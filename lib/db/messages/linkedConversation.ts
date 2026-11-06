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
 * (idx_messages_account_inreplyto_lower) or `threadId`
 * (idx_messages_account_thread_date), then the peer's matched threads.
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

/** Header rows of one peer mailbox that belong to the source conversation. */
async function readPeerConversationRows(
  peerAccountId: string,
  source: LinkedConversationSource,
  options: { groupBy?: string; threadDateSource?: ThreadDateSource }
) {
  if (source.keys.length === 0) return [];
  const db = await getAccountDb(peerAccountId);
  const baseArgs: unknown[] = [peerAccountId];
  let baseWhere = applyVisibleMessageFilters("m.accountId = ? AND COALESCE(m.draft, 0) = 0");
  baseWhere = applyExcludedFolderFilters(baseWhere, baseArgs, excludedPeerFolderIds(db, peerAccountId));

  // Stored Message-IDs normally keep their brackets; query both spellings.
  const messageIdKeys = Array.from(new Set(source.keys.flatMap((key) => [key, `<${key}>`])));
  const matchArgs = [...baseArgs, ...messageIdKeys, ...messageIdKeys, ...source.rawKeys];
  const idList = messageIdKeys.map(() => "?").join(",");
  const threadRows = db
    .prepare(
      `SELECT m.threadId, MAX(m.dateValue) AS latest FROM messages m
       WHERE ${baseWhere}
         AND (lower(m.messageId) IN (${idList})
           OR lower(m.inReplyTo) IN (${idList})
           OR m.threadId IN (${source.rawKeys.map(() => "?").join(",")}))
       GROUP BY m.threadId
       ORDER BY latest DESC
       LIMIT ?`
    )
    .all(...matchArgs, MAX_PEER_THREADS) as Array<{ threadId: string }>;
  const threadIds = threadRows.map((row) => String(row.threadId)).filter(Boolean);
  if (threadIds.length === 0) return [];
  const rows = db
    .prepare(
      `SELECT ${threadMessageSelectColumns("headers")} FROM messages m
       WHERE ${baseWhere} AND m.threadId IN (${threadIds.map(() => "?").join(",")})
       ORDER BY m.dateValue DESC, m.id DESC
       LIMIT ?`
    )
    .all(...baseArgs, ...threadIds, MAX_LINKED_MESSAGES) as any[];
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
