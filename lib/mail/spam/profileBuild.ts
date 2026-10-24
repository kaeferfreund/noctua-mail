import { open } from "node:fs/promises";
import path from "node:path";
import type { Folder } from "@/lib/data";
import { parseAddressEmails } from "@/lib/ownAddresses";
import { findInboxFolder, isDraftsFolder, isSentFolder, isSpamFolder, isTrashFolder } from "@/lib/specialFolders";
import type { RecentSenderMail } from "./anomaly";
import { buildSpamInputFromMessage, parseHeaderBlock, topReceivedAt } from "./input";
import {
  emptySenderProfile,
  foldSenderMail,
  PROFILE_MAIL_IDS,
  profileMailKey,
  senderMailFacts,
  spamArrivalTime,
  spamSenderKey,
  type SenderMailFacts,
  type SenderProfile
} from "./senderProfile";

/**
 * Builds the sender profiles of one account shard from its stored rows in one
 * pass (backfill and `spam-eval --trust-profiles`): no full MIME parse, only
 * the first SOURCE_HEAD_BYTES of each source for the header block and the
 * attachment names. Rows of Sent, Drafts and Trash do not count; rows in a
 * Junk folder only raise the profile's junk count. Stored "Als Spam" decisions
 * (spam_examples) become the profile's lastUserSpamAt. A mail's time is its
 * arrival (the Received stamp of the source head); only rows without one fall
 * back to dateValue (rows without a stored source: no authentication either).
 */
export const SOURCE_HEAD_BYTES = 64 * 1024;
const HTML_LIMIT = 200_000;
/** The classifier reads at most 4,096 characters of text; quoted parts are dropped from this window. */
const BODY_LIMIT = 20_000;
const READ_CONCURRENCY = 32;
const ROW_BATCH = 2_000;

/** A shard handle (bun:sqlite Database): the scripts' read-only one or the app's. */
type ShardDb = { prepare: (sql: string) => { all: (...params: any[]) => any[] } };

/** All matching rows after rowid `start` in rowid batches, so large HTML bodies never sit in memory at once. */
function* batchedRows<T>(db: ShardDb, columns: string, where: string, params: unknown[], start: number): Generator<T> {
  const statement = db.prepare(`SELECT rowid AS _rowid, ${columns} FROM messages WHERE rowid > ? AND ${where} ORDER BY rowid LIMIT ${ROW_BATCH}`);
  let after = start;
  for (;;) {
    const rows = statement.all(after, ...params) as Array<T & { _rowid: number }>;
    yield* rows;
    if (rows.length < ROW_BATCH) return;
    after = rows[rows.length - 1]._rowid;
  }
}

export type SourceHead = { headers: string; attachments: Array<{ filename: string; contentType: string }> };

const PART_NAME = /^content-(?:disposition|type):[^\n]*?\b(?:file)?name\*?=\s*"?([^";\r\n]+)/gim;

/** Header block and the attachment names visible in the first bytes of a source. */
export function parseSourceHead(head: string): SourceHead {
  const end = head.search(/\r?\n\r?\n/);
  const headers = end >= 0 ? head.slice(0, end) : head;
  const body = end >= 0 ? head.slice(end) : "";
  const names = new Set<string>();
  for (const match of body.replace(/\r?\n[ \t]+/g, " ").matchAll(PART_NAME)) names.add(match[1].trim());
  return { headers, attachments: [...names].slice(0, 10).map((filename) => ({ filename, contentType: "" })) };
}

