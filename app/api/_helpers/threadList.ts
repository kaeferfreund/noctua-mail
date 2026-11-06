import type { Message } from "@/lib/data";

/** Shared by the thread list of one mailbox and of a domain (`/api/domains/[domain]/threads`). */
const THREAD_LIST_DEFAULT_PAGE_SIZE = 300;
const THREAD_LIST_MAX_PAGE_SIZE = 600;

export function clampThreadListPageSize(raw: string | null) {
  const requested = Number(raw ?? String(THREAD_LIST_DEFAULT_PAGE_SIZE)) || THREAD_LIST_DEFAULT_PAGE_SIZE;
  if (!Number.isFinite(requested)) return THREAD_LIST_DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(THREAD_LIST_MAX_PAGE_SIZE, Math.trunc(requested)));
}

/**
 * Drop list fields the cards do not read. Topics stay on each message: the
 * response has no separate thread-level topic payload, and the open view
 * reads suggestions off the list item.
 */
export function slimThreadListItem(item: Message): Message {
  const slim: Message = { ...item };
  if (slim.body === "") {
    delete (slim as { body?: string }).body;
  }
  delete slim.categoryScore;
  delete slim.categorySignals;
  if (!slim.attachments || slim.attachments.length === 0) {
    delete slim.attachments;
  }
  if (!slim.calendarInviteStates || slim.calendarInviteStates.length === 0) {
    delete slim.calendarInviteStates;
  }
  return slim;
}
