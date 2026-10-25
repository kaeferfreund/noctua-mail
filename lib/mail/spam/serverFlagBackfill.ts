import type { Folder } from "@/lib/data";
import { isNonJunkKeyword } from "@/lib/messageFlags";
import { parseAddressEmails } from "@/lib/ownAddresses";
import { getRootDomain } from "@/lib/senderIdentity";
import { findInboxFolder, findJunkFolder, isSentFolder } from "@/lib/specialFolders";
import { folderMailboxPath } from "@/lib/mailboxPaths";
import type { SpamEvalRecord } from "./apply";
import type { SpamExampleSource } from "./examples";
import { sentToAddressInDb } from "../../db/sentRecipients";
import { buildSpamInputFromMessage } from "./input";
import { readSourceHeads } from "./profileBuild";
import { serverSpamScore } from "./senderProfile";
import { applyStaticRules, serverFlaggedSpam, type StaticRules } from "./staticRules";
import type { SpamInput } from "./types";

/**
 * Selection for the one-time backfill of server-flagged INBOX mail into Junk
 * (`scripts/spam-apply.ts --server-flagged`, doc/SPAM-DETECTION.md). The flag
 * (`X-Spam-Flag: YES` of the receiving server, the same top-most header the
 * classifier reads) is only in the stored source, so the first bytes of every
 * INBOX source are read; nothing else is parsed. Conservative: every reason a
 * household member may want the mail in the INBOX excludes it, and each
 * exclusion is counted and listed. A sender address that also sent unflagged
 * INBOX mail (SENDER_HISTORY_MIN) is a known sender whose flag is likely wrong. Works on any shard handle, so the dry run
 * uses the read-only copy and the apply re-checks over the app's connection.
 */
export const SERVER_FLAG_BACKFILL_SOURCE = "server-flag-backfill" satisfies SpamExampleSource;
/** The live sweep's window (service.ts SWEEP_WINDOW_MS): mail this young is left to the classifier. */
export const CLASSIFIER_WINDOW_MS = 3 * 24 * 60 * 60_000;
/** A sender address with this many INBOX mails without the flag is a known sender: its flagged mail stays. */
export const SENDER_HISTORY_MIN = 2;
const HEAD_BATCH = 2_000;
const SUBJECT_LIMIT = 80;

export type ServerFlagExclusion =
  | "pending-move" | "no-imap-uid" | "no-sender" | "no-junk-folder"
  | "flagged" | "answered" | "not-junk" | "replied" | "collab"
  | "classifier-decided" | "classifier-window"
  | "own-domain" | "ham-example" | "ham-domain" | "static-allow" | "correspondent" | "sender-history";
export type ServerFlagDecision = "move" | ServerFlagExclusion;

/** One server-flagged INBOX mail; `reasons` lists every exclusion that applies (empty: it moves). */
export type ServerFlagItem = {
  accountId: string;
  id: string;
  messageId: string | null;
  from: string;
  fromEmail: string | null;
  subject: string;
  date: string;
  dateValue: number;
  score: number | null;
  /** INBOX mails of the same address / root domain without the server flag (review hint: platforms with ham history). */
  senderUnflagged: number;
  domainUnflagged: number;
  decision: ServerFlagDecision;
  reasons: ServerFlagExclusion[];
};

export type ServerFlagAccountScan = {
  accountId: string;
  junkMailbox: string | null;
  inboxRows: number;
  withSource: number;
  flagged: number;
  counts: Partial<Record<ServerFlagDecision, number>>;
  items: ServerFlagItem[];
  /** `isCancelled` stopped the scan between two batches; counts and items are incomplete. */
  cancelled?: boolean;
};

/** A shard handle (bun:sqlite Database): the dry run's read-only one or the app's. */
export type ScanDb = { prepare: (sql: string) => { all: (...params: any[]) => any[] } };

export type ServerFlagHousehold = {
  ownAddresses: ReadonlySet<string>;
  ownDomains: ReadonlySet<string>;
  /** Whether any household mailbox has written to `email` (Sent folders). */
  isCorrespondent: (email: string) => boolean;
  staticRules: StaticRules;
};

