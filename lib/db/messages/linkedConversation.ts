/**
 * Conversations across mailboxes of one domain.
 *
 * A conversation opened in mailbox A is matched against other mailboxes by
 * RFC header ids only (Message-ID, In-Reply-To, References), never by
 * subject. Callers pass only the peer mailboxes the signed-in user may read;
 * this module never decides access.
 *
 * The lookup per peer shard is two indexed reads: matching rows by
 * `lower(messageId)` (idx_messages_account_msgid_date), `lower(inReplyTo)`
 * (idx_messages_account_inreplyto_lower) and `threadId`
 * (idx_messages_account_thread_date) in separate `UNION ALL` branches, then
 * the peer's matched threads (see `buildPeerConversationQueries`).
 */
import type { Message } from "../../data";
import type { ThreadDateSource } from "../../threadDate";
import { getAccountDb } from "../connection";
import { getFolderSpecialKind } from "../../specialFolders";
import { parseReferences } from "./_shared";
import {
  applyExcludedFolderFilters,
  applyVisibleMessageFilters,
  hydrateThreadMessageRows,
  threadMessageSelectColumns
} from "./query";

/** Newest rows of the opened conversation whose header ids are matched. */
const MAX_SOURCE_ROWS = 200;
/** Header ids sent to one peer query (each id is queried with and without brackets). */
const MAX_KEYS = 300;
/** Peer conversations merged per peer mailbox. */
const MAX_PEER_THREADS = 10;
/** Foreign messages returned in total (newest kept). */
export const MAX_LINKED_MESSAGES = 100;

/** Folders whose messages never join another mailbox's conversation. */
const EXCLUDED_PEER_FOLDER_KINDS = new Set(["trash", "spam", "drafts"]);

/** Comparison form of a header id: trimmed, lower-case, without angle brackets. */
export function normalizeConversationHeaderId(value?: string | null) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  const core = trimmed.startsWith("<") && trimmed.endsWith(">") ? trimmed.slice(1, -1).trim() : trimmed;
  return core || null;
}

type SourceRow = {
  id: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
};

export type LinkedConversationSource = {
  /** Normalized header ids of the opened conversation (Message-ID, In-Reply-To, References). */
  keys: string[];
  /** Raw (trimmed) header ids, matched against peer thread ids. */
  rawKeys: string[];
  /** Normalized Message-ID → row id of the opened mailbox's own copies. */
  ownIds: Map<string, string>;
  ownRowIds: Set<string>;
};

/** Header ids of one conversation in one mailbox. */
export async function readLinkedConversationSource(params: {
  accountId: string;
  threadId: string;
  excludeFolderIds?: string[];
}): Promise<LinkedConversationSource> {
  const threadId = params.threadId.trim();
  const db = await getAccountDb(params.accountId);
  const args: unknown[] = [params.accountId, threadId];
  let where = applyVisibleMessageFilters("m.accountId = ? AND m.threadId = ?");
  where = applyExcludedFolderFilters(where, args, (params.excludeFolderIds ?? []).slice(0, 400));
  const rows = db
    .prepare(
      `SELECT m.id, m.messageId, m.inReplyTo, m."references" FROM messages m
       WHERE ${where}
       ORDER BY m.dateValue DESC, m.id DESC
       LIMIT ?`
    )
    .all(...args, MAX_SOURCE_ROWS) as SourceRow[];
  const keys = new Set<string>();
  const rawKeys = new Set<string>();
  const ownIds = new Map<string, string>();
  const add = (value?: string | null) => {
    const raw = value?.trim();
    const key = normalizeConversationHeaderId(raw);
    if (!raw || !key) return;
    rawKeys.add(raw);
    keys.add(key);
  };
  add(threadId);
  for (const row of rows) {
    const own = normalizeConversationHeaderId(row.messageId);
    if (own && !ownIds.has(own)) ownIds.set(own, String(row.id));
    add(row.messageId);
    add(row.inReplyTo);
    (parseReferences(row.references) ?? []).forEach(add);
  }
  return {
    keys: Array.from(keys).slice(0, MAX_KEYS),
    rawKeys: Array.from(rawKeys).slice(0, MAX_KEYS),
    ownIds,
    ownRowIds: new Set(rows.map((row) => String(row.id)))
  };
}

function excludedPeerFolderIds(db: any, accountId: string) {
  const rows = db
    .prepare(`SELECT id, name, specialUse FROM folders WHERE accountId = ?`)
    .all(accountId) as Array<{ id: string; name: string; specialUse: string | null }>;
  return rows
    .filter((row) => {
      const kind = getFolderSpecialKind({ name: row.name, specialUse: row.specialUse ?? undefined });
      return kind !== null && EXCLUDED_PEER_FOLDER_KINDS.has(kind);
    })
    .map((row) => row.id);
}

type PeerQuery = { sql: string; args: unknown[] };

/**
 * The two reads of one peer mailbox, as SQL (exported for the query-plan test).
 *
 * `match` finds the peer's conversations that share a header id. It is one
 * `UNION ALL` branch per key column, so each branch uses its own index
 * (an OR across the three columns would walk the whole shard by `accountId`).
 * `rows(threadIds)` reads the matched conversations; `+m.dateValue` keeps the
 * planner on idx_messages_account_thread_date instead of walking the shard
 * newest-first via idx_messages_account_date until enough rows match.
 */