async function readHead(file: string, buffer: Buffer): Promise<SourceHead | null> {
  let handle;
  try {
    handle = await open(file, "r");
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return parseSourceHead(buffer.toString("latin1", 0, bytesRead));
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

/** Reads the heads of many sources with bounded parallelism (cold disks are seek-bound). */
export async function readSourceHeads(sourcesDir: string, accountId: string, ids: string[]) {
  const heads = new Map<string, SourceHead>();
  const dir = path.join(sourcesDir, encodeURIComponent(accountId));
  let cursor = 0;
  await Promise.all(Array.from({ length: READ_CONCURRENCY }, async () => {
    // One buffer per reader: allocating 64 KB per source dominated the run time.
    const buffer = Buffer.allocUnsafe(SOURCE_HEAD_BYTES);
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const head = await readHead(path.join(dir, `${encodeURIComponent(id)}.eml`), buffer);
      if (head) heads.set(id, head);
    }
  }));
  return heads;
}

/**
 * Arrival of a stored row (burst rule): the Received stamp of its source head,
 * else the time it was checked, else its dateValue (rows without either).
 */
export function storedMailArrival(row: { dateValue: number; spamCheckedAt?: number | null }, head: SourceHead | undefined) {
  return spamArrivalTime({ receivedAt: head ? topReceivedAt(parseHeaderBlock(head.headers)) : null }, row.spamCheckedAt ?? row.dateValue);
}

type ProfileRow = {
  id: string; folderId: string; dateValue: number; fromAddr: string | null; toAddr: string | null; ccAddr: string | null;
  replyToAddr: string | null; subject: string | null; messageId: string | null; listId: string | null; listUnsubscribe: string | null;
  body: string | null; htmlBody: string | null; hasSource: number | null;
};

/** One counted mail of a sender: its facts and the row id. */
export type SenderMailRecord = SenderMailFacts & { id: string };

export type AccountProfileBuild = {
  profiles: Map<string, SenderProfile>;
  /** The counted mails per sender by arrival (the eval folds only the mails before the judged one). */
  mails: Map<string, SenderMailRecord[]>;
  /** Mails per sender in Junk folders. */
  junkMails: Map<string, number>;
  /** The row ids behind `junkMails` (the backfill keeps live junk counts of other mails). */
  junkIds: Map<string, string[]>;
  /** Latest stored "Als Spam" decision per sender. */
  userSpam: Map<string, number>;
  /** INBOX mails per sender (burst rule in the eval). */
  inboxMails: Map<string, Array<RecentSenderMail & { id: string }>>;
  rows: number;
  withSource: number;
  /** The rows up to this rowid are folded in; a catch-up (`previous`) reads only the rows after it. */
  lastRowid: number;
};

const appendTo = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const list = map.get(key);
  if (list) list.push(value); else map.set(key, [value]);
};
const copyLists = <T>(map: Map<string, T[]> | undefined) => new Map([...(map ?? [])].map(([key, list]) => [key, [...list]]));

/**
 * One pass over the shard's rows up to its current last rowid. With
 * `previous` only the rows stored since that build are read and added to it
 * (the backfill catches up with mail that arrived while it was building).
 */
