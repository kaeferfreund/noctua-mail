/**
 * Bounded reader windows over one conversation.
 *
 * Opening a thread returns header rows only: the anchor (selected or
 * deep-linked message) with up to `before` older and `after` newer
 * neighbours, plus the newest message. Remaining ranges are reachable through
 * opaque, exclusive cursors. Order is `(dateValue, id)` so equal dates page
 * deterministically. Parents outside the returned rows come back as header
 * placeholders so reply references still resolve.
 */
import type { Message } from "../../data";
import type { ThreadDateSource } from "../../threadDate";
import { getAccountDb } from "../connection";
import {
  applyExcludedFolderFilters,
  applyVisibleMessageFilters,
  hydrateThreadMessageRows,
  threadMessageSelectColumns
} from "./query";

export const THREAD_WINDOW_DEFAULT_BEFORE = 10;
export const THREAD_WINDOW_DEFAULT_AFTER = 10;
export const THREAD_WINDOW_DEFAULT_PAGE_SIZE = 20;
const THREAD_WINDOW_MAX_SPAN = 100;
const MAX_EXCLUDED_FOLDERS = 400;

type WindowKey = [dateValue: number, id: string];

type ThreadWindowCursorPayload = {
  v: 1;
  thread: string;
  dir: "older" | "newer";
  /** Exclusive lower bound (newer) or upper bound (older). */
  from: WindowKey;
  /** Exclusive upper bound of a newer gap: the already returned newest row. */
  to?: WindowKey;
};

export type ThreadWindowInfo = {
  total: number;
  anchorId: string | null;
  hasOlder: boolean;
  olderCursor: string | null;
  hasNewer: boolean;
  newerCursor: string | null;
};

export type ThreadWindowResult = {
  items: Message[];
  placeholders: Message[];
  window: ThreadWindowInfo;
};

export class ThreadWindowCursorError extends Error {}

function clampCount(value: unknown, fallback: number, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(THREAD_WINDOW_MAX_SPAN, Math.max(min, Math.floor(parsed)));
}

function isWindowKey(value: unknown): value is WindowKey {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "string" &&
    value[1].length > 0
  );
}

export function encodeThreadWindowCursor(payload: Omit<ThreadWindowCursorPayload, "v">) {
  return Buffer.from(JSON.stringify({ v: 1, ...payload })).toString("base64url");
}

export function decodeThreadWindowCursor(cursor: string, threadId: string) {
  let parsed: Partial<ThreadWindowCursorPayload> | null = null;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    parsed = null;
  }
  if (
    !parsed ||
    parsed.v !== 1 ||
    parsed.thread !== threadId ||
    (parsed.dir !== "older" && parsed.dir !== "newer") ||
    !isWindowKey(parsed.from) ||
    (parsed.to !== undefined && !isWindowKey(parsed.to))
  ) {
    throw new ThreadWindowCursorError("Invalid thread window cursor");
  }
  return parsed as ThreadWindowCursorPayload;
}

const keyOf = (row: { dateValue: number; id: string }): WindowKey => [Number(row.dateValue), String(row.id)];

