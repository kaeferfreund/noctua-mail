import { getIdentityRecomputeJob } from "../threadRecomputeJobs";
import { describe, test, expect } from "bun:test";
import type { Message } from "../data";
import { dbModulePromise } from "../testDbHarness";
import { getDb, getAccountDb } from "./connection";
import { getDefaultAccountDbPath } from "../runtimePaths";
import { identityTestAccount } from "../testFixtures/senderIdentities";
import { createAuthenticatedTestSession } from "../testAuthHarness";
import { createSenderIdentity, disableSenderIdentity } from "../senderIdentities";
import { saveMessageSource } from "../storage";
import { resolveComposeIdentity } from "../senderIdentitySelection";
import { withDbWriteRetry } from "../dbWriteRetry";

const db = await dbModulePromise;
async function fixture() {
  const accountId = `identity-metadata-${crypto.randomUUID()}`;
  await db.upsertAccount(identityTestAccount(accountId));
  const folderId = `${accountId}:INBOX`;
  await db.saveFoldersForAccount(accountId, [{ id: folderId, accountId, name: "INBOX", count: 0 }]);
  const message: Message = { id: `message-${crypto.randomUUID()}`, messageId: `<${crypto.randomUUID()}@example.test>`,
    accountId, folderId, threadId: `thread-${crypto.randomUUID()}`, from: "customer@example.test", to: "primary@example.test",
    subject: "Synthetic metadata", date: new Date(1000).toISOString(), dateValue: 1000, body: "Synthetic", preview: "Synthetic",
    imapUid: 1, mailboxPath: "INBOX" };
  return { accountId, folderId, message };
}
describe("sender identity message metadata", () => {
  test("upsert and every list/detail projection preserve headers and marker through envelope-only and replacement updates", async () => {
    const f = await fixture();
    const metadata = { deliveredTo: ["primary@example.test"], originalTo: ["alias@example.test"], senderIdentityId: "synthetic-id" };
    await db.upsertMessages(f.accountId, f.folderId, [{ ...f.message, ...metadata }]);
    for (const replace of [false, true]) {
      await db.upsertMessages(f.accountId, f.folderId, [f.message], replace);
      expect(await db.getMessageById(f.accountId, f.message.id)).toMatchObject(metadata);
    }
    expect((await db.listMessages({ accountId: f.accountId, page: 1, pageSize: 10 })).items[0]).toMatchObject(metadata);
    expect((await db.listThreads({ accountId: f.accountId, page: 1, pageSize: 10 })).items[0]).toMatchObject(metadata);
    expect((await db.listThreadMessages({ accountId: f.accountId, threadIds: [f.message.threadId] })).items[0]).toMatchObject(metadata);
    await db.upsertMessages(f.accountId, f.folderId, [{ ...f.message, originalTo: [], deliveredTo: [] }]);
    expect(await db.getMessageById(f.accountId, f.message.id)).toMatchObject({ originalTo: [], deliveredTo: [], senderIdentityId: "synthetic-id" });
    const shard = await getAccountDb(f.accountId);
    expect(shard.prepare("SELECT fromEmail FROM messages WHERE id=?").get(f.message.id)).toEqual({ fromEmail: "customer@example.test" });
  });
  test("collision copies and accounts in a shared shard never inherit another copy's metadata", async () => {
    const a = await fixture(); const b = await fixture();
    const master = await getDb();
    // A prior identity recompute can still be releasing its durable worker
    // lease. Fixture setup uses the same bounded writer retry as other setup.
    await withDbWriteRetry("senderIdentityMetadata.shareShard", () => master
      .prepare("UPDATE accounts SET dbPath=? WHERE id=?").run(getDefaultAccountDbPath(a.accountId), b.accountId));
    await db.upsertMessages(a.accountId, a.folderId, [{ ...a.message, deliveredTo: ["a@example.test"] }]);
    await db.upsertMessages(b.accountId, b.folderId, [{ ...b.message, id: a.message.id, messageId: a.message.messageId, deliveredTo: ["b@example.test"] }]);
    expect((await db.getMessageById(a.accountId, a.message.id))?.deliveredTo).toEqual(["a@example.test"]);
    expect((await db.getMessageById(b.accountId, a.message.messageId!))?.deliveredTo).toEqual(["b@example.test"]);
    await db.upsertMessages(a.accountId, a.folderId, [{ ...a.message, imapUid: 2 }]);
    const copies = (await db.listMessages({ accountId: a.accountId, page: 1, pageSize: 10 })).items;
    expect(copies).toHaveLength(2);
    expect(copies.find(message => message.imapUid === 2)?.deliveredTo).toBeUndefined();
    await db.upsertMessages(b.accountId, b.folderId, [{ ...b.message, id: a.message.id, messageId: a.message.messageId, imapUid: 2, deliveredTo: ["b-copy@example.test"] }]);
    expect((await db.listMessages({ accountId: a.accountId, page: 1, pageSize: 10 })).items).toHaveLength(2);
    expect((await db.listMessages({ accountId: b.accountId, page: 1, pageSize: 10 })).items.find(message => message.imapUid === 2)?.deliveredTo).toEqual(["b-copy@example.test"]);
    await expect(db.upsertMessages(a.accountId, a.folderId, [b.message], true)).rejects.toThrow("another account");
    expect((await db.getMessageById(a.accountId, a.message.id))?.deliveredTo).toEqual(["a@example.test"]);
  });
  test("explicit legacy reopen parses cached outer headers once", async () => {
    const f = await fixture();
    await db.upsertMessages(f.accountId, f.folderId, [{ ...f.message, hasSource: true }]);
    await saveMessageSource(f.accountId, f.message.id, "Delivered-To: alias@example.test\r\n\r\nDelivered-To: body@example.test");
    expect((await db.getMessageById(f.accountId, f.message.id))?.deliveredTo).toEqual(["alias@example.test"]);
    expect((await db.listMessages({ accountId: f.accountId, page: 1, pageSize: 10 })).items[0].deliveredTo).toEqual(["alias@example.test"]);
  });
  test("adding an identity rebuilds persisted signals and exact received dates while preserving thread/topic links", async () => {
    const f = await fixture(); const auth = await createAuthenticatedTestSession(f.accountId);
    const inbound = { ...f.message, from: "notalias@example.test", dateValue: 1000 };
    const outbound = { ...f.message, id: `${f.message.id}-sent`, messageId: `<sent-${crypto.randomUUID()}@example.test>`, from: "alias@example.test", dateValue: 2000, imapUid: 2 };
    await db.upsertMessages(f.accountId, f.folderId, [inbound, outbound]);
    const shard = await getAccountDb(f.accountId);
    shard.prepare("INSERT INTO thread_topics(threadId,topicId,accountId,assignedAt) VALUES(?,?,?,?)").run(f.message.threadId, "synthetic-topic", f.accountId, 1);
    expect(shard.prepare("SELECT 1 FROM thread_signals WHERE accountId=? AND signalValue='alias@example.test'").get(f.accountId)).not.toBeNull();
    await createSenderIdentity(f.accountId, { email: "alias@example.test", displayName: "Alias" }, { userId: auth.user.id });
    const deadline = Date.now() + 10000;
    while (["queued", "running"].includes(getIdentityRecomputeJob(f.accountId)?.status ?? "") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    expect(getIdentityRecomputeJob(f.accountId)?.status).toBe("done");
    expect(shard.prepare("SELECT 1 FROM thread_signals WHERE accountId=? AND signalValue='alias@example.test'").get(f.accountId)).toBeNull();
    expect(shard.prepare("SELECT latestReceivedDateValue FROM threads WHERE accountId=? AND threadId=?").get(f.accountId, f.message.threadId)).toEqual({ latestReceivedDateValue: 1000 });
    expect(shard.prepare("SELECT threadId,topicId FROM thread_topics WHERE accountId=?").get(f.accountId)).toEqual({ threadId: f.message.threadId, topicId: "synthetic-topic" });
    expect((await db.getMessageById(f.accountId, outbound.id))?.threadId).toBe(f.message.threadId);
  });
  test("stale prefs fall back with warning; delete user retains attribution, delete mailbox removes identities", async () => {
    const f = await fixture(); const auth = await createAuthenticatedTestSession(f.accountId);
    const alias = await createSenderIdentity(f.accountId, { email: "alias@example.test", displayName: "Alias" }, { userId: auth.user.id });
    await db.mergeUserAccountPrefs(auth.user.id, f.accountId, { defaultIdentityId: alias.id, signatureOverride: "Synthetic personal" });
    await disableSenderIdentity(f.accountId, alias.id, { userId: auth.user.id });
    await expect(db.mergeUserAccountPrefs(auth.user.id, f.accountId, { defaultIdentityId: alias.id })).rejects.toThrow("enabled identity");
    const prefs = await db.getUserAccountPrefs(auth.user.id, f.accountId);
    expect(prefs.defaultIdentityId).toBe(alias.id);
    expect(resolveComposeIdentity({ accountId: f.accountId, identities: await db.listSenderIdentities(f.accountId), prefs }).warnings).toHaveLength(1);
    await db.deleteUser(auth.user.id);
    expect(await db.getUserAccountPrefs(auth.user.id, f.accountId)).toEqual({});
    expect((await db.listSenderIdentities(f.accountId)).find(i => i.id === alias.id)?.createdBy).toBe(auth.user.id);
    expect(await db.deleteAccountControlPlane(f.accountId)).toBe(true);
    expect(await db.listSenderIdentities(f.accountId)).toEqual([]);
  });
});
