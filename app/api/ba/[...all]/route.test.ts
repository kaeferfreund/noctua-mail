import { expect, test } from "bun:test";
import { execFile } from "child_process";
import { promisify } from "util";
import { createTempDir, TEST_BASE_URL, TEST_SECRET } from "@/lib/testAuthHarness";

const run = promisify(execFile);

test("mounted auth surface stays 503 for every method and graph startup is idempotent", async () => {
  const temp = createTempDir("noctua-ba-route-");
  try {
    const script = `
      import assert from "node:assert/strict";
      import * as route from "./app/api/ba/[...all]/route.ts";
      import { getAuth, migrateAuthSchema } from "./lib/betterAuth.ts";
      import { closeAllDbConnections } from "./lib/db/connection.ts";
      for(const method of ["GET","POST","PATCH","PUT","DELETE"]) {
        const response = await route[method]();
        assert.equal(response.status,503);
        assert.deepEqual(await response.json(),{code:"auth_integration_pending"});
        assert.equal(response.headers.get("set-cookie"),null);
      }
      const auth = await getAuth();
      assert.deepEqual(await migrateAuthSchema(auth.options),{createdTables:[],addedColumns:[],addedIndexes:[]});
      await auth.api.getSession({headers:new Headers()});
      closeAllDbConnections();
      console.log("pending-auth-ok");
    `;
    const env = { ...process.env, NOCTUA_DATA_DIR: temp.dir, ACCOUNT_DB_IDLE_MS: "0", BETTER_AUTH_SECRET: TEST_SECRET,
      BETTER_AUTH_URL: TEST_BASE_URL, PASSKEY_RP_ID: "localhost", NOCTUA_DESKTOP_MODE: "false", IMAP_CREDENTIALS_STORAGE: "db",
      BETTER_AUTH_TELEMETRY: "0", BETTER_AUTH_TELEMETRY_ENDPOINT: "", NOCTUA_TRUSTED_ORIGINS: "" };
    for (let start = 0; start < 2; start++) {
      const { stdout } = await run(process.execPath, ["--eval", script], { cwd: process.cwd(), env, timeout: 20000 });
      expect(stdout).toContain("pending-auth-ok");
    }
  } finally { temp.cleanup(); }
});
