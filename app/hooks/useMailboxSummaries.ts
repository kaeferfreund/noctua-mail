"use client";
import { useEffect, useRef, useState } from "react";
import type { UserMailboxSummary, MailboxSummaryResult } from "@/lib/mailboxSummary";
import type { UserEvent } from "@/lib/userEvents";
import { applyMailboxSummary, readSummaryEvents, summaryReconnectDelay } from "./mailboxSummaryEvents";

type Options = {
  sessionKey: string | null;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onMailboxesChanged: () => void;
  onSummaryChanged?: (accountId: string) => void;
  onThreadChanged: (accountId: string, threadId: string, revision: number) => void;
};

/** One canonical snapshot per connection; count events never reread known mailboxes. */
export function useMailboxSummaries(options: Options) {
  const { sessionKey, apiFetch } = options;
  const callbacks = useRef(options);
  callbacks.current = options;
  const [entry, setEntry] = useState<{ key: string; mailboxes: UserMailboxSummary[] } | null>(null);
  useEffect(() => {
    if (!sessionKey) return;
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stream: AbortController | undefined;
    let failures = 0;
    let generation = 0;
    let mailboxes: UserMailboxSummary[] | null = null;
    let refreshTask: Promise<void> | null = null;
    const pending = new Map<string, Extract<UserEvent, { type: "mailbox-summary" }>>();
    const revisions = new Map<string, number>();
    const publish = () => { if (!stopped) setEntry({ key: sessionKey, mailboxes: mailboxes ?? [] }); };
    const stop = () => {
      stopped = true; controller.abort(); stream?.abort(); clearTimeout(timer);
      mailboxes = null; pending.clear(); revisions.clear(); setEntry(null);
    };
    const refresh = (): Promise<void> => {
      if (refreshTask) return refreshTask;
      const start = generation;
      const signal = stream?.signal ?? controller.signal;
      refreshTask = (async () => {
        const response = await apiFetch("/api/me/mailboxes/summary", { signal, cache: "no-store" });
        if (stopped || signal.aborted) return;
        if (response.status === 403 || response.status === 401) { stop(); return; }
        if (!response.ok) throw new Error("Mailbox summary unavailable");
        const result: MailboxSummaryResult = await response.json();
        if (stopped || signal.aborted || start !== generation) return;
        if (!result.ok || !Array.isArray(result.mailboxes)) throw new Error("Invalid mailbox summary");
        mailboxes = result.mailboxes;
        // Events delivered during the GET are newer than its snapshot. Overlay
        // the latest coalesced values, without invalidating the whole read.
        for (const update of pending.values()) mailboxes = applyMailboxSummary(mailboxes, update) ?? mailboxes;
        pending.clear(); publish();
      })().finally(() => { refreshTask = null; });
      return refreshTask;
    };
    const refreshMissing = () => {
      void refresh().then(() => {
        // Membership changed while the old snapshot was in flight.
        if (!stopped && !stream?.signal.aborted && mailboxes === null) refreshMissing();
      }).catch(() => { stream?.abort(); });
    };
    const onEvent = (event: UserEvent | null) => {
      if (stopped) return;
      if (event?.type === "mailbox-summary" && typeof event.accountId === "string" &&
        (event.unread === null || Number.isFinite(event.unread)) && Number.isFinite(event.assignedToMe) && Number.isFinite(event.unassignedOpen)) {
        pending.set(event.accountId, event);
        const next = mailboxes && applyMailboxSummary(mailboxes, event);
        if (next) { mailboxes = next; publish(); if (!refreshTask) pending.delete(event.accountId); }
        else refreshMissing();
        callbacks.current.onSummaryChanged?.(event.accountId);
      } else if (event?.type === "thread-collab" && typeof event.accountId === "string" && typeof event.threadId === "string" && Number.isFinite(event.revision)) {
        const key = JSON.stringify([event.accountId, event.threadId]);
        if (event.revision <= (revisions.get(key) ?? -1)) return;
        revisions.set(key, event.revision);
        callbacks.current.onThreadChanged(event.accountId, event.threadId, event.revision);
      } else {
        ++generation; mailboxes = null; pending.clear(); revisions.clear(); publish();
        if (event?.type === "mailboxes-changed") callbacks.current.onMailboxesChanged();
        refreshMissing();
      }
    };
    const connect = async () => {
      stream = new AbortController();
      const activeStream = stream;
      // Fetch transport exposes HTTP 403 (EventSource hides it) and lets us
      // own the retry timer instead of racing the browser's automatic retry.
      const abort = () => activeStream.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      try {
        const response = await apiFetch("/api/me/events", { signal: activeStream.signal, cache: "no-store", headers: { Accept: "text/event-stream" } });
        if (stopped) return;
        if (response.status === 403 || response.status === 401) { stop(); return; }
        if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Mailbox events unavailable");
        revisions.clear(); pending.clear();
        const snapshot = refresh();
        // Attach the reader before awaiting the snapshot to avoid missing
        // events during shard reads. Either failure cancels this connection.
        await Promise.all([snapshot.catch(error => { activeStream.abort(); throw error; }),
          readSummaryEvents(response.body, onEvent, () => { failures = 0; }).finally(() => activeStream.abort())]);
      } catch { /* Disconnects repair through a fresh authorized connection. */ }
      finally {
        controller.signal.removeEventListener("abort", abort);
        activeStream.abort();
        if (!stopped) timer = setTimeout(() => { void connect(); }, summaryReconnectDelay(failures++));
      }
    };
    void connect();
    return () => { stopped = true; controller.abort(); stream?.abort(); clearTimeout(timer); };
  }, [sessionKey, apiFetch]);
  return entry?.key === sessionKey ? entry.mailboxes : [];
}
