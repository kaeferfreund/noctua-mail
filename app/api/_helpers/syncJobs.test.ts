import { expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { handleSyncStartRequest, handleSyncStatusRequest } from "./syncJobs";
import * as syncJobs from "@/lib/syncJobs";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";

const DETAIL = "IMAP connect to imap.internal.example.test:993 failed: synthetic upstream reply";

test("failed sync jobs show worker diagnostics only to managers", async () => {
  const accountId = `sync-status-${randomUUID()}`;
  const db = await dbModulePromise;
  await db.upsertAccount(identityTestAccount(accountId));
  const f = await createAuthenticatedTestSession(accountId);
  const job = {
    id: "synthetic-job", payload: { accountId }, status: "failed", startedAt: Date.now(), error: DETAIL,
    progress: { accountId, mailboxPath: "INBOX", mode: "recent", phase: "failed", processed: 0, message: DETAIL, updatedAt: Date.now() }
  } as syncJobs.SyncJob;
  const getJob = spyOn(syncJobs, "getSyncJob").mockReturnValue(job);
  const start = spyOn(syncJobs, "startSyncJob").mockResolvedValue(job);
  const info = spyOn(console, "info").mockImplementation(() => {});
  const request = (method = "GET") => new Request(`http://localhost:3000/api/accounts/${accountId}/sync?jobId=synthetic-job`, {
    method, headers: { cookie: f.jar.header(), origin: "http://localhost:3000", "content-type": "application/json" },
    ...(method === "POST" ? { body: "{}" } : {})
  });
  try {
    for (const role of ["viewer", "editor", "manager"] as const) {
      await db.setUserAccountRole(f.user.id, accountId, role, f.user.id);
      const status = await (await handleSyncStatusRequest(request(), { accountId })).json();
      const started = await (await handleSyncStartRequest(request("POST"), { accountId })).json();
      const text = JSON.stringify([status, started]);
      if (role === "manager") {
        expect(status.job.error).toBe(DETAIL);
        expect(started.message).toBe(DETAIL);
      } else {
        expect(text).not.toContain("imap.internal.example.test");
        expect(status.job).toMatchObject({ status: "failed", error: "Sync failed.", progress: { phase: "failed", message: "Sync failed." } });
        expect(started.message).toBe("Sync failed.");
      }
    }
  } finally {
    getJob.mockRestore();
    start.mockRestore();
    info.mockRestore();
  }
});
