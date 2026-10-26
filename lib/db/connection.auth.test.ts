import { expect, test } from "bun:test";
import { execFile } from "child_process";
import { promisify } from "util";
import { createTestAuthHarness, createTempDir, TEST_BASE_URL, TEST_SECRET } from "../testAuthHarness";
import { withDbWriteRetry } from "../dbWriteRetry";
import { setActiveAccountId } from "../betterAuth";

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
      // A cold module graph must yield/retry while another process/handle owns
      // the master writer lock; concurrent callers cannot observe partial init.
      const cold = await import("./lib/db/connection.ts?watcher-startup-contention");
      authDb.exec("BEGIN IMMEDIATE");
      let coldResolved = false;
      const firstCold = cold.getDb().then(db => { coldResolved = true; return db; });
      const secondCold = cold.getDb();
      await new Promise(resolve => setTimeout(resolve, 40));
      assert.equal(coldResolved, false);
      authDb.exec("ROLLBACK");
      assert.equal(await firstCold, await secondCold);
      cold.closeAllDbConnections();
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

async function checkShardConfiguration(cacheOverride: string, expectedCacheKib: number) {
  const temp = createTempDir("noctua-shard-performance-");
  try {
    // A separate process exercises the real singleton/init path without changing
    // the shared DB harness environment or closing other tests' connections.
    const { stdout } = await execFileAsync("nice", ["-n", "10", process.execPath, "--eval", `
      import assert from "node:assert/strict";
      import { closeAllDbConnections, getDb, getAuthDb, getAccountDb } from "./lib/db/connection.ts";

      const masterDefaults = {
        journal_mode: "wal", synchronous: 2, busy_timeout: 0, foreign_keys: 1,
        cache_size: -2000, temp_store: 0, mmap_size: 0,
        wal_autocheckpoint: 1000, journal_size_limit: -1
      };
      function pragmas(db) {
        return Object.fromEntries(Object.keys(masterDefaults).map(name => [
          name, Object.values(db.prepare("PRAGMA " + name).get())[0]
        ]));
      }
      const indexNames = [
        "idx_messages_account_folder_messageid",
        "idx_messages_account_msgid_date",
        "idx_messages_account_folder_unread"
      ];
      function assertIndexes(db) {
        const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'messages'").all();
        for (const name of indexNames) assert.ok(indexes.some(index => index.name === name), name);
      }
      try {
        const master = await getDb();
        const auth = await getAuthDb();
        assert.deepEqual(pragmas(master), masterDefaults);
        assert.deepEqual(pragmas(auth), masterDefaults);
        const { persistAccountRow } = await import("./lib/db/rowParsers.ts");
        persistAccountRow(master, { id: "synthetic-performance-account", name: "Synthetic performance mailbox", email: "performance@example.test", avatar: "",
          imap: { host: "imap.example.test", port: 993, secure: true, user: "performance@example.test", password: "synthetic" },
          smtp: { host: "smtp.example.test", port: 465, secure: true, user: "performance@example.test", password: "synthetic" } });
        const shard = await getAccountDb("synthetic-performance-account");
        const shardDefaults = {
          ...masterDefaults, synchronous: 1, busy_timeout: 15000,
          cache_size: -Number(process.env.EXPECTED_CACHE_KIB), temp_store: 2,
          mmap_size: 134217728, wal_autocheckpoint: 4000, journal_size_limit: 67108864
        };
        assert.deepEqual(pragmas(shard), shardDefaults);
        assertIndexes(shard);
        assert.deepEqual(pragmas(master), masterDefaults);
        assert.deepEqual(pragmas(auth), masterDefaults);
        assert.equal(shard.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'sqlite_stat1'").get().n, 0);

        // Simulate an existing shard missing these additive indexes, then use
        // the real reopen path to check migration and connection-local pragmas.
        for (const name of indexNames) shard.exec("DROP INDEX " + name);
        closeAllDbConnections();
        const reopened = await getAccountDb("synthetic-performance-account");
        assertIndexes(reopened);
        assert.deepEqual(pragmas(reopened), shardDefaults);
        assert.equal(await getAccountDb("synthetic-performance-account"), reopened);
        assert.deepEqual(pragmas(await getDb()), masterDefaults);
        assert.deepEqual(pragmas(await getAuthDb()), masterDefaults);
        console.log("shard-performance-ok");
      } finally {
        closeAllDbConnections();
      }
    `], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NOCTUA_DATA_DIR: temp.dir,
        ACCOUNT_DB_IDLE_MS: "0",
        ACCOUNT_DB_CACHE_KIB: cacheOverride,
        EXPECTED_CACHE_KIB: String(expectedCacheKib)
      },
      timeout: 10000
    });
    expect(stdout).toContain("shard-performance-ok");
  } finally {
    temp.cleanup();
  }
}

test("real shard init adds performance indexes and pragmas while preserving master defaults", async () => {
  await checkShardConfiguration("", 32768);
});

test.each([
  ["65536", 65536],
  ["1999", 32768],
  ["invalid", 32768]
] as const)("shard cache override %s resolves to %i KiB", async (raw: string, expected: number) => {
  await checkShardConfiguration(raw, expected);
});


test("active mailbox updates yield to the master writer and never restore a concurrently revoked session", async () => {
  const f = await createTestAuthHarness();
  let locked = false;
  let release: ReturnType<typeof setTimeout> | undefined;
  try {
    const user = await f.createUser("mailbox-contention@example.test");
    const { session, jar } = await f.signIn(user.email);
    if (!session) throw new Error("Synthetic session missing");
    const holdWriter = (revoke: boolean) => {
      f.master.exec("BEGIN IMMEDIATE");
      locked = true;
      release = setTimeout(() => {
        if (revoke) f.master.prepare("DELETE FROM auth_session WHERE token=?").run(session.session.token);
        f.master.exec("COMMIT");
        locked = false;
      }, 25);
    };
    holdWriter(false);
    const updated = await setActiveAccountId(f.auth, session.session.token, "synthetic-mailbox");
    expect(updated).toMatchObject({ activeAccountId: "synthetic-mailbox" });
    expect((await f.auth.api.getSession({ headers: jar.headers() }))?.session.activeAccountId).toBe("synthetic-mailbox");
    holdWriter(true);
    expect(await setActiveAccountId(f.auth, session.session.token, "another-synthetic-mailbox")).toBeNull();
    expect(f.master.prepare("SELECT id FROM auth_session WHERE token=?").get(session.session.token)).toBeNull();
    expect(await f.auth.api.getSession({ headers: jar.headers() })).toBeNull();
    expect(f.master.prepare("PRAGMA busy_timeout").get().timeout).toBe(0);
    expect(f.database.prepare("PRAGMA busy_timeout").get().timeout).toBe(0);
  } finally {
    if (release) clearTimeout(release);
    if (locked) f.master.exec("ROLLBACK");
    f.close();
  }
});
