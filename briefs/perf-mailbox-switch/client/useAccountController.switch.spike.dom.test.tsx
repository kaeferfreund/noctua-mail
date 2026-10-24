import { afterEach, describe, expect, it } from "bun:test";
import { useEffect, useRef, useState } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Account, Folder } from "@/lib/data";
import { DEFAULT_SEARCH_BADGES, DEFAULT_SEARCH_FIELDS } from "./useSearchState";
import { useStartupSync } from "./useStartupSync";
import { findInboxFolder } from "@/lib/specialFolders";
import { useAccountController, type UseAccountControllerParams } from "./useAccountController.proto.spike";
import { useApiErrorMessage } from "./useApiErrorMessage";
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


// D1 design spec (spike). Run against the prototype controller.
type Deferred = { url: string; init?: RequestInit; resolve: (res: Response) => void };
function deferredFetch(onMe: () => unknown) {
  const held: Deferred[] = [];
  const calls: string[] = [];
  const apiFetch: UseAccountControllerParams["apiFetch"] = async (input, init) => {
    const url = String(input); calls.push(url);
    if (url === "/api/auth/me") return json(onMe());
    return new Promise<Response>(resolve => held.push({ url, init, resolve }));
  };
  const release = async (match: string, res: (d: Deferred) => Response) => {
    const index = held.findIndex(d => d.url.includes(match));
    if (index < 0) throw new Error(`nothing held for ${match}; held=${held.map(d => d.url)}`);
    const [d] = held.splice(index, 1);
    await act(async () => { d.resolve(res(d)); await Promise.resolve(); });
  };
  return { apiFetch, calls, held, release };
}
const foldersOf = (id: string) => [{ id: `${id}:Archive`, accountId: id, name: "Archive", count: 0 },
  { id: `${id}:INBOX`, accountId: id, name: "Inbox", specialUse: "\\Inbox", count: 0 }];
const meFor = (state: { selected: string; accounts?: Account[] }) => () =>
  ({ user: { id: "synthetic-user" }, accounts: state.accounts ?? [...accounts, { id: "account-c" } as Account], accountId: state.selected, mailboxState: "selected" });

async function booted(state: { selected: string; accounts?: Account[] }) {
  const f = deferredFetch(meFor(state));
  const view = mount(f.apiFetch);
  await waitFor(() => expect(f.held.some(d => d.url.endsWith("/folders"))).toBe(true));
  await f.release("/folders", () => json(foldersOf(state.selected)));
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  f.calls.length = 0;
  return { ...f, ...view };
}

