"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buildAccountApiPath } from "@/lib/accountApiPaths";
import { autoMarkReadDelayMs, resolveAutoMarkReadMode } from "@/lib/autoMarkRead";
import { roleAtLeast } from "@/lib/accountRole";
import type { Account, Message, UserAccountPrefs } from "@/lib/data";
import { ACCOUNT_PREFS_CHANGED, SENDER_SETTINGS_STORAGE_KEY } from "@/lib/ui/senderSettings";
import { useLatestRef } from "./useLatestRef";

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * The resolved auto-read dwell of the signed-in user for `account`, or
 * `null` (never) until the personal preferences are known: a user who chose
 * "never" must not get a message marked while the preferences still load.
 * They are read once a message is `opened`, not at startup. Setting `\Seen`
 * needs the editor role, so viewers never auto-read.
 */
export function useAutoMarkReadDelay(
  account: Pick<Account, "id" | "settings" | "accessRole"> | null | undefined,
  opened: boolean,
  apiFetch: Fetch = fetch
): number | null {
  const accountId = account && roleAtLeast(account.accessRole, "editor") ? account.id : undefined;
  const [loaded, setLoaded] = useState<{ accountId: string; prefs: UserAccountPrefs } | null>(null);
  // Bumped by every save in this window: a read still in flight is older.
  const revision = useRef(0);
  useEffect(() => {
    if (!accountId) return;
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ accountId?: string; prefs?: UserAccountPrefs }>).detail;
      if (detail?.accountId !== accountId || !detail.prefs) return;
      revision.current += 1;
      setLoaded({ accountId, prefs: detail.prefs });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SENDER_SETTINGS_STORAGE_KEY || !event.newValue) return;
      try {
        if (JSON.parse(event.newValue).accountId !== accountId) return;
        revision.current += 1;
        setLoaded(null); // Reload private preferences; the receipt carries no values.
      } catch { /* Ignore malformed receipts. */ }
    };
    window.addEventListener(ACCOUNT_PREFS_CHANGED, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ACCOUNT_PREFS_CHANGED, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [accountId]);
  const needed = Boolean(accountId) && opened && loaded?.accountId !== accountId;
  useEffect(() => {
    if (!needed || !accountId) return;
    let active = true;
    const started = revision.current;
    void apiFetch(buildAccountApiPath(accountId, "/prefs"), { cache: "no-store" })
      .then(response => (response.ok ? response.json() : null))
      .then((data: { prefs?: UserAccountPrefs } | null) => {
        if (active && revision.current === started && data?.prefs) setLoaded({ accountId, prefs: data.prefs });
      })
      .catch(() => { /* Stay on "never" when the preferences are unavailable. */ });
    return () => { active = false; };
  }, [accountId, apiFetch, needed]);
  if (!accountId || loaded?.accountId !== accountId) return null;
  return autoMarkReadDelayMs(resolveAutoMarkReadMode(account?.settings, loaded.prefs));
}

const messageKey = (message: Pick<Message, "accountId" | "id">) => `${message.accountId}\u0000${message.id}`;

/**
 * Orders auto-read against the user's own read/unread actions (menu, `r`/`u`,
 * swipe, bulk). A manual action bumps the message's version, which ends its
 * auto-read period, and is sent only after an auto-read request still in
 * flight for that message: the manual state is the last one the server and
 * the list see.
 */
