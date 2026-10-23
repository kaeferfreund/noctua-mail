import type { UserMailboxSummary } from "@/lib/mailboxSummary";
import type { UserEvent } from "@/lib/userEvents";

export const summaryReconnectDelay = (failures: number) => Math.min(30_000, 1_000 * 2 ** Math.min(failures, 5));

// Older servers omit the additive fields; a canonical read repairs their metadata.
export type MailboxSummaryUpdate = Omit<Extract<UserEvent, { type: "mailbox-summary" }>, "watcher" | "open"> &
  Partial<Pick<Extract<UserEvent, { type: "mailbox-summary" }>, "watcher" | "open">>;
export const hasSummaryMetadata = (update: MailboxSummaryUpdate) => update.watcher !== undefined && Number.isFinite(update.open);

/** Unknown mailboxes need metadata from a canonical read; known counts are absolute. */
export function applyMailboxSummary(mailboxes: UserMailboxSummary[], update: MailboxSummaryUpdate) {
  if (!mailboxes.some(mailbox => mailbox.accountId === update.accountId)) return null;
  return mailboxes.map(mailbox => mailbox.accountId === update.accountId
    ? { ...mailbox, unread: update.unread, assignedToMe: update.assignedToMe, unassignedOpen: update.unassignedOpen,
      ...(update.open === undefined ? {} : { open: update.open }), ...(update.watcher === undefined ? {} : { watcher: update.watcher }) }
    : mailbox);
}

/** Streaming SSE framing, including split UTF-8/chunks, CRLF and comment heartbeats. */
export async function readSummaryEvents(body: ReadableStream<Uint8Array>, onEvent: (event: UserEvent | null) => void, onActivity: () => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let data: string[] = [];
  const line = (value: string) => {
    if (!value) {
      if (data.length) {
        try {
          const event = JSON.parse(data.join("\n")) as UserEvent;
          onEvent(event && event.type === eventName ? event : null);
        } catch { onEvent(null); }
      }
      eventName = ""; data = [];
    } else if (value.startsWith("event:")) eventName = value.slice(6).trimStart();
    else if (value.startsWith("data:")) data.push(value.slice(5).trimStart());
  };
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return;
      onActivity();
      buffer += decoder.decode(chunk.value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n")) !== -1) {
        line(buffer.slice(0, end).replace(/\r$/, ""));
        buffer = buffer.slice(end + 1);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Collaboration views use distinct whole-mailbox thread counts from one summary. */
export function collaborationViewCount(id: string, summary: UserMailboxSummary | undefined) {
  if (id === "virtual:assigned-to-me") return summary?.assignedToMe ?? null;
  if (id === "virtual:unassigned") return summary?.unassignedOpen ?? null;
  return id === "virtual:open" ? summary?.open ?? null : null;
}
