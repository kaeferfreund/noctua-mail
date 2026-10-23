import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTempDir } from "../testAuthHarness";

const execFileAsync = promisify(execFile);

async function runContentionProbe(mode: "read" | "create") {
  const temp = createTempDir("noctua-collab-connections-");
  try {
    // Isolate the real connection singleton graph from other DB tests. Force
    // zero busy timeout so a held writer fails immediately instead of blocking
    // the event loop that must release it after the first retry.
    return await execFileAsync(process.execPath, ["--eval", `
      import assert from "node:assert/strict";
      import { Database } from "bun:sqlite";
      import { createV2FtsShard } from "./lib/testFixtures/v2FtsShard.ts";
      import { closeAllDbConnections, configureDb, getAccountDb } from "./lib/db/connection.ts";
      const exec = Database.prototype.exec;
      Database.prototype.exec = function(sql) {
        return exec.call(this, /^PRAGMA busy_timeout = /.test(sql) ? "PRAGMA busy_timeout=0" : sql);
      };
      const accountId = "synthetic-collab-account";
      const initialized = await getAccountDb(accountId);
      const dbPath = initialized.prepare("PRAGMA database_list").get().file;
      closeAllDbConnections();
      const writer = new Database(dbPath);
      configureDb(writer, 0);
      const creating = process.env.COLLAB_PROBE === "create";
      if (creating) {
        // Missing collaboration tables model an older shard. A declared v3
        // shard must have the complete guard set and is explicitly rejected.
        createV2FtsShard(writer);
        for (const table of ["thread_collab_state", "thread_comments", "thread_activity", "sent_by"])
          writer.exec("DROP TABLE " + table);
      }
      let retries = 0;
      const warn = console.warn;
      console.warn = (message, details) => {
        warn(message, details);
        if (message === "[db-write-retry] retry" && details.operation === "initAccountSchema") {
          retries++;
          assert.equal(writer.inTransaction, true);
          writer.exec("COMMIT");
        }
      };
      writer.exec("BEGIN IMMEDIATE");
      try {
        const reader = await getAccountDb(accountId);
        assert.equal(reader.prepare("PRAGMA busy_timeout").get().timeout, 0);
        assert.equal(reader.prepare("SELECT COUNT(*) AS n FROM thread_collab_state").get().n, 0);
        assert.equal(reader.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name LIKE 'idx_thread_%'").get().n >= 4, true);
        assert.equal(retries, creating ? 1 : 0);
        assert.equal(writer.inTransaction, !creating);
        console.log("collab-" + process.env.COLLAB_PROBE + "-ok");
      } finally {
        if (writer.inTransaction) writer.exec("ROLLBACK");
        writer.close();
        closeAllDbConnections();
      }
    `], {
      cwd: process.cwd(),
      env: { ...process.env, NOCTUA_DATA_DIR: temp.dir, ACCOUNT_DB_IDLE_MS: "0", COLLAB_PROBE: mode },
      timeout: 10000
    });
  } finally {
    temp.cleanup();
  }
}

test("cold shard reader succeeds under a held writer lock without schema writes", async () => {
  const { stdout, stderr } = await runContentionProbe("read");
  expect(stdout).toContain("collab-read-ok");
  expect(stderr).not.toContain("[db-write-retry]");
});

test("v2 collaboration schema creation retries contention at the async connection boundary", async () => {
  const { stdout, stderr } = await runContentionProbe("create");
  expect(stdout).toContain("collab-create-ok");
  expect(stderr).toContain("[db-write-retry] retry");
});
