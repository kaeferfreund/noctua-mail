"use client";
import { useEffect, useRef, useState, useLayoutEffect } from "react";
import type { UserMailboxSummary, MailboxSummaryResult } from "@/lib/mailboxSummary";
import type { MailboxState } from "@/lib/authClient";
import type { UserEvent } from "@/lib/userEvents";
import { applyMailboxSummary, hasSummaryMetadata, readSummaryEvents, reconcileMailboxSummaries, summaryReconnectDelay, type MailboxSummaryUpdate } from "./mailboxSummaryEvents";

type Options = {
  sessionKey: string | null;
  authState?: MailboxState | null;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onMailboxesChanged: () => void;
  onSummaryChanged?: (accountId: string) => void;
  onThreadChanged: (accountId: string, threadId: string, revision: number) => void;
};

/** One canonical snapshot per connection; count events never reread known mailboxes. */
export function useMailboxSummaries(options: Options) {
  const { sessionKey, apiFetch } = options;
  // Reuse the account controller's /auth/me four-state signal. Selection is
  // irrelevant to this user-wide feed; enrollment and unresolved auth suspend it.
  const authenticated = options.authState === undefined || (options.authState !== null && options.authState !== "enrollment");
  const deniedKey = useRef<string | null>(null);
  const callbacks = useRef(options);
  useLayoutEffect(() => { callbacks.current = options; });
  const [entry, setEntry] = useState<{ key: string; mailboxes: UserMailboxSummary[] } | null>(null);
  useEffect(() => {
    if (deniedKey.current !== sessionKey) deniedKey.current = null;
    if (!sessionKey || !authenticated || deniedKey.current === sessionKey) return;
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stream: AbortController | undefined;
    let failures = 0;
    let generation = 0;
    let mailboxes: UserMailboxSummary[] | null = null;
    let refreshTask: Promise<void> | null = null;
    let repairTask: Promise<void> | null = null;
    let repairNeeded = false;
    const pending = new Map<string, MailboxSummaryUpdate>();
    const revisions = new Map<string, number>();
    const publish = () => {
      const next = mailboxes ?? [];
      if (!stopped) setEntry(previous => previous?.key === sessionKey && previous.mailboxes === next
        ? previous : { key: sessionKey, mailboxes: next });
    };
    const stop = () => {
      deniedKey.current = sessionKey;
      stopped = true; controller.abort(); stream?.abort(); clearTimeout(timer);
      mailboxes = null; pending.clear(); revisions.clear(); setEntry(null);
    };
    const refresh = (): Promise<void> => {
      if (refreshTask) return refreshTask;
      const start = generation;
      const repairsMetadata = mailboxes !== null;
      const signal = stream?.signal ?? controller.signal;
      refreshTask = (async () => {
        const response = await apiFetch("/api/me/mailboxes/summary", { signal, cache: "no-store" });
        if (stopped || signal.aborted) return;
        if (response.status === 403) { stop(); return; }
        if (response.status === 401) {
          ++generation; mailboxes = null; pending.clear(); revisions.clear(); publish();
          throw new Error("Mailbox session is being restored");
        }
        if (!response.ok) throw new Error("Mailbox summary unavailable");
        const result: MailboxSummaryResult = await response.json();
        if (stopped || signal.aborted || start !== generation) return;
        if (!result.ok || !Array.isArray(result.mailboxes)) throw new Error("Invalid mailbox summary");
        // A heartbeat can precede a denied GET; only a valid snapshot recovers.
        failures = 0;
        mailboxes = reconcileMailboxSummaries(mailboxes, result.mailboxes);
        // Events delivered during the GET are newer than its snapshot. Overlay
        // the latest coalesced values, without invalidating the whole read.
        for (const update of pending.values()) {
          const next = applyMailboxSummary(mailboxes, update);
          if (!next || (!repairsMetadata && !hasSummaryMetadata(update))) repairNeeded = true;
          if (next) mailboxes = next;
        }
        pending.clear(); publish();
      })().finally(() => { refreshTask = null; });
      return refreshTask;
    };
    const refreshMissing = () => {
      if (repairTask) return;
      // All invalidations share the in-flight read. Its overlay records any
      // unapplicable event, then this drain performs exactly one repair read.
      repairTask = (async () => {
        try {
          do {
            repairNeeded = false;
            await refresh();
          } while (!stopped && !stream?.signal.aborted && (repairNeeded || mailboxes === null));
        } catch { stream?.abort(); }
        finally { repairTask = null; }
      })();
    };
    const onEvent = (event: UserEvent | null) => {
      if (stopped) return;
      if (event?.type === "mailbox-summary" && typeof event.accountId === "string" &&
        (event.unread === null || Number.isFinite(event.unread)) && Number.isFinite(event.assignedToMe) && Number.isFinite(event.unassignedOpen)) {
        if (refreshTask) pending.set(event.accountId, event);
        const next = mailboxes && applyMailboxSummary(mailboxes, event);
        if (next) {
          const changed = next !== mailboxes;
          mailboxes = next;
          if (changed) publish();
          if (!refreshTask) pending.delete(event.accountId);
        }
        if (!next || !hasSummaryMetadata(event)) refreshMissing();
        // Counts alone cannot prove that assignments stayed the same. Preserve
        // this invalidation even when the sidebar snapshot is display-equal.
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
        if (response.status === 403) { stop(); return; }
        if (response.status === 401) {
          ++generation; mailboxes = null; pending.clear(); revisions.clear(); publish();
          throw new Error("Mailbox session is being restored");
        }
        if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Mailbox events unavailable");
        revisions.clear(); pending.clear();
        const snapshot = refresh();
        // Attach the reader before awaiting the snapshot to avoid missing
        // events during shard reads. Either failure cancels this connection.
        await Promise.all([snapshot.catch(error => { activeStream.abort(); throw error; }),
          readSummaryEvents(response.body, onEvent, () => {}).finally(() => activeStream.abort())]);
      } catch { /* Disconnects repair through a fresh authorized connection. */ }
      finally {
        controller.signal.removeEventListener("abort", abort);
        activeStream.abort();
        if (!stopped) timer = setTimeout(() => { void connect(); }, summaryReconnectDelay(failures++));
      }
    };
    void connect();
    return () => { stopped = true; controller.abort(); stream?.abort(); clearTimeout(timer); };
  }, [sessionKey, authenticated, apiFetch]);
  return authenticated && entry?.key === sessionKey ? entry.mailboxes : [];
}
