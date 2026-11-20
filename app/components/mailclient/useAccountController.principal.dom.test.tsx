import { afterEach, describe, expect, it } from "bun:test";
import { useState } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Account } from "@/lib/data";
import { DEFAULT_SEARCH_BADGES, DEFAULT_SEARCH_FIELDS } from "./useSearchState";
import { useAccountController, type UseAccountControllerParams } from "./useAccountController";
import { clearCalendarReminderStorage } from "./utils/calendarReminders";

// Shared browser: when another person signs in (or the session ends) in the same
// mounted client, the previous person's open mailbox settings and error log go.

afterEach(() => {
  cleanup();
  clearCalendarReminderStorage();
});

const mailbox = { id: "account-a", name: "Private Mailbox", email: "private@example.test" } as Account;
const noop = () => {};

function mount(me: () => Response) {
  return renderHook(() => {
    const [manageOpen, setManageOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [exceptionEntries, setExceptionEntries] = useState<Array<{ id: string; message: string; timestamp: number }>>([]);
    const [authState, setAuthState] = useState<"loading" | "ok" | "unauth">("loading");
    const params: UseAccountControllerParams = {
      activeAccountId: "", accounts: [], accountFolders: [], activeFolderId: "", deletingFolderIds: new Set(),
      apiFetch: async (input) => String(input) === "/api/auth/me" ? me() : Response.json([]),
      readErrorMessage: async (res: Response) => `HTTP ${res.status}`, reportError: noop,
      refreshFolders: async () => null, runSyncJob: async () => ({ count: 0 }),
      setAccounts: noop, setActiveAccountId: noop, setFolders: noop, setAuthState, setCurrentUser: noop,
      setInitialDataReady: noop, setInitialFoldersLoadedAccountId: noop, setSessionTtlSeconds: noop,
      setMessages: noop, setMessagesPage: noop, setHasMoreMessages: noop, setTotalMessages: noop,
      setActiveMessageId: noop, setViewMessage: noop, setActiveFolderId: noop, setQuery: noop, setSearchScope: noop,
      setSearchFields: noop, setSearchBadges: noop, setActiveVirtualFolderId: noop,
      defaultSearchFields: DEFAULT_SEARCH_FIELDS, defaultSearchBadges: DEFAULT_SEARCH_BADGES,
      setLastFolderId: noop, setMessageListError: noop, setExceptionEntries, setManageOpen, setManageTab: noop,
      setEditingAccount, setDeletingFolderIds: noop
    };
    const controller = useAccountController(params);
    return { controller, manageOpen, setManageOpen, editingAccount, setEditingAccount, exceptionEntries, setExceptionEntries, authState };
  });
}

const signedIn = (id: string) => Response.json({ user: { id, email: `${id}@example.test` }, accounts: [], accountId: null, mailboxState: "unselected" });

describe("principal change in a mounted client", () => {
  it("closes the previous user's mailbox settings and error log when another user signs in", async () => {
    let user = "user-a";
    const { result } = mount(() => signedIn(user));
    await act(async () => { await result.current.controller.loadInitialData(); });
    expect(result.current.authState).toBe("ok");
    expect(localStorage.getItem("noctua:calendar-reminder-principal")).toBe("user-a");
    act(() => {
      result.current.setManageOpen(true); result.current.setEditingAccount(mailbox);
      result.current.setExceptionEntries([{ id: "e1", message: "private detail", timestamp: 1 }]);
    });
    // The same user refreshing the session keeps the dialog open.
    await act(async () => { await result.current.controller.loadInitialData(); });
    expect(result.current.manageOpen).toBe(true);

    user = "user-b";
    await act(async () => { await result.current.controller.loadInitialData(); });
    await waitFor(() => expect(result.current.manageOpen).toBe(false));
    expect(result.current.editingAccount).toBeNull();
    expect(result.current.exceptionEntries).toEqual([]);
    expect(localStorage.getItem("noctua:calendar-reminder-principal")).toBe("user-b");
  });

  it("closes them when the session ends", async () => {
    let signedOut = false;
    const { result } = mount(() => signedOut ? new Response(null, { status: 401 }) : signedIn("user-a"));
    await waitFor(() => expect(result.current.authState).toBe("ok"));
    act(() => { result.current.setManageOpen(true); result.current.setEditingAccount(mailbox); });
    signedOut = true;
    act(() => { void result.current.controller.loadInitialData(); });
    await waitFor(() => expect(result.current.authState).toBe("unauth"));
    expect(result.current.manageOpen).toBe(false);
    expect(result.current.editingAccount).toBeNull();
  });
});
