"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readReaderStorage, writeReaderStorage } from "./readerFocus";

/** Device-only sidebar state: the domain groups a user collapsed, one key per
 * user so people sharing a browser keep their own layout. */
export function collapsedDomainsKey(userId: string | null | undefined): string {
  return `noctua:sidebarDomainsCollapsed:${userId || "anonymous"}`;
}

/** The sidebar sections that group mailboxes by domain. */
export type MailboxSection = "mine" | "shared";
const SECTIONS: readonly MailboxSection[] = ["mine", "shared"];

/** Stored entry for one group: the section is part of it, so the same domain
 * in "Eigene" and "Geteilte" collapses independently. */
export function collapsedDomainEntry(section: MailboxSection, domain: string): string {
  return `${section}:${domain}`;
}

/** Entries stored before the section was part of the key are a bare domain
 * (domains contain no colon); they count for both sections. */
function isLegacyEntry(entry: string): boolean {
  return !SECTIONS.some(section => entry.startsWith(`${section}:`));
}

/** The stored JSON array of entries; anything else counts as nothing collapsed. */
export function parseCollapsedDomains(raw: string | null): ReadonlySet<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

/** The collapsed domains of one section. */
export function collapsedDomainsInSection(entries: ReadonlySet<string>, section: MailboxSection): ReadonlySet<string> {
  const prefix = `${section}:`;
  const domains = new Set<string>();
  for (const entry of entries) {
    if (entry.startsWith(prefix)) domains.add(entry.slice(prefix.length));
    else if (isLegacyEntry(entry)) domains.add(entry);
  }
  return domains;
}

/** The stored value after toggling one section's domain (sorted, so equal sets
 * serialise equally). Legacy entries are rewritten per section first, so the
 * other section keeps its state. */
export function toggleCollapsedDomain(entries: ReadonlySet<string>, section: MailboxSection, domain: string): string {
  const next = new Set<string>();
  for (const entry of entries) {
    if (isLegacyEntry(entry)) SECTIONS.forEach(item => next.add(collapsedDomainEntry(item, entry)));
    else next.add(entry);
  }
  const entry = collapsedDomainEntry(section, domain);
  if (!next.delete(entry)) next.add(entry);
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

/** Collapsed domain groups of the signed-in user in one sidebar section; all
 * expanded on the server and until hydration. */
export function useCollapsedDomains(userId: string | null | undefined, section: MailboxSection) {
  const key = collapsedDomainsKey(userId);
  const raw = useSyncExternalStore(subscribe, () => readReaderStorage(key), () => null);
  const collapsed = useMemo(() => collapsedDomainsInSection(parseCollapsedDomains(raw), section), [raw, section]);
  const toggle = useCallback((domain: string) => {
    writeReaderStorage(key, toggleCollapsedDomain(parseCollapsedDomains(readReaderStorage(key)), section, domain));
    listeners.forEach(listener => listener());
  }, [key, section]);
  return { collapsed, toggle };
}
