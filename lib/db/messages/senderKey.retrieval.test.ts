import { expect, test } from "bun:test";
import { resolveStoredMessageContentState } from "../../messageContentState";
import { createHash } from "crypto";
import { createCollabFixture } from "../../testThreadCollabHarness";
import { saveMessageSource } from "../../storage";
import { closeAccountDbConnection, getDb } from "../connection";
import { getDefaultAccountDbPath } from "../../runtimePaths";
import { getMessageById } from "./retrieval";

// Frozen getMessageById, copied verbatim from 620a785 (only its name changed).
import { parseDeliveryMetadata } from "../../mail/imap/parser";
import { getMessageSource } from "../../storage";
import { withDbWriteRetry } from "../../dbWriteRetry";
import { hydrateIdentityMetadata } from "./identityMetadata";
/**
 * Single-record fetchers and attachment/ref listings for the messages domain.
 *
 * Complements `./query.ts`: these entry points resolve one message by id
 * (with fallback lookups on RFC-5322 `Message-ID` and stripped `<...>` forms),
 * surface attachment metadata, and expose the row listings that the IMAP sync
 * reconciliation path relies on.
 */
import type { Message } from "../../data";
import { backfillMessageSenderKey } from "./senderKey";
import { getAccountDb } from "../connection";
import { buildMessageRowIdLookupCandidates } from "../../messageIds";
import {
  getMessageCalendarInviteDataByMessageId,
  hydrateAttachment,
  parseReferences,
  parseStringArray,
  safeParseJson
} from "./_shared";

async function referenceGetMessageById(accountId: string, messageId: string) {
  const db = await getAccountDb(accountId);
  const normalizedLookup = messageId.trim();
  const idLookupCandidates = buildMessageRowIdLookupCandidates(normalizedLookup);
  let row: any = null;
  for (const candidateId of idLookupCandidates) {
    row = db
      .prepare(`SELECT * FROM messages WHERE accountId = ? AND id = ?`)
      .get(accountId, candidateId) as any;
    if (row) break;
  }
  if (!row) {
    row = db
      .prepare(
        `SELECT * FROM messages WHERE accountId = ? AND lower(messageId) = lower(?) ORDER BY dateValue DESC LIMIT 1`
      )
      .get(accountId, normalizedLookup) as any;
  }
  if (!row) {
    const trimmed = normalizedLookup.replace(/[<>]/g, "").trim();
    if (trimmed && trimmed !== normalizedLookup) {
      row = db
        .prepare(
          `SELECT * FROM messages WHERE accountId = ? AND lower(messageId) LIKE ? ORDER BY dateValue DESC LIMIT 1`
        )
        .get(accountId, `%${trimmed.toLowerCase()}%`) as any;
    }
  }
  if (!row) return null;
  // Lazy cached-source enrichment for explicitly reopened legacy messages.
  if (row.hasSource && (row.deliveredTo == null || row.originalTo == null)) {
    const source = await getMessageSource(accountId, row.id);
    if (source) {
      const metadata = parseDeliveryMetadata(Buffer.from(source));
      await withDbWriteRetry("hydrateDeliveryMetadata", () => db.prepare(`UPDATE messages SET
        deliveredTo=COALESCE(deliveredTo,?), originalTo=COALESCE(originalTo,?),
        senderIdentityId=COALESCE(senderIdentityId,?) WHERE accountId=? AND id=?`)
        .run(JSON.stringify(metadata.deliveredTo), JSON.stringify(metadata.originalTo), metadata.senderIdentityId ?? null, accountId, row.id));
      row = db.prepare("SELECT * FROM messages WHERE accountId=? AND id=?").get(accountId, row.id);
      if (!row) return null;
    }
  }
  await backfillMessageSenderKey(db, row);
  const attachments = db
    .prepare(`SELECT * FROM attachments WHERE accountId = ? AND messageId = ?`)
    .all(accountId, row.id) as any[];
  const calendarInviteData = (await getMessageCalendarInviteDataByMessageId(
    db,
    accountId,
    [row.id]
  )).get(row.id);
  return {
    id: row.id,
    accountId: row.accountId,
    folderId: row.folderId,
    mailboxPath: row.mailboxPath ?? undefined,
    imapUid: typeof row.imapUid === "number" ? row.imapUid : undefined,
    threadId: row.threadId,
    parentId: row.parentId ?? undefined,
    messageId: row.messageId ?? undefined,
    inReplyTo: row.inReplyTo ?? undefined,
    references: parseReferences(row.references),
    xForwardedMessageId: row.xForwardedMessageId ?? undefined,
    xComposeFormat: row.xComposeFormat ?? undefined,
    quotedHtmlEdited: row.quotedHtmlEdited ? true : false,
    subject: row.subject,
    from: row.fromAddr,
    senderKey: row.senderKey ?? null,
    replyTo: row.replyToAddr ?? undefined,
    to: row.toAddr,
    cc: row.ccAddr ?? undefined,
    bcc: row.bccAddr ?? undefined,
    preview: row.preview,
    date: row.date,
    dateValue: row.dateValue,
    body: row.body,
    htmlBody: row.htmlBody ?? undefined,
    priority: row.priority ?? undefined,
    hasSource: Boolean(row.hasSource),
    ...hydrateIdentityMetadata(row),
    sizeBytes: typeof row.sizeBytes === "number" ? row.sizeBytes : undefined,
    attachments: attachments.map((att) => hydrateAttachment(accountId, row.id, att)),
    unread: Boolean(row.unread),
    flags: safeParseJson<string[]>(row.flags),
    seen: Boolean(row.seen),
    answered: Boolean(row.answered),
    flagged: Boolean(row.flagged),
    deleted: Boolean(row.deleted),
    draft: Boolean(row.draft),
    recent: Boolean(row.recent),
    category: row.category ?? undefined,
    categoryScore: typeof row.categoryScore === "number" ? row.categoryScore : undefined,
    categorySignals: parseStringArray(row.categorySignals),
    calendarEventUids: calendarInviteData?.calendarEventUids ?? [],
    calendarInviteStates: calendarInviteData?.calendarInviteStates ?? [],
    listUnsubscribe: row.listUnsubscribe ?? undefined
  } as Message;
}

