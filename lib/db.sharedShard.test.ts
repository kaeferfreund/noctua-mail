import { describe, expect, test } from "bun:test";
import { createSharedShardFixture } from "./testSharedShardHarness";
import { buildImapMessageRowId } from "./messageIds";
import { ingestCopiedMessages } from "./crossAccountCopy";
import { sanitizeSyncedMessage } from "./mail/syncMessageSanitizer";
import { getAttachmentData, getMessageSource } from "./storage";
import * as collab from "./db/threadCollab";
import { getMailboxSummaries } from "./db/mailboxSummary";

const thread = "<shared-root@example.test>";
const header = "<shared-message@example.test>";
const id = buildImapMessageRowId(header);
const attachment = (filename: string) => ({
  id: "same-attachment", filename, contentType: "application/pdf", size: 2048, inline: false
});

describe("shared shard account identities", () => {
  // Regressions for the same-Message-ID and common-thread sync scenarios.
  test("same RFC Message-ID sync preserves both account rows, FTS and thread indexes", async () => {
    const { a, b, db } = await createSharedShardFixture();
    await a.seed(a.message(thread, { id, messageId: header, subject: "A subject", body: "syntheticfirstword", unread: true }));
    await b.seed(b.message(thread, { id, messageId: header, subject: "B subject", body: "syntheticsecondword", unread: false }));
    expect((await a.api.getMessageById(a.accountId, id))?.subject).toBe("A subject");
    expect((await b.api.getMessageById(b.accountId, id))?.subject).toBe("B subject");
    for (const [f, own, other] of [[a, "syntheticfirstword", "syntheticsecondword"], [b, "syntheticsecondword", "syntheticfirstword"]] as const) {
      expect((await f.api.listMessages({ accountId: f.accountId, page: 1, pageSize: 30, query: own })).items.map(m => m.id)).toEqual([id]);
      expect((await f.api.listMessages({ accountId: f.accountId, page: 1, pageSize: 30, query: other })).items).toEqual([]);
      expect((await f.api.listThreads({ accountId: f.accountId, page: 1, pageSize: 30 })).items).toHaveLength(1);
    }
    // Account validation precedes destructive replacement work.
    await expect(a.api.upsertMessages(a.accountId, null, [b.message(thread)], true)).rejects.toThrow("Message accountId must match");
    expect((await a.api.getMessageById(a.accountId, id))?.subject).toBe("A subject");
    expect(db.prepare("SELECT accountId FROM threads WHERE threadId = ?").all(thread)).toHaveLength(2);
    expect((await getMailboxSummaries([a.accountId, b.accountId])).map(s => s.unreadInbox)).toEqual([1, 0]);
  });

  test("distinct messages with a common root retain both account thread listings", async () => {
    const { a, b, db } = await createSharedShardFixture();
    await a.seed(a.message(thread));
    await b.seed(b.message(thread));
    expect(db.prepare("SELECT 1 FROM threads WHERE accountId=? AND threadId=?").get(a.accountId, thread)).not.toBeNull();
    expect((await a.api.listThreads({ accountId: a.accountId, page: 1, pageSize: 30 })).items).toHaveLength(1);
    expect((await b.api.listThreads({ accountId: b.accountId, page: 1, pageSize: 30 })).items).toHaveLength(1);
  });

  test("attachments, translations, invite states and topic filters use the complete account key", async () => {
    const { a, b, db } = await createSharedShardFixture();
    for (const [f, label] of [[a, "firstdocument.pdf"], [b, "seconddocument.pdf"]] as const) {
      await f.seed(f.message(thread, { id, messageId: header, attachments: [attachment(label)], calendarEventUids: ["same-event"] }));
      await f.api.putCachedTranslation(f.accountId, { messageId: id, targetLang: "de", format: "text", marker: "same-marker", translatedText: label, detectedSourceLang: "en" });
    }
    // An ordinary update must not delete translation children through REPLACE.
    await b.seed(b.message(thread, { id, messageId: header, attachments: [attachment("seconddocument.pdf")], calendarEventUids: ["same-event"] }));
    for (const [f, label, other] of [[a, "firstdocument.pdf", "seconddocument.pdf"], [b, "seconddocument.pdf", "firstdocument.pdf"]] as const) {
      expect((await f.api.getCachedTranslation(f.accountId, id, "de", "text", "same-marker"))?.translatedText).toBe(label);
      expect((await f.api.getMessageById(f.accountId, id))?.attachments?.map(x => x.filename)).toEqual([label]);
      expect((await f.api.listThreadMessages({ accountId: f.accountId, threadIds: [thread] })).items[0]?.attachments?.map(x => x.filename)).toEqual([label]);
      expect((await f.api.listMessages({ accountId: f.accountId, page: 1, pageSize: 30, query: other })).items).toEqual([]);
    }
    expect(db.prepare("SELECT * FROM message_calendar_events WHERE messageId=?").all(id)).toHaveLength(2);
    db.prepare("INSERT INTO thread_topics(threadId,topicId,accountId,assignedAt) VALUES(?,?,?,?)").run(thread, "same-topic", b.accountId, 1);
    expect((await a.api.listMessages({ accountId: a.accountId, page: 1, pageSize: 30, query: "topic:none" })).items).toHaveLength(1);
    expect((await b.api.listMessages({ accountId: b.accountId, page: 1, pageSize: 30, query: "topic:none" })).items).toEqual([]);
    db.prepare("INSERT INTO thread_topics(threadId,topicId,accountId,assignedAt) VALUES(?,?,?,?)").run(thread, "same-topic", a.accountId, 1);
    expect(db.prepare("SELECT * FROM thread_topics WHERE threadId=? AND topicId=?").all(thread, "same-topic")).toHaveLength(2);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  for (const operation of ["replace-folder", "replace-account", "delete-one", "delete-batch", "delete-prefix"] as const) {
    test(`${operation} preserves the other account's messages and dependents`, async () => {
      const { a, b } = await createSharedShardFixture();
      const af = `${a.accountId}:INBOX`, bf = `${b.accountId}:INBOX`;
      await a.seed(a.message(thread, { id, messageId: header, folderId: af, body: "syntheticretainedword", attachments: [attachment("A.pdf")], calendarEventUids: ["same-event"] }));
      await b.seed(b.message(thread, { id, messageId: header, folderId: bf, attachments: [attachment("B.pdf")], calendarEventUids: ["same-event"] }));
      await a.api.putCachedTranslation(a.accountId, { messageId: id, targetLang: "de", format: "text", marker: "m", translatedText: "A translation", detectedSourceLang: "en" });
      if (operation.startsWith("replace")) await b.api.upsertMessages(b.accountId, operation === "replace-folder" ? bf : null, [], true);
      else if (operation === "delete-one") await b.api.deleteMessageById(b.accountId, id);
      else if (operation === "delete-batch") await b.api.deleteMessagesByIds(b.accountId, [id]);
      else await b.api.deleteMessagesByFolderPrefix(b.accountId, "INBOX");
      expect(await b.api.getMessageById(b.accountId, id)).toBeNull();
      expect((await a.api.getMessageById(a.accountId, id))?.attachments?.[0]?.filename).toBe("A.pdf");
      expect((await a.api.getCachedTranslation(a.accountId, id, "de", "text", "m"))?.translatedText).toBe("A translation");
      expect((await a.api.listMessages({ accountId: a.accountId, page: 1, pageSize: 30, query: "syntheticretainedword" })).items).toHaveLength(1);
      expect((await a.api.listThreads({ accountId: a.accountId, page: 1, pageSize: 30 })).items).toHaveLength(1);
    });
  }

  test("recompute and collaboration remap leave matching row and thread ids in the other account intact", async () => {
    const { a, b, db } = await createSharedShardFixture();
    const root = "<new-root@example.test>";
    for (const f of [a, b]) {
      await f.seed(f.message(thread, { id, messageId: header, references: [root] }));
      db.transaction(() => {
        const actor = { userId: "synthetic-user", clientId: "web:synthetic" };
        collab.updateThreadCollabState(db, f.accountId, thread, { status: f === a ? "waiting" : "closed" }, actor, 100);
        collab.addThreadComment(db, f.accountId, thread, f.accountId, actor, 100);
        db.prepare("INSERT INTO thread_topics VALUES(?,?,?,?)").run(thread, "same-topic", f.accountId, 100);
      }).immediate();
      await collab.recordReplySent(f.accountId, { messageId: "<same-sent@example.test>", inReplyTo: header }, { userId: "synthetic-user", clientId: "web:synthetic" });
    }
    await a.api.recomputeThreadIdsForAccount(a.accountId);
    expect((await a.api.getMessageById(a.accountId, id))?.threadId).toBe(root);
    expect((await b.api.getMessageById(b.accountId, id))?.threadId).toBe(thread);
    expect(collab.getThreadCollabState(db, b.accountId, thread).status).toBe("closed");
    expect(collab.listThreadComments(db, b.accountId, thread)[0]?.body).toBe(b.accountId);
    expect(collab.listThreadComments(db, a.accountId, root)[0]?.body).toBe(a.accountId);
    expect(db.prepare("SELECT * FROM thread_topics WHERE accountId=? AND threadId=?").all(b.accountId, thread)).toHaveLength(1);
    expect(collab.listThreadActivity(db, b.accountId, thread).filter(row => row.type === "reply_sent")).toHaveLength(1);
    expect(collab.listThreadActivity(db, a.accountId, root).filter(row => row.type === "reply_sent")).toHaveLength(1);
    expect(db.prepare("SELECT * FROM sent_by WHERE messageId=?").all("<same-sent@example.test>")).toHaveLength(2);
  });

  test("copied-message ingestion and sync sanitization preserve source account data in a shared shard", async () => {
    const { a, b } = await createSharedShardFixture();
    const source = a.message(thread, { id, messageId: header, source: "Synthetic A source", attachments: [{ ...attachment("A.pdf"), dataUrl: "data:application/pdf;base64,QQ==" }] });
    await a.seed(await sanitizeSyncedMessage(source, a.accountId));
    await ingestCopiedMessages(b.accountId, [b.message(thread, { id, messageId: header, source: "Synthetic B source", attachments: [{ ...attachment("B.pdf"), dataUrl: "data:application/pdf;base64,Qg==" }] })], {
      resolveThreadingForAccountMessages: b.api.resolveThreadingForAccountMessages,
      sanitizeSyncedMessage,
      upsertMessages: b.api.upsertMessages
    });
    expect((await a.api.getMessageById(a.accountId, id))?.attachments?.[0]?.filename).toBe("A.pdf");
    expect((await b.api.getMessageById(b.accountId, id))?.attachments?.[0]?.filename).toBe("B.pdf");
    expect(await getMessageSource(a.accountId, id)).toBe("Synthetic A source");
    expect(await getMessageSource(b.accountId, id)).toBe("Synthetic B source");
    expect((await getAttachmentData(a.accountId, id, "same-attachment"))?.toString()).toBe("A");
    expect((await getAttachmentData(b.accountId, id, "same-attachment"))?.toString()).toBe("B");
  });
});
