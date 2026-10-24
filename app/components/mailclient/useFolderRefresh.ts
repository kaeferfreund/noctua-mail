"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { Folder } from "@/lib/data";
import { buildAccountFoldersPath } from "@/lib/accountApiPaths";
import { useLatestRef } from "@/app/hooks/useLatestRef";

type FolderRefreshParams = {
  activeAccountId: string;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  reportError: (message: string) => void;
  readErrorMessage: (res: Response) => Promise<string>;
  setFolders: (folders: Folder[]) => void;
};

/**
 * Reload the folder list of the active (or given) mailbox. The callback's
 * identity does not depend on the UI language: it is passed into the bootstrap
 * and sync controllers, and a language switch must not re-run their effects.
 */
export function useFolderRefresh({ activeAccountId, apiFetch, reportError, readErrorMessage, setFolders }: FolderRefreshParams) {
  const tnRef = useLatestRef(useTranslations("Notifications"));
  const activeAccountIdRef = useLatestRef(activeAccountId);
  return useCallback(async (accountIdOverride?: string): Promise<Folder[] | null> => {
    const targetAccountId = accountIdOverride?.trim() || activeAccountId;
    if (!targetAccountId) {
      setFolders([]);
      return [];
    }
    try {
      const foldersRes = await apiFetch(buildAccountFoldersPath(targetAccountId));
      if (foldersRes.ok) {
        const nextFolders = (await foldersRes.json()) as Folder[];
        if (activeAccountIdRef.current === targetAccountId) setFolders(nextFolders);
        return nextFolders;
      } else {
        reportError(await readErrorMessage(foldersRes));
      }
    } catch {
      reportError(tnRef.current("refreshFoldersFailed"));
    }
    return null;
  }, [activeAccountId, apiFetch, reportError, readErrorMessage, setFolders, activeAccountIdRef, tnRef]);
}
