"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { applyAnchor, captureAnchor, isMeasurable, SCROLL_KEYS, ScrollAnchorStore, type AnchorItems, type ScrollAnchor } from "@/lib/ui/scrollAnchors";
import type { DeepLinkTransaction } from "./useDeepLinks";

type Pane = "list" | "reader";
type Options = {
  accountId: string;
  /** Full list identity (account, folder/view, search, grouping, filters). */
  listKey: string;
  listRef: RefObject<HTMLElement | null>;
  /** False while a phone shows the reader over the still-mounted list. */
  listShown: boolean;
  readerMessageId: string;
  readerScroll: () => HTMLElement | null;
  readerItems: () => AnchorItems;
  getCollapsed: () => Record<string, boolean>;
  restoreCollapsed: (collapsed: Record<string, boolean>) => void;
};
type Restore = { key: string; cancel: () => void };
/** How the reader's own selection scroll should behave for the active message. */
export type ReaderPlacement = "skip" | "instant" | "default";

const TOP: ScrollAnchor = { id: "", offset: 0, top: 0 };
const RESTORE_BUDGET_MS = 3000;
const STABLE_FRAMES = 3;
/** Late HTML/iframe layout may shift the anchored message after placement. */
const SETTLE_MS = 2000;
const SETTLE_REAPPLIES = 3;

const historyEntry = (): string => {
  const entry = typeof window === "undefined" ? undefined : window.history.state?.noctuaEntry;
  return typeof entry === "string" ? entry : "";
};
const listRows = (list: HTMLElement | null): AnchorItems =>
  list ? Array.from(list.querySelectorAll<HTMLElement>("[data-message-id]"), row => [row.dataset.messageId ?? "", row] as const) : [];
const findItem = (items: AnchorItems, id: string) => {
  for (const [itemId, element] of items) if (itemId === id && element.isConnected) return element;
  return null;
};

/**
 * Per-history-entry and per-place scroll anchors for the list and reader panes.
 * Precedence: an explicit new URL message target keeps its own placement, then
 * the Back/Forward entry's anchor, then the last anchor of that place, then top.
 * The deep-link hook stays the only history owner; this hook only reads the
 * entry id it writes and reacts to its URL → UI transactions.
 */
