import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { dbModulePromise } from "./testDbHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";
import { assertAccountFolder } from "./folderAccountGuard";
import { runSyncOperation } from "./syncOperation";

const db = await dbModulePromise;

test("validates literal mailbox paths containing colons against the correct shard", async () => {
  const accountId = `synthetic-folder-${randomUUID()}`;
  const folderId = `${accountId}:Projects:2026`;
  await db.upsertAccount(identityTestAccount(accountId));
  await db.saveFoldersForAccount(accountId, [{ id: folderId, accountId, name: "Projects:2026", count: 0 }]);
  await assertAccountFolder(accountId, folderId);
  await expect(assertAccountFolder("synthetic-other", folderId)).rejects.toMatchObject({ code: "folder_account_mismatch" });
  await expect(assertAccountFolder(accountId, `${accountId}:missing`)).rejects.toMatchObject({ code: "folder_account_mismatch" });
});

test("sync operation rejects the incident payload before opening IMAP", async () => {
  await expect(runSyncOperation({ accountId: "synthetic-b", folderId: "synthetic-a:INBOX", mode: "full" }))
    .rejects.toMatchObject({ code: "folder_account_mismatch" });
});

test("real sync worker exits once without retrying an account mismatch", async () => {
  const child = Bun.spawn([process.execPath, "scripts/runSyncJob.ts", JSON.stringify({
    accountId: "synthetic-b", folderId: "synthetic-a:INBOX", mode: "full"
  })], { stdout: "pipe", stderr: "pipe" });
  const timeout = setTimeout(() => child.kill(), 5000);
  try {
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    expect(code).toBe(1);
    expect(stderr).toContain("folder_account_mismatch");
    expect(stderr).not.toContain("retrying in");
    expect(stdout).not.toContain('"phase":"retrying"');
  } finally { clearTimeout(timeout); }
}, 10000);
