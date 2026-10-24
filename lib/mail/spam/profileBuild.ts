import { open } from "node:fs/promises";
import path from "node:path";
import type { Folder } from "@/lib/data";
import { parseAddressEmails } from "@/lib/ownAddresses";
import { findInboxFolder, isDraftsFolder, isSentFolder, isSpamFolder, isTrashFolder } from "@/lib/specialFolders";
import type { RecentSenderMail } from "./anomaly";
import { buildSpamInputFromMessage } from "./input";
import { foldSenderMail, senderMailFacts, spamSenderKey, type SenderMailFacts, type SenderProfile } from "./senderProfile";

/**
 * Builds the sender profiles of one account shard from its stored rows in one
 * pass (backfill and `spam-eval --trust-profiles`): no full MIME parse, only
 * the first SOURCE_HEAD_BYTES of each source for the header block and the
 * attachment names. Rows of Sent, Drafts and Trash do not count; rows in a
 * Junk folder only raise the profile's junk count.
 */
export const SOURCE_HEAD_BYTES = 64 * 1024;
const HTML_LIMIT = 200_000;
/** The classifier reads at most 4,096 characters of text; quoted parts are dropped from this window. */
const BODY_LIMIT = 20_000;
const READ_CONCURRENCY = 32;
const ROW_BATCH = 2_000;

/** A shard handle (bun:sqlite Database): the scripts' read-only one or the app's. */
type ShardDb = { prepare: (sql: string) => { all: (...params: any[]) => any[] } };

/** All matching rows in rowid batches, so large HTML bodies never sit in memory at once. */
function* batchedRows<T>(db: ShardDb, columns: string, where: string, params: unknown[]): Generator<T> {
  const statement = db.prepare(`SELECT rowid AS _rowid, ${columns} FROM messages WHERE rowid > ? AND ${where} ORDER BY rowid LIMIT ${ROW_BATCH}`);
  let after = -Infinity;
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

type ProfileRow = {
  id: string; folderId: string; dateValue: number; fromAddr: string | null; toAddr: string | null; ccAddr: string | null;
  replyToAddr: string | null; subject: string | null; messageId: string | null; listId: string | null; listUnsubscribe: string | null;
  body: string | null; htmlBody: string | null; hasSource: number | null;
};

export type AccountProfileBuild = {
  profiles: Map<string, SenderProfile>;
  /** INBOX mails per sender (burst rule in the eval). */
  inboxMails: Map<string, Array<RecentSenderMail & { id: string }>>;
  rows: number;
  withSource: number;
};

export async function buildAccountSenderProfiles(params: {
  accountId: string;
  db: ShardDb;
  folders: Folder[];
  /** Household addresses (direct vs. Bcc). */
  ownAddresses: ReadonlySet<string>;
  /** Data dir `sources`; without it the auth facts are "unknown". */
  sourcesDir?: string;
}): Promise<AccountProfileBuild> {
  const { accountId, db, folders } = params;
  const skipped = new Set(folders.filter((folder) => isSentFolder(folder.id, folders) || isDraftsFolder(folder.id, folders)
    || isTrashFolder(folder.id, folders)).map((folder) => folder.id));
  const junk = new Set(folders.filter((folder) => isSpamFolder(folder.id, folders)).map((folder) => folder.id));
  const inboxId = findInboxFolder(folders, accountId)?.id ?? null;
  // Unary + keeps the planner on the rowid range: an accountId index would rescan the shard per batch.
  const live = "+accountId = ? AND COALESCE(deleted, 0) = 0";
  const ids = params.sourcesDir
    ? (db.prepare(`SELECT id, folderId FROM messages WHERE ${live} AND hasSource = 1`).all(accountId) as Array<{ id: string; folderId: string }>)
      .filter((row) => !skipped.has(row.folderId)).map((row) => row.id)
    : [];
  const heads = params.sourcesDir ? await readSourceHeads(params.sourcesDir, accountId, ids) : new Map<string, SourceHead>();

  const facts = new Map<string, SenderMailFacts[]>();
  const junkMails = new Map<string, number>();
  const inboxMails: AccountProfileBuild["inboxMails"] = new Map();
  let rows = 0;
  for (const row of batchedRows<ProfileRow>(db, `id, folderId, dateValue, fromAddr, toAddr, ccAddr, replyToAddr, subject, messageId,
      listId, listUnsubscribe, substr(body, 1, ${BODY_LIMIT}) AS body, substr(htmlBody, 1, ${HTML_LIMIT}) AS htmlBody, hasSource`, live, [accountId])) {
    if (skipped.has(row.folderId)) continue;
    rows += 1;
    if (junk.has(row.folderId)) {
      const key = spamSenderKey(parseAddressEmails(row.fromAddr ?? "")[0]);
      if (key) junkMails.set(key, (junkMails.get(key) ?? 0) + 1);
      continue;
    }
    const head = heads.get(row.id);
    const input = buildSpamInputFromMessage({
      from: row.fromAddr ?? "", to: row.toAddr ?? "", cc: row.ccAddr, subject: row.subject ?? "", replyTo: row.replyToAddr,
      messageId: row.messageId, listId: row.listId, listUnsubscribe: row.listUnsubscribe, body: row.body, htmlBody: row.htmlBody,
      attachments: head?.attachments, headers: head?.headers
    });
    const mail = senderMailFacts(input, { ownAddresses: params.ownAddresses, date: row.dateValue });
    if (!mail) continue;
    const list = facts.get(mail.senderKey);
    if (list) list.push(mail); else facts.set(mail.senderKey, [mail]);
    if (row.folderId === inboxId) {
      const entry = { id: row.id, date: row.dateValue, circle: mail.circle };
      const mails = inboxMails.get(mail.senderKey);
      if (mails) mails.push(entry); else inboxMails.set(mail.senderKey, [entry]);
    }
  }

  const profiles = new Map<string, SenderProfile>();
  for (const [senderKey, list] of facts) {
    list.sort((a, b) => a.date - b.date);
    let profile: SenderProfile | null = null;
    for (const mail of list) profile = foldSenderMail(profile, mail);
    if (profile) profiles.set(senderKey, profile);
  }
  for (const [senderKey, count] of junkMails) {
    const profile = profiles.get(senderKey);
    if (profile) profile.junkCount += count;
  }
  return { profiles, inboxMails, rows, withSource: heads.size };
}
