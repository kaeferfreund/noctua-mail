"use client";

import { publishLocalePreference } from "@/lib/i18n/localeEvents";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildAccountApiPath,
  buildAccountFolderDeletePath,
  buildAccountFolderRenamePath,
  buildAccountFoldersCreatePath,
  buildAccountFoldersPath
} from "@/lib/accountApiPaths";
import type { Account, Folder, Message } from "@/lib/data";
import { createAuthClient, type AuthMe, type AuthUser, type AuthSecurity, type MailboxState } from "@/lib/authClient";
import type {
  SearchBadgesState,
  SearchFieldsState,
  VirtualFolderDefinition
} from "./useSearchState";
import type { ManageTab } from "../AccountSettingsModal";
import type { SyncJobResult, SyncMode } from "./types";
import {
  buildAccountSaveRequest,
  createBlankEditAccount,
  normalizeCaldavForSave,
  normalizeDeeplForSave
} from "./utils/accountControllerHelpers";

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type UseAccountControllerParams = {
  activeAccountId: string;
  accounts: Account[];
  accountFolders: Folder[];
  activeFolderId: string;
  deletingFolderIds: Set<string>;
  apiFetch: ApiFetch;
  readErrorMessage: (res: Response) => Promise<string>;
  reportError: (message: string) => void;
  refreshFolders: (accountIdOverride?: string) => Promise<Folder[] | null>;
  runSyncJob: (payload: {
    accountId: string;
    folderId?: string;
    fullSync?: boolean;
    mode?: SyncMode;
    fullSyncReason?: string;
  }) => Promise<SyncJobResult>;
  // State setters owned by MailClient
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setActiveAccountId: React.Dispatch<React.SetStateAction<string>>;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  setAuthState: React.Dispatch<React.SetStateAction<"loading" | "ok" | "unauth">>;
  setCurrentUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
  setInitialDataReady: React.Dispatch<React.SetStateAction<boolean>>;
  setInitialFoldersLoadedAccountId: React.Dispatch<React.SetStateAction<string | null>>;
  setSessionTtlSeconds: React.Dispatch<React.SetStateAction<number | null>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setMessagesPage: React.Dispatch<React.SetStateAction<number>>;
  setHasMoreMessages: React.Dispatch<React.SetStateAction<boolean>>;
  setTotalMessages: React.Dispatch<React.SetStateAction<number | null>>;
  setActiveMessageId: React.Dispatch<React.SetStateAction<string>>;
  setViewMessage: React.Dispatch<React.SetStateAction<Message | null>>;
  setActiveFolderId: React.Dispatch<React.SetStateAction<string>>;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  setSearchScope: React.Dispatch<React.SetStateAction<"folder" | "all">>;
  setSearchFields: React.Dispatch<React.SetStateAction<SearchFieldsState>>;
  setSearchBadges: React.Dispatch<React.SetStateAction<SearchBadgesState>>;
  setActiveVirtualFolderId: React.Dispatch<
    React.SetStateAction<VirtualFolderDefinition["id"] | null>
  >;
  defaultSearchFields: SearchFieldsState;
  defaultSearchBadges: SearchBadgesState;
  setLastFolderId: React.Dispatch<React.SetStateAction<string>>;
  setMessageListError: React.Dispatch<React.SetStateAction<string | null>>;
  setExceptionEntries: React.Dispatch<React.SetStateAction<Array<{ id: string; message: string; timestamp: number }>>>;
  setManageOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setManageTab: React.Dispatch<React.SetStateAction<ManageTab>>;
  setEditingAccount: React.Dispatch<React.SetStateAction<Account | null>>;
  setDeletingFolderIds: React.Dispatch<React.SetStateAction<Set<string>>>;
};

