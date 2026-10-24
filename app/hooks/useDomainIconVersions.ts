"use client";
import { useEffect, useMemo, useState } from "react";
import { mailboxGroupDomain } from "@/lib/senderIdentity";

/** Sidebar group domain → version of its admin-uploaded icon. */
export type DomainIconVersions = Readonly<Record<string, string>>;

const NONE: DomainIconVersions = Object.freeze({});

// An upload or reset in the admin panel reloads the versions of every mounted
// sidebar in this tab, so the new image shows without a page reload.
const listeners = new Set<() => void>();
export function notifyDomainIconsChanged() {
  listeners.forEach(listener => listener());
}

function parseVersions(data: unknown): DomainIconVersions | null {
  const icons = (data as { icons?: unknown } | null)?.icons;
  if (!icons || typeof icons !== "object" || Array.isArray(icons)) return null;
  return Object.fromEntries(Object.entries(icons).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/**
 * Versions of the uploaded domain icons for the signed-in user's mailbox
 * domains (GET /api/domain-icons). Reloaded when the set of domains changes
 * or an admin changes an icon; a failed load keeps the last known versions.
 */
export function useDomainIconVersions({ sessionKey, apiFetch, accounts }: {
  sessionKey: string | null;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  accounts: ReadonlyArray<{ email: string }>;
}): DomainIconVersions {
  const [entry, setEntry] = useState<{ key: string; icons: DomainIconVersions } | null>(null);
  const [revision, setRevision] = useState(0);
  const domainsKey = useMemo(() => [...new Set(accounts.map(account => mailboxGroupDomain(account.email) ?? ""))].sort().join(","), [accounts]);
  useEffect(() => {
    const listener = () => setRevision(value => value + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  useEffect(() => {
    if (!sessionKey || !domainsKey) return;
    const controller = new AbortController();
    apiFetch("/api/domain-icons", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const icons = parseVersions(data);
        if (icons && !controller.signal.aborted) setEntry({ key: sessionKey, icons });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [apiFetch, sessionKey, domainsKey, revision]);
  return entry && entry.key === sessionKey ? entry.icons : NONE;
}
