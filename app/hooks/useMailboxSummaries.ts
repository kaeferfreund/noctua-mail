"use client";
import { useEffect, useRef, useState } from "react";
import type { UserMailboxSummary, MailboxSummaryResult } from "@/lib/mailboxSummary";
import type { UserEvent } from "@/lib/userEvents";

type Options = {
  sessionKey: string | null;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onMailboxesChanged: () => void;
  onThreadChanged: (accountId: string) => void;
};

/** User-wide events keep inactive mailbox badges and the selected views current. */
export function useMailboxSummaries(options: Options) {
  const { sessionKey, apiFetch } = options;
  const callbacks = useRef(options);
  callbacks.current = options;
  const [entry, setEntry] = useState<{ key: string; mailboxes: UserMailboxSummary[] } | null>(null);
  useEffect(() => {
    if (!sessionKey) return;
    const controller = new AbortController();
    let sequence = 0;
    const refresh = async () => {
      const request = ++sequence;
      try {
        const response = await apiFetch("/api/me/mailboxes/summary", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const result: MailboxSummaryResult = await response.json();
        if (!controller.signal.aborted && request === sequence && result.ok)
          setEntry({ key: sessionKey, mailboxes: result.mailboxes });
      } catch { /* Reconnect or the next event retries the canonical snapshot. */ }
    };
    void refresh();
    const source = new EventSource("/api/me/events");
    source.addEventListener("open", () => { void refresh(); });
    source.addEventListener("mailbox-summary", event => {
      if (controller.signal.aborted) return;
      const update = JSON.parse((event as MessageEvent).data) as Extract<UserEvent, { type: "mailbox-summary" }>;
      ++sequence;
      setEntry(current => current?.key === sessionKey ? { ...current, mailboxes: current.mailboxes.map(mailbox =>
        mailbox.accountId === update.accountId ? { ...mailbox, unread: update.unread, assignedToMe: update.assignedToMe, unassignedOpen: update.unassignedOpen } : mailbox)
      } : current);
      // Refresh metadata as well, including newly granted mailboxes.
      void refresh();
    });
    source.addEventListener("thread-collab", event => {
      if (!controller.signal.aborted) callbacks.current.onThreadChanged((JSON.parse((event as MessageEvent).data) as UserEvent & { accountId: string }).accountId);
    });
    source.addEventListener("mailboxes-changed", () => {
      if (controller.signal.aborted) return;
      ++sequence;
      setEntry(null);
      callbacks.current.onMailboxesChanged();
      void refresh();
    });
    return () => { controller.abort(); source.close(); };
  }, [sessionKey, apiFetch]);
  return entry?.key === sessionKey ? entry.mailboxes : [];
}