type InboxRow = {
  id: string; messageId: string | null; threadId: string; fromAddr: string | null; toAddr: string | null; ccAddr: string | null;
  replyToAddr: string | null; subject: string | null; date: string; dateValue: number; flags: string | null; answered: number | null;
  flagged: number | null; imapUid: number | null; spamCheckedAt: number | null; pendingMoveStartedAt: number | null;
  listId: string | null; listUnsubscribe: string | null; hasSource: number | null;
};

const hasTable = (db: ScanDb, name: string) => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").all(name).length > 0;
const inDomain = (candidate: string, domain: string) => candidate === domain || candidate.endsWith(`.${domain}`);
const rootDomainOf = (email: string) => {
  const domain = email.slice(email.lastIndexOf("@") + 1);
  return getRootDomain(domain) ?? domain;
};
/** Message-IDs compared without angle brackets and case. */
const messageIdKey = (value: string) => value.trim().replace(/^<|>$/g, "").toLowerCase();
const messageIdKeys = (value: string | null) => (value ?? "").match(/<[^<>\s]+>/g)?.map(messageIdKey) ?? (value?.trim() ? [messageIdKey(value)] : []);

function parseFlags(value: string | null) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((flag): flag is string => typeof flag === "string") : [];
  } catch { return []; }
}

/** Senders and root domains with a stored "Kein Spam" / "Nicht verdächtig" example in this mailbox. */
function hamSenders(db: ScanDb, accountId: string) {
  const emails = new Set<string>();
  const domains = new Set<string>();
  if (!hasTable(db, "spam_examples")) return { emails, domains };
  for (const row of db.prepare("SELECT senderEmail, senderDomain FROM spam_examples WHERE accountId = ? AND label = 'ham'").all(accountId) as
    Array<{ senderEmail: string | null; senderDomain: string | null }>) {
    if (row.senderEmail) emails.add(row.senderEmail.toLowerCase());
    if (row.senderDomain) domains.add(row.senderDomain.toLowerCase());
  }
  return { emails, domains };
}

/** Threads with an assignee, a changed status, notes or a topic. */
function collabThreads(db: ScanDb, accountId: string) {
  const threads = new Set<string>();
  const add = (sql: string) => { for (const row of db.prepare(sql).all(accountId) as Array<{ threadId: string }>) threads.add(row.threadId); };
  if (hasTable(db, "thread_collab_state")) {
    add("SELECT threadId FROM thread_collab_state WHERE accountId = ? AND (assigneeUserId IS NOT NULL OR status != 'open' OR commentCount > 0)");
  }
  if (hasTable(db, "thread_comments")) add("SELECT DISTINCT threadId FROM thread_comments WHERE accountId = ? AND deletedAt IS NULL");
  if (hasTable(db, "thread_topics")) add("SELECT DISTINCT threadId FROM thread_topics WHERE accountId = ?");
  return threads;
}

/** Message-IDs a household address (or the Sent folder) has replied to: In-Reply-To and References of its mails. */
function repliedMessageIds(db: ScanDb, accountId: string, folders: Folder[], ownAddresses: ReadonlySet<string>) {
  const replied = new Set<string>();
  const rows = db.prepare(`SELECT folderId, fromAddr, inReplyTo, "references" AS refs FROM messages
    WHERE accountId = ? AND COALESCE(deleted, 0) = 0 AND (inReplyTo IS NOT NULL OR "references" IS NOT NULL)`).all(accountId) as
    Array<{ folderId: string; fromAddr: string | null; inReplyTo: string | null; refs: string | null }>;
  for (const row of rows) {
    const author = parseAddressEmails(row.fromAddr ?? "")[0]?.toLowerCase();
    if (!isSentFolder(row.folderId, folders) && !(author && ownAddresses.has(author))) continue;
    for (const key of [...messageIdKeys(row.inReplyTo), ...messageIdKeys(row.refs)]) replied.add(key);
  }
  return replied;
}

/** Whether any household Sent folder has written to an address (the `isCorrespondent` of ServerFlagHousehold), cached per address. */
export function createCorrespondentCheck(sentShards: Array<{ db: ScanDb; accountId: string; sentFolderId: string }>) {
  const cache = new Map<string, boolean>();
  return (email: string) => {
    let known = cache.get(email);
    if (known === undefined) {
      known = sentShards.some((shard) => sentToAddressInDb(shard.db, shard.accountId, shard.sentFolderId, email));
      cache.set(email, known);
    }
    return known;
  };
}