export function useAccountController({
  activeAccountId,
  accounts,
  accountFolders,
  activeFolderId,
  deletingFolderIds,
  apiFetch,
  readErrorMessage,
  reportError,
  refreshFolders,
  setAccounts,
  setActiveAccountId,
  setFolders,
  setAuthState,
  setCurrentUser,
  setInitialDataReady,
  setInitialFoldersLoadedAccountId,
  setSessionTtlSeconds,
  setMessages,
  setMessagesPage,
  setHasMoreMessages,
  setTotalMessages,
  setActiveMessageId,
  setViewMessage,
  setActiveFolderId,
  setQuery,
  setSearchScope,
  setSearchFields,
  setSearchBadges,
  setActiveVirtualFolderId,
  defaultSearchFields,
  defaultSearchBadges,
  setLastFolderId,
  setMessageListError,
  setExceptionEntries,
  setManageOpen,
  setManageTab,
  setEditingAccount,
  setDeletingFolderIds
}: UseAccountControllerParams) {
  const [mailboxState, setMailboxState] = useState<MailboxState | null>(null);
  const [security, setSecurity] = useState<AuthSecurity | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const instanceAdmin = useRef(false);
  const lastIdentity = useRef<string | null>(null);
  const loadInitialData = useCallback(
    async () => {
      const version = ++loadVersion.current;
      setInitialDataReady(false);
      setInitialFoldersLoadedAccountId(null);
      setBootstrapError(null);
      try {
        const me = await apiFetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        if (version !== loadVersion.current) return;
        if (!me.ok) {
          if (me.status === 401) {
            publishLocalePreference(null);
            lastIdentity.current = null; instanceAdmin.current = false;
            setMessages([]); setViewMessage(null); setActiveMessageId("");
            setAuthState("unauth"); setCurrentUser(null); setAccounts([]);
            setActiveAccountId(""); setFolders([]); setMailboxState(null); setSecurity(null);
          } else setBootstrapError(await readErrorMessage(me));
          return;
        }
        const data = await me.json() as AuthMe;
        if (version !== loadVersion.current) return;
        publishLocalePreference(data.user?.uiLocale);
        if (lastIdentity.current !== data.user?.id) {
          setMessages([]); setViewMessage(null); setActiveMessageId(""); setMessagesPage(1);
          setHasMoreMessages(true); setTotalMessages(null); setActiveFolderId("");
        }
        lastIdentity.current = data.user?.id ?? null;
        instanceAdmin.current = data.user?.role === "admin";
        setAuthState("ok"); setCurrentUser(data.user); setSecurity(data.security);
        setSessionTtlSeconds(data.ttlSeconds);
        const restricted = data.mailboxState === "enrollment";
        const nextAccounts = restricted ? [] : data.accounts;
        // Only the server's persisted selection can activate a mailbox. A list
        // of memberships is never permission to select the first one locally.
        const selected = data.mailboxState === "selected" && nextAccounts.some(account => account.id === data.accountId) ? data.accountId! : "";
        setMailboxState(data.mailboxState === "selected" && !selected ? "unselected" : data.mailboxState);
        setAccounts(nextAccounts); setActiveAccountId(selected); setFolders([]);
        if (selected) {
          const foldersRes = await apiFetch(buildAccountFoldersPath(selected));
          if (version !== loadVersion.current) return;
          if (foldersRes.ok) {
            setFolders(await foldersRes.json() as Folder[]); setInitialFoldersLoadedAccountId(selected);
          } else reportError(await readErrorMessage(foldersRes));
        } else setInitialFoldersLoadedAccountId("");
        setInitialDataReady(true);
      } catch {
        if (version === loadVersion.current) setBootstrapError("Failed to load mailbox data. Please retry.");
      }
    },
    [apiFetch, readErrorMessage, reportError, setAccounts, setActiveAccountId, setAuthState,
      setCurrentUser, setFolders, setInitialDataReady, setInitialFoldersLoadedAccountId, setSessionTtlSeconds,
      setMessages, setViewMessage, setActiveMessageId, setMessagesPage, setHasMoreMessages, setTotalMessages, setActiveFolderId]
  );

  const logout = async () => {
    try {
      await createAuthClient(apiFetch).logout();
      loadVersion.current++; lastIdentity.current = null; instanceAdmin.current = false;
      setAuthState("unauth"); setCurrentUser(null); setAccounts([]); setFolders([]);
      setActiveAccountId(""); setMailboxState(null); setSecurity(null);
      setMessages([]); setViewMessage(null); setExceptionEntries([]); setMessageListError(null);
      return true;
    } catch {
      reportError("Unable to log out. Your session is still open. Try again.");
      return false;
    }
  };

  const switchAccount = useCallback(
    async (nextAccountId: string) => {
      const normalizedAccountId = nextAccountId.trim();
      if (!normalizedAccountId || normalizedAccountId === activeAccountId) return;
      try {
        const response = await apiFetch("/api/auth/switch-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: normalizedAccountId })
        });
        if (!response.ok) {
          reportError(await readErrorMessage(response));
          return;
        }
        setExceptionEntries([]);
        setMessageListError(null);
        setMessages([]);
        setMessagesPage(1);
        setHasMoreMessages(true);
        setTotalMessages(null);
        setActiveMessageId("");
        setViewMessage(null);
        setQuery("");
        setSearchScope("folder");
        setSearchFields({ ...defaultSearchFields });
        setSearchBadges({ ...defaultSearchBadges });
        setActiveVirtualFolderId(null);
        setActiveFolderId("");
        setLastFolderId("");
        await loadInitialData();
      } catch {
        reportError("Failed to switch account.");
      }
    },
    [
      activeAccountId,
      apiFetch,
      loadInitialData,
      readErrorMessage,
      reportError,
      setActiveMessageId,
      setActiveFolderId,
      setActiveVirtualFolderId,
      setExceptionEntries,
      setHasMoreMessages,
      setLastFolderId,
      setMessageListError,
      setMessages,
      setMessagesPage,
      setQuery,
      setSearchBadges,
      setSearchFields,
      setSearchScope,
      setTotalMessages,
      setViewMessage,
      defaultSearchBadges,
      defaultSearchFields
    ]
  );

  const saveAccount = async (account: Account) => {
    if (!account.email?.trim()) {
      reportError("Email address is required");
      return;
    }
    const exists = Boolean(accounts.find((a) => a.id === account.id));
    if (!exists && !instanceAdmin.current) { reportError("Ask your admin to create a mailbox."); return; }
    const { endpoint, method, body, isNew } = buildAccountSaveRequest(account, exists);
    const saveResult = await apiFetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!saveResult.ok) {
      reportError(await readErrorMessage(saveResult));
      return;
    }
    if (isNew) {
      // Admin creation grants no implicit ownership/membership or mail access.
      setManageOpen(false); setEditingAccount(null);
      await loadInitialData();
      return;
    }
    const refreshed = await apiFetch("/api/accounts");
    if (refreshed.ok) {
      const nextAccounts = (await refreshed.json()) as Account[];
      setAccounts(nextAccounts);
      setManageOpen(false);
      setEditingAccount(null);

    } else {
      reportError(await readErrorMessage(refreshed));
    }
  };

  const saveAccountSettings = async (account: Account) => {
    const exists = accounts.find((a) => a.id === account.id);
    if (!exists) return;
    const caldav = normalizeCaldavForSave(account.caldav);
    const deepl = normalizeDeeplForSave(account.deepl);
    const res = await apiFetch(buildAccountApiPath(account.id, ""), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: account.settings ?? {},
        caldav,
        deepl
      })
    });
    if (!res.ok) {
      reportError(await readErrorMessage(res));
      return;
    }
    const refreshed = await apiFetch("/api/accounts");
    if (refreshed.ok) {
      const nextAccounts = (await refreshed.json()) as Account[];
      setAccounts(nextAccounts);
      setManageOpen(false);
      setEditingAccount(null);
    } else {
      reportError(await readErrorMessage(refreshed));
    }
  };

  const deleteAccount = async (accountId: string) => {
    const res = await apiFetch(buildAccountApiPath(accountId, ""), { method: "DELETE" });
    if (!res.ok) {
      reportError(await readErrorMessage(res));
      return;
    }
    const refreshed = await apiFetch("/api/accounts");
    if (refreshed.ok) {
      const nextAccounts = (await refreshed.json()) as Account[];
      setAccounts(nextAccounts);
      await loadInitialData();
    } else {
      reportError(await readErrorMessage(refreshed));
    }
    setManageOpen(false);
    setEditingAccount(null);
  };

  const startEditAccount = (account?: Account) => {
    if (!account && !instanceAdmin.current) { reportError("Ask your admin to create a mailbox."); return; }
    const targetAccount: Account =
      account ?? createBlankEditAccount(() => crypto.randomUUID());
    setEditingAccount(targetAccount);
    setManageOpen(true);
    setManageTab("account");
  };

  const handleCreateSubfolder = async (folder: Folder) => {
    if (!activeAccountId) return;
    const name = window.prompt("New subfolder name");
    if (!name?.trim()) return;
    try {
      const res = await apiFetch(buildAccountFoldersCreatePath(activeAccountId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parentId: folder.id
        })
      });
      if (!res.ok) {
        reportError(await readErrorMessage(res));
        return;
      }
      await refreshFolders();
    } catch {
      reportError("Failed to create folder.");
    }
  };

  const handleRenameFolderItem = async (folder: Folder) => {
    if (!activeAccountId) return;
    const name = window.prompt("Rename folder", folder.name);
    if (!name?.trim() || name.trim() === folder.name) return;
    try {
      const res = await apiFetch(buildAccountFolderRenamePath(activeAccountId, folder.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() })
      });
      if (!res.ok) {
        reportError(await readErrorMessage(res));
        return;
      }
      await refreshFolders();
    } catch {
      reportError("Failed to rename folder.");
    }
  };

  const handleDeleteFolderItem = async (folder: Folder) => {
    if (!activeAccountId) return;
    if (deletingFolderIds.has(folder.id)) return;
    const confirmed = window.confirm(`Delete folder "${folder.name}" and its messages?`);
    if (!confirmed) return;
    setDeletingFolderIds((prev) => {
      const next = new Set(prev);
      next.add(folder.id);
      return next;
    });
    try {
      const res = await apiFetch(buildAccountFolderDeletePath(activeAccountId, folder.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        reportError(await readErrorMessage(res));
        return;
      }
      await refreshFolders();
      if (activeFolderId === folder.id) {
        setActiveFolderId(accountFolders[0]?.id ?? "");
      }
    } catch {
      reportError("Failed to delete folder.");
    } finally {
      setDeletingFolderIds((prev) => {
        const next = new Set(prev);
        next.delete(folder.id);
        return next;
      });
    }
  };

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return {
    mailboxState, security, bootstrapError, logout,
    loadInitialData,
    switchAccount,
    refreshFolders,
    saveAccount,
    saveAccountSettings,
    deleteAccount,
    startEditAccount,
    handleCreateSubfolder,
    handleRenameFolderItem,
    handleDeleteFolderItem
  };
}
