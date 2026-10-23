import type { UserMailboxSummary } from "@/lib/mailboxSummary";
import type { UserEvent } from "@/lib/userEvents";

export const summaryReconnectDelay = (failures: number) => Math.min(30_000, 1_000 * 2 ** Math.min(failures, 5));

// Older servers omit the additive fields; a canonical read repairs their metadata.
export type MailboxSummaryUpdate = Omit<Extract<UserEvent, { type: "mailbox-summary" }>, "watcher" | "open"> &
  Partial<Pick<Extract<UserEvent, { type: "mailbox-summary" }>, "watcher" | "open">>;
export const hasSummaryMetadata = (update: MailboxSummaryUpdate) => update.watcher !== undefined && Number.isFinite(update.open);

function equalWatcher(previous: UserMailboxSummary["watcher"], incoming: UserMailboxSummary["watcher"]) {
  return previous.state === incoming.state && previous.lastEventAt === incoming.lastEventAt;
}

/** Unknown mailboxes need metadata from a canonical read; known counts are absolute. */
export function applyMailboxSummary(mailboxes: UserMailboxSummary[], update: MailboxSummaryUpdate) {
  const index = mailboxes.findIndex(mailbox => mailbox.accountId === update.accountId);
  if (index === -1) return null;
  const mailbox = mailboxes[index];
  const open = update.open ?? mailbox.open;
  const watcher = update.watcher ?? mailbox.watcher;
  if (mailbox.unread === update.unread && mailbox.assignedToMe === update.assignedToMe &&
    mailbox.unassignedOpen === update.unassignedOpen && mailbox.open === open && equalWatcher(mailbox.watcher, watcher)) return mailboxes;
  const next = mailboxes.slice();
  next[index] = { ...mailbox, unread: update.unread, assignedToMe: update.assignedToMe, unassignedOpen: update.unassignedOpen,
    open, watcher: equalWatcher(mailbox.watcher, watcher) ? mailbox.watcher : watcher };
  return next;
}

/** Only reconcile within the current connection/session; compare access metadata too. */
export function reconcileMailboxSummaries(previous: UserMailboxSummary[] | null, incoming: UserMailboxSummary[]) {
  if (!previous) return incoming;
  const byAccount = new Map(previous.map(mailbox => [mailbox.accountId, mailbox]));
  const next = incoming.map(mailbox => {
    const old = byAccount.get(mailbox.accountId);
    return old && old.name === mailbox.name && old.email === mailbox.email && old.accessRole === mailbox.accessRole &&
      old.isOwner === mailbox.isOwner && old.shared === mailbox.shared && old.unread === mailbox.unread &&
      old.assignedToMe === mailbox.assignedToMe && old.unassignedOpen === mailbox.unassignedOpen && old.open === mailbox.open &&
      equalWatcher(old.watcher, mailbox.watcher) ? old : mailbox;
  });
  return next.length === previous.length && next.every((mailbox, index) => mailbox === previous[index]) ? previous : next;
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
