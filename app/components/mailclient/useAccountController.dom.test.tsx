// @ts-expect-error -- Bun supplies this test API at runtime; the project has no bun:test declarations.
import { afterEach, describe, expect, it } from "bun:test";
import { useState } from "react";
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import AccountSettingsModal from "../AccountSettingsModal";
import type { AuthUser } from "@/lib/authClient";
import type { Account } from "@/lib/data";
import { DEFAULT_SEARCH_BADGES, DEFAULT_SEARCH_FIELDS } from "./useSearchState";
import { useAccountController, type UseAccountControllerParams } from "./useAccountController";

afterEach(cleanup);

const accounts = [{ id: "account-a" }, { id: "account-b" }] as Account[];
const noop = () => {};

function mount(apiFetch: UseAccountControllerParams["apiFetch"], overrides: Partial<UseAccountControllerParams> = {}) {
  const errors: string[] = [];
  const defaults: UseAccountControllerParams = {
    currentUser: null, activeAccountId: "", accounts: [], accountFolders: [], activeFolderId: "",
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
    ...overrides,
  };
  const hook = renderHook(() => {
    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
    const [activeAccountId, setActiveAccountId] = useState("");
    const [ready, setInitialDataReady] = useState(false);
    const [loadedAccounts, setAccounts] = useState<Account[]>([]);
    const [auth, setAuthState] = useState<"loading" | "ok" | "unauth">("loading");
    const controller = useAccountController({ ...defaults, currentUser, setCurrentUser, activeAccountId, setActiveAccountId,
      accounts: loadedAccounts, setAccounts, setInitialDataReady, setAuthState });
    return { ...controller, activeAccountId, setActiveAccountId, ready, auth, loadedAccounts };
  });
  return { ...hook, errors };
}

const json = (value: unknown) => Response.json(value);

