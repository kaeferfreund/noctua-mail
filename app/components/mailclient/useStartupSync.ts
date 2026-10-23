"use client";

import { useEffect, type MutableRefObject } from "react";
import type { Folder } from "@/lib/data";
import { isAccountFolder } from "@/lib/folderAccount";
import { decideStartupSync } from "@/lib/syncPolicy";
import { logSyncPolicyCall } from "@/lib/syncPolicyLogging";
import type { useSyncController } from "./useSyncController";

type SyncStatus = "running" | "done" | null;
type StartupSyncParams = {
  initialDataReady: boolean;
  activeAccountId: string;
  initialFoldersLoadedAccountId: string | null;
  accountFolders: Folder[];
  activeFolderId: string;
  initialSyncStatusRef: MutableRefObject<Record<string, SyncStatus>>;
  readInitialSyncSessionStatus: (accountId: string) => SyncStatus;
  writeInitialSyncSessionStatus: (accountId: string, status: SyncStatus) => void;
  syncAccountRef: ReturnType<typeof useSyncController>["syncAccountRef"];
};

export function useStartupSync({ initialDataReady, activeAccountId, initialFoldersLoadedAccountId,
  accountFolders, activeFolderId, initialSyncStatusRef, readInitialSyncSessionStatus,
  writeInitialSyncSessionStatus, syncAccountRef }: StartupSyncParams) {
  useEffect(() => {
    if (!initialDataReady || !activeAccountId) return;
    if (initialFoldersLoadedAccountId !== activeAccountId) return;

    const hasAccountFolders = accountFolders.length > 0;

    // For returning users, wait until the active folder is selected before starting
    // sync, so the syncAccount closure captures the correct activeFolderId. Without
    // this guard, activeFolderId is "" when the effect first fires (it gets set by a
    // sibling effect that runs in the same flush), causing refreshMailboxData() to be
    // skipped after sync completes and the user sees stale mail.
    if (hasAccountFolders && !isAccountFolder(activeAccountId, activeFolderId, accountFolders)) return;

    const syncStatus =
      initialSyncStatusRef.current[activeAccountId] ?? readInitialSyncSessionStatus(activeAccountId);
    if (syncStatus === "running" || syncStatus === "done") return;

    initialSyncStatusRef.current[activeAccountId] = "running";
    writeInitialSyncSessionStatus(activeAccountId, "running");
    const accountId = activeAccountId;
    const startupDecision = decideStartupSync({
      hasAccountFolders,
      activeFolderId
    });
    const startupTriggerId = logSyncPolicyCall({
      caller: "startup",
      policy: "decideStartupSync",
      accountId: activeAccountId,
      folderId: activeFolderId || null,
      input: {
        hasAccountFolders,
        activeFolderId
      },
      decision: startupDecision
    });
    if (startupDecision.kind === "skip") {
      delete initialSyncStatusRef.current[accountId];
      writeInitialSyncSessionStatus(accountId, null);
      return;
    }
    const syncPromise =
      startupDecision.kind === "account"
        ? syncAccountRef.current?.(undefined, startupDecision.mode, {
            fullSyncReason: startupDecision.reason,
            triggerId: startupTriggerId
          })
        : startupDecision.mode === "new" || startupDecision.mode === "repair" || startupDecision.mode === "full"
          ? syncAccountRef.current?.(startupDecision.folderId, startupDecision.mode, {
              fullSyncReason: startupDecision.reason,
              triggerId: startupTriggerId
            })
          : undefined;
    if (!syncPromise) {
      delete initialSyncStatusRef.current[accountId];
      writeInitialSyncSessionStatus(accountId, null);
      return;
    }

    void syncPromise
      .then(() => {
        initialSyncStatusRef.current[accountId] = "done";
        writeInitialSyncSessionStatus(accountId, "done");
      })
      .catch(() => {
        delete initialSyncStatusRef.current[accountId];
        writeInitialSyncSessionStatus(accountId, null);
      });
  }, [
    activeAccountId,
    accountFolders,
    initialDataReady,
    initialFoldersLoadedAccountId,
    activeFolderId,
    readInitialSyncSessionStatus,
    writeInitialSyncSessionStatus,
    initialSyncStatusRef,
    syncAccountRef
  ]);

}
