"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { deferUntilIdle } from "./deferUntilIdle";
import { getRecipientAliasesResource } from "./recipientAliasesResource";

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type UseRecipientAliasesOptions = {
  activeAccountId: string;
  apiFetch: ApiFetch;
};

export function useRecipientAliases({ activeAccountId, apiFetch }: UseRecipientAliasesOptions) {
  const resource = useMemo(
    () => getRecipientAliasesResource(apiFetch, activeAccountId),
    [apiFetch, activeAccountId]
  );
  const recipientAliases = useSyncExternalStore(
    resource.subscribe, resource.getSnapshot, resource.getSnapshot
  );
  const refreshRecipientAliases = useCallback(
    (accountId: string) => getRecipientAliasesResource(apiFetch, accountId).load(true),
    [apiFetch]
  );

  useEffect(() => {
    if (!activeAccountId) return;
    resource.invalidate();
    return deferUntilIdle(() => { void resource.load(); });
  }, [activeAccountId, resource]);

  return {
    recipientAliases,
    setRecipientAliases: resource.set,
    refreshRecipientAliases
  };
}
