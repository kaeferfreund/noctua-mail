import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeOutreachDb, getOutreachDb } from "../db";
import { prepareTrackedHtml } from "./index";

const accountId = "mailbox-rewrite";
const origin = "https://links.example.test";
const envKeys = ["NOCTUA_DATA_DIR", "NOCTUA_OUTREACH_PUBLIC_URL"] as const;
let env: Array<string | undefined>;
let dir: string;

beforeEach(() => {
  env = envKeys.map(key => process.env[key]);
  dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "outreach-rewrite-"));
  process.env.NOCTUA_DATA_DIR = dir;
  process.env.NOCTUA_OUTREACH_PUBLIC_URL = origin;
});
afterEach(() => {
  closeOutreachDb();
  for (const [i, key] of envKeys.entries()) {
    if (env[i] === undefined) delete process.env[key];
    else process.env[key] = env[i];
  }
  rmSync(dir, { recursive: true, force: true });
});

async function seedSend(id: string) {
  const db = await getOutreachDb();
  db.prepare("INSERT INTO contacts (id, accountId, email, emailLower, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 0)")
    .run(`contact-${id}`, accountId, `${id}@example.test`, `${id}@example.test`);
  db.prepare(`INSERT INTO sends (id, accountId, kind, contactId, recipients, subject, status, queuedAt)
    VALUES (?, ?, 'campaign', ?, 'recipient@example.test', 'Synthetic mail', 'sending', 0)`).run(id, accountId, `contact-${id}`);
  return db;
}

const tokens = (html: string) => [...html.matchAll(/\/t\/([co])\/([\w-]+)/g)].map(match => `${match[1]}:${match[2].replace(/\.gif$/, "")}`);

test("AG: only the addon's own /t/ links are exempt from click tracking", async () => {
  await seedSend("send-ag");
  const html = await prepareTrackedHtml({ accountId, sendId: "send-ag", trackOpens: false, trackClicks: true,
    html: `<a href="https://forum.example.test/t/topic/1">Forum</a><a href="${origin}/t/c/existing">Own</a>` });
  expect(html).not.toContain("https://forum.example.test/t/topic/1");
  expect(html).toContain(`href="${origin}/t/c/existing"`);
  const db = await getOutreachDb();
  expect(db.prepare("SELECT url FROM tracking_links WHERE accountId = ? AND sendId = 'send-ag'").all(accountId))
    .toEqual([{ url: "https://forum.example.test/t/topic/1" }]);
});

test("AH: a retry of the same send reuses its open token and the click token of each target", async () => {
  const db = await seedSend("send-ah");
  await seedSend("send-other");
  const input = { accountId, sendId: "send-ah", trackOpens: true, trackClicks: true, contactId: "contact-send-ah",
    html: `<a href="https://target.example.test/a">A</a><a href="https://target.example.test/b">B</a>` };
  const first = tokens(await prepareTrackedHtml(input));
  expect(first).toHaveLength(3);
  expect(tokens(await prepareTrackedHtml(input))).toEqual(first);
  // A changed body on retry keeps the tokens of the targets it still has and adds the new one.
  const changed = tokens(await prepareTrackedHtml({ ...input, html: `<a href="https://target.example.test/b">B</a><a href="https://target.example.test/c">C</a>` }));
  expect(changed[0]).toBe(first[1]);
  expect(first).not.toContain(changed[1]);
  expect(changed[2]).toBe(first[2]);
  expect(db.prepare("SELECT count(*) AS n FROM tracking_links WHERE accountId = ? AND sendId = 'send-ah'").get(accountId)).toEqual({ n: 4 });
  // Another send never shares a token.
  const other = tokens(await prepareTrackedHtml({ ...input, sendId: "send-other", contactId: "contact-send-other" }));
  expect(other.some(token => first.includes(token))).toBe(false);
});
