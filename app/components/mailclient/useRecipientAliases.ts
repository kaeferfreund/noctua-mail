"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { deferUntilIdle } from "./deferUntilIdle";
import { getRecipientAliasesResource } from "./recipientAliasesResource";

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type UseRecipientAliasesOptions = {
  activeAccountId: string;
  apiFetch: ApiFetch;
  /** False while a mailbox switch is pending: the idle read waits for it. */
  secondaryReadsReady?: boolean;
};

export function useRecipientAliases({ activeAccountId, apiFetch, secondaryReadsReady = true }: UseRecipientAliasesOptions) {
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
    if (!activeAccountId || !secondaryReadsReady) return;
    resource.invalidate();
    const controller = new AbortController();
    const cancel = deferUntilIdle(() => { void resource.load(false, controller.signal); });
    return () => {
      cancel();
      controller.abort();
    };
  }, [activeAccountId, resource, secondaryReadsReady]);

  return {
    recipientAliases,
    setRecipientAliases: resource.set,
    refreshRecipientAliases
  };
}
