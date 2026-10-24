"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readReaderStorage, writeReaderStorage } from "./readerFocus";

/** Device-only sidebar state: the domain groups a user collapsed, one key per
 * user so people sharing a browser keep their own layout. */
export function collapsedDomainsKey(userId: string | null | undefined): string {
  return `noctua:sidebarDomainsCollapsed:${userId || "anonymous"}`;
}

/** The stored JSON array of domains; anything else counts as nothing collapsed. */
export function parseCollapsedDomains(raw: string | null): ReadonlySet<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

/** The stored value after toggling one domain (sorted, so equal sets serialise equally). */
export function toggleCollapsedDomain(collapsed: ReadonlySet<string>, domain: string): string {
  const next = new Set(collapsed);
  if (!next.delete(domain)) next.add(domain);
  return JSON.stringify([...next].sort());
}

// Every mailbox section reads the same key: a toggle notifies all of them, and
// a change in another tab arrives through the storage event.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Collapsed domain groups of the signed-in user; all expanded on the server
 * and until hydration. */
export function useCollapsedDomains(userId: string | null | undefined) {
  const key = collapsedDomainsKey(userId);
  const raw = useSyncExternalStore(subscribe, () => readReaderStorage(key), () => null);
  const collapsed = useMemo(() => parseCollapsedDomains(raw), [raw]);
  const toggle = useCallback((domain: string) => {
    writeReaderStorage(key, toggleCollapsedDomain(parseCollapsedDomains(readReaderStorage(key)), domain));
    listeners.forEach(listener => listener());
  }, [key]);
  return { collapsed, toggle };
}
