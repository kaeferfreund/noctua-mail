import { afterEach, describe, expect, it } from "bun:test";
import { useEffect, useRef, useState } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Account, Folder } from "@/lib/data";
import { DEFAULT_SEARCH_BADGES, DEFAULT_SEARCH_FIELDS } from "@/app/components/mailclient/useSearchState";
import { useStartupSync } from "@/app/components/mailclient/useStartupSync";
import { findInboxFolder } from "@/lib/specialFolders";
import { useAccountController, type UseAccountControllerParams } from "@/app/components/mailclient/useAccountController";
import { useApiErrorMessage } from "./useApiErrorMessage.prefix";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { getMessages } from "@/lib/i18n/translator";
import type { UiLocale } from "@/lib/i18n/config";

afterEach(cleanup);

const accounts = [{ id: "account-a" }, { id: "account-b" }] as Account[];
const noop = () => {};

function mount(apiFetch: UseAccountControllerParams["apiFetch"], firstSync?: (accountId: string, folderId?: string) => void,
  localeRef?: { current: UiLocale }) {
  const errors: string[] = [];
  const defaults: UseAccountControllerParams = {
    activeAccountId: "", accounts: [], accountFolders: [], activeFolderId: "",
    deletingFolderIds: new Set(), refreshFolders: async () => null, runSyncJob: async () => ({ count: 0 }),
    defaultSearchFields: DEFAULT_SEARCH_FIELDS, defaultSearchBadges: DEFAULT_SEARCH_BADGES,
    apiFetch, reportError: (error: string) => errors.push(error),
    readErrorMessage: async (res: Response) => `HTTP ${res.status}`,
    setAccounts: noop,
    setActiveAccountId: noop,
    setFolders: noop,
    setAuthState: noop,
    setCurrentUser: noop,
    setInitialDataReady: noop,
    setInitialFoldersLoadedAccountId: noop,
    setSessionTtlSeconds: noop,
    setMessages: noop,
    setMessagesPage: noop,
    setHasMoreMessages: noop,
    setTotalMessages: noop,
    setActiveMessageId: noop,
    setViewMessage: noop,
    setActiveFolderId: noop,
    setQuery: noop,
    setSearchScope: noop,
    setSearchFields: noop,
    setSearchBadges: noop,
    setActiveVirtualFolderId: noop,
    setLastFolderId: noop,
    setMessageListError: noop,
    setExceptionEntries: noop,
    setManageOpen: noop,
    setManageTab: noop,
    setEditingAccount: noop,
    setDeletingFolderIds: noop,
  };
  const hook = renderHook(() => {
    const [activeAccountId, setActiveAccountId] = useState("");
    const [ready, setInitialDataReady] = useState(false);
    const [loadedAccounts, setAccounts] = useState<Account[]>([]);
    const [activeFolderId, setActiveFolderId] = useState("");
    const [lastFolderId, setLastFolderId] = useState("");
    const [folders, setFolders] = useState<Folder[]>([]);
    const [initialFoldersLoadedAccountId, setInitialFoldersLoadedAccountId] = useState<string | null>(null);
    const [auth, setAuthState] = useState<"loading" | "ok" | "unauth">("loading");
    // With a locale, use the production error resolver under a switchable provider.
    const productionReadErrorMessage = useApiErrorMessage({ setAuthState, setReloginAccountId: noop, setReloginDescription: noop });
    const readErrorMessage = localeRef ? productionReadErrorMessage : defaults.readErrorMessage;
    const controller = useAccountController({ ...defaults, readErrorMessage, activeAccountId, setActiveAccountId,
      accounts: loadedAccounts, setAccounts, setInitialDataReady, setAuthState,
      activeFolderId, setActiveFolderId, setLastFolderId, setFolders, setInitialFoldersLoadedAccountId });
    const syncAccountRef = useRef<Parameters<typeof useStartupSync>[0]["syncAccountRef"]["current"]>(undefined);
    syncAccountRef.current = async folderId => { firstSync?.(activeAccountId, folderId); };
    useStartupSync({ initialDataReady: ready, activeAccountId, initialFoldersLoadedAccountId,
      activeFolderId, accountFolders: folders, initialSyncStatusRef: useRef({}),
      readInitialSyncSessionStatus: () => null, writeInitialSyncSessionStatus: noop, syncAccountRef });
    useEffect(() => {
      if (firstSync && ready && folders.length && !activeFolderId) {
        setActiveFolderId(findInboxFolder(folders, activeAccountId)?.id ?? "");
      }
    }, [activeAccountId, activeFolderId, folders, ready]);
    return { ...controller, readErrorMessage, activeAccountId, setActiveAccountId, ready, auth, loadedAccounts, activeFolderId, setActiveFolderId, lastFolderId, setLastFolderId };
  }, { wrapper: ({ children }) => <I18nTestProvider locale={localeRef?.current ?? "en"}>{children}</I18nTestProvider> });
  return { ...hook, errors };
}

