import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import type { Account } from "@/lib/data";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

const { upsertAccount } = await dbModulePromise;
const { handleRecomputeStatusRequest } = await import("./recomputeJobs");

function buildAccount(accountId: string): Account {
  return {
    id: accountId,
    name: "Recompute Jobs",
    email: "owner@example.test",
    avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "secret" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "secret" }
  };
}

describe("handleRecomputeStatusRequest", () => {
  test("worker stderr of a failed recompute reaches managers only", async () => {
    const accountId = `recompute-${randomUUID()}`;
    await upsertAccount(buildAccount(accountId));
    const fixture = await createAuthenticatedTestSession(accountId);
    const stderr = "Error: SQLITE_BUSY at /srv/internal/worker.ts:12";
    const job = { id: "job-1", accountId, status: "failed" as const, error: stderr };
    const status = async () => {
      const response = await handleRecomputeStatusRequest(
        new Request("http://localhost/api/x?jobId=job-1", { headers: { cookie: fixture.jar.header() } }),
        () => job,
        { accountId }
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as { job: { error?: string } }).job.error;
    };
    for (const role of ["viewer", "editor"] as const) {
      fixture.master.prepare("UPDATE user_accounts SET role=? WHERE userId=? AND accountId=?").run(role, fixture.user.id, accountId);
      expect(await status()).toBe("Recompute failed.");
    }
    fixture.master.prepare("UPDATE user_accounts SET role='manager' WHERE userId=? AND accountId=?").run(fixture.user.id, accountId);
    expect(await status()).toBe(stderr);
  });
});
