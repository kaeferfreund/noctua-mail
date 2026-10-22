import { expect, test } from "bun:test";
import { execFile } from "child_process";
import { promisify } from "util";
import { createTempDir, TEST_BASE_URL, TEST_SECRET } from "@/lib/testAuthHarness";

const run = promisify(execFile);
test("mounted policy handler is active, raw endpoints blocked, legacy cookie expired and second startup empty", async () => {
  const temp = createTempDir("noctua-ba-route-");
  try {
    const script = `
      import assert from "node:assert/strict";
      import * as route from "./app/api/ba/[...all]/route.ts";
      import { getAuth, migrateAuthSchema } from "./lib/betterAuth.ts";
      import { closeAllDbConnections } from "./lib/db/connection.ts";
      const response = await route.GET(new Request(process.env.BETTER_AUTH_URL+"/api/ba/ok",{headers:{cookie:"noctua_session=obsolete"}}));
      assert.equal(response.status,200);
      assert.equal((await response.json()).ok,true);
      assert.match(response.headers.get("set-cookie"),/noctua_session=;.*Max-Age=0/);
      for(const path of ["sign-up/email","admin/create-user","request-password-reset","change-password"]) {
        const denied=await route.POST(new Request(process.env.BETTER_AUTH_URL+"/api/ba/"+path,{method:"POST",headers:{origin:process.env.BETTER_AUTH_URL,"content-type":"application/json"},body:"{}"}));
        assert.ok([403,404].includes(denied.status));
      }
      const auth = await getAuth();
      assert.deepEqual(await migrateAuthSchema(auth.options),{createdTables:[],addedColumns:[],addedIndexes:[]});
      closeAllDbConnections();
      console.log("mounted-auth-ok");
    `;
    const env = { ...process.env, NOCTUA_DATA_DIR: temp.dir, ACCOUNT_DB_IDLE_MS: "0", BETTER_AUTH_SECRET: TEST_SECRET,
      BETTER_AUTH_URL: TEST_BASE_URL, PASSKEY_RP_ID: "localhost", IMAP_CREDENTIALS_STORAGE: "db",
      BETTER_AUTH_TELEMETRY: "0", BETTER_AUTH_TELEMETRY_ENDPOINT: "", NOCTUA_TRUSTED_ORIGINS: "" };
    for (let start = 0; start < 2; start++) {
      const { stdout } = await run(process.execPath, ["--eval", script], { cwd: process.cwd(), env, timeout: 20000 });
      expect(stdout).toContain("mounted-auth-ok");
      expect(stdout).not.toContain("Admin invite code:");
    }
  } finally { temp.cleanup(); }
});
