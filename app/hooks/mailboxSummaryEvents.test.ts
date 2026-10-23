import { expect, test } from "bun:test";
import { applyMailboxSummary, readSummaryEvents, summaryReconnectDelay } from "./mailboxSummaryEvents";
import type { UserMailboxSummary } from "@/lib/mailboxSummary";

const mailbox: UserMailboxSummary = { accountId: "synthetic-a", name: "Synthetic", email: "a@example.test", accessRole: "viewer", isOwner: false, shared: true,
  unread: null, assignedToMe: 0, unassignedOpen: 0, watcher: { state: "idling" } };
const update = { type: "mailbox-summary" as const, accountId: mailbox.accountId, unread: 5, assignedToMe: 3, unassignedOpen: 7 };
test("summary events replace absolute counts without changing metadata or unrelated mailboxes", () => {
  const other = { ...mailbox, accountId: "synthetic-b" };
  const rows = [mailbox, other];
  const next = applyMailboxSummary(rows, update)!;
  expect(next[0]).toEqual({ ...mailbox, unread: 5, assignedToMe: 3, unassignedOpen: 7 });
  expect(next[1]).toBe(other);
  expect(rows[0].unread).toBeNull();
  expect(applyMailboxSummary(next, update)).toEqual(next);
  expect(applyMailboxSummary(rows, { ...update, accountId: "synthetic-unknown" })).toBeNull();
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
