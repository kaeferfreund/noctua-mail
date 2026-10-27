import { afterEach, describe, expect, it } from "bun:test";
import { useEffect, useRef, useState } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Account, Folder } from "@/lib/data";
import { DEFAULT_SEARCH_BADGES, DEFAULT_SEARCH_FIELDS } from "./useSearchState";
import { useStartupSync } from "./useStartupSync";
import { findInboxFolder } from "@/lib/specialFolders";
import { useAccountController, type UseAccountControllerParams } from "./useAccountController";
import { useApiErrorMessage } from "./useApiErrorMessage";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { getMessages } from "@/lib/i18n/translator";
import type { UiLocale } from "@/lib/i18n/config";
import { MailboxViewCache } from "./mailboxViewCache";

afterEach(cleanup);

const accounts = [{ id: "account-a" }, { id: "account-b" }] as Account[];
const noop = () => {};

function mount(apiFetch: UseAccountControllerParams["apiFetch"], firstSync?: (accountId: string, folderId?: string) => void,
  localeRef?: { current: UiLocale }, viewCache?: MailboxViewCache) {
  const errors: string[] = [];
  const renders: Array<{ accountId: string; folderId: string; switchPending: boolean }> = [];
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
    const [switchPending, setSwitchPending] = useState(false);
    renders.push({ accountId: activeAccountId, folderId: activeFolderId, switchPending });
    // With a locale, use the production error resolver under a switchable provider.
    const productionReadErrorMessage = useApiErrorMessage({ setAuthState, setReloginAccountId: noop, setReloginDescription: noop });
    const readErrorMessage = localeRef ? productionReadErrorMessage : defaults.readErrorMessage;
    const controller = useAccountController({ ...defaults, readErrorMessage, activeAccountId, setActiveAccountId,
      accounts: loadedAccounts, setAccounts, setInitialDataReady, setAuthState,
      activeFolderId, setActiveFolderId, setLastFolderId, setFolders, setInitialFoldersLoadedAccountId, viewCache, setSwitchPending });
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
    return { ...controller, readErrorMessage, switchPending, activeAccountId, setActiveAccountId, ready, auth, loadedAccounts, activeFolderId, setActiveFolderId, lastFolderId, setLastFolderId, folders };
  }, { wrapper: ({ children }) => <I18nTestProvider locale={localeRef?.current ?? "en"}>{children}</I18nTestProvider> });
  return { ...hook, errors, renders };
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

  // Was "persists a switch before rereading me and requesting selected folders".
  // Persisting before activation is pinned by "activates nothing until the persisted
  // selection and the folder read both succeeded"; the persisted selection still
  // drives the next bootstrap below.
  it("persists a switch and reads the selected folders in parallel, then bootstraps from the persisted selection", async () => {
    const calls: string[] = [];
    let selected = "account-a";
    const { result } = mount(async (input) => {
      const url = String(input); calls.push(url);
      if (url.endsWith("switch-account")) { selected = "account-b"; return json({ accountId: selected }); }
      if (url === "/api/auth/me") return json({ accounts, accountId: selected, mailboxState: "selected" });
      if (url === "/api/accounts") return json(accounts);
      return json([]);
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    calls.length = 0;
    await act(async () => { await result.current.switchAccount("account-b"); });
    expect(calls).toEqual(["/api/auth/switch-account", "/api/accounts/account-b/folders"]);
    expect(result.current.activeAccountId).toBe("account-b");
    calls.length = 0;
    await act(async () => { await result.current.loadInitialData(); });
    expect(calls).toEqual(["/api/auth/me", "/api/accounts/account-b/folders"]);
    expect(result.current.activeAccountId).toBe("account-b");
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
    // Selected only after the server persisted it (activation order: see the D1 suite).
    await act(async () => { await result.current.switchAccount("account-b"); });
    expect(result.current.activeAccountId).toBe("account-b");
    expect(result.current.mailboxState).toBe("selected");
    expect(calls.slice(-2)).toEqual(["/api/auth/switch-account", "/api/accounts/account-b/folders"]);
    expect(calls.filter(url => url === "/api/auth/me")).toHaveLength(3);
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
      // Folder reads are scoped by the path id, never by the session selection.
      const folderAccount = /^\/api\/accounts\/([^/]+)\/folders$/.exec(url)?.[1] ?? selected;
      return json([{ id: `${folderAccount}:Archive`, accountId: folderAccount, name: "Archive", count: 0 },
        { id: `${folderAccount}:INBOX`, accountId: folderAccount, name: "Posteingang", specialUse: "\\Inbox", count: 0 }]);
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


describe("parallel atomic mailbox switch", () => {
  type Held = { url: string; init?: RequestInit; resolve: (res: Response) => void };
  const foldersOf = (id: string) => [{ id: `${id}:Archive`, accountId: id, name: "Archive", count: 0 },
    { id: `${id}:INBOX`, accountId: id, name: "Inbox", specialUse: "\\Inbox", count: 0 }];
  const allAccounts = [...accounts, { id: "account-c" }, { id: "account-d" }] as Account[];
  type Server = { selected: string; accounts?: Account[] };
  // /auth/me answers at once from `server`; every other request is held until released.
  async function booted(server: Server, viewCache?: MailboxViewCache) {
    const held: Held[] = [];
    const calls: string[] = [];
    const apiFetch: UseAccountControllerParams["apiFetch"] = async (input, init) => {
      const url = String(input); calls.push(url);
      if (url === "/api/auth/me") return json({ user: { id: "synthetic-user" }, accounts: server.accounts ?? allAccounts,
        accountId: server.selected, mailboxState: "selected" });
      return new Promise<Response>(resolve => held.push({ url, init, resolve }));
    };
    const release = async (match: string, res: (held: Held) => Response) => {
      await waitFor(() => expect(held.some(item => item.url.includes(match))).toBe(true));
      const [item] = held.splice(held.findIndex(entry => entry.url.includes(match)), 1);
      await act(async () => { item.resolve(res(item)); await Promise.resolve(); });
    };
    const persisted = (item: Held) => JSON.parse(String(item.init?.body)).accountId as string;
    // A switch-account response that applies the write, as the server does.
    const persist = (item: Held) => { server.selected = persisted(item); return json({ ok: true, accountId: server.selected }); };
    const view = mount(apiFetch, undefined, undefined, viewCache);
    await release(`/${server.selected}/folders`, () => json(foldersOf(server.selected)));
    await waitFor(() => expect(view.result.current.ready).toBe(true));
    calls.length = 0;
    return { ...view, held, calls, release, persist, persisted };
  }
  const switchTo = (h: Awaited<ReturnType<typeof booted>>, id: string) => {
    let done!: Promise<void>;
    act(() => { done = h.result.current.switchAccount(id); });
    return done;
  };

  it("persists the selection and reads the new folders in parallel, without /auth/me", async () => {
    const h = await booted({ selected: "account-a" });
    const done = switchTo(h, "account-b");
    // Both requests are in flight before either answered.
    expect(h.calls).toEqual(["/api/auth/switch-account", "/api/accounts/account-b/folders"]);
    await h.release("switch-account", h.persist);
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await act(async () => { await done; });
    expect(h.result.current.activeAccountId).toBe("account-b");
    expect(h.result.current.activeFolderId).toBe("account-b:INBOX");
    expect(h.result.current.mailboxState).toBe("selected");
    expect(h.calls).not.toContain("/api/auth/me");
  });

  it("(b) a switch keeps loadInitialData identity-stable, so the mount bootstrap never re-runs", async () => {
    const h = await booted({ selected: "account-a" });
    const bootstrap = h.result.current.loadInitialData;
    const done = switchTo(h, "account-b");
    await h.release("switch-account", h.persist);
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await act(async () => { await done; });
    expect(h.result.current.activeAccountId).toBe("account-b");
    expect(h.result.current.loadInitialData).toBe(bootstrap);
    expect(h.calls.filter(url => url === "/api/auth/me")).toEqual([]);
  });

  it("(a) activates nothing until the persisted selection and the folder read both succeeded", async () => {
    const h = await booted({ selected: "account-a" });
    act(() => { h.result.current.setActiveFolderId("account-a:INBOX"); });
    const done = switchTo(h, "account-b");
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    // The folders of B have arrived, but B is not persisted yet: A stays fully active.
    expect(h.result.current.activeAccountId).toBe("account-a");
    expect(h.result.current.activeFolderId).toBe("account-a:INBOX");
    await h.release("switch-account", h.persist);
    await act(async () => { await done; });
    expect(h.result.current.activeAccountId).toBe("account-b");
    expect(h.result.current.activeFolderId).toBe("account-b:INBOX");
    // Account and folder change in the same commit: no render pairs a folder with another mailbox.
    expect(h.renders.filter(render => render.folderId && !render.folderId.startsWith(`${render.accountId}:`))).toEqual([]);
  });

  for (const denied of ["switch-account", "/account-b/folders"]) {
    it(`(c) a 403 from ${denied} never activates the mailbox and reloads the server view`, async () => {
      const server: Server = { selected: "account-a", accounts };
      const h = await booted(server);
      const done = switchTo(h, "account-b");
      server.accounts = [accounts[0]]; // B was revoked meanwhile
      if (denied === "switch-account") {
        await h.release("/account-b/folders", () => Response.json({ ok: false }, { status: 403 }));
        await h.release("switch-account", () => Response.json({ ok: false }, { status: 403 }));
      } else {
        await h.release("/account-b/folders", () => Response.json({ ok: false }, { status: 403 }));
        await h.release("switch-account", () => json({ ok: true, accountId: "account-a" }));
      }
      await h.release("/account-a/folders", () => json(foldersOf("account-a")));
      await act(async () => { await done; });
      expect(h.calls).toContain("/api/auth/me");
      expect(h.result.current.ready).toBe(true);
      expect(h.result.current.activeAccountId).toBe("account-a");
      expect(h.result.current.loadedAccounts.map(account => account.id)).toEqual(["account-a"]);
      expect(h.renders.some(render => render.accountId === "account-b")).toBe(false);
      expect(h.errors).toEqual(["HTTP 403"]);
    });
  }

  it("a folder read failure after a persisted switch resolves the mailbox from the server", async () => {
    const h = await booted({ selected: "account-a" });
    const done = switchTo(h, "account-b");
    await h.release("switch-account", h.persist);
    await h.release("/account-b/folders", () => new Response(null, { status: 503 }));
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await act(async () => { await done; });
    expect(h.calls.filter(url => url === "/api/auth/me")).toHaveLength(1);
    expect(h.result.current.activeAccountId).toBe("account-b");
    expect(h.result.current.ready).toBe(true);
  });

  it("rapid A -> B -> C persists in click order and commits only the last selection", async () => {
    const h = await booted({ selected: "account-a" });
    void switchTo(h, "account-b");
    const done = switchTo(h, "account-c");
    // One selection write at a time: C's write waits for B's.
    await waitFor(() => expect(h.held.filter(item => item.url.endsWith("switch-account"))).toHaveLength(1));
    await h.release("/account-c/folders", () => json(foldersOf("account-c")));
    await h.release("switch-account", item => { expect(h.persisted(item)).toBe("account-b"); return h.persist(item); });
    expect(h.result.current.activeAccountId).toBe("account-a");
    await h.release("switch-account", item => { expect(h.persisted(item)).toBe("account-c"); return h.persist(item); });
    await act(async () => { await done; });
    expect(h.result.current.activeAccountId).toBe("account-c");
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    expect(h.result.current.activeAccountId).toBe("account-c");
    expect(h.result.current.activeFolderId).toBe("account-c:INBOX");
    expect(h.renders.some(render => render.accountId === "account-b")).toBe(false);
  });

  it("A -> B -> A before B commits keeps A, persists A last and does not reset A's view", async () => {
    const server: Server = { selected: "account-a" };
    const h = await booted(server);
    act(() => { h.result.current.setActiveFolderId("account-a:INBOX"); h.result.current.setLastFolderId("account-a:INBOX"); });
    void switchTo(h, "account-b");
    const done = switchTo(h, "account-a");
    // Returning to the mailbox still shown reads no folders, and its write waits for B's.
    expect(h.calls).toEqual(["/api/auth/switch-account", "/api/accounts/account-b/folders"]);
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await h.release("switch-account", item => { expect(h.persisted(item)).toBe("account-b"); return h.persist(item); });
    expect(h.result.current.activeAccountId).toBe("account-a");
    await h.release("switch-account", item => { expect(h.persisted(item)).toBe("account-a"); return h.persist(item); });
    await act(async () => { await done; });
    expect(server.selected).toBe("account-a");
    expect(h.result.current.activeAccountId).toBe("account-a");
    expect(h.result.current.activeFolderId).toBe("account-a:INBOX");
    expect(h.result.current.lastFolderId).toBe("account-a:INBOX");
    expect(h.renders.some(render => render.accountId === "account-b")).toBe(false);
    expect(h.calls.filter(url => url.endsWith("switch-account"))).toHaveLength(2);
    expect(h.calls).not.toContain("/api/auth/me");
  });

  it("reports a pending switch from the first click until the last overlapping switch settled", async () => {
    const h = await booted({ selected: "account-a" });
    expect(h.result.current.switchPending).toBe(false);
    void switchTo(h, "account-b");
    expect(h.result.current.switchPending).toBe(true);
    const done = switchTo(h, "account-c");
    await h.release("/account-c/folders", () => json(foldersOf("account-c")));
    await h.release("switch-account", h.persist);
    // B's switch settled, C's still runs.
    expect(h.result.current.switchPending).toBe(true);
    await h.release("switch-account", h.persist);
    await act(async () => { await done; });
    expect(h.result.current.activeAccountId).toBe("account-c");
    expect(h.result.current.switchPending).toBe(false);
    // The commit and the settled flag render together: C is never shown as pending.
    expect(h.renders.some(render => render.accountId === "account-c" && render.switchPending)).toBe(false);
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    expect(h.result.current.switchPending).toBe(false);
  });

  it("A -> B -> A -> B ends on B", async () => {
    const server: Server = { selected: "account-a" };
    const h = await booted(server);
    void switchTo(h, "account-b");
    void switchTo(h, "account-a");
    const done = switchTo(h, "account-b");
    await h.release("switch-account", item => { expect(h.persisted(item)).toBe("account-b"); return h.persist(item); });
    // A's write was superseded before it was sent.
    await h.release("switch-account", item => { expect(h.persisted(item)).toBe("account-b"); return h.persist(item); });
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await act(async () => { await done; });
    expect(server.selected).toBe("account-b");
    expect(h.result.current.activeAccountId).toBe("account-b");
    expect(h.result.current.activeFolderId).toBe("account-b:INBOX");
  });

  it("a click on the shown mailbox without a pending switch sends nothing", async () => {
    const h = await booted({ selected: "account-a" });
    await act(async () => { await h.result.current.switchAccount("account-a"); });
    expect(h.calls).toEqual([]);
  });

  it("(c) A -> B -> A with a 403 on A's write activates nothing and reloads the server view", async () => {
    const server: Server = { selected: "account-a", accounts: allAccounts };
    const h = await booted(server);
    void switchTo(h, "account-b");
    const done = switchTo(h, "account-a");
    await h.release("switch-account", h.persist);
    server.accounts = allAccounts.filter(account => account.id !== "account-a"); // A was revoked meanwhile
    await h.release("switch-account", () => Response.json({ ok: false }, { status: 403 }));
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await act(async () => { await done; });
    expect(h.errors).toEqual(["HTTP 403"]);
    expect(h.calls.filter(url => url === "/api/auth/me")).toHaveLength(1);
    expect(h.result.current.activeAccountId).toBe("account-b");
    expect(h.result.current.loadedAccounts.map(account => account.id)).not.toContain("account-a");
    expect(h.result.current.ready).toBe(true);
  });

  it("a bootstrap overlapping A -> B -> A keeps A and reloads the server view once A is persisted", async () => {
    const server: Server = { selected: "account-a" };
    const h = await booted(server);
    act(() => { h.result.current.setActiveFolderId("account-a:INBOX"); h.result.current.setLastFolderId("account-a:INBOX"); });
    void switchTo(h, "account-b");
    const done = switchTo(h, "account-a");
    await h.release("switch-account", h.persist);
    // e.g. a mailboxes-changed event reads the selection between B's and A's writes.
    await act(async () => { await h.result.current.loadInitialData(); });
    expect(h.result.current.activeAccountId).toBe("account-a");
    expect(h.result.current.ready).toBe(false);
    await h.release("switch-account", h.persist);
    await act(async () => { await done; });
    // The overlapped bootstrap left the view not ready: it is resolved again from the server.
    await h.release("/account-a/folders", () => json(foldersOf("account-a")));
    expect(server.selected).toBe("account-a");
    expect(h.calls.filter(url => url === "/api/auth/me")).toHaveLength(2);
    expect(h.result.current.ready).toBe(true);
    expect(h.result.current.activeAccountId).toBe("account-a");
    expect(h.result.current.activeFolderId).toBe("account-a:INBOX");
    expect(h.result.current.lastFolderId).toBe("account-a:INBOX");
    expect(h.renders.some(render => render.accountId === "account-b")).toBe(false);
  });

  it("a write superseded before it was sent is skipped", async () => {
    const h = await booted({ selected: "account-a" });
    void switchTo(h, "account-b");
    void switchTo(h, "account-c");
    const done = switchTo(h, "account-d");
    await h.release("switch-account", item => { expect(h.persisted(item)).toBe("account-b"); return h.persist(item); });
    await h.release("switch-account", item => { expect(h.persisted(item)).toBe("account-d"); return h.persist(item); });
    await h.release("/account-d/folders", () => json(foldersOf("account-d")));
    await act(async () => { await done; });
    expect(h.calls.filter(url => url.endsWith("switch-account"))).toHaveLength(2);
    expect(h.result.current.activeAccountId).toBe("account-d");
  });

  it("a bootstrap overlapping the switch publishes accounts but never overrides the switch's selection", async () => {
    const server: Server = { selected: "account-a", accounts: allAccounts };
    const h = await booted(server);
    const done = switchTo(h, "account-b");
    server.accounts = [...accounts, { id: "account-d" } as Account]; // membership changed meanwhile
    await act(async () => { await h.result.current.loadInitialData(); }); // e.g. a mailboxes-changed event
    expect(h.result.current.loadedAccounts.map(account => account.id)).toEqual(["account-a", "account-b", "account-d"]);
    expect(h.result.current.activeAccountId).toBe("account-a");
    await h.release("switch-account", h.persist);
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await act(async () => { await done; });
    expect(h.result.current.activeAccountId).toBe("account-b");
    expect(h.result.current.ready).toBe(true);
    expect(h.result.current.activeFolderId).toBe("account-b:INBOX");
    expect(h.calls.filter(url => url.endsWith("/folders"))).toEqual(["/api/accounts/account-b/folders"]);
    // That bootstrap read the old selection: the switch's choice is written again, not reverted.
    server.selected = "account-a";
    await h.release("switch-account", item => { expect(h.persisted(item)).toBe("account-b"); return h.persist(item); });
    expect(server.selected).toBe("account-b");
    expect(h.result.current.activeAccountId).toBe("account-b");
    expect(h.calls.filter(url => url === "/api/auth/me")).toHaveLength(1);
  });

  it("a bootstrap overlapping the switch that no longer grants the target reloads the server view", async () => {
    const server: Server = { selected: "account-a", accounts };
    const h = await booted(server);
    const done = switchTo(h, "account-b");
    server.accounts = [accounts[0]];
    await act(async () => { await h.result.current.loadInitialData(); });
    await h.release("switch-account", h.persist);
    server.selected = "account-a"; // revocation moved the selection to a granted mailbox
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await h.release("/account-a/folders", () => json(foldersOf("account-a")));
    await act(async () => { await done; });
    expect(h.calls.filter(url => url === "/api/auth/me")).toHaveLength(2);
    expect(h.result.current.activeAccountId).toBe("account-a");
    expect(h.result.current.loadedAccounts.map(account => account.id)).toEqual(["account-a"]);
  });

  it("a failed switch with a deferred bootstrap re-resolves the selection from the server", async () => {
    const h = await booted({ selected: "account-a" });
    const done = switchTo(h, "account-b");
    await act(async () => { await h.result.current.loadInitialData(); });
    expect(h.result.current.ready).toBe(false);
    await h.release("switch-account", () => Response.json({ ok: false }, { status: 503 }));
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await h.release("/account-a/folders", () => json(foldersOf("account-a")));
    await act(async () => { await done; });
    expect(h.result.current.ready).toBe(true);
    expect(h.result.current.activeAccountId).toBe("account-a");
  });

  it("a logout during the switch keeps the signed-out state", async () => {
    const h = await booted({ selected: "account-a" });
    const done = switchTo(h, "account-b");
    let loggedOut!: Promise<boolean>;
    act(() => { loggedOut = h.result.current.logout(); });
    await h.release("logout", () => json({ ok: true }));
    await act(async () => { await loggedOut; });
    await h.release("switch-account", h.persist);
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await act(async () => { await done; });
    expect(h.result.current.auth).toBe("unauth");
    expect(h.result.current.activeAccountId).toBe("");
  });

  it("(c) without /auth/me in the switch, a revoked membership still reaches the account list through the refresh bootstrap", async () => {
    const server: Server = { selected: "account-a", accounts };
    const h = await booted(server);
    const done = switchTo(h, "account-b");
    await h.release("switch-account", h.persist);
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await act(async () => { await done; });
    expect(h.result.current.loadedAccounts.map(account => account.id)).toEqual(["account-a", "account-b"]);
    // mailboxes-changed and the session refresh both run the bootstrap.
    server.accounts = [accounts[1]];
    let refreshed!: Promise<void>;
    act(() => { refreshed = h.result.current.loadInitialData(); });
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await act(async () => { await refreshed; });
    expect(h.result.current.loadedAccounts.map(account => account.id)).toEqual(["account-b"]);
    expect(h.result.current.activeAccountId).toBe("account-b");
  });
});

describe("switch to a mailbox visited earlier", () => {
  type Held = { url: string; init?: RequestInit; resolve: (res: Response) => void };
  const foldersOf = (id: string, count = 0) => [{ id: `${id}:Archive`, accountId: id, name: "Archive", count: 0 },
    { id: `${id}:INBOX`, accountId: id, name: "Inbox", specialUse: "\\Inbox", count }] as Folder[];
  async function bootedWithCache(server: { selected: string; accounts: Account[] }) {
    const held: Held[] = [];
    const calls: string[] = [];
    const cache = new MailboxViewCache();
    const view = mount(async (input, init) => {
      const url = String(input); calls.push(url);
      if (url === "/api/auth/me") return json({ user: { id: "synthetic-user" }, accounts: server.accounts,
        accountId: server.selected, mailboxState: "selected" });
      return new Promise<Response>(resolve => held.push({ url, init, resolve }));
    }, undefined, undefined, cache);
    const release = async (match: string, res: () => Response) => {
      await waitFor(() => expect(held.some(item => item.url.includes(match))).toBe(true));
      const [item] = held.splice(held.findIndex(entry => entry.url.includes(match)), 1);
      if (match === "switch-account" && res().ok) server.selected = JSON.parse(String(item.init?.body)).accountId;
      await act(async () => { item.resolve(res()); await Promise.resolve(); });
    };
    await release(`/${server.selected}/folders`, () => json(foldersOf(server.selected)));
    await waitFor(() => expect(view.result.current.ready).toBe(true));
    calls.length = 0;
    const switchTo = (id: string) => {
      let done!: Promise<void>;
      act(() => { done = view.result.current.switchAccount(id); });
      return done;
    };
    return { ...view, held, calls, cache, release, switchTo };
  }

  it("shows the cached folders on the click, then takes the fresh folders and keeps a folder opened meanwhile", async () => {
    const h = await bootedWithCache({ selected: "account-a", accounts });
    h.cache.writeFolders("account-b", foldersOf("account-b", 3));
    const done = h.switchTo("account-b");
    // Nothing has answered yet, and B is already shown with its inbox and cached counts.
    expect(h.calls).toEqual(["/api/auth/switch-account", "/api/accounts/account-b/folders"]);
    expect(h.result.current.activeAccountId).toBe("account-b");
    expect(h.result.current.activeFolderId).toBe("account-b:INBOX");
    expect(h.result.current.folders.find(folder => folder.id === "account-b:INBOX")?.count).toBe(3);
    act(() => { h.result.current.setActiveFolderId("account-b:Archive"); });
    await h.release("switch-account", () => json({ ok: true }));
    await h.release("/account-b/folders", () => json(foldersOf("account-b", 5)));
    await act(async () => { await done; });
    expect(h.result.current.folders.find(folder => folder.id === "account-b:INBOX")?.count).toBe(5);
    expect(h.result.current.activeFolderId).toBe("account-b:Archive");
    expect(h.calls).not.toContain("/api/auth/me");
    expect(h.renders.filter(render => render.folderId && !render.folderId.startsWith(`${render.accountId}:`))).toEqual([]);
  });

  it("A -> B -> A with both cached ends on A, persisted last", async () => {
    const server = { selected: "account-a", accounts };
    const h = await bootedWithCache(server);
    h.cache.writeFolders("account-a", foldersOf("account-a"));
    h.cache.writeFolders("account-b", foldersOf("account-b"));
    const toB = h.switchTo("account-b");
    expect(h.result.current.activeAccountId).toBe("account-b");
    const toA = h.switchTo("account-a");
    expect(h.result.current.activeAccountId).toBe("account-a");
    await h.release("switch-account", () => json({ ok: true }));
    await h.release("switch-account", () => json({ ok: true }));
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await h.release("/account-a/folders", () => json(foldersOf("account-a")));
    await act(async () => { await Promise.all([toB, toA]); });
    expect(server.selected).toBe("account-a");
    expect(h.result.current.activeAccountId).toBe("account-a");
    expect(h.result.current.activeFolderId).toBe("account-a:INBOX");
  });

  it("A -> B (cached) -> A in the same tick ends on A, shown and persisted", async () => {
    const server = { selected: "account-a", accounts };
    const h = await bootedWithCache(server);
    h.cache.writeFolders("account-a", foldersOf("account-a"));
    h.cache.writeFolders("account-b", foldersOf("account-b"));
    // One callback, no render in between: the second call sees the closure of A.
    const switchAccount = h.result.current.switchAccount;
    let toB!: Promise<void>;
    let toA!: Promise<void>;
    act(() => { toB = switchAccount("account-b"); toA = switchAccount("account-a"); });
    expect(h.result.current.activeAccountId).toBe("account-a");
    await h.release("switch-account", () => json({ ok: true }));
    await h.release("switch-account", () => json({ ok: true }));
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await h.release("/account-a/folders", () => json(foldersOf("account-a")));
    await act(async () => { await Promise.all([toB, toA]); });
    expect(server.selected).toBe("account-a");
    expect(h.result.current.activeAccountId).toBe("account-a");
    expect(h.result.current.activeFolderId).toBe("account-a:INBOX");
  });

  for (const status of [403, 500]) {
    it(`a ${status} on the switch replaces the cached view with the server's${status === 403 ? " and drops the mailbox's cache" : ""}`, async () => {
      const server = { selected: "account-a", accounts };
      const h = await bootedWithCache(server);
      h.cache.writeFolders("account-b", foldersOf("account-b"));
      const done = h.switchTo("account-b");
      expect(h.result.current.activeAccountId).toBe("account-b");
      if (status === 403) server.accounts = [accounts[0]];
      await h.release("switch-account", () => Response.json({ ok: false }, { status }));
      await h.release("/account-a/folders", () => json(foldersOf("account-a")));
      await act(async () => { await done; });
      expect(h.calls).toContain("/api/auth/me");
      expect(h.result.current.activeAccountId).toBe("account-a");
      expect(h.result.current.ready).toBe(true);
      expect(h.errors).toEqual([`HTTP ${status}`]);
      expect(h.cache.readFolders("account-b") === null).toBe(status === 403);
    });
  }
});