describe("D1 parallel atomic switch (spike spec)", () => {
  it("persists the selection and reads the new mailbox's folders in parallel, without /auth/me", async () => {
    const state = { selected: "account-a" };
    const h = await booted(state);
    let done!: Promise<void>;
    act(() => { done = h.result.current.switchAccount("account-b"); });
    expect(h.calls).toEqual(["/api/auth/switch-account", "/api/accounts/account-b/folders"]);
    await h.release("switch-account", () => { state.selected = "account-b"; return json({ ok: true, accountId: "account-b" }); });
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await act(async () => { await done; });
    expect(h.result.current.activeAccountId).toBe("account-b");
    expect(h.result.current.activeFolderId).toBe("account-b:INBOX");
    expect(h.calls).not.toContain("/api/auth/me");
  });

  it("(b) a switch keeps loadInitialData identity-stable, so the mount bootstrap never re-runs", async () => {
    const state = { selected: "account-a" };
    const h = await booted(state);
    const bootstrap = h.result.current.loadInitialData;
    act(() => { void h.result.current.switchAccount("account-b"); });
    await h.release("switch-account", () => { state.selected = "account-b"; return json({ ok: true }); });
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await waitFor(() => expect(h.result.current.activeAccountId).toBe("account-b"));
    expect(h.result.current.loadInitialData).toBe(bootstrap);
    expect(h.calls.filter(url => url === "/api/auth/me")).toEqual([]);
  });

  it("activates nothing until the persisted selection and the folder read both succeeded", async () => {
    const h = await booted({ selected: "account-a" });
    act(() => { h.result.current.setActiveFolderId("account-a:INBOX"); });
    act(() => { void h.result.current.switchAccount("account-b"); });
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    expect(h.result.current.activeAccountId).toBe("account-a");
    expect(h.result.current.activeFolderId).toBe("account-a:INBOX");
    await h.release("switch-account", () => json({ ok: true, accountId: "account-b" }));
    await waitFor(() => expect(h.result.current.activeAccountId).toBe("account-b"));
    expect(h.result.current.activeFolderId).toBe("account-b:INBOX");
  });

  for (const denied of ["switch-account", "/account-b/folders"]) {
    it(`a 403 from ${denied} never activates the mailbox and re-bootstraps from the server`, async () => {
      const state = { selected: "account-a", accounts };
      const h = await booted(state);
      act(() => { void h.result.current.switchAccount("account-b"); });
      state.accounts = [accounts[0]];
      await h.release(denied, () => Response.json({ ok: false }, { status: 403 }));
      const other = denied === "switch-account" ? "/account-b/folders" : "switch-account";
      await h.release(other, () => other === "switch-account" ? json({ ok: true }) : json(foldersOf("account-b")));
      await waitFor(() => expect(h.calls).toContain("/api/auth/me"));
      await waitFor(() => expect(h.held.some(d => d.url === "/api/accounts/account-a/folders")).toBe(true));
      await h.release("/account-a/folders", () => json(foldersOf("account-a")));
      await waitFor(() => expect(h.result.current.ready).toBe(true));
      expect(h.result.current.activeAccountId).toBe("account-a");
      expect(h.result.current.loadedAccounts.map(a => a.id)).toEqual(["account-a"]);
      expect(h.errors).toEqual(["HTTP 403"]);
    });
  }

  it("rapid A -> B -> C commits only the last selection", async () => {
    const h = await booted({ selected: "account-a" });
    act(() => { void h.result.current.switchAccount("account-b"); });
    act(() => { void h.result.current.switchAccount("account-c"); });
    await h.release("/account-c/folders", () => json(foldersOf("account-c")));
    await h.release("switch-account", () => json({ ok: true }));
    await h.release("switch-account", () => json({ ok: true }));
    await waitFor(() => expect(h.result.current.activeAccountId).toBe("account-c"));
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    expect(h.result.current.activeAccountId).toBe("account-c");
    expect(h.result.current.activeFolderId).toBe("account-c:INBOX");
  });

  it("a bootstrap overlapping the switch publishes accounts but never overrides the switch's selection", async () => {
    const state = { selected: "account-a", accounts: [...accounts, { id: "account-c" } as Account] };
    const h = await booted(state);
    act(() => { void h.result.current.switchAccount("account-b"); });
    state.accounts = [...accounts, { id: "account-d" } as Account]; // membership changed meanwhile
    await act(async () => { await h.result.current.loadInitialData(); }); // e.g. a mailboxes-changed event
    expect(h.result.current.loadedAccounts.map(a => a.id)).toEqual(["account-a", "account-b", "account-d"]);
    await h.release("switch-account", () => { state.selected = "account-b"; return json({ ok: true }); });
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await waitFor(() => expect(h.result.current.activeAccountId).toBe("account-b"));
    expect(h.result.current.ready).toBe(true);
    expect(h.result.current.activeFolderId).toBe("account-b:INBOX");
    expect(h.calls.filter(url => url.endsWith("/folders"))).toEqual(["/api/accounts/account-b/folders"]);
  });

  it("a failed switch with a deferred bootstrap re-resolves the selection from the server", async () => {
    const state = { selected: "account-a" };
    const h = await booted(state);
    act(() => { void h.result.current.switchAccount("account-b"); });
    await act(async () => { await h.result.current.loadInitialData(); });
    expect(h.result.current.ready).toBe(false);
    await h.release("switch-account", () => Response.json({ ok: false }, { status: 503 }));
    await h.release("/account-b/folders", () => json(foldersOf("account-b")));
    await waitFor(() => expect(h.held.some(d => d.url === "/api/accounts/account-a/folders")).toBe(true));
    await h.release("/account-a/folders", () => json(foldersOf("account-a")));
    await waitFor(() => expect(h.result.current.ready).toBe(true));
    expect(h.result.current.activeAccountId).toBe("account-a");
  });
});
