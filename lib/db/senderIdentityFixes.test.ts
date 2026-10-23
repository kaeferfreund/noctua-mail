import { test, expect } from "bun:test";
import type { Message } from "../data";
import { dbModulePromise } from "../testDbHarness";
import { getAccountDb, getDb } from "./connection";
import { identityTestAccount } from "../testFixtures/senderIdentities";
import { getDefaultAccountDbPath } from "../runtimePaths";
import { createAuthenticatedTestSession } from "../testAuthHarness";
import { createSenderIdentity } from "../senderIdentities";
import { resyncImapMessageIntoDb } from "../mail/resyncMessage";
import { sanitizeSyncedMessage } from "../mail/syncMessageSanitizer";
import { ingestCopiedMessages } from "../crossAccountCopy";
import { buildDraftInputForMode } from "../drafts";
const db = await dbModulePromise;
async function fixture() {
  const accountId = `identity-fix-${crypto.randomUUID()}`;
  const account = identityTestAccount(accountId);
  await db.upsertAccount(account);
  const folderId = `${accountId}:INBOX`;
  await db.saveFoldersForAccount(accountId, [{ id: folderId, accountId, name: "INBOX", count: 0 }]);
  const message: Message = { id: crypto.randomUUID(), messageId: `<${crypto.randomUUID()}@example.test>`, accountId, folderId,
    threadId: crypto.randomUUID(), from: "customer@example.test", to: "primary@example.test", subject: "Synthetic identity",
    preview: "Synthetic", body: "Synthetic", date: new Date(1000).toISOString(), dateValue: 1000, imapUid: 1, mailboxPath: "INBOX" };
  const auth = await createAuthenticatedTestSession(accountId);
  const master = await getDb();
  const add = (email: string, enabled = true) => createSenderIdentity(accountId, { email, displayName: "Synthetic", enabled }, { userId: auth.user.id }, master);
  return { accountId, account, folderId, message, add };
}

test("me search ORs primary and enabled/disabled aliases in message/thread counts and groups, ANDs independent terms", async () => {
  const f = await fixture();
  await f.add("alias@example.test"); await f.add("disabled@example.test", false);
  const authors = ["primary@example.test", "alias@example.test", "disabled@example.test", "notalias@example.test", '"alias@example.test" <external@example.test>'];
  await db.upsertMessages(f.accountId, f.folderId, authors.map((from, index) => ({ ...f.message, id: `${f.message.id}-${index}`, messageId: `<${index}-${f.message.id}@example.test>`, threadId: `${f.message.threadId}-${index}`, from, to: "customer@example.test", imapUid: index + 1 })));
  for (const query of ["from:me", "with:me", "from:me with:customer@example.test"]) {
    // listThreads' date grouping returns loaded counts, so its filtered bucket counts are checked by week.
    for (const [list, groupBy] of [[db.listMessages, "date"], [db.listThreads, "week"]] as const) {
      const result = await list({ accountId: f.accountId, query, page: 1, pageSize: 2, groupBy });
      expect(result.total).toBe(3); expect(result.items).toHaveLength(2);
      expect(result.groups?.reduce((sum, group) => sum + group.count, 0)).toBe(3);
    }
  }
  expect((await db.listMessages({ accountId: f.accountId, query: "from:me from:alias@example.test", page: 1, pageSize: 20 })).total).toBe(1);
  await db.upsertMessages(f.accountId, f.folderId, [{ ...f.message, id: `${f.message.id}-recipient`, to: 'Group: "Alias" <disabled@example.test>;', imapUid: 9 }]);
  expect((await db.listMessages({ accountId: f.accountId, query: "with:me", page: 1, pageSize: 20 })).total).toBe(4);
});

test("shared-shard metadata follows the exact prior copy on replacement and ordinary row-ID changes", async () => {
  for (const replace of [false, true]) {
    const a = await fixture(), b = await fixture();
    (await getDb()).prepare("UPDATE accounts SET dbPath=? WHERE id=?").run(getDefaultAccountDbPath(a.accountId), b.accountId);
    const metadata = { deliveredTo: ["b@example.test"], originalTo: ["alias@example.test"], senderIdentityId: "b-only" };
    const incoming = { ...b.message, id: a.message.id, messageId: a.message.messageId };
    await db.upsertMessages(a.accountId, a.folderId, [{ ...a.message, deliveredTo: ["a@example.test"] }]);
    await db.upsertMessages(b.accountId, b.folderId, [{ ...incoming, ...metadata }]);
    const before = (await db.listMessages({ accountId: b.accountId, page: 1, pageSize: 10 })).items[0];
    (await getAccountDb(a.accountId)).prepare("DELETE FROM messages WHERE accountId=?").run(a.accountId);
    await db.upsertMessages(b.accountId, b.folderId, [incoming], replace);
    const after = (await db.listMessages({ accountId: b.accountId, page: 1, pageSize: 10 })).items[0];
    expect(after).toMatchObject(metadata); expect(after.id).toBe(before.id);
    await db.upsertMessages(b.accountId, b.folderId, [{ ...incoming, imapUid: 2 }]);
    expect((await db.listMessages({ accountId: b.accountId, page: 1, pageSize: 10 })).items.find(item => item.imapUid === 2)?.deliveredTo).toBeUndefined();
  }
});

