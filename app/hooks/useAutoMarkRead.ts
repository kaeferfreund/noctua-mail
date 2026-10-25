"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buildAccountApiPath } from "@/lib/accountApiPaths";
import { autoMarkReadDelayMs, resolveAutoMarkReadMode } from "@/lib/autoMarkRead";
import type { AccountSettings, Message, UserAccountPrefs } from "@/lib/data";
import { ACCOUNT_PREFS_CHANGED } from "@/lib/ui/senderSettings";
import { useLatestRef } from "./useLatestRef";

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * The resolved auto-read dwell of the signed-in user for `accountId`, or
 * `null` (never) until the personal preferences are known: a user who chose
 * "never" must not get a message marked while the preferences still load.
 */
export function useAutoMarkReadDelay(
  accountId: string | undefined,
  accountSettings: Pick<AccountSettings, "reading"> | undefined,
  apiFetch: Fetch = fetch
): number | null {
  const [loaded, setLoaded] = useState<{ accountId: string; prefs: UserAccountPrefs } | null>(null);
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    void apiFetch(buildAccountApiPath(accountId, "/prefs"), { cache: "no-store" })
      .then(response => (response.ok ? response.json() : null))
      .then((data: { prefs?: UserAccountPrefs } | null) => {
        if (active && data?.prefs) setLoaded({ accountId, prefs: data.prefs });
      })
      .catch(() => { /* Stay on "never" when the preferences are unavailable. */ });
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ accountId?: string; prefs?: UserAccountPrefs }>).detail;
      if (detail?.accountId === accountId && detail.prefs) setLoaded({ accountId, prefs: detail.prefs });
    };
    window.addEventListener(ACCOUNT_PREFS_CHANGED, onChanged);
    return () => {
      active = false;
      window.removeEventListener(ACCOUNT_PREFS_CHANGED, onChanged);
    };
  }, [accountId, apiFetch]);
  if (!accountId || loaded?.accountId !== accountId) return null;
  return autoMarkReadDelayMs(resolveAutoMarkReadMode(accountSettings, loaded.prefs));
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** One open period of a message in the reader. */
type OpenPeriod = { seen: boolean; done: boolean; timer?: ReturnType<typeof setTimeout>; delayMs?: number };

const periodKey = (message: Pick<Message, "accountId" | "id">) => `${message.accountId}\u0000${message.id}`;

/**
 * Marks the shown unread `messages` read after `delayMs` of dwell while the
 * page is visible. A message leaving `messages` (other selection, collapsed
 * card) or a hidden page cancels its timer. Each open period marks a message
 * at most once, and not at all once its read state changed while it was open
 * (for example the user marked it unread): opening it again starts a new period.
 */
export function useAutoMarkRead({ messages, delayMs, onMarkRead }: {
  messages: Message[];
  delayMs: number | null;
  onMarkRead: (message: Message) => void;
}) {
  const visible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== "hidden", () => false);
  const periods = useRef(new Map<string, OpenPeriod>());
  const latestMessages = useLatestRef(messages);
  const latestOnMarkRead = useLatestRef(onMarkRead);
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
      let period = open.get(key);
      if (!period) {
        period = { seen, done: seen };
        open.set(key, period);
      } else if (period.seen !== seen) {
        period.seen = seen;
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
        if (target && !target.seen) latestOnMarkRead.current(target);
      }, delayMs);
    });
  }, [shownKey, delayMs, visible, latestMessages, latestOnMarkRead]);

  useEffect(() => {
    const open = periods.current;
    return () => {
      open.forEach(period => clearTimeout(period.timer));
      open.clear();
    };
  }, []);
}
