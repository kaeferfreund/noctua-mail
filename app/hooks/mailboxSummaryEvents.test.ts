import { expect, test } from "bun:test";
import { applyMailboxSummary, readSummaryEvents, reconcileMailboxSummaries, summaryReconnectDelay } from "./mailboxSummaryEvents";
import type { UserMailboxSummary } from "@/lib/mailboxSummary";

const mailbox: UserMailboxSummary = { accountId: "synthetic-a", name: "Synthetic", email: "a@example.test", accessRole: "viewer", isOwner: false, shared: true,
  unread: null, assignedToMe: 0, unassignedOpen: 0, open: 0, watcher: { state: "idling" } };
const update = { type: "mailbox-summary" as const, accountId: mailbox.accountId, unread: 5, assignedToMe: 3, unassignedOpen: 7, open: 9, watcher: { state: "auth_failed" as const, lastEventAt: 1234 } };
test("summary events replace absolute counts with watcher metadata without changing unrelated mailboxes", () => {
  const other = { ...mailbox, accountId: "synthetic-b" };
  const rows = [mailbox, other];
  const next = applyMailboxSummary(rows, update)!;
  expect(next[0]).toEqual({ ...mailbox, unread: 5, assignedToMe: 3, unassignedOpen: 7, open: 9, watcher: update.watcher });
  expect(next[1]).toBe(other);
  expect(rows[0].unread).toBeNull();
  expect(applyMailboxSummary(next, { ...update, watcher: { ...update.watcher } })).toBe(next);
  expect(applyMailboxSummary(rows, { ...update, accountId: "synthetic-unknown" })).toBeNull();
});

test("each summary count and watcher field change replaces only its mailbox", () => {
  const other = { ...mailbox, accountId: "synthetic-b" };
  const rows = [mailbox, other];
  const base = { ...update, unread: mailbox.unread, assignedToMe: 0, unassignedOpen: 0, open: 0, watcher: { ...mailbox.watcher } };
  for (const changed of [{ unread: 0 }, { assignedToMe: 1 }, { unassignedOpen: 1 }, { open: 1 },
    { watcher: { state: "backoff" as const } }, { watcher: { state: "idling" as const, lastEventAt: 1 } }]) {
    const event = { ...base, ...changed };
    const next = applyMailboxSummary(rows, event)!;
    expect(next).not.toBe(rows);
    expect(next[0]).not.toBe(mailbox);
    expect(next[1]).toBe(other);
    expect(applyMailboxSummary(next, event)).toBe(next);
  }
  expect(applyMailboxSummary(rows, { ...base, open: undefined, watcher: undefined })).toBe(rows);
  expect(mailbox).toMatchObject({ unread: null, assignedToMe: 0, watcher: { state: "idling" } });
});

test("canonical snapshots retain equal entities, but never conceal access or metadata changes", () => {
  const other = { ...mailbox, accountId: "synthetic-b" };
  const rows = [mailbox, other];
  const copy = () => rows.map(row => ({ ...row, watcher: { ...row.watcher } }));
  expect(reconcileMailboxSummaries(rows, copy())).toBe(rows);
  const changed: UserMailboxSummary = { accountId: "synthetic-c", name: "Synthetic changed", email: "changed@example.test",
    accessRole: "editor", isOwner: true, shared: false, unread: 1, assignedToMe: 1, unassignedOpen: 1, open: 1,
    watcher: { state: "stopped", lastEventAt: 1 } };
  for (const field of Object.keys(changed) as (keyof UserMailboxSummary)[]) {
    const incoming = copy();
    incoming[0] = { ...incoming[0], [field]: changed[field] };
    const next = reconcileMailboxSummaries(rows, incoming);
    expect(next).not.toBe(rows);
    expect(next[0]).toBe(incoming[0]);
    expect(next[1]).toBe(other);
  }
  expect(reconcileMailboxSummaries(rows, [other, mailbox])).toEqual([other, mailbox]);
  expect(reconcileMailboxSummaries(rows, [other])).toEqual([other]);
  const newSession = copy();
  expect(reconcileMailboxSummaries(null, newSession)).toBe(newSession);
  expect(reconcileMailboxSummaries(null, newSession)[0]).not.toBe(mailbox);
});
test("disconnect backoff doubles and caps at thirty seconds", () => {
  expect(Array.from({ length: 9 }, (_, i) => summaryReconnectDelay(i))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000]);
});
test("SSE framing tolerates split CRLF, UTF-8 and heartbeats; malformed events request repair", async () => {
  const events: unknown[] = [];
  const text = `: heartbeat\r\n\r\nevent: mailbox-summary\r\ndata: ${JSON.stringify(update)}\r\n\r\nevent: mailboxes-changed\ndata: {"type":"mailboxes-changed","synthetic":"ü"}\n\nevent: thread-collab\ndata: invalid\n\n`;
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  let activity = 0;
  await readSummaryEvents(stream, event => events.push(event), () => activity++);
  expect(events).toEqual([update, { type: "mailboxes-changed", synthetic: "ü" }, null]);
  expect(activity).toBe(bytes.length);
});
