import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initOutreachSchema } from "../db";
import { renderContent, sampleContact } from "../sending/render";
import { OUTREACH_IMAGE_MAX_BYTES } from "../types";
import { decodeImageBase64, listOutreachImages, prepareImage, saveOutreachImage } from "./index";

let db: Database;
beforeEach(() => { db = initOutreachSchema(new Database(":memory:")); });
afterEach(() => { db.close(); });

const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");

test("storage deduplicates concurrent uploads across mailboxes and retains the first upload metadata", async () => {
  const dir = mkdtempSync(join(tmpdir(), "outreach-images-"));
  try {
    const a = prepareImage(gif, "foo.gif");
    const b = prepareImage(gif, "folder/bar.GIF");
    const [first, second] = await Promise.all([
      saveOutreachImage(db, "a", a, "user-a", dir), saveOutreachImage(db, "b", b, "user-b", dir)
    ]);
    const duplicate = await saveOutreachImage(db, "a", b, "user-b", dir);
    expect(duplicate).toEqual({ ...first, created: false });
    expect(second.image).toMatchObject({ url: first.image.url, accountId: "b", filename: "bar.GIF", width: 1, height: 1 });
    expect(listOutreachImages(db, "a")).toEqual([first.image]);
    expect(listOutreachImages(db, "b")).toEqual([second.image]);
    expect(listOutreachImages(db, "unknown")).toEqual([]);
    expect(db.query("SELECT createdByUserId FROM images WHERE accountId = 'a'").get()).toEqual({ createdByUserId: "user-a" });
    expect(readdirSync(dir)).toEqual([first.image.url.split("/").pop()!]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("v4 upgrades add only image storage, preserving existing template data", () => {
  db.exec("DROP TABLE images; PRAGMA user_version = 4");
  db.query("INSERT INTO templates (id, accountId, name, createdAt, updatedAt) VALUES ('template', 'a', 'Test', 1, 1)").run();
  initOutreachSchema(db);
  expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: 5 });
  expect(db.query("SELECT name FROM templates WHERE accountId = 'a'").get()).toEqual({ name: "Test" });
  expect(listOutreachImages(db, "a")).toEqual([]);
});

test("type is detected from bytes; only matching filename suffixes and bounded, valid base64 are accepted", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d494844520000000300000002", "hex");
  const jpeg = Buffer.from("ffd8ffc00008080002000303", "hex");
  const webp = Buffer.from("524946461600000057454250565038580a00000000000000020000010000", "hex");
  for (const [bytes, name, contentType] of [[png, "x.png", "image/png"], [jpeg, "x.jpeg", "image/jpeg"], [webp, "x", "image/webp"]] as const) {
    expect(prepareImage(bytes, name)).toMatchObject({ contentType, width: 3, height: 2 });
  }
  expect(() => prepareImage(gif, "photo.png")).toThrow("extension");
  expect(() => prepareImage(Buffer.from("<svg/>"), "photo.png")).toThrow("Use PNG");
  expect(() => prepareImage(new Uint8Array(OUTREACH_IMAGE_MAX_BYTES + 1), "photo.png")).toThrow("5 MiB");
  expect(decodeImageBase64(gif.toString("base64"))).toEqual(gif);
  expect(() => decodeImageBase64("a !!")).toThrow("Invalid base64");
  expect(() => decodeImageBase64(Buffer.alloc(OUTREACH_IMAGE_MAX_BYTES + 1).toString("base64"))).toThrow("5 MiB");
});

test("mail rendering makes only canonical hosted img src paths absolute", () => {
  const previous = process.env.NOCTUA_OUTREACH_PUBLIC_URL;
  process.env.NOCTUA_OUTREACH_PUBLIC_URL = "https://links.example.test/a";
  try {
    const local = `/t/m/${"a".repeat(64)}.jpg`;
    const html = `<img src="${local}" srcset="${local} 2x"><img src="/t/m/invalid.jpg"><img src="https://other.example.test/a.png"><a href="${local}">Link</a>`;
    const output = renderContent({ subject: "Test", html, text: "" }, {
      contact: sampleContact, organizationName: "", organizationAddress: "", unsubscribeUrl: "", now: 0
    });
    expect(output.html).toBe(html.replace(`src="${local}"`, `src="https://links.example.test${local}"`));
  } finally {
    if (previous === undefined) delete process.env.NOCTUA_OUTREACH_PUBLIC_URL;
    else process.env.NOCTUA_OUTREACH_PUBLIC_URL = previous;
  }
});
