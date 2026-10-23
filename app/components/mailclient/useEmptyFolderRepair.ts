"use client";

import { useEffect, type MutableRefObject } from "react";
import { buildAccountMessagesPath } from "@/lib/accountApiPaths";
import { isAccountFolder } from "@/lib/folderAccount";
import type { Folder } from "@/lib/data";
import type { UseAccountControllerParams } from "./useAccountController";
import type { useSyncController } from "./useSyncController";

type SyncController = ReturnType<typeof useSyncController>;

type EmptyFolderRepairParams = {
  accountId: string;
  folderId: string;
  accountFolders: Folder[];
  enabled: boolean;
  apiFetch: UseAccountControllerParams["apiFetch"];
  attemptedFolderIdsRef: MutableRefObject<Set<string>>;
  recomputeThreadsRef: SyncController["recomputeThreadsRef"];
  syncFolderRef: SyncController["syncFolderWithBackgroundRef"];
};

/** An empty list can need threading repair or a full fetch, scoped to its selection. */
export function useEmptyFolderRepair({ accountId, folderId, accountFolders, enabled, apiFetch,
  attemptedFolderIdsRef, recomputeThreadsRef, syncFolderRef }: EmptyFolderRepairParams) {
  useEffect(() => {
    if (!enabled || !isAccountFolder(accountId, folderId, accountFolders)) return;
    if (attemptedFolderIdsRef.current.has(folderId)) return;
    attemptedFolderIdsRef.current.add(folderId);
    let cancelled = false;
    // Retain the callbacks belonging to this account. A ref read after awaiting
    // the list response could instead invoke the next account's sync controller.
    const recompute = recomputeThreadsRef.current;
    const syncFolder = syncFolderRef.current;
    void (async () => {
      try {
        const params = new URLSearchParams({ folderId, pageSize: "1" });
        const res = await apiFetch(buildAccountMessagesPath(accountId, params));
        if (!res.ok) return;
        const data = await res.json() as { total?: number };
        if (cancelled) return;
        if (typeof data.total === "number" && data.total > 0) await recompute();
        else await syncFolder(folderId, true, "full", {
          fullSyncReason: "Auto-repair requested full sync because the folder list is empty and no raw messages were found in the DB."
        });
      } catch {
        // Repair is opportunistic; the regular sync path reports failures.
      }
    })();
    return () => { cancelled = true; };
  }, [accountId, folderId, accountFolders, enabled, apiFetch, attemptedFolderIdsRef,
    recomputeThreadsRef, syncFolderRef]);
}