const json = (value: unknown) => Response.json(value);

describe("account bootstrap request order", () => {
  it("a UI language switch keeps the error resolver and does not re-bootstrap the mailbox", async () => {
    const calls: string[] = [];
    const localeRef: { current: UiLocale } = { current: "de" };
    const { result, rerender } = mount(async (input) => {
      const url = String(input); calls.push(url);
      return json(url === "/api/auth/me" ? { accounts, accountId: "account-b", mailboxState: "selected" } : []);
    }, undefined, localeRef);
    await waitFor(() => expect(result.current.ready).toBe(true));
    const resolver = result.current.readErrorMessage;
    for (const locale of ["en", "de"] as const) {
      localeRef.current = locale;
      rerender();
      await act(async () => { await Promise.resolve(); });
      expect(result.current.readErrorMessage).toBe(resolver);
      expect(result.current.ready).toBe(true);
      // The stable resolver still localizes with the current UI language.
      expect(await resolver(Response.json({ code: "folder_account_mismatch" }, { status: 400 })))
        .toBe(getMessages(locale).Notifications.folderAccountMismatch);
    }
    expect(calls).toEqual(["/api/auth/me", "/api/accounts/account-b/folders"]);
  });

  it("cold loads once: auth/me -> folders, even after publishing the selected account", async () => {
    const calls: string[] = [];
    const { result, rerender } = mount(async (input) => {
      const url = String(input); calls.push(url);
      return json(url === "/api/auth/me" ? { accounts, accountId: "account-b", mailboxState: "selected" } : []);
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    rerender();
    expect(result.current.activeAccountId).toBe("account-b");
    expect(result.current.loadedAccounts).toEqual(accounts);
    expect(calls).toEqual(["/api/auth/me", "/api/accounts/account-b/folders"]);
  });

  it("clears stale local selection when the server reports unselected", async () => {
    let resolve!: (res: Response) => void;
    const me = new Promise<Response>((done) => { resolve = done; });
    const calls: string[] = [];
    const { result } = mount(async (input) => {
      calls.push(String(input));
      return String(input) === "/api/auth/me" ? me : json([]);
    });
    act(() => result.current.setActiveAccountId("account-b"));
    await act(async () => { resolve(json({ accounts, accountId: null, mailboxState: "unselected" })); });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(calls).toEqual(["/api/auth/me"]);
    expect(result.current.activeAccountId).toBe("");
    expect(result.current.mailboxState).toBe("unselected");
  });

  it("persists a switch before rereading me and requesting selected folders", async () => {
    const calls: string[] = [];
    let selected = "account-a";
    const { result } = mount(async (input) => {
      const url = String(input); calls.push(url);
      if (url.endsWith("switch-account")) { selected = "account-b"; return json({ accountId: selected }); }
      if (url === "/api/auth/me") return json({ accounts, accountId: selected, mailboxState: "selected" });
      if (url === "/api/accounts") return json(accounts);
      return json(url.endsWith("switch-account") ? { accountId: "account-b" } : []);
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    calls.length = 0;
    await act(async () => { await result.current.switchAccount("account-b"); });
    expect(calls).toEqual(["/api/auth/switch-account", "/api/auth/me", "/api/accounts/account-b/folders"]);
    expect(result.current.activeAccountId).toBe("account-b");
    calls.length = 0;
    await act(async () => { await result.current.loadInitialData(); });
    expect(calls).toEqual(["/api/auth/me", "/api/accounts/account-b/folders"]);
  });

  it("does not request accounts or folders after an auth 401", async () => {
    const calls: string[] = [];
    const { result } = mount(async (input) => {
      calls.push(String(input)); return new Response(null, { status: 401 });
    });
    await waitFor(() => expect(result.current.auth).toBe("unauth"));
    expect(result.current.ready).toBe(false);
    expect(calls).toEqual(["/api/auth/me"]);
  });

  it("never loads folders for a preferred account absent from fresh account access", async () => {
    const calls: string[] = [];
    const { result } = mount(async (input) => {
      const url = String(input); calls.push(url);
      return json(url === "/api/auth/me" ? { accounts: [], accountId: "account-b", mailboxState: "selected" } : []);
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.activeAccountId).toBe("");
    expect(calls).toEqual(["/api/auth/me"]);
  });
});


describe("identity and mailbox state transitions", () => {
  it("keeps enrollment, none and unselected mailbox-independent, then persists selected before mail", async () => {
    const calls: string[] = [];
    let mailboxState = "enrollment";
    const { result } = mount(async input => {
      const path = String(input); calls.push(path);
      if (path.endsWith("switch-account")) { mailboxState = "selected"; return json({ ok: true, accountId: "account-b" }); }
      return json(path === "/api/auth/me" ? { user: { id: "synthetic-user" }, accounts: mailboxState === "enrollment" || mailboxState === "none" ? [] : accounts,
        mailboxState, accountId: mailboxState === "selected" ? "account-b" : null, security: { enrollmentRequired: mailboxState === "enrollment" } } : []);
    });
    await waitFor(() => expect(result.current.mailboxState).toBe("enrollment"));
    expect(result.current.activeAccountId).toBe(""); expect(result.current.loadedAccounts).toEqual([]);
    mailboxState = "none"; await act(async () => { await result.current.loadInitialData(); });
    expect(result.current.mailboxState).toBe("none"); expect(result.current.auth).toBe("ok");
    mailboxState = "unselected"; await act(async () => { await result.current.loadInitialData(); });
    expect(result.current.mailboxState).toBe("unselected"); expect(result.current.activeAccountId).toBe("");
    expect(calls).toEqual(["/api/auth/me", "/api/auth/me", "/api/auth/me"]);
    await act(async () => { await result.current.switchAccount("account-b"); });
    expect(result.current.activeAccountId).toBe("account-b");
    expect(calls.slice(-3)).toEqual(["/api/auth/switch-account", "/api/auth/me", "/api/accounts/account-b/folders"]);
  });
  it("does not log out for bootstrap network/503 errors and exposes retry", async () => {
    let failed = true;
    const { result } = mount(async () => failed ? new Response(null, { status: 503 }) : json({ accounts: [], mailboxState: "none", accountId: null }));
    await waitFor(() => expect(result.current.bootstrapError).toBe("HTTP 503"));
    expect(result.current.auth).toBe("loading"); failed = false;
    await act(async () => { await result.current.loadInitialData(); });
    expect(result.current.auth).toBe("ok"); expect(result.current.bootstrapError).toBeNull();
  });
  it("bodyless logout checks success before clearing identity and mailbox state", async () => {
    let failLogout = true;
    const { result, errors } = mount(async (input, init) => {
      if (String(input).endsWith("logout")) {
        expect(init?.method).toBe("POST"); expect(init?.body).toBeUndefined();
        expect(new Headers(init?.headers).has("content-type")).toBe(false);
        return Response.json({ ok: !failLogout }, { status: failLogout ? 503 : 200 });
      }
      return json(String(input) === "/api/auth/me" ? { accounts, accountId: "account-a", mailboxState: "selected" } : []);
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { expect(await result.current.logout()).toBe(false); });
    expect(result.current.auth).toBe("ok"); expect(result.current.activeAccountId).toBe("account-a"); expect(result.current.loadedAccounts).toEqual(accounts);
    expect(errors.at(-1)).toContain("session is still open"); failLogout = false;
    await act(async () => { expect(await result.current.logout()).toBe(true); });
    expect(result.current.auth).toBe("unauth"); expect(result.current.activeAccountId).toBe(""); expect(result.current.loadedAccounts).toEqual([]);
  });
});


describe("admin-only mailbox creation", () => {
  const draft: Account = { id: "synthetic-draft", name: "Synthetic mailbox", email: "mailbox@example.test", avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "synthetic", password: "synthetic-password" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "synthetic", password: "synthetic-password" } };
  for (const role of ["admin", "user"]) it(`${role} respects creation authority without implicit mailbox access`, async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const { result, errors } = mount(async (input, init) => {
      const url = String(input); calls.push({ url, init });
      return json(url === "/api/auth/me" ? { user: { id: "synthetic-user", role }, accounts: [], mailboxState: "none", accountId: null } : { ok: true, account: { ...draft, id: "synthetic-created" } });
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    calls.length = 0;
    await act(async () => { await result.current.saveAccount(draft); });
    expect(calls.map(call => call.url)).toEqual(role === "admin" ? ["/api/admin/accounts", "/api/auth/me"] : []);
    expect(result.current.activeAccountId).toBe("");
    expect(result.current.mailboxState).toBe("none");
    if (role === "admin") {
      expect(calls[0].init?.method).toBe("POST");
      expect(JSON.parse(String(calls[0].init?.body)).id).toBeUndefined();
    } else expect(errors).toContain("Ask your admin to create a mailbox.");
  });
});


for (const flow of ["switch", "create-self-grant-select"] as const) {
  it(`first startup sync follows the new account after ${flow}`, async () => {
    let selected = "account-a";
    let created = false;
    let granted = false;
    const syncs: Array<{ accountId: string; folderId?: string }> = [];
    const apiFetch: UseAccountControllerParams["apiFetch"] = async (input, init) => {
      const url = String(input);
      if (url === "/api/admin/accounts") { created = true; return json({ account: { id: "account-b" } }); }
      if (url === "/api/admin/accounts/account-b/members/synthetic-user") { granted = true; return json({ ok: true }); }
      if (url === "/api/auth/switch-account") {
        if (flow === "create-self-grant-select") expect(created && granted).toBe(true);
        selected = JSON.parse(String(init?.body)).accountId;
        return json({ accountId: selected });
      }
      if (url === "/api/auth/me") return json({ user: { id: "synthetic-user", role: "admin" }, accounts,
        accountId: selected, mailboxState: "selected" });
      return json([{ id: `${selected}:Archive`, accountId: selected, name: "Archive", count: 0 },
        { id: `${selected}:INBOX`, accountId: selected, name: "Posteingang", specialUse: "\\Inbox", count: 0 }]);
    };
    const { result } = mount(apiFetch, (accountId, folderId) => syncs.push({ accountId, folderId }));
    await waitFor(() => expect(syncs.some(sync => sync.accountId === "account-a")).toBe(true));
    act(() => { result.current.setActiveFolderId("account-a:INBOX"); result.current.setLastFolderId("account-a:INBOX"); });
    await act(async () => {
      if (flow === "create-self-grant-select") {
        await result.current.saveAccount({ id: "synthetic-draft", email: "new@example.test" } as Account);
        await apiFetch("/api/admin/accounts/account-b/members/synthetic-user", { method: "PUT",
          body: JSON.stringify({ role: "manager" }) });
        // The admin self-grant branch persists selection, then calls loadInitialData.
        await apiFetch("/api/auth/switch-account", { method: "POST",
          body: JSON.stringify({ accountId: "account-b" }) });
        await result.current.loadInitialData();
      } else await result.current.switchAccount("account-b");
    });
    await waitFor(() => expect(syncs.filter(sync => sync.accountId === "account-b")).toHaveLength(1));
    expect(syncs.find(sync => sync.accountId === "account-b")).toEqual({ accountId: "account-b", folderId: "account-b:INBOX" });
    expect(result.current.lastFolderId).toBe("");
  });
}