export async function listThreadMessageWindow(params: {
  accountId: string;
  threadId: string;
  anchorMessageId?: string | null;
  cursor?: string | null;
  before?: number;
  after?: number;
  pageSize?: number;
  excludeFolderIds?: string[];
  /** Only rows of this folder (a conversation read in trash or spam shows only those). */
  folderId?: string | null;
  groupBy?: string;
  threadDateSource?: ThreadDateSource;
}): Promise<ThreadWindowResult> {
  const { accountId, groupBy, threadDateSource } = params;
  const threadId = params.threadId.trim();
  const cursor = params.cursor ? decodeThreadWindowCursor(params.cursor, threadId) : null;
  const before = clampCount(params.before, THREAD_WINDOW_DEFAULT_BEFORE);
  const after = clampCount(params.after, THREAD_WINDOW_DEFAULT_AFTER);
  const pageSize = clampCount(params.pageSize, THREAD_WINDOW_DEFAULT_PAGE_SIZE, 1);
  const db = await getAccountDb(accountId);

  const baseArgs: unknown[] = [accountId, threadId];
  let baseWhere = applyVisibleMessageFilters("m.accountId = ? AND m.threadId = ?");
  baseWhere = applyExcludedFolderFilters(
    baseWhere,
    baseArgs,
    (params.excludeFolderIds ?? []).slice(0, MAX_EXCLUDED_FOLDERS)
  );
  if (params.folderId) {
    baseWhere += " AND m.folderId = ?";
    baseArgs.push(params.folderId);
  }

  type KeyRow = { id: string; dateValue: number };
  const selectKeys = (condition: string, args: unknown[], order: "ASC" | "DESC", limit: number) =>
    limit <= 0
      ? []
      : (db
          .prepare(
            `SELECT m.id, m.dateValue FROM messages m
             WHERE ${baseWhere}${condition}
             ORDER BY m.dateValue ${order}, m.id ${order}
             LIMIT ?`
          )
          .all(...baseArgs, ...args, limit) as KeyRow[]);
  const olderThan = (key: WindowKey) => ({
    sql: " AND (m.dateValue < ? OR (m.dateValue = ? AND m.id < ?))",
    args: [key[0], key[0], key[1]]
  });
  const newerThan = (key: WindowKey) => ({
    sql: " AND (m.dateValue > ? OR (m.dateValue = ? AND m.id > ?))",
    args: [key[0], key[0], key[1]]
  });
  const combine = (...parts: Array<{ sql: string; args: unknown[] }>) => ({
    sql: parts.map((part) => part.sql).join(""),
    args: parts.flatMap((part) => part.args)
  });

  const total = Number(
    (db.prepare(`SELECT COUNT(*) AS total FROM messages m WHERE ${baseWhere}`).get(...baseArgs) as {
      total: number;
    }).total ?? 0
  );

  const selected: KeyRow[] = [];
  const window: ThreadWindowInfo = {
    total,
    anchorId: null,
    hasOlder: false,
    olderCursor: null,
    hasNewer: false,
    newerCursor: null
  };

  if (cursor?.dir === "older") {
    const condition = olderThan(cursor.from);
    const rows = selectKeys(condition.sql, condition.args, "DESC", pageSize + 1);
    const page = rows.slice(0, pageSize);
    selected.push(...page);
    window.hasOlder = rows.length > pageSize;
    window.olderCursor = window.hasOlder
      ? encodeThreadWindowCursor({ thread: threadId, dir: "older", from: keyOf(page[page.length - 1]) })
      : null;
  } else if (cursor?.dir === "newer") {
    const condition = cursor.to
      ? combine(newerThan(cursor.from), olderThan(cursor.to))
      : newerThan(cursor.from);
    const rows = selectKeys(condition.sql, condition.args, "ASC", pageSize + 1);
    const page = rows.slice(0, pageSize);
    selected.push(...page);
    window.hasNewer = rows.length > pageSize;
    window.newerCursor = window.hasNewer
      ? encodeThreadWindowCursor({
          thread: threadId,
          dir: "newer",
          from: keyOf(page[page.length - 1]),
          to: cursor.to
        })
      : null;
  } else {
    const anchorId = params.anchorMessageId?.trim();
    const anchor =
      (anchorId
        ? (db
            .prepare(`SELECT m.id, m.dateValue FROM messages m WHERE ${baseWhere} AND m.id = ?`)
            .get(...baseArgs, anchorId) as KeyRow | null)
        : null) ?? selectKeys("", [], "DESC", 1)[0];
    if (anchor) {
      window.anchorId = String(anchor.id);
      const anchorKey = keyOf(anchor);
      const older = olderThan(anchorKey);
      const olderRows = selectKeys(older.sql, older.args, "DESC", before + 1);
      const olderPage = olderRows.slice(0, before);
      window.hasOlder = olderRows.length > before;
      const oldest = olderPage[olderPage.length - 1] ?? anchor;
      window.olderCursor = window.hasOlder
        ? encodeThreadWindowCursor({ thread: threadId, dir: "older", from: keyOf(oldest) })
        : null;

      const newer = newerThan(anchorKey);
      const newerRows = selectKeys(newer.sql, newer.args, "ASC", after + 1);
      const newerPage = newerRows.slice(0, after);
      selected.push(...olderPage, anchor, ...newerPage);
      if (newerRows.length > after) {
        // Always include the newest message; anything between the window
        // and it stays behind an exclusive newer cursor.
        const newest = selectKeys("", [], "DESC", 1)[0];
        selected.push(newest);
        const lastInWindow = newerPage[newerPage.length - 1] ?? anchor;
        const firstOutside = newerRows[after];
        if (String(firstOutside.id) !== String(newest.id)) {
          window.hasNewer = true;
          window.newerCursor = encodeThreadWindowCursor({
            thread: threadId,
            dir: "newer",
            from: keyOf(lastInWindow),
            to: keyOf(newest)
          });
        }
      }
    }
  }

  const ids = Array.from(new Set(selected.map((row) => String(row.id))));
  const loadRows = (rowIds: string[]) =>
    rowIds.length === 0
      ? []
      : (db
          .prepare(
            `SELECT ${threadMessageSelectColumns("headers")} FROM messages m
             WHERE ${baseWhere} AND m.id IN (${rowIds.map(() => "?").join(",")})
             ORDER BY m.dateValue ASC, m.id ASC`
          )
          .all(...baseArgs, ...rowIds) as any[]);
  const rows = loadRows(ids);
  const items = await hydrateThreadMessageRows(db, accountId, rows, {
    groupBy,
    threadDateSource,
    projection: "headers"
  });

  const loadedIds = new Set(ids);
  const missingParentIds = Array.from(
    new Set(
      rows
        .map((row) => (typeof row.parentId === "string" ? row.parentId.trim() : ""))
        .filter((parentId) => parentId && !loadedIds.has(parentId))
    )
  );
  const placeholders = await hydrateThreadMessageRows(db, accountId, loadRows(missingParentIds), {
    groupBy,
    threadDateSource,
    projection: "headers"
  });

  return { items, placeholders, window };
}