/**
 * Every server-flagged INBOX mail of one account with its decision; reads only
 * INBOX source heads. `since` (the admin rescan's range) judges and lists only
 * flagged mail with a `dateValue` from then on; the sender history still counts
 * the whole INBOX, so the exclusions stay the same as without it.
 */
export async function scanServerFlaggedInbox(params: {
  accountId: string;
  db: ScanDb;
  folders: Folder[];
  sourcesDir: string;
  household: ServerFlagHousehold;
  now?: number;
  since?: number | null;
  /** After each batch of source heads: INBOX rows read so far and in total. */
  onProgress?: (read: number, total: number) => void;
  isCancelled?: () => boolean;
}): Promise<ServerFlagAccountScan> {
  const { accountId, db, folders, household } = params;
  const now = params.now ?? Date.now();
  const inbox = findInboxFolder(folders, accountId);
  const junk = findJunkFolder(folders, accountId);
  const scan: ServerFlagAccountScan = {
    accountId, junkMailbox: junk ? folderMailboxPath(junk, accountId) : null, inboxRows: 0, withSource: 0, flagged: 0, counts: {}, items: []
  };
  if (!inbox) return scan;
  const rows = db.prepare(`SELECT id, messageId, threadId, fromAddr, toAddr, ccAddr, replyToAddr, subject, date, dateValue, flags, answered,
      flagged, imapUid, spamCheckedAt, pendingMoveStartedAt, listId, listUnsubscribe, hasSource
    FROM messages WHERE accountId = ? AND folderId = ? AND COALESCE(deleted, 0) = 0 ORDER BY dateValue ASC`).all(accountId, inbox.id) as InboxRow[];
  scan.inboxRows = rows.length;
  const ham = hamSenders(db, accountId);
  const collab = collabThreads(db, accountId);
  const replied = repliedMessageIds(db, accountId, folders, household.ownAddresses);

  // Pass 1: the server flag of every INBOX mail; unflagged mail (or mail without a stored source) counts as sender history.
  const flaggedRows: Array<{ row: InboxRow; input: SpamInput }> = [];
  const senderUnflagged = new Map<string, number>();
  const domainUnflagged = new Map<string, number>();
  const countUnflagged = (input: SpamInput) => {
    const email = input.fromEmail;
    if (!email) return;
    const root = rootDomainOf(email);
    senderUnflagged.set(email, (senderUnflagged.get(email) ?? 0) + 1);
    domainUnflagged.set(root, (domainUnflagged.get(root) ?? 0) + 1);
  };
  for (let start = 0; start < rows.length; start += HEAD_BATCH) {
    if (params.isCancelled?.()) return { ...scan, cancelled: true };
    const batch = rows.slice(start, start + HEAD_BATCH);
    const heads = await readSourceHeads(params.sourcesDir, accountId, batch.filter((row) => row.hasSource === 1).map((row) => row.id));
    scan.withSource += heads.size;
    for (const row of batch) {
      const head = heads.get(row.id);
      const input = buildSpamInputFromMessage({
        from: row.fromAddr ?? "", to: row.toAddr ?? "", cc: row.ccAddr, subject: row.subject ?? "", replyTo: row.replyToAddr,
        messageId: row.messageId, listId: row.listId, listUnsubscribe: row.listUnsubscribe, headers: head?.headers
      });
      if (head && serverFlaggedSpam(input)) flaggedRows.push({ row, input });
      else countUnflagged(input);
    }
    params.onProgress?.(Math.min(rows.length, start + batch.length), rows.length);
  }
  const since = params.since ?? null;
  const judged = since === null ? flaggedRows : flaggedRows.filter(({ row }) => row.dateValue >= since);
  scan.flagged = judged.length;

  // Pass 2: the exclusions of every flagged mail.
  for (const { row, input } of judged) {
    const flags = parseFlags(row.flags);
    const email = input.fromEmail;
    const domain = email ? email.slice(email.lastIndexOf("@") + 1) : "";
    const reasons: ServerFlagExclusion[] = [];
    const exclude = (reason: ServerFlagExclusion, applies: unknown) => { if (applies) reasons.push(reason); };
    exclude("pending-move", row.pendingMoveStartedAt !== null);
    exclude("no-imap-uid", typeof row.imapUid !== "number");
    exclude("no-sender", !email);
    exclude("no-junk-folder", !junk);
    exclude("flagged", row.flagged === 1 || flags.some((flag) => flag.toLowerCase() === "\\flagged"));
    exclude("answered", row.answered === 1 || flags.some((flag) => flag.toLowerCase() === "\\answered"));
    exclude("not-junk", flags.some(isNonJunkKeyword));
    exclude("replied", messageIdKeys(row.messageId).some((key) => replied.has(key)));
    exclude("collab", collab.has(row.threadId));
    exclude("classifier-decided", row.spamCheckedAt !== null);
    exclude("classifier-window", row.dateValue >= now - CLASSIFIER_WINDOW_MS);
    exclude("own-domain", email && (household.ownAddresses.has(email) || [...household.ownDomains].some((own) => inDomain(domain, own))));
    exclude("ham-example", email && ham.emails.has(email));
    exclude("ham-domain", domain && ham.domains.has(rootDomainOf(email!)));
    exclude("static-allow", applyStaticRules(household.staticRules, input).decision === "allow");
    exclude("correspondent", email && household.isCorrespondent(email));
    exclude("sender-history", email && (senderUnflagged.get(email) ?? 0) >= SENDER_HISTORY_MIN);
    const decision: ServerFlagDecision = reasons[0] ?? "move";
    scan.counts[decision] = (scan.counts[decision] ?? 0) + 1;
    const score = serverSpamScore(input.spamHeaders);
    scan.items.push({
      accountId, id: row.id, messageId: row.messageId, from: row.fromAddr ?? "", fromEmail: email,
      subject: (row.subject ?? "").slice(0, SUBJECT_LIMIT), date: row.date, dateValue: row.dateValue, score: score !== null && Number.isFinite(score) ? score : null,
      senderUnflagged: email ? senderUnflagged.get(email) ?? 0 : 0, domainUnflagged: email ? domainUnflagged.get(rootDomainOf(email)) ?? 0 : 0,
      decision, reasons
    });
  }
  return scan;
}

