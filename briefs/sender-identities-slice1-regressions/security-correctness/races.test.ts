import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
const root = process.env.REVIEW_CHECKOUT ?? "/home/monkey/code/noctua-mail/wt-review-collab";
const { createTestAuthHarness, openMasterDb } = await import(`${root}/lib/testAuthHarness.ts`);
const { identityTestAccount } = await import(`${root}/lib/testFixtures/senderIdentities.ts`);
const { persistAccountRow } = await import(`${root}/lib/db/rowParsers.ts`);
const worker = path.join(import.meta.dir, "race-worker.ts");
async function race(mode: string, dbPath: string, arg1 = "", emails = ["", ""], userId = "") {
  const dir = mkdtempSync(path.join(tmpdir(), "review-race-")); const latch = path.join(dir, "go");
  const processes = emails.map(email => Bun.spawn(["nice", "-n", "10", "bun", "run", worker, mode, dbPath, arg1, email, latch], { env: { ...process.env, REVIEW_USER_ID: userId }, stdout: "pipe", stderr: "pipe" }));
  try {
    const outputs = processes.map(async process => {
      const reader = process.stdout.getReader(); let output = ""; let ready!: () => void;
      const readyPromise = new Promise<void>(resolve => { ready = resolve; });
      const done = (async () => { while (true) { const item = await reader.read(); if (item.done) break; output += new TextDecoder().decode(item.value); if (output.includes("READY")) ready(); } const code = await process.exited; const stderr = await new Response(process.stderr).text(); if (code !== 0) throw new Error(`worker ${code}: ${stderr}`); return JSON.parse(output.split("RESULT ")[1].split("\n")[0]); })();
      return { readyPromise, done };
    });
    const prepared = await Promise.all(outputs); await Promise.all(prepared.map(p => p.readyPromise)); writeFileSync(latch, "go");
    return await Promise.all(prepared.map(p => p.done));
  } finally { for (const child of processes) { if (child.exitCode === null) child.kill(); await child.exited; } rmSync(dir, { recursive: true, force: true }); }
}
test("C7 two independent processes concurrently migrate a legacy master and seed exactly once; reopening preserves seed", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "review-legacy-")); const dbPath = path.join(dir, "main.db");
  let database = openMasterDb(dbPath);
  try {
    persistAccountRow(database, identityTestAccount("legacy")); database.exec("DROP TABLE sender_identities"); database.close();
    const results = await race("master", dbPath);
    expect(results[0]).toEqual(results[1]); expect(results[0]).toHaveLength(1);
    database = openMasterDb(dbPath); expect(database.prepare("SELECT id,email FROM sender_identities WHERE accountId='legacy'").all()).toEqual(results[0]);
    const id = results[0][0].id;
    database.prepare("UPDATE sender_identities SET displayName='Manager label' WHERE id=?").run(id);
    persistAccountRow(database, { ...identityTestAccount("legacy"), email: "edited@example.test", name: "Sidebar label" });
    expect(database.prepare("SELECT id,email,displayName FROM sender_identities WHERE accountId='legacy'").get()).toEqual({ id, email: "primary@example.test", displayName: "Manager label" });
  } finally { database.close(); rmSync(dir, { recursive: true, force: true }); }
});
test("C8 two independent processes concurrently add legacy shard metadata columns without losing rows", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "review-legacy-shard-")); const dbPath = path.join(dir, "shard.db");
  const database = new Database(dbPath); database.exec("CREATE TABLE messages(id TEXT PRIMARY KEY, accountId TEXT); INSERT INTO messages VALUES('old','legacy')"); database.close();
  try { const results = await race("shard", dbPath); expect(results).toEqual([{ deliveredTo: null, originalTo: null, senderIdentityId: null }, { deliveredTo: null, originalTo: null, senderIdentityId: null }]); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
test("C9 concurrent normalized duplicate creates return 201/409 with one identity and one audit", async () => {
  const auth = await createTestAuthHarness();
  try {
    const user = await auth.createUser(`race-${crypto.randomUUID()}@example.test`);
    persistAccountRow(auth.master, identityTestAccount("a", user.id));
    const results = await race("create", auth.temp.dbPath, "a", [" Alias@EXAMPLE.test ", "alias@example.test"], user.id);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(auth.master.prepare("SELECT COUNT(*) n FROM sender_identities WHERE accountId='a' AND email='alias@example.test'").get()).toEqual({ n: 1 });
    expect(auth.master.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='identity.create'").get()).toEqual({ n: 1 });
  } finally { auth.close(); }
});