export function createAutoReadCoordinator() {
  const versions = new Map<string, number>();
  const autoRequests = new Map<string, Promise<unknown>>();
  return {
    manualSeenVersion: (message: Pick<Message, "accountId" | "id">) => versions.get(messageKey(message)) ?? 0,
    autoRead: (message: Message, request: (shouldRetry: () => boolean) => Promise<unknown>) => {
      const key = messageKey(message);
      const version = versions.get(key) ?? 0;
      const pending: Promise<unknown> = request(() => (versions.get(key) ?? 0) === version).catch(() => {}).finally(() => {
        if (autoRequests.get(key) === pending) autoRequests.delete(key);
      });
      autoRequests.set(key, pending);
    },
    manualSeen: <T,>(messages: Pick<Message, "accountId" | "id">[], request: () => Promise<T>): Promise<T> => {
      const pending: Promise<unknown>[] = [];
      messages.forEach(message => {
        const key = messageKey(message);
        versions.set(key, (versions.get(key) ?? 0) + 1);
        const inFlight = autoRequests.get(key);
        if (inFlight) pending.push(inFlight);
      });
      return pending.length > 0 ? Promise.all(pending).then(request) : request();
    }
  };
}
export type AutoReadCoordinator = ReturnType<typeof createAutoReadCoordinator>;

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** One open period of a message in the reader. */
type OpenPeriod = { seen: boolean; version: number; done: boolean; timer?: ReturnType<typeof setTimeout>; delayMs?: number };

const periodKey = messageKey;

/**
 * Marks the shown unread `messages` read after `delayMs` of dwell while the
 * page is visible. A message leaving `messages` (other selection, collapsed
 * card) or a hidden page cancels its timer. Each open period marks a message
 * at most once, and not at all once its read state changed or the user took a
 * read/unread action on it (`manualSeenVersion` moved) while it was open:
 * opening it again starts a new period. The request layer retries a failed automatic mark once;
 * the coordinator cancels that retry when a manual action wins.
 */
export function useAutoMarkRead({ messages, delayMs, onMarkRead, manualSeenVersion }: {
  messages: Message[];
  delayMs: number | null;
  onMarkRead: (message: Message) => void;
  /** See `createAutoReadCoordinator`. */
  manualSeenVersion?: (message: Message) => number;
}) {
  const visible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== "hidden", () => false);
  const periods = useRef(new Map<string, OpenPeriod>());
  const latestMessages = useLatestRef(messages);
  const latestOnMarkRead = useLatestRef(onMarkRead);
  const latestManualSeenVersion = useLatestRef(manualSeenVersion);
  const shownKey = messages.map(message => `${periodKey(message)}:${message.seen ? 1 : 0}`).join("\u0001");

  // `shownKey` stands for `messages`: the effect reacts to which messages are
  // shown and their read state, not to a new array identity on every render.
  useEffect(() => {
    const open = periods.current;
    const shown = new Map(latestMessages.current.map(message => [periodKey(message), message]));
    open.forEach((period, key) => {
      if (shown.has(key)) return;
      clearTimeout(period.timer);
      open.delete(key);
    });
    shown.forEach((message, key) => {
      const seen = Boolean(message.seen);
      const version = latestManualSeenVersion.current?.(message) ?? 0;
      let period = open.get(key);
      if (!period) {
        period = { seen, version, done: seen };
        open.set(key, period);
      } else if (period.seen !== seen || period.version !== version) {
        period.seen = seen;
        period.version = version;
        period.done = true;
      }
      const armed = !period.done && !seen && delayMs !== null && visible;
      if (period.timer !== undefined && (!armed || period.delayMs !== delayMs)) {
        clearTimeout(period.timer);
        period.timer = undefined;
      }
      if (!armed || period.timer !== undefined) return;
      const current = period;
      current.delayMs = delayMs;
      current.timer = setTimeout(() => {
        current.timer = undefined;
        current.done = true;
        const target = latestMessages.current.find(item => periodKey(item) === key);
        // A read/unread action during the dwell wins, even when it changed nothing.
        if (!target || target.seen || (latestManualSeenVersion.current?.(target) ?? 0) !== current.version) return;
        latestOnMarkRead.current(target);
      }, delayMs);
    });
  }, [shownKey, delayMs, visible, latestMessages, latestOnMarkRead, latestManualSeenVersion]);

  useEffect(() => {
    const open = periods.current;
    return () => {
      open.forEach(period => clearTimeout(period.timer));
      open.clear();
    };
  }, []);
}