export async function buildAccountSenderProfiles(params: {
  accountId: string;
  db: ShardDb;
  folders: Folder[];
  /** Household addresses (direct vs. Bcc). */
  ownAddresses: ReadonlySet<string>;
  /** Data dir `sources`; without it the auth facts are "unknown". */
  sourcesDir?: string;
  previous?: AccountProfileBuild;
}): Promise<AccountProfileBuild> {
  const { accountId, db, folders, previous } = params;
  const skipped = new Set(folders.filter((folder) => isSentFolder(folder.id, folders) || isDraftsFolder(folder.id, folders)
    || isTrashFolder(folder.id, folders)).map((folder) => folder.id));
  const junk = new Set(folders.filter((folder) => isSpamFolder(folder.id, folders)).map((folder) => folder.id));
  const inboxId = findInboxFolder(folders, accountId)?.id ?? null;
  const after = previous?.lastRowid ?? 0;
  const lastRowid = (db.prepare("SELECT COALESCE(MAX(rowid), 0) AS last FROM messages").all()[0] as { last: number }).last;
  // Unary + keeps the planner on the rowid range: an accountId index would rescan the shard per batch.
  const live = "+accountId = ? AND COALESCE(deleted, 0) = 0 AND rowid <= ?";
  const ids = params.sourcesDir
    ? (db.prepare(`SELECT id, folderId FROM messages WHERE ${live} AND rowid > ? AND hasSource = 1`).all(accountId, lastRowid, after) as Array<{ id: string; folderId: string }>)
      .filter((row) => !skipped.has(row.folderId)).map((row) => row.id)
    : [];
  const heads = params.sourcesDir ? await readSourceHeads(params.sourcesDir, accountId, ids) : new Map<string, SourceHead>();

  const mails = copyLists(previous?.mails);
  const junkMails = new Map(previous?.junkMails);
  const junkIds = copyLists(previous?.junkIds);
  const inboxMails = copyLists(previous?.inboxMails);
  let rows = previous?.rows ?? 0;
  for (const row of batchedRows<ProfileRow>(db, `id, folderId, dateValue, fromAddr, toAddr, ccAddr, replyToAddr, subject, messageId,
      listId, listUnsubscribe, substr(body, 1, ${BODY_LIMIT}) AS body, substr(htmlBody, 1, ${HTML_LIMIT}) AS htmlBody, hasSource`, live, [accountId, lastRowid], after)) {
    if (skipped.has(row.folderId)) continue;
    rows += 1;
    if (junk.has(row.folderId)) {
      const key = spamSenderKey(parseAddressEmails(row.fromAddr ?? "")[0]);
      if (key) {
        junkMails.set(key, (junkMails.get(key) ?? 0) + 1);
        appendTo(junkIds, key, row.id);
      }
      continue;
    }
    const head = heads.get(row.id);
    const input = buildSpamInputFromMessage({
      from: row.fromAddr ?? "", to: row.toAddr ?? "", cc: row.ccAddr, subject: row.subject ?? "", replyTo: row.replyToAddr,
      messageId: row.messageId, listId: row.listId, listUnsubscribe: row.listUnsubscribe, body: row.body, htmlBody: row.htmlBody,
      attachments: head?.attachments, headers: head?.headers
    });
    const facts = senderMailFacts(input, { ownAddresses: params.ownAddresses, arrivedAt: row.dateValue });
    if (!facts) continue;
    const mail = { ...facts, id: row.id };
    appendTo(mails, mail.senderKey, mail);
    if (row.folderId === inboxId) appendTo(inboxMails, mail.senderKey, { id: row.id, date: mail.date, circle: mail.circle });
  }

  for (const list of mails.values()) list.sort((a, b) => a.date - b.date);
  const userSpam = storedUserSpam(db, accountId);
  const profiles = new Map<string, SenderProfile>();
  for (const senderKey of new Set([...mails.keys(), ...userSpam.keys()])) {
    profiles.set(senderKey, foldSenderMails(senderKey, mails.get(senderKey) ?? [], junkMails.get(senderKey) ?? 0, userSpam.get(senderKey) ?? null,
      null, junkIds.get(senderKey)));
  }
  return { profiles, mails, junkMails, junkIds, userSpam, inboxMails, rows, withSource: (previous?.withSource ?? 0) + heads.size, lastRowid };
}

/**
 * The profile of `list` (sorted by arrival; records with an id are remembered)
 * with the sender's junk count, the ids behind it and the "Als Spam" time.
 */
export function foldSenderMails(senderKey: string, list: ReadonlyArray<SenderMailFacts & { id?: string }>, junkCount: number,
  lastUserSpamAt: number | null, start: SenderProfile | null = null, junkIds: readonly string[] = []): SenderProfile {
  let profile = start;
  for (const mail of list) profile = foldSenderMail(profile, mail);
  const result = profile ?? emptySenderProfile(senderKey, lastUserSpamAt ?? Date.now());
  result.junkCount = junkCount;
  result.junkMailIds = junkIds.slice(-PROFILE_MAIL_IDS).map(profileMailKey);
  result.lastUserSpamAt = Math.max(result.lastUserSpamAt ?? 0, lastUserSpamAt ?? 0) || null;
  return result;
}

/** Latest "Als Spam" per sender key from the shard's stored user decisions (none on shards without the table). */
function storedUserSpam(db: ShardDb, accountId: string) {
  const latest = new Map<string, number>();
  if (!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'spam_examples'`).all().length) return latest;
  const rows = db.prepare(`SELECT senderEmail, MAX(createdAt) AS at FROM spam_examples
    WHERE accountId = ? AND label = 'spam' AND senderEmail IS NOT NULL GROUP BY senderEmail`).all(accountId) as Array<{ senderEmail: string; at: number }>;
  for (const row of rows) {
    const key = spamSenderKey(row.senderEmail);
    if (key) latest.set(key, Math.max(latest.get(key) ?? 0, row.at));
  }
  return latest;
}
