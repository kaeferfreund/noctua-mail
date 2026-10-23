import { expect, test } from "bun:test";
import type { Message } from "@/lib/data";
import type { CollabSummary, ThreadCollabState } from "../collab/types";
import { applyMessageCollabUpdate, applyMessagesCollabUpdates, applyThreadCollabCacheUpdates, equalCollabSummary } from "./threadCollabUpdates";

const state: ThreadCollabState = {
  accountId: "synthetic-a", threadId: "synthetic-thread", status: "open", assigneeUserId: null,
  assignedByUserId: null, assignedAt: null, statusChangedAt: null, statusChangedByUserId: null,
  commentCount: 1, lastActivityAt: 1234, updatedAt: 1234, revision: 1, updatedByUserId: null
};
const message: Message = { id: "synthetic-message", threadId: state.threadId, accountId: state.accountId,
  folderId: "synthetic-a:INBOX", subject: "Synthetic subject", from: "sender@example.test", to: "recipient@example.test",
  preview: "Synthetic preview", body: "Synthetic body", date: "2026-10-23", dateValue: 1, collab: state,
  hasAttachments: true, attachments: [] };
const unrelated = { ...message, id: "synthetic-other", threadId: "synthetic-other-thread" };
const otherAccount = { ...message, id: "synthetic-b-message", accountId: "synthetic-b" };
const messages = [message, unrelated, otherAccount];
const accountCache = new Map<string, CollabSummary>([[state.threadId, state], [unrelated.threadId, state]]);
const otherCache = new Map<string, CollabSummary>([[state.threadId, state]]);
const cache = new Map([[state.accountId, accountCache], [otherAccount.accountId, otherCache]]);

test("identical collaboration payloads retain both Map levels, messages and reader references", () => {
  const updates = new Map([[state.threadId, { ...state }]]);
  for (let i = 0; i < 2; i++) {
    expect(applyThreadCollabCacheUpdates(cache, state.accountId, updates)).toBe(cache);
    expect(applyMessagesCollabUpdates(messages, state.accountId, updates)).toBe(messages);
    expect(applyMessageCollabUpdate(message, state.accountId, updates)).toBe(message);
  }
  expect(applyThreadCollabCacheUpdates(cache, "unknown", new Map())).toBe(cache);
});

// Include every field of the full state: summaries must not swallow revision,
// assignment or activity changes just because status/note count stayed equal.
const changes: ThreadCollabState = {
  accountId: "synthetic-changed-account", threadId: "synthetic-changed-thread", status: "closed", assigneeUserId: "synthetic-assignee",
  assignedByUserId: "synthetic-assigner", assignedAt: 4321, statusChangedAt: 4321, statusChangedByUserId: "synthetic-changer",
  commentCount: 2, lastActivityAt: 4321, updatedAt: 4321, revision: 2, updatedByUserId: "synthetic-updater"
};
for (const field of Object.keys(changes) as (keyof ThreadCollabState)[]) test(`collaboration ${field} changes replace only the matching entity`, () => {
  const incoming = { ...state, [field]: changes[field] };
  expect(equalCollabSummary(state, incoming)).toBe(false);
  const updates = new Map([[state.threadId, incoming]]);
  const nextCache = applyThreadCollabCacheUpdates(cache, state.accountId, updates);
  expect(nextCache).not.toBe(cache);
  expect(nextCache.get(state.accountId)).not.toBe(accountCache);
  expect(nextCache.get(state.accountId)?.get(state.threadId)).toBe(incoming);
  expect(nextCache.get(state.accountId)?.get(unrelated.threadId)).toBe(state);
  expect(nextCache.get(otherAccount.accountId)).toBe(otherCache);
  expect(accountCache.get(state.threadId)).toBe(state);
  const next = applyMessagesCollabUpdates(messages, state.accountId, updates);
  expect(next).not.toBe(messages);
  expect(next[0]).not.toBe(message);
  expect(next[0].collab).toBe(incoming);
  expect(next[0].attachments).toBe(message.attachments);
  expect(next[1]).toBe(unrelated);
  expect(next[2]).toBe(otherAccount);
  expect(message.collab).toBe(state);
  expect(applyThreadCollabCacheUpdates(nextCache, state.accountId, updates)).toBe(nextCache);
  expect(applyMessagesCollabUpdates(next, state.accountId, updates)).toBe(next);
});

test("account partitions never borrow equal summaries from another account", () => {
  const incoming = { ...state };
  const updates = new Map([[state.threadId, incoming]]);
  const next = applyThreadCollabCacheUpdates(new Map([[state.accountId, accountCache]]), "synthetic-new", updates);
  expect(next.get("synthetic-new")).not.toBe(accountCache);
  expect(next.get("synthetic-new")?.get(state.threadId)).toBe(incoming);
  expect(applyMessagesCollabUpdates([otherAccount], state.accountId, updates)[0]).toBe(otherAccount);
});

test("a full collaboration state is not equal to a summary with no revision metadata", () => {
  const summary = { status: state.status, assigneeUserId: state.assigneeUserId, commentCount: state.commentCount, updatedAt: state.updatedAt };
  expect(equalCollabSummary(summary, state)).toBe(false);
  expect(equalCollabSummary(state, summary)).toBe(false);
  expect(equalCollabSummary(undefined, summary)).toBe(false);
});
