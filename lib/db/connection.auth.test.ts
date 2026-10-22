import { expect, test } from "bun:test";
import { execFile } from "child_process";
import { promisify } from "util";
import { createTestAuthHarness, createTempDir, TEST_BASE_URL, TEST_SECRET } from "../testAuthHarness";
import { withDbWriteRetry } from "../dbWriteRetry";

const execFileAsync = promisify(execFile);

test("shared handle negative control: foreign write rolls back with the adapter", async () => {
  const f = await createTestAuthHarness();
  try {
    const context = await f.auth.$context;
    await expect(context.adapter.transaction(async trx => {
      await trx.create({ model: "verification", data: { identifier: "negative-control", value: "x", expiresAt: new Date(Date.now()+60000) } });
      await Promise.resolve();
      // Deliberately WRONG handle, retained as a regression negative control.
      f.database.prepare(`INSERT INTO invite_codes(code,role,createdAt) VALUES('wrong-handle','user',1)`).run();
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    expect(f.master.prepare(`SELECT code FROM invite_codes WHERE code='wrong-handle'`).get()).toBeNull();
  } finally { f.close(); }
});

test("dedicated handle retries yield; unrelated Noctua writes survive auth rollback", async () => {
  const f = await createTestAuthHarness();
  try {
    const context = await f.auth.$context;
    let write: Promise<unknown> | undefined;
    let attempts = 0;
    await expect(context.adapter.transaction(async trx => {
      await trx.create({ model: "verification", data: { identifier: "positive-control", value: "x", expiresAt: new Date(Date.now()+60000) } });
      write = withDbWriteRetry("isolated-write", () => {
        attempts++;
        f.master.prepare(`INSERT INTO invite_codes(code,role,createdAt) VALUES('right-handle','user',1)`).run();
      }, { baseDelayMs: 20, maxDelayMs: 20 });
      await new Promise(resolve => setTimeout(resolve, 0));
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    await write;
    expect(attempts).toBeGreaterThan(1);
    expect(f.master.prepare(`SELECT code FROM invite_codes WHERE code='right-handle'`).get()).not.toBeNull();
    expect(f.master.prepare(`SELECT id FROM auth_verification WHERE identifier='positive-control'`).get()).toBeNull();
  } finally { f.close(); }
});

test("production handles: blank dbPath contention, concurrent path wins, shard timeout and safe reopen", async () => {
  // Separate process uses the real singleton graph without closing other tests'
  // shared testDbHarness connections or changing their process environment.
  const temp = createTempDir("noctua-auth-connections-");
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, ["--eval", `
      import assert from "node:assert/strict";
      import path from "node:path";
      import { getAuth } from "./lib/betterAuth.ts";
      import { closeAllDbConnections, getDb, getAuthDb, getAccountDb } from "./lib/db/connection.ts";
      const instance = await getAuth();
      assert.equal(instance, await getAuth());
      const [master, authDb] = await Promise.all([getDb(),getAuthDb()]);
      assert.notEqual(master,authDb);
      for(const db of [master,authDb]) {
        assert.equal(db.prepare("PRAGMA busy_timeout").get().timeout,0);
        assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys,1);
        assert.equal(db.prepare("PRAGMA journal_mode").get().journal_mode,"wal");
      }
      const insert = master.prepare(
        "INSERT INTO accounts(id,name,email,avatar,dbPath,imapHost,imapPort,imapSecure,imapUser,imapPassword,smtpHost,smtpPort,smtpSecure,smtpUser,smtpPassword) VALUES(?,?,?,'','',?,993,1,?,'',?,465,1,?,'')"
      );
      for(const id of ["blank","winner"]) insert.run(id,id,id+"@example.test","imap.example.test",id+"@example.test","smtp.example.test",id+"@example.test");
      const context = await instance.$context;
      for(const id of ["blank","winner"]) {
        let shard;
        await context.adapter.transaction(async trx => {
          await trx.create({ model:"verification", data:{identifier:"held-"+id,value:"x",expiresAt:new Date(Date.now()+60000)} });
          shard = getAccountDb(id);
          await new Promise(resolve => setTimeout(resolve,30));
          if(id==="winner") authDb.prepare("UPDATE accounts SET dbPath=? WHERE id=?").run(path.join(process.env.NOCTUA_DATA_DIR,"concurrent-winner.db"),id);
        });
        const opened = await shard;
        assert.equal(opened.prepare("PRAGMA busy_timeout").get().timeout,15000);
        const selected = master.prepare("SELECT dbPath FROM accounts WHERE id=?").get(id).dbPath;
        const actual = opened.prepare("PRAGMA database_list").get().file;
        assert.equal(actual,selected);
        if(id==="winner") assert.equal(selected,path.join(process.env.NOCTUA_DATA_DIR,"concurrent-winner.db"));
      }
      await instance.api.getSession({headers:new Headers()});
      closeAllDbConnections();
      const reopened = await getAuth();
      assert.notEqual(reopened,instance);
      assert.notEqual(await getAuthDb(),authDb);
      assert.equal(await reopened.api.getSession({headers:new Headers()}),null);
      closeAllDbConnections();
      console.log("connection-acceptance-ok");
    `], { cwd: process.cwd(), env: { ...process.env, NOCTUA_DATA_DIR: temp.dir, ACCOUNT_DB_IDLE_MS: "0",
      BETTER_AUTH_SECRET: TEST_SECRET, BETTER_AUTH_URL: TEST_BASE_URL, PASSKEY_RP_ID: "localhost",
      NOCTUA_DESKTOP_MODE: "false", IMAP_CREDENTIALS_STORAGE: "db", BETTER_AUTH_TELEMETRY: "0", BETTER_AUTH_TELEMETRY_ENDPOINT: "", NOCTUA_TRUSTED_ORIGINS: "" }, timeout: 20000 });
    expect(stdout).toContain("connection-acceptance-ok");
    expect(stderr).toContain("[db-write-retry] retry");
  } finally { temp.cleanup(); }
});
