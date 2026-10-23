import type { Message } from "@/lib/data";
import type { CollabSummary, ThreadCollabState } from "../collab/types";

// A list summary can also carry the full reader state. Preserve every revision
// and assignment/activity field when deciding whether that state is unchanged.
type LiveCollabSummary = CollabSummary & Partial<ThreadCollabState>;
export function equalCollabSummary(previous: LiveCollabSummary | undefined, incoming: LiveCollabSummary): boolean {
  return previous !== undefined && previous.status === incoming.status &&
    previous.assigneeUserId === incoming.assigneeUserId && previous.commentCount === incoming.commentCount &&
    previous.updatedAt === incoming.updatedAt && previous.revision === incoming.revision &&
    previous.accountId === incoming.accountId && previous.threadId === incoming.threadId &&
    previous.assignedByUserId === incoming.assignedByUserId && previous.assignedAt === incoming.assignedAt &&
    previous.statusChangedAt === incoming.statusChangedAt && previous.statusChangedByUserId === incoming.statusChangedByUserId &&
    previous.lastActivityAt === incoming.lastActivityAt && previous.updatedByUserId === incoming.updatedByUserId;
}

export function applyThreadCollabCacheUpdates(
  cache: Map<string, Map<string, CollabSummary>>,
  accountId: string,
  updates: Map<string, CollabSummary>
) {
  const previous = cache.get(accountId);
  let next: Map<string, CollabSummary> | undefined;
  for (const [threadId, state] of updates) {
    if (equalCollabSummary(previous?.get(threadId), state)) continue;
    if (!next) next = new Map(previous);
    next.set(threadId, state);
  }
  return next ? new Map(cache).set(accountId, next) : cache;
}

export function applyMessageCollabUpdate(message: Message, accountId: string, updates: Map<string, CollabSummary>): Message {
  const state = updates.get(message.threadId);
  return message.accountId === accountId && state && !equalCollabSummary(message.collab, state)
    ? { ...message, collab: state } : message;
}

export function applyMessagesCollabUpdates(messages: Message[], accountId: string, updates: Map<string, CollabSummary>): Message[] {
  let next = messages;
  messages.forEach((message, index) => {
    const updated = applyMessageCollabUpdate(message, accountId, updates);
    if (updated === message) return;
    if (next === messages) next = messages.slice();
    next[index] = updated;
  });
  return next;
}
