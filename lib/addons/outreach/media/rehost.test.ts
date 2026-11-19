import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rehostImages } from "@/scripts/outreach-rehost-images";
import { initOutreachSchema } from "../db";
import { OUTREACH_IMAGE_MAX_BYTES } from "../types";
import { listOutreachImages } from "./index";

let db: Database;
beforeEach(() => { db = initOutreachSchema(new Database(":memory:")); });
afterEach(() => { db.close(); });

const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");
const asset = "https://cdn.example.test/logo.gif?a=1&b=2";
const image = '<IMG width="1" SRC="https://cdn.example.test/logo.gif?a=1&amp;b=2">';
const badge = '<a href="//badge.example.test/p"><b>badge</b><img src="https://cdn.example.test/badge.gif"></a>';
const other = '<img src="https://fake.cdn.example.test/p.gif"><!--<img src="https://cdn.example.test/comment.gif">-->';
const original = `<!DoCtYpE html><html><body>{{first_name|default:"Alex"}}${image}${image}${badge}${other}</body></html>`;

function insertTemplate(db: Database, id: string, html: string, accountId = "a") {
  db.query("INSERT INTO templates (id, accountId, name, html, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, 1)")
    .run(id, accountId, id, html);
}

test("dry run and write share URL filtering and deduplication, preserving unrelated HTML", async () => {
  insertTemplate(db, "template", original);
  insertTemplate(db, "other", original, "b");
  db.query(`INSERT INTO campaigns (id, accountId, name, html, status, createdAt, updatedAt)
    VALUES ('draft', 'a', 'draft', ?, 'draft', 1, 1), ('sent', 'a', 'sent', ?, 'sent', 1, 1)`).run(image, image);
  db.query("INSERT INTO sequences (id, accountId, name, status, createdAt, updatedAt) VALUES ('sequence', 'a', 'sequence', 'live', 1, 1)").run();
  db.query(`INSERT INTO sequence_steps (id, sequenceId, accountId, name, position, html)
    VALUES ('step', 'sequence', 'a', 'step', 0, ?), ('step2', 'sequence', 'a', 'step2', 1, ?)`).run(image, image);
  const scratch = mkdtempSync(join(tmpdir(), "outreach-rehost-"));
  try {
    const directory = join(scratch, "media");
    const calls: string[] = [];
    const options = {
      accountId: "a", hosts: ["CDN.example.test", "files.example.test"], dropLinksTo: ["badge.example.test"], directory,
      fetchImage: async (url: URL, init: RequestInit) => {
        calls.push(url.href);
        expect(init.redirect).toBe("manual");
        if (url.href === asset) return new Response(null, { status: 302, headers: { location: "https://files.example.test/logo.gif" } });
        expect(url.href).toBe("https://files.example.test/logo.gif");
        return new Response(gif, { headers: { "content-type": "text/plain" } });
      }
    };
    const dry = await rehostImages(db, options);
    expect(dry.failures).toEqual([]);
    expect(dry.summary).toHaveLength(4);
    expect(dry.summary.find(row => row.id === "template")).toMatchObject({ references: 2, images: 1, links: 1 });
    expect(listOutreachImages(db, "a")).toEqual([]);
    expect(existsSync(directory)).toBe(false);
    expect(db.query("SELECT html FROM templates WHERE accountId = 'a'").get()).toEqual({ html: original });
    expect(calls).toEqual([asset, "https://files.example.test/logo.gif"]);

    expect(await rehostImages(db, { ...options, write: true })).toEqual(dry);
    expect(calls).toHaveLength(4);
    const [{ url }] = listOutreachImages(db, "a");
    expect(listOutreachImages(db, "b")).toEqual([]);
    const expectedImage = `<IMG width="1" src="${url}">`;
    expect(db.query("SELECT html FROM templates WHERE accountId = 'a'").get()).toEqual({
      html: original.replaceAll(image, expectedImage).replace(badge, "")
    });
    expect(db.query("SELECT html FROM templates WHERE accountId = 'b'").get()).toEqual({ html: original });
    expect(db.query("SELECT html FROM campaigns WHERE accountId = 'a' AND id = 'sent'").get()).toEqual({ html: image });
    expect(db.query("SELECT html FROM campaigns WHERE accountId = 'a' AND id = 'draft'").get()).toEqual({ html: expectedImage });
    expect(db.query("SELECT html FROM sequence_steps WHERE accountId = 'a'").all()).toEqual([{ html: expectedImage }, { html: expectedImage }]);
    expect((await rehostImages(db, { ...options, write: true })).summary.every(row => !row.references && !row.links)).toBe(true);
    expect(calls).toHaveLength(4);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("only unambiguous badge links are removed and dry run reports the same skips as write", async () => {
  const link = '<a href="https://badge.example.test">';
  const footer = '<footer><span>Footer</span>' + link + 'Badge</a></footer>';
  const nested = '<table><tr><td><table><tr><td>' + link + 'Badge</a></td></tr></table></td></tr></table>';
  const cases = [
    { id: "table-foster", html: `<table>${link}Badge<tr><td>Tabelleninhalt</td></tr>Badge-Fortsetzung</a></table>` },
    { id: "split", html: `<p>${link}<b>Badge</a>Rest</b></p>` },
    { id: "pre", html: `<pre>${link}Badge</a>
Rest</pre>` },
    { id: "document-boundary", html: `${link}Badge</a><!doctype html><p>Rest</p>` },
    { id: "unclosed", html: `<p>${link}Badge</p>` },
    { id: "footer", html: footer, expected: footer.replace(link + "Badge</a>", "") },
    { id: "nested", html: nested, expected: nested.replace(link + "Badge</a>", "") }
  ];
  for (const { id, html } of cases) insertTemplate(db, id, html);
  const options = {
    accountId: "a", hosts: ["cdn.example.test"], dropLinksTo: ["badge.example.test"],
    fetchImage: async (url: URL) => { throw new Error(`Unexpected image download: ${url.pathname}`); }
  };
  const dry = await rehostImages(db, options);
  const write = await rehostImages(db, { ...options, write: true });
  expect(write).toEqual(dry);
  for (const { id, html, expected } of cases) {
    expect(write.summary.find(row => row.id === id)).toMatchObject({
      links: expected === undefined ? 0 : 1, skippedAmbiguous: expected === undefined ? 1 : 0
    });
    expect(db.query("SELECT html FROM templates WHERE accountId = 'a' AND id = ?").get(id)).toEqual({ html: expected ?? html });
  }
});

test("rehosting adds or replaces the suffix with the detected canonical extension", async () => {
  const url = "https://cdn.example.test/picture.php?format=gif";
  const noSuffix = "https://cdn.example.test/other";
  const html = `<table><img src="${url}" srcset="${url} 2x"><tr><td><img src="${noSuffix}"></td></tr></table>`;
  insertTemplate(db, "template", html);
  const directory = mkdtempSync(join(tmpdir(), "outreach-rehost-"));
  try {
    const otherGif = Buffer.from(gif);
    otherGif[4] = 0x37; // GIF87a, so it occupies its own library entry.
    const options = {
      accountId: "a", hosts: ["cdn.example.test"], directory,
      fetchImage: async (source: URL) => new Response(source.href === url ? gif : otherGif)
    };
    const dry = await rehostImages(db, options);
    expect(dry.failures).toEqual([]);
    expect(dry.summary[0]).toMatchObject({ references: 2, images: 2 });
    expect(await rehostImages(db, { ...options, write: true })).toEqual(dry);
    const images = listOutreachImages(db, "a");
    expect(images.map(item => item.filename).sort()).toEqual(["other.gif", "picture.gif"]);
    expect(db.query("SELECT html FROM templates WHERE accountId = 'a' AND id = 'template'").get()).toEqual({
      html: html.replace(`src="${url}"`, `src="${images.find(item => item.filename === "picture.gif")!.url}"`)
        .replace(`src="${noSuffix}"`, `src="${images.find(item => item.filename === "other.gif")!.url}"`)
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("only allowed HTTPS destinations are fetched; declared and streamed limits and image types are enforced", async () => {
  const allowed = "https://cdn.example.test";
  const sources = [
    "http://cdn.example.test/plain.gif", "https://cdn.example.test:8443/port.gif", "https://user@cdn.example.test/credentials.gif",
    `${allowed}/redirect.gif`, `${allowed}/declared.gif`, `${allowed}/streamed.gif`, `${allowed}/invalid.gif`
  ];
  const html = sources.map(src => `<img src="${src}">`).join("");
  insertTemplate(db, "failures", html);
  const requests: string[] = [];
  const report = await rehostImages(db, {
    accountId: "a", hosts: ["cdn.example.test"],
    fetchImage: async url => {
      requests.push(url.href);
      if (url.pathname === "/redirect.gif") return new Response(null, { status: 302, headers: { location: "https://outside.example.test/" } });
      if (url.pathname === "/declared.gif") return new Response(gif, { headers: { "content-length": String(OUTREACH_IMAGE_MAX_BYTES + 1) } });
      if (url.pathname === "/streamed.gif") return new Response(new Uint8Array(OUTREACH_IMAGE_MAX_BYTES + 1));
      return new Response("GIF89a");
    }
  });
  expect(requests).toEqual(sources.slice(3));
  expect(report.failures.map(failure => failure.url)).toEqual(sources);
  expect(report.failures.map(failure => failure.reason)).toEqual([
    ...Array(4).fill("Requires HTTPS on an allowed host, without credentials or a custom port."),
    "Image exceeds the 5 MiB limit.", "Image exceeds the 5 MiB limit.", "Use PNG, JPEG, GIF or WebP."
  ]);
  expect(report.summary[0]).toMatchObject({ references: 0, images: 0 });
});

test("a write records conflicts and does not overwrite a concurrent edit or scheduled campaign", async () => {
  insertTemplate(db, "template", image);
  db.query("INSERT INTO campaigns (id, accountId, name, html, createdAt, updatedAt) VALUES ('draft', 'a', 'draft', ?, 1, 1)").run(image);
  const directory = mkdtempSync(join(tmpdir(), "outreach-rehost-"));
  try {
    const { conflicts } = await rehostImages(db, {
      accountId: "a", hosts: ["cdn.example.test"], directory, write: true,
      fetchImage: async () => {
        db.query("UPDATE templates SET html = 'edited' WHERE accountId = 'a'").run();
        db.query("UPDATE campaigns SET status = 'scheduled' WHERE accountId = 'a'").run();
        return new Response(gif);
      }
    });
    expect(conflicts.map(row => row.id)).toEqual(["draft", "template"]);
    expect(db.query("SELECT html FROM templates WHERE accountId = 'a'").get()).toEqual({ html: "edited" });
    expect(db.query("SELECT html, status FROM campaigns WHERE accountId = 'a'").get()).toEqual({ html: image, status: "scheduled" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