export function buildPeerConversationQueries(
  peerAccountId: string,
  source: Pick<LinkedConversationSource, "keys" | "rawKeys">,
  excludedFolderIds: string[]
) {
  const filterArgs: unknown[] = [];
  const filters = applyExcludedFolderFilters(
    applyVisibleMessageFilters("COALESCE(m.draft, 0) = 0"),
    filterArgs,
    excludedFolderIds
  );
  const placeholders = (values: readonly unknown[]) => values.map(() => "?").join(",");
  // Stored Message-IDs normally keep their brackets; query both spellings.
  const messageIdKeys = Array.from(new Set(source.keys.flatMap((key) => [key, `<${key}>`])));
  const branches: Array<[column: string, values: readonly string[]]> = [
    ["lower(m.messageId)", messageIdKeys],
    ["lower(m.inReplyTo)", messageIdKeys],
    ["m.threadId", source.rawKeys]
  ];
  const parts = branches.filter(([, values]) => values.length > 0);
  const match: PeerQuery = {
    sql: `SELECT threadId, MAX(dateValue) AS latest FROM (
      ${parts
        .map(([column, values]) => `SELECT m.threadId, m.dateValue FROM messages m
        WHERE m.accountId = ? AND ${column} IN (${placeholders(values)}) AND ${filters}`)
        .join("\n      UNION ALL\n      ")}
    )
    GROUP BY threadId
    ORDER BY latest DESC
    LIMIT ?`,
    args: [
      ...parts.flatMap(([, values]) => [peerAccountId, ...values, ...filterArgs]),
      MAX_PEER_THREADS
    ]
  };
  const rows = (threadIds: readonly string[]): PeerQuery => ({
    sql: `SELECT ${threadMessageSelectColumns("headers")} FROM messages m
      WHERE m.accountId = ? AND m.threadId IN (${placeholders(threadIds)}) AND ${filters}
      ORDER BY +m.dateValue DESC, m.id DESC
      LIMIT ?`,
    args: [peerAccountId, ...threadIds, ...filterArgs, MAX_LINKED_MESSAGES]
  });
  return { match, rows };
}

/** Header rows of one peer mailbox that belong to the source conversation. */
async function readPeerConversationRows(
  peerAccountId: string,
  source: LinkedConversationSource,
  options: { groupBy?: string; threadDateSource?: ThreadDateSource }
) {
  if (source.keys.length === 0) return [];
  const db = await getAccountDb(peerAccountId);
  const queries = buildPeerConversationQueries(peerAccountId, source, excludedPeerFolderIds(db, peerAccountId));
  const threadRows = db.prepare(queries.match.sql).all(...queries.match.args) as Array<{ threadId: string }>;
  const threadIds = threadRows.map((row) => String(row.threadId)).filter(Boolean);
  if (threadIds.length === 0) return [];
  const read = queries.rows(threadIds);
  const rows = db.prepare(read.sql).all(...read.args) as any[];
  return hydrateThreadMessageRows(db, peerAccountId, rows, { ...options, projection: "headers" });
}

/**
 * Messages of the same conversation that live in the given peer mailboxes,
 * as header rows re-threaded into the opened conversation:
 * - a Message-ID the opened mailbox already holds is dropped (its own copy wins),
 * - a Message-ID held by several peers is returned once (first peer in the given order),
 * - `threadId` is the opened conversation's id, `parentId` points at the
 *   replied-to row (own or linked) when it is present.
 * Ordered by date ascending.
 */
export async function listLinkedConversationMessages(params: {
  accountId: string;
  threadId: string;
  peerAccountIds: readonly string[];
  excludeFolderIds?: string[];
  groupBy?: string;
  threadDateSource?: ThreadDateSource;
}): Promise<Message[]> {
  const peers = params.peerAccountIds.filter((id) => id && id !== params.accountId);
  if (peers.length === 0) return [];
  const threadId = params.threadId.trim();
  if (!threadId) return [];
  const source = await readLinkedConversationSource({
    accountId: params.accountId,
    threadId,
    excludeFolderIds: params.excludeFolderIds
  });
  if (source.keys.length === 0) return [];
  const seen = new Set(source.ownIds.keys());
  const linked: Message[] = [];
  for (const peerAccountId of peers) {
    const rows = await readPeerConversationRows(peerAccountId, source, {
      groupBy: params.groupBy,
      threadDateSource: params.threadDateSource
    });
    for (const row of rows) {
      const key = normalizeConversationHeaderId(row.messageId);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      // Row ids derive from the Message-ID; an equal id is the same message.
      if (source.ownRowIds.has(row.id)) continue;
      linked.push(row);
    }
  }
  linked.sort((a, b) => b.dateValue - a.dateValue || b.id.localeCompare(a.id));
  const kept = linked.slice(0, MAX_LINKED_MESSAGES);
  const idByHeader = new Map(source.ownIds);
  kept.forEach((item) => {
    const key = normalizeConversationHeaderId(item.messageId);
    if (key && !idByHeader.has(key)) idByHeader.set(key, item.id);
  });
  return kept
    .map((item) => {
      const parentKeys = [item.inReplyTo, ...[...(item.references ?? [])].reverse()];
      let parentId: string | undefined;
      for (const value of parentKeys) {
        const candidate = idByHeader.get(normalizeConversationHeaderId(value) ?? "");
        if (candidate && candidate !== item.id) {
          parentId = candidate;
          break;
        }
      }
      return { ...item, threadId, parentId, linkedThreadId: item.threadId };
    })
    .sort((a, b) => a.dateValue - b.dateValue || a.id.localeCompare(b.id));
}