test("one legacy author repair handles NULL/populated bare/angle IDN before summaries, exact lookalikes and all-outgoing fallback", async () => {
  const f = await fixture(); await f.add("alias@bücher.example");
  const shard = await getAccountDb(f.accountId);
  const variants = ["alias@bücher.example", '"Synthetic" <alias@bücher.example>', "alias@xn--bcher-kva.example"];
  for (const from of variants) for (const legacy of [null, "alias@bücher.example"]) {
    await db.upsertMessages(f.accountId, f.folderId, [{ ...f.message, from: "notalias@bücher.example" }, { ...f.message, id: `${f.message.id}-out`, messageId: `<out-${f.message.id}@example.test>`, from, dateValue: 2000, imapUid: 2 }], true);
    shard.prepare("UPDATE messages SET fromEmail=? WHERE accountId=? AND id=?").run(legacy, f.accountId, `${f.message.id}-out`);
    await db.recomputeThreadsForAccount(f.accountId);
    expect(shard.prepare("SELECT latestReceivedDateValue FROM threads WHERE accountId=? AND threadId=?").get(f.accountId, f.message.threadId)).toEqual({ latestReceivedDateValue: 1000 });
    expect(shard.prepare("SELECT fromEmail FROM messages WHERE accountId=? AND id=?").get(f.accountId, `${f.message.id}-out`)).toEqual({ fromEmail: "alias@xn--bcher-kva.example" });
  }
  for (const from of ["notalias@bücher.example", "alias@bücher.example"]) {
    await db.upsertMessages(f.accountId, f.folderId, [{ ...f.message, from, dateValue: 3000 }], true);
    await db.recomputeThreadsForAccount(f.accountId);
    expect(shard.prepare("SELECT latestReceivedDateValue FROM threads WHERE accountId=? AND threadId=?").get(f.accountId, f.message.threadId)).toEqual({ latestReceivedDateValue: 3000 });
  }
});

test("metadata survives full resync, move, copied-message ingest and related projections; server reply drafts exclude historical aliases", async () => {
  const f = await fixture(); await f.add("alias@example.test"); await f.add("disabled@example.test", false);
  const metadata = { deliveredTo: ["primary@example.test"], originalTo: ["alias@example.test"], senderIdentityId: "synthetic-marker" };
  const source = "Delivered-To: primary@example.test\r\nX-Original-To: alias@example.test (recipient)\r\nX-Noctua-Identity-Id: synthetic-marker\r\n\r\nSynthetic";
  await db.upsertMessages(f.accountId, f.folderId, [{ ...f.message, ...metadata }]);
  const synced = await resyncImapMessageIntoDb(f.account, { ...f.message, ...metadata }, 2, undefined, {
    getAttachmentIds: db.getAttachmentIds, getMessageById: db.getMessageById,
    resolveThreadingForAccountMessages: db.resolveThreadingForAccountMessages, updateMessageImapUid: db.updateMessageImapUid,
    upsertMessages: db.upsertMessages, syncImapMessage: async () => ({ ...f.message, imapUid: 2, source }),
    sanitizeSyncedMessage, deleteAttachmentData: async () => {}
  });
  expect(synced).toMatchObject(metadata);
  const archive = `${f.accountId}:Archive`;
  await db.saveFoldersForAccount(f.accountId, [{ id: archive, accountId: f.accountId, name: "Archive", count: 0 }]);
  await db.updateMessageFolder(f.accountId, f.message.id, archive, "Archive", 3);
  expect(await db.getMessageById(f.accountId, f.message.id)).toMatchObject(metadata);
  const destination = await fixture();
  await ingestCopiedMessages(destination.accountId, [{ ...destination.message, source }], {
    resolveThreadingForAccountMessages: db.resolveThreadingForAccountMessages, sanitizeSyncedMessage, upsertMessages: db.upsertMessages
  });
  expect(await db.getMessageById(destination.accountId, destination.message.id)).toMatchObject(metadata);
  const related = { ...destination.message, id: `${destination.message.id}-related`, messageId: `<related-${destination.message.id}@example.test>`, imapUid: 2, ...metadata };
  await db.upsertMessages(destination.accountId, destination.folderId, [related]);
  const results = await db.listRelatedMessages({ accountId: destination.accountId, relatedId: destination.message.id, page: 1, pageSize: 10 });
  expect(results.items.find(item => item.id === related.id)).toMatchObject(metadata);
  for (const from of ["alias@example.test", "disabled@example.test"]) {
    const id = `${f.message.id}-${from}`;
    await db.upsertMessages(f.accountId, f.folderId, [{ ...f.message, id, messageId: `<${id}@example.test>`, from, to: '"alias@example.test" <customer@example.test>, disabled@example.test', imapUid: 5 }]);
    const draft = await buildDraftInputForMode(f.account, f.accountId, { mode: "reply", messageId: id });
    expect(draft.to).toBe('"alias@example.test" <customer@example.test>');
  }
});

test("the light own-address read matches the full account's own addresses", async () => {
  const { getAccountById } = await import("./accounts");
  const { getAccountOwnAddresses } = await import("./senderIdentities");
  const { getOwnAddresses } = await import("../ownAddresses");
  const f = await fixture();
  await f.add("Alias@Bücher.example"); await f.add("disabled@example.test", false);
  const account = await getAccountById(f.accountId);
  expect(account).not.toBeNull();
  const own = await getAccountOwnAddresses(f.accountId);
  expect(own).toEqual(getOwnAddresses(account!));
  expect(own).toContain("alias@xn--bcher-kva.example");
  expect(await getAccountOwnAddresses(`missing-${crypto.randomUUID()}`)).toEqual([]);
});