type Fixture = Awaited<ReturnType<typeof createCollabFixture>>;
type Trace = { sql: string; method: string; args: unknown[]; changes?: number }[];

// Observe execution, not preparation: switching to the connection's query cache
// must preserve SQL, bindings, read/write order, affected rows and final storage.
async function observe(
  f: Fixture,
  lookup: string,
  read: typeof getMessageById,
  beforeSenderWrite?: () => void
) {
  const db = await getAccountDb(f.accountId);
  const prepare = db.prepare;
  const query = db.query;
  const trace: Trace = [];
  let injected = false;
  const wrap = (factory: typeof prepare) => (sql: string) => {
    const statement = factory.call(db, sql);
    return new Proxy(statement, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (["get", "all", "run"].includes(String(key))) {
          return (...args: unknown[]) => {
            if (key === "run" && sql.includes("SET senderKey = ?") && !injected) {
              injected = true;
              beforeSenderWrite?.();
            }
            const result = value.apply(target, args);
            if (/\b(messages|attachments|message_calendar_events)\b/.test(sql)) {
              trace.push({ sql, method: String(key), args, ...(key === "run" ? { changes: result.changes } : {}) });
            }
            return result;
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare = wrap(prepare);
    db.query = wrap(query);
    const read_ = await read(f.accountId, lookup);
    // contentState was added to getMessageById after 620a785: check it, then
    // compare the remaining fields with the frozen reference.
    let result = read_;
    if (read_ && "contentState" in read_) {
      expect(read_.contentState).toBe(resolveStoredMessageContentState(read_));
      const { contentState: _contentState, ...rest } = read_;
      result = rest as typeof read_;
    }
    const rows = ["messages", "attachments", "message_calendar_events"].map(table =>
      prepare.call(db, `SELECT * FROM ${table} ORDER BY accountId, ${table === "messages" ? "id" : table === "attachments" ? "messageId, id" : "messageId, eventUid"}`).all()
    );
    return { result, trace, rows };
  } finally {
    db.prepare = prepare;
    db.query = query;
    db.exec("ROLLBACK");
  }
}

const source = "From: Wire Sender <wire@example.test>\r\nDelivered-To: delivered@example.test\r\nX-Original-To: original@example.test\r\nX-Noctua-Identity-Id: wire-identity\r\n\r\nSynthetic";
const digest = createHash("sha256").update(source).digest("hex");

type LegacyScenario = {
  name: string; provenance: string | null; expectedKey: string | null;
  delivery: boolean; senderWrites: number; key?: string; missing?: boolean;
  baseOnly?: boolean; hydrated?: boolean; partial?: boolean;
};
const legacyScenarios: LegacyScenario[] = [
  { name: "owned exact source hydrates delivery before sender", provenance: digest, expectedKey: "wire@example.test", delivery: true, senderWrites: 1 },
  { name: "legacy cache without provenance hydrates delivery only", provenance: null, expectedKey: null, delivery: true, senderWrites: 0 },
  { name: "replaced exact source fails provenance", provenance: "0".repeat(64), expectedKey: null, delivery: true, senderWrites: 0 },
  { name: "existing sender key is preserved", provenance: digest, key: "retained@example.test", expectedKey: "retained@example.test", delivery: true, senderWrites: 0 },
  { name: "missing source performs no writes", provenance: digest, missing: true, expectedKey: null, delivery: false, senderWrites: 0 },
  { name: "collision source fallback cannot establish sender ownership", provenance: digest, baseOnly: true, expectedKey: null, delivery: true, senderWrites: 0 },
  { name: "already hydrated delivery allows sender-only backfill", provenance: digest, hydrated: true, expectedKey: "wire@example.test", delivery: false, senderWrites: 1 },
  { name: "COALESCE preserves populated delivery and identity", provenance: digest, partial: true, expectedKey: "wire@example.test", delivery: true, senderWrites: 1 }
];

test.each(legacyScenarios)("retrieval matches 620a785: $name", async scenario => {
  const f = await createCollabFixture();
  const id = "synthetic-0123456789ab";
  await f.seed(f.message("<legacy@example.test>", {
    id, from: "Display Sender <display@example.test>", senderKey: scenario.key ?? null,
    hasSource: true, attachments: [{ id: "part", filename: "synthetic.txt", contentType: "text/plain", size: 17, inline: true, cid: "synthetic-cid" }]
  }));
  f.db.prepare(`UPDATE messages SET sourceSha256=?, deliveredTo=?, originalTo=?, senderIdentityId=? WHERE accountId=? AND id=?`)
    .run(scenario.provenance, scenario.hydrated ? '[]' : null, scenario.hydrated ? '[]' : scenario.partial ? '["retained@example.test"]' : null, scenario.partial ? "retained-identity" : null, f.accountId, id);
  f.db.prepare(`INSERT INTO message_calendar_events(accountId,messageId,eventUid,inviteActionType,processedAtMs,processedByUserId,processedAutomatically,unprocessedReason)
    VALUES(?,?,' B@example.test ','invitation',123,' synthetic-user ',1,'event_series_not_found'),(?,?,'a@example.test','invalid',NULL,NULL,0,NULL)`)
    .run(f.accountId, id, f.accountId, id);
  if (!scenario.missing) await saveMessageSource(f.accountId, scenario.baseOnly ? "synthetic" : id, source);
  const before = await observe(f, id, referenceGetMessageById);
  const after = await observe(f, id, getMessageById);
  expect(after).toEqual(before);
  expect(after.result?.senderKey).toBe(scenario.expectedKey);
  expect(after.result?.attachments).toHaveLength(1);
  expect(after.result?.calendarEventUids).toEqual(["b@example.test", "a@example.test"]);
  expect(after.result?.calendarInviteStates).toHaveLength(1);
  const writes = after.trace.filter(call => call.method === "run");
  expect(writes.filter(call => call.sql.includes("SET senderKey = ?"))).toHaveLength(scenario.senderWrites);
  expect(writes.filter(call => call.sql.includes("deliveredTo=COALESCE"))).toHaveLength(scenario.delivery ? 1 : 0);
  if (scenario.delivery) expect(writes[0].sql).toContain("deliveredTo=COALESCE");
  if (scenario.partial) expect(after.result).toMatchObject({ originalTo: ["retained@example.test"], senderIdentityId: "retained-identity" });
});

test.each(["senderKey", "fromAddr", "sourceSha256"])("retrieval matches 620a785 when concurrent resync changes %s", async column => {
  const f = await createCollabFixture();
  const [message] = await f.seed(f.message("<race@example.test>", { id: "race", senderKey: null, hasSource: true, deliveredTo: [], originalTo: [] }));
  f.db.prepare("UPDATE messages SET sourceSha256=? WHERE accountId=? AND id=?").run(digest, f.accountId, message.id);
  await saveMessageSource(f.accountId, message.id, source);
  const mutate = f.db.prepare(`UPDATE messages SET ${column}=? WHERE accountId=? AND id=?`);
  const inject = () => mutate.run(column === "senderKey" ? "concurrent@example.test" : "changed", f.accountId, message.id);
  const before = await observe(f, message.id, referenceGetMessageById, inject);
  const after = await observe(f, message.id, getMessageById, inject);
  expect(after).toEqual(before);
  expect(after.trace.find(call => call.sql.includes("SET senderKey = ?"))?.changes).toBe(0);
  expect(after.result?.senderKey).toBe(column === "senderKey" ? "concurrent@example.test" : null);
});

test("retrieval preserves exact/collision/RFC/LIKE/missing lookups and shared-shard isolation after reopening", async () => {
  const f = await createCollabFixture();
  await f.seed(
    f.message("thread", { id: "base", messageId: "<Shared@EXAMPLE.TEST>", dateValue: 1000, senderKey: "a@example.test" }),
    f.message("thread", { id: "newer", messageId: "<shared@example.test>", dateValue: 2000, senderKey: "a@example.test" }),
    f.message("thread", { id: "variant-0123456789ab", messageId: "prefix-like@example.test-suffix", senderKey: "a@example.test" })
  );
  const other = await createCollabFixture();
  closeAccountDbConnection(getDefaultAccountDbPath(other.accountId));
  (await getDb()).prepare("UPDATE accounts SET dbPath=? WHERE id=?").run(getDefaultAccountDbPath(f.accountId), other.accountId);
  await other.api.saveFoldersForAccount(other.accountId, [{ id: other.folderId, accountId: other.accountId, name: "INBOX", count: 0 }]);
  await other.seed(other.message("thread", { id: "base", messageId: "<shared@example.test>", senderKey: "b@example.test" }));
  for (const [lookup, expectedId] of [
    [" base ", "base"], ["base-0123456789ab", "base"], ["variant-0123456789ab", "variant-0123456789ab"],
    ["<SHARED@example.test>", "newer"], ["<like@example.test>", "variant-0123456789ab"], ["missing", null], [" ", null]
  ]) {
    const before = await observe(f, lookup!, referenceGetMessageById);
    const after = await observe(f, lookup!, getMessageById);
    expect(after).toEqual(before);
    expect(after.result?.id ?? null).toBe(expectedId);
    expect(after.trace.filter(call => call.method === "run")).toEqual([]);
  }
  expect((await getMessageById(other.accountId, "base"))?.senderKey).toBe("b@example.test");
  closeAccountDbConnection(getDefaultAccountDbPath(f.accountId));
  expect((await getMessageById(f.accountId, "base"))?.senderKey).toBe("a@example.test");
  expect((await getMessageById(other.accountId, "base"))?.senderKey).toBe("b@example.test");
});

test("stable retrieval reads reuse connection statements across opens and collision candidates", async () => {
  const f = await createCollabFixture();
  await f.seed(f.message("thread", { id: "base", senderKey: "sender@example.test", deliveredTo: [], originalTo: [] }));
  await getAccountDb(f.accountId);
  const query = f.db.query;
  const prepare = f.db.prepare;
  const reads = new Map<string, Set<unknown>>();
  let candidateExecutions = 0;
  let candidateLookups = 0;
  const unexpectedPreparations: string[] = [];
  f.db.query = (sql: string) => {
    const statement = query.call(f.db, sql);
    if (sql.includes("SELECT * FROM messages WHERE accountId = ? AND id = ?") ||
      sql.includes("SELECT * FROM attachments WHERE") || sql.includes("FROM message_calendar_events")) {
      const statements = reads.get(sql) ?? new Set();
      statements.add(statement);
      reads.set(sql, statements);
      if (sql.includes("SELECT * FROM messages")) {
        candidateLookups++;
        return { get: (...args: unknown[]) => { candidateExecutions++; return statement.get(...args); } };
      }
    }
    return statement;
  };
  f.db.prepare = (sql: string) => {
    if (sql.includes("SELECT * FROM messages WHERE accountId = ? AND id = ?") ||
      sql.includes("SELECT * FROM attachments WHERE") || sql.includes("FROM message_calendar_events")) unexpectedPreparations.push(sql);
    return prepare.call(f.db, sql);
  };
  try {
    const first = await getMessageById(f.accountId, "base-0123456789ab");
    const second = await getMessageById(f.accountId, "base-0123456789ab");
    expect(second).toEqual(first);
    expect(candidateLookups).toBe(2);
    expect(candidateExecutions).toBe(4);
    expect(reads.size).toBe(3);
    for (const statements of reads.values()) expect(statements.size).toBe(1);
    expect(unexpectedPreparations).toEqual([]);
  } finally {
    f.db.query = query;
    f.db.prepare = prepare;
  }
});
