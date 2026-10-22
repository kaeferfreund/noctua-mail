import type { Dispatch, SetStateAction } from "react";
import { buildAccountRecipientAliasesPath } from "@/lib/accountApiPaths";
import type { RecipientAlias } from "@/lib/data";

// This resource only requests account path strings. Accept the narrower
// compose fetch contract without wrapping it (its identity scopes the cache).
type ApiFetch = (input: string, init?: RequestInit) => Promise<Response>;
const emptyAliases: RecipientAlias[] = [];

// Scoped to a client's fetch function and account, so the idle hook and an
// immediate compose share one request and the same published snapshot.
const resources = new WeakMap<ApiFetch, Map<string, ReturnType<typeof createResource>>>();

function createResource(apiFetch: ApiFetch, accountId: string) {
  let aliases = emptyAliases;
  let loaded = false;
  let revision = 0;
  let pending: Promise<RecipientAlias[]> | undefined;
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());
  const set: Dispatch<SetStateAction<RecipientAlias[]>> = (update) => {
    revision += 1;
    loaded = true;
    aliases = typeof update === "function" ? update(aliases) : update;
    publish();
  };
  const load = (refresh = false): Promise<RecipientAlias[]> => {
    if (!accountId) return Promise.resolve(emptyAliases);
    if (pending) return pending;
    if (loaded && !refresh) return Promise.resolve(aliases);
    const requestRevision = revision;
    pending = Promise.resolve().then(async () => {
      try {
        const response = await apiFetch(buildAccountRecipientAliasesPath(accountId), {
          cache: "no-store"
        });
        const data = await response.json() as { ok?: boolean; aliases?: RecipientAlias[] };
        const next = response.ok && data.ok && Array.isArray(data.aliases) ? data.aliases : [];
        // Local create/update/delete actions that happened during this read win.
        if (revision === requestRevision) set(next);
        return aliases;
      } catch {
        // Leave a failed read retryable on the next explicit refresh/open.
        return aliases;
      }
    }).finally(() => { pending = undefined; });
    return pending;
  };
  return {
    invalidate: () => { loaded = false; },
    getSnapshot: () => aliases,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    set,
    load
  };
}

export function getRecipientAliasesResource(apiFetch: ApiFetch, accountId: string) {
  let accounts = resources.get(apiFetch);
  if (!accounts) {
    accounts = new Map();
    resources.set(apiFetch, accounts);
  }
  let resource = accounts.get(accountId);
  if (!resource) {
    resource = createResource(apiFetch, accountId);
    accounts.set(accountId, resource);
  }
  return resource;
}

export function ensureRecipientAliasesReady(apiFetch: ApiFetch, accountId: string) {
  return getRecipientAliasesResource(apiFetch, accountId).load();
}