export function useScrollAnchors(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const stores = useRef<{ entry: ScrollAnchorStore; place: ScrollAnchorStore } | null>(null);
  stores.current ??= { entry: new ScrollAnchorStore(), place: new ScrollAnchorStore() };
  const armed = useRef<Record<Pane, boolean>>({ list: true, reader: true });
  const restores = useRef<Partial<Record<Pane, Restore>>>({});
  const transaction = useRef<{ origin: DeepLinkTransaction["origin"]; listChanged: boolean } | null>(null);
  const keys = useRef({ list: options.listKey, reader: "", listShown: options.listShown });
  const claimedReader = useRef("");
  const historyReader = useRef("");

  const pane = useCallback((name: Pane) => {
    const o = latest.current;
    if (name === "list") {
      const list = o.listRef.current;
      return { key: o.listKey, scroll: list, items: () => listRows(list) };
    }
    return { key: o.readerMessageId ? `${o.accountId}|${o.readerMessageId}` : "", scroll: o.readerScroll(), items: o.readerItems };
  }, []);
  const saved = useCallback((name: Pane, history: boolean) => {
    const key = pane(name).key;
    if (!key) return undefined;
    const entry = historyEntry();
    return (history && entry ? stores.current!.entry.get(`${name}|${entry}|${key}`) : undefined) ??
      stores.current!.place.get(`${name}|${key}`);
  }, [pane]);
  const capture = useCallback((name: Pane) => {
    if (!armed.current[name]) return;
    const { key, scroll, items } = pane(name);
    if (!key) return;
    const anchor = captureAnchor(scroll, items());
    // Hidden panes report no geometry and must never overwrite a visible position.
    if (!anchor) return;
    if (name === "reader") {
      const all = latest.current.getCollapsed();
      const collapsed: Record<string, boolean> = {};
      for (const [id, element] of items()) if (id in all && scroll!.contains(element)) collapsed[id] = all[id];
      anchor.collapsed = collapsed;
    }
    stores.current!.place.set(`${name}|${key}`, anchor);
    const entry = historyEntry();
    if (entry) stores.current!.entry.set(`${name}|${entry}|${key}`, anchor);
  }, [pane]);
  const cancel = useCallback((name: Pane) => {
    restores.current[name]?.cancel();
    restores.current[name] = undefined;
  }, []);
  const restore = useCallback((name: Pane, anchor: ScrollAnchor) => {
    cancel(name);
    const key = pane(name).key;
    armed.current[name] = false;
    if (name === "reader") claimedReader.current = key;
    const started = performance.now();
    let frame = 0;
    let stable = 0;
    let collapsedApplied = false;
    let observer: ResizeObserver | null = null;
    let settleTimer = 0;
    const stop = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      observer?.disconnect();
    };
    const finish = () => {
      armed.current[name] = true;
      const { scroll, items } = pane(name);
      if (!anchor.id || !scroll || typeof ResizeObserver === "undefined") return;
      // One bounded re-check for late HTML layout (iframe height, images, fonts).
      let reapplies = 0;
      observer = new ResizeObserver(() => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          const error = applyAnchor(scroll, anchor, findItem(items(), anchor.id));
          if (error !== null && error >= 1 && ++reapplies >= SETTLE_REAPPLIES) cancel(name);
        });
      });
      for (const [, element] of items()) if (scroll.contains(element)) observer.observe(element);
      settleTimer = window.setTimeout(() => cancel(name), SETTLE_MS);
    };
    const step = () => {
      frame = 0;
      const { key: current, scroll, items } = pane(name);
      if (current !== key) { cancel(name); armed.current[name] = true; return; }
      if (isMeasurable(scroll)) {
        if (!collapsedApplied && anchor.collapsed) {
          collapsedApplied = true;
          latest.current.restoreCollapsed(anchor.collapsed);
        }
        const error = anchor.id ? applyAnchor(scroll, anchor, findItem(items(), anchor.id)) : null;
        if (error === null) {
          // Not rendered yet: the pixel fallback moves a virtual window onto the item.
          if (Math.abs(scroll.scrollTop - anchor.top) >= 1) scroll.scrollTop = anchor.top;
          if (!anchor.id) { finish(); return; }
          stable = 0;
        } else if (error < 1 && ++stable >= STABLE_FRAMES) { finish(); return; }
        else if (error >= 1) stable = 0;
      }
      if (performance.now() - started > RESTORE_BUDGET_MS) { cancel(name); armed.current[name] = true; return; }
      frame = window.requestAnimationFrame(step);
    };
    // First attempt after the commit: cached rows, the revealed pane and the
    // expanded linked message have geometry by then.
    frame = window.requestAnimationFrame(step);
    restores.current[name] = { key, cancel: stop };
  }, [cancel, pane]);

  // Capture from real scrolls only; programmatic restores are disarmed.
  useEffect(() => {
    const frames: Record<Pane, number> = { list: 0, reader: 0 };
    const schedule = (name: Pane) => {
      if (frames[name]) return;
      frames[name] = window.requestAnimationFrame(() => { frames[name] = 0; capture(name); });
    };
    const onScroll = (event: Event) => {
      if (event.target === latest.current.listRef.current) schedule("list");
      else if (event.target instanceof HTMLElement && event.target === latest.current.readerScroll()) schedule("reader");
    };
    const onUser = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        const target = event.target;
        if (!SCROLL_KEYS.has(event.key) || (target instanceof Element && target.closest("input, textarea, select, [contenteditable=true]"))) return;
      }
      // The reader keeps its claim: a late selection scroll must not snap back.
      for (const name of ["list", "reader"] as const) { cancel(name); armed.current[name] = true; }
      historyReader.current = "";
    };
    const userEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    document.addEventListener("scroll", onScroll, true);
    userEvents.forEach(type => window.addEventListener(type, onUser, { capture: true, passive: true }));
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      userEvents.forEach(type => window.removeEventListener(type, onUser, { capture: true }));
      window.cancelAnimationFrame(frames.list);
      window.cancelAnimationFrame(frames.reader);
      cancel("list");
      cancel("reader");
    };
  }, [cancel, capture]);

  // Destination changes outside a URL transaction: revisit anchor, else top.
  // Layout effect so a restore disarms capture before the browser's clamp scroll.
  const readerKey = options.readerMessageId ? `${options.accountId}|${options.readerMessageId}` : "";
  useLayoutEffect(() => {
    const last = keys.current;
    const listChanged = last.list !== options.listKey;
    const readerChanged = last.reader !== readerKey;
    const revealed = !last.listShown && options.listShown;
    keys.current = { list: options.listKey, reader: readerKey, listShown: options.listShown };
    if (readerChanged) { claimedReader.current = ""; historyReader.current = ""; }
    if (transaction.current) {
      if (listChanged) transaction.current.listChanged = true;
      return;
    }
    if (listChanged) restore("list", saved("list", false) ?? TOP);
    else if (revealed) {
      const anchor = saved("list", true);
      if (anchor) restore("list", anchor);
    }
    if (readerChanged && readerKey) {
      const anchor = saved("reader", false);
      if (anchor) restore("reader", anchor);
    }
  }, [options.accountId, options.listKey, options.listShown, readerKey, restore, saved]);

  const onTransaction = useCallback((event: DeepLinkTransaction) => {
    if (event.phase === "start") {
      transaction.current = { origin: event.origin, listChanged: false };
      historyReader.current = "";
      for (const name of ["list", "reader"] as const) { cancel(name); armed.current[name] = false; }
      return;
    }
    const work = transaction.current ?? { origin: event.origin, listChanged: false };
    transaction.current = null;
    const history = work.origin === "history";
    const list = work.origin === "initial" ? undefined : saved("list", history);
    if (list) restore("list", list);
    else if (work.listChanged && work.origin !== "initial") restore("list", TOP);
    else armed.current.list = true;
    // An explicit link target keeps the reader's own selection placement.
    const reader = history && event.messageId ? saved("reader", true) : undefined;
    if (reader) restore("reader", reader);
    else {
      armed.current.reader = true;
      if (history && event.messageId) historyReader.current = latest.current.readerMessageId;
    }
  }, [cancel, restore, saved]);

  const readerPlacement = useCallback((): ReaderPlacement => {
    const o = latest.current;
    const key = o.readerMessageId ? `${o.accountId}|${o.readerMessageId}` : "";
    if (key && claimedReader.current === key) return "skip";
    // History navigation without a saved position: place at once, never smooth.
    if (transaction.current?.origin === "history" || (o.readerMessageId && historyReader.current === o.readerMessageId)) return "instant";
    return "default";
  }, []);

  return { onTransaction, readerPlacement };
}
