"use client";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { readReaderStorage, writeReaderStorage } from "./readerFocus";

/** Device-only sidebar state: the domain groups a user collapsed, one key per
 * user so people sharing a browser keep their own layout. */
export function collapsedDomainsKey(userId: string | null | undefined): string {
  return `noctua:sidebarDomainsCollapsed:${userId || "anonymous"}`;
}

/** Previous versions stored the same list with mine:/shared: prefixes. */
function domainOf(entry: string): string {
  return entry.replace(/^(mine|shared):/, "");
}

/** The stored JSON array of entries; anything else counts as nothing collapsed. */
export function parseCollapsedDomains(raw: string | null): ReadonlySet<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map(domainOf) : []);
  } catch {
    return new Set();
  }
}

/** Rewrite old section keys once; a collapsed section keeps its domain collapsed. */
export function migrateCollapsedDomains(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const entries: unknown = JSON.parse(raw);
    return Array.isArray(entries) && entries.some(entry => typeof entry === "string" && /^(mine|shared):/.test(entry))
      ? JSON.stringify([...parseCollapsedDomains(raw)].sort()) : null;
  } catch { return null; }
}

export function toggleCollapsedDomain(entries: ReadonlySet<string>, domain: string): string {
  const next = new Set([...entries].map(domainOf));
  if (!next.delete(domain)) next.add(domain);
  return JSON.stringify([...next].sort());
}

// A toggle notifies every subscriber, and
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

/** Collapsed domain groups of the signed-in user in the sidebar; all
 * expanded on the server and until hydration. */
export function useCollapsedDomains(userId: string | null | undefined) {
  const key = collapsedDomainsKey(userId);
  const raw = useSyncExternalStore(subscribe, () => readReaderStorage(key), () => null);
  const collapsed = useMemo(() => parseCollapsedDomains(raw), [raw]);
  useEffect(() => {
    const migrated = migrateCollapsedDomains(raw);
    if (migrated !== null) {
      writeReaderStorage(key, migrated);
      listeners.forEach(listener => listener());
    }
  }, [key, raw]);
  const toggle = useCallback((domain: string) => {
    writeReaderStorage(key, toggleCollapsedDomain(parseCollapsedDomains(readReaderStorage(key)), domain));
    listeners.forEach(listener => listener());
  }, [key]);
  return { collapsed, toggle };
}