/** The candidates in the shape of `applySpamItems` (sequential move loop of scripts/spam-apply.ts). */
export function serverFlagApplyRecords(items: readonly ServerFlagItem[]): SpamEvalRecord[] {
  return items.filter((item) => item.decision === "move").map((item) => ({
    accountId: item.accountId, id: item.id, label: "ham", decision: "spam", source: SERVER_FLAG_BACKFILL_SOURCE,
    confidence: null, subject: item.subject, fromEmail: item.fromEmail, mailboxPath: "INBOX", serverSpamFlag: true
  }));
}

export type ReviewedServerFlagItem = Pick<ServerFlagItem, "accountId" | "id" | "messageId" | "decision">;

/** Reads the reviewed dry-run file (`--only`): only items still marked "move" count. */
export function parseReviewedServerFlagItems(json: unknown): ReviewedServerFlagItem[] {
  const list = (json as { items?: unknown })?.items;
  if (!Array.isArray(list)) throw new Error("--only must be the JSON written by --server-flagged --dry-run --out ({ items: [...] })");
  return list.filter((entry): entry is ReviewedServerFlagItem => !!entry && typeof entry === "object"
    && typeof entry.accountId === "string" && typeof entry.id === "string" && entry.decision === "move");
}

/**
 * Apply plan: the reviewed "move" items that the current data still selects
 * (same row id and Message-ID, still in the INBOX, no exclusion now). Reviewed
 * items the current scan does not select are reported, never moved.
 */
export function planServerFlagApply(reviewed: readonly ReviewedServerFlagItem[], current: readonly ServerFlagItem[]) {
  const byKey = new Map(current.map((item) => [`${item.accountId}\u0000${item.id}`, item]));
  const move: ServerFlagItem[] = [];
  const gone: ReviewedServerFlagItem[] = [];
  const nowExcluded: ServerFlagItem[] = [];
  const seen = new Set<string>();
  for (const entry of reviewed) {
    const key = `${entry.accountId}\u0000${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = byKey.get(key);
    if (!item || (entry.messageId ?? null) !== (item.messageId ?? null)) gone.push(entry);
    else if (item.decision !== "move") nowExcluded.push(item);
    else move.push(item);
  }
  return { move, gone, nowExcluded };
}