describe("account bootstrap request order", () => {
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

const draft: Account = {
  id: "draft-synthetic", name: "Synthetic mailbox", email: "mail@example.test", avatar: "",
  imap: { host: "imap.example.test", port: 993, secure: true, user: "mail@example.test", password: "synthetic" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "mail@example.test", password: "synthetic" }
};
const admin = { id: "synthetic-admin", email: "admin@example.test", name: "Synthetic admin", role: "admin" };
const me = (user = admin) => ({ user, accounts: [], accountId: null, mailboxState: "none" });

describe("mailbox creation", () => {
  it("creates through admin, self-grants manager, refreshes, selects and syncs in order", async () => {
    const calls: Array<{ path: string; method?: string; body?: unknown }> = [];
    let selected = false;
    const created = { ...draft, id: "server-mailbox" };
    const { result } = mount(async (input, init) => {
      const path = String(input);
      calls.push({ path, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (path === "/api/auth/me") return json({ ...me(), accounts: selected ? [created] : [], accountId: selected ? created.id : null, mailboxState: selected ? "selected" : "none" });
      if (path === "/api/admin/accounts") return json({ ok: true, account: created });
      if (path === "/api/accounts") return json([created]);
      if (path === "/api/auth/switch-account") selected = true;
      return json([]);
    }, {
      refreshFolders: async id => { calls.push({ path: `refresh:${id}` }); return []; },
      runSyncJob: async payload => { calls.push({ path: `sync:${payload.accountId}`, body: payload }); return { count: 1 }; }
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    calls.length = 0;
    await act(async () => { await result.current.saveAccount(draft); });
    expect(calls.map(call => call.path)).toEqual([
      "/api/admin/accounts", "/api/admin/accounts/server-mailbox/members/synthetic-admin",
      "/api/accounts", "/api/auth/switch-account", "/api/auth/me", "/api/accounts/server-mailbox/folders",
      "refresh:server-mailbox", "sync:server-mailbox"
    ]);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({ name: draft.name, email: draft.email, avatar: "", imap: draft.imap, smtp: draft.smtp });
    expect(calls[1]).toEqual({ path: "/api/admin/accounts/server-mailbox/members/synthetic-admin", method: "PUT", body: { role: "manager" } });
    expect(calls[3].body).toEqual({ accountId: created.id });
    expect(result.current.activeAccountId).toBe(created.id);
    expect(result.current.loadedAccounts).toEqual([created]);
    expect(result.current.accountSaveError).toBeNull();
  });

  for (const [status, message] of [[400, "Invalid mailbox credentials"], [403, "Forbidden"], [409, "Mailbox already exists"]] as const) {
    it(`keeps the dialog open and surfaces server ${status} errors`, async () => {
      let closes = 0;
      const { result } = mount(async input => String(input) === "/api/auth/me" ? json(me()) : Response.json({ message }, { status }), {
        readErrorMessage: async response => (await response.json()).message,
        setManageOpen: () => { closes++; }
      });
      await waitFor(() => expect(result.current.ready).toBe(true));
      await act(async () => { await result.current.saveAccount(draft); });
      expect(closes).toBe(0);
      expect(result.current.accountSaveError).toBe(message);
      const view = render(<AccountSettingsModal editingAccount={draft} isOpen manageTab="account" isExistingAccount={false}
        isAdminUser saveError={result.current.accountSaveError} onClose={noop} onTabChange={noop} onSave={noop} onDelete={noop} />);
      expect(view.getByRole("alert").textContent).toBe(message);
    });
  }

  it("surfaces network errors and allows retry", async () => {
    const { result } = mount(async input => {
      if (String(input) === "/api/auth/me") return json(me());
      throw new Error("Synthetic network failure");
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.saveAccount(draft); });
    expect(result.current.accountSaveError).toBe("Synthetic network failure");
    expect(result.current.accountSaving).toBe(false);
  });

  it("does not select or sync after a failed self-grant, and retries without recreating", async () => {
    const calls: string[] = [];
    let failGrant = true;
    const { result } = mount(async input => {
      const path = String(input); calls.push(path);
      if (path === "/api/auth/me") return json(me());
      if (path === "/api/admin/accounts") return json({ account: { ...draft, id: "created" } });
      if (path.endsWith("/members/synthetic-admin")) return Response.json({}, { status: failGrant ? 403 : 200 });
      return json([]);
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    calls.length = 0;
    await act(async () => { await result.current.saveAccount(draft); });
    expect(calls).toEqual(["/api/admin/accounts", "/api/admin/accounts/created/members/synthetic-admin"]);
    expect(result.current.accountSaveError).toContain("Mailbox created, but access could not be granted: HTTP 403");
    failGrant = false; calls.length = 0;
    await act(async () => { await result.current.saveAccount(draft); });
    expect(calls[0]).toBe("/api/admin/accounts/created/members/synthetic-admin");
    expect(calls).not.toContain("/api/admin/accounts");
  });

  it("gates non-admin entry and direct saves without a create request", async () => {
    let opens = 0;
    const paths: string[] = [];
    const { result, errors } = mount(async input => { paths.push(String(input)); return json(me({ ...admin, role: "user" })); }, {
      setManageOpen: () => { opens++; }
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.startEditAccount());
    await act(async () => { await result.current.saveAccount(draft); });
    expect(paths).toEqual(["/api/auth/me"]);
    expect(opens).toBe(0);
    expect(errors).toEqual(["Only an admin can add mailboxes", "Only an admin can add mailboxes"]);
    expect(result.current.accountSaveError).toBe("Only an admin can add mailboxes");
    const view = render(<AccountSettingsModal editingAccount={draft} isOpen manageTab="account" isExistingAccount={false}
      onClose={noop} onTabChange={noop} onSave={noop} onDelete={noop} />);
    expect(view.getByRole("alert").textContent).toBe("Only an admin can add mailboxes");
    expect(view.getByRole("button", { name: /^Save$/ }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps existing-mailbox edits on PUT without an admin grant", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const { result } = mount(async (input, init) => {
      const path = String(input); calls.push({ path, method: init?.method });
      if (path === "/api/auth/me") return json({ ...me({ ...admin, role: "user" }), accounts: [draft], mailboxState: "unselected" });
      return json([draft]);
    });
    await waitFor(() => expect(result.current.ready).toBe(true)); calls.length = 0;
    await act(async () => { await result.current.saveAccount(draft); });
    expect(calls).toEqual([{ path: "/api/accounts/draft-synthetic", method: "PUT" }, { path: "/api/accounts", method: undefined }]);
  });
});
