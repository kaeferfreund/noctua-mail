import { expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { getRequestClientId } from "./clientId";
import { handleSyncStartRequest, handleSyncStatusRequest } from "./syncJobs";
import { requireAccountContext } from "./accountContext";
import * as syncJobs from "@/lib/syncJobs";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import type { Account } from "@/lib/data";

test("client correlation IDs accept only 1–64 safe characters", () => {
  for (const value of ["a", "Web_client-123", "a".repeat(64), "", "a".repeat(215), "bad.id", "two words"]) {
    const request = new Request("http://localhost:3000", { headers: { "x-noctua-client": value } });
    expect(getRequestClientId(request)).toBe(/^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined);
  }
});

test("215-character client IDs never reach unauthorized status logs, account contexts or sync workers", async () => {
  const invalid = "x".repeat(215);
  const request = (cookie = "", method = "GET", clientId = invalid) => new Request("http://localhost:3000/api/sync?jobId=synthetic", {
    method, headers: { cookie, "x-noctua-client": clientId, "content-type": "application/json", origin: "http://localhost:3000" },
    ...(method === "POST" ? { body: "{}" } : {})
  });
  const log = spyOn(console, "info").mockImplementation(() => {});
  try {
    expect((await handleSyncStatusRequest(request())).status).toBe(401);
    expect(log.mock.calls.flat().join(" ")).not.toContain(invalid);
    const statusLog = log.mock.calls.map((call: unknown[]) => String(call[0])).find((line: string) => line.startsWith("[sync-status] "));
    expect(statusLog).toBeDefined();
    expect(JSON.parse(statusLog!.replace("[sync-status] ", ""))).not.toHaveProperty("clientId");
  } finally { log.mockRestore(); }
  const id = randomUUID();
  const email = `client-${id}@example.test`;
  const { upsertAccount } = await dbModulePromise;
  await upsertAccount({ id, name: "Synthetic Client", email, avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: email, password: "synthetic-imap" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "synthetic-smtp" }
  } as Account);
  const f = await createAuthenticatedTestSession(id);
  for (const resolve of [requireAccountContext]) {
    const context = await resolve(request(f.jar.header()), id);
    expect(context).toHaveProperty("clientId", undefined);
  }
  const worker = spyOn(syncJobs, "startSyncJob").mockReturnValue({ id: "synthetic-job", status: "queued" } as ReturnType<typeof syncJobs.startSyncJob>);
  try {
    expect((await handleSyncStartRequest(request(f.jar.header(), "POST"), { accountId: id })).status).toBe(202);
    expect(worker.mock.calls[0][1]).toBeUndefined();
    expect((await handleSyncStartRequest(request(f.jar.header(), "POST", "web_123-ABC"), { accountId: id })).status).toBe(202);
    expect(worker.mock.calls[1][1]).toBe("web_123-ABC");
  } finally { worker.mockRestore(); }
});
