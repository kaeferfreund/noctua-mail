import { afterEach, describe, expect, it } from "bun:test";
import { useRef } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Folder, Message } from "@/lib/data";
import { DEFAULT_SEARCH_BADGES } from "./useSearchState";
import { useMessageData, type UseMessageDataParams } from "./useMessageData";
import { MailboxViewCache, useMailboxViewCache } from "./mailboxViewCache";

afterEach(cleanup);

type Held = { url: string; signal?: AbortSignal; resolve: (res: Response) => void };
const row = (accountId: string, n: number) => ({ id: `${accountId}-m${n}`, accountId, threadId: `${accountId}-t${n}`,
  subject: `Subject ${accountId} ${n}` }) as Message;
const page = (accountId: string, from: number, hasMore: boolean) =>
  Response.json({ items: [row(accountId, from), row(accountId, from + 1)], hasMore, total: 6 });

type Props = { accountId: string; folderId?: string; query?: string };

function mount(initialProps: Props = { accountId: "account-a" }, viewCache?: MailboxViewCache) {
  const held: Held[] = [];
  const errors: string[] = [];
  const apiFetch: UseMessageDataParams["apiFetch"] = (input, init) => new Promise<Response>(resolve => {
    held.push({ url: String(input), signal: init?.signal ?? undefined, resolve });
  });
  const view = renderHook(({ accountId, folderId = `${accountId}:INBOX`, query = "" }: Props) => {
    const messagesKey = `${accountId}|folder|${folderId}|${query}`;
    const currentKeyRef = useRef(messagesKey);
    currentKeyRef.current = messagesKey;
    return useMessageData({
      messagesKey, activeAccountId: accountId, searchScope: "folder", activeFolderId: folderId,
      isRelatedSearch: false, relatedQueryId: "", selectedSearchFields: [], searchBadges: DEFAULT_SEARCH_BADGES,
      effectiveSearchBadges: [], currentSearchExcludedFolderIds: [], supportsThreads: true, groupBy: "date",
      threadDateSource: "latestReceivedDateValue", sortBy: "date", query, authState: "ok", apiFetch,
      readErrorMessage: async () => "Error", reportError: message => { errors.push(message); },
      setRelatedContext: () => {}, relatedContext: null, setCollapsedGroups: () => {}, setCollapsedThreads: () => {},
      currentKeyRef, viewCache
    });
  }, { initialProps: initialProps as Props });
  const pending = (accountId: string, pageNumber = 1) =>
    held.filter(item => item.url.startsWith(`/api/accounts/${accountId}/`) && new URL(item.url, "http://x").searchParams.get("page") === String(pageNumber));
  const release = async (item: Held, res: Response) => {
    held.splice(held.indexOf(item), 1);
    await act(async () => { item.resolve(res); await Promise.resolve(); });
  };
  return { ...view, held, errors, pending, release };
}

describe("superseded list loads", () => {
  it("abort the old key's load and start the new key at once; a late old response changes nothing", async () => {
    const h = mount();
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    const stale = h.pending("account-a")[0];
    h.rerender({ accountId: "account-b" });
    // B's first page is requested without waiting for A's response.
    await waitFor(() => expect(h.pending("account-b")).toHaveLength(1));
    expect(stale.signal?.aborted).toBe(true);
    await h.release(h.pending("account-b")[0], page("account-b", 1, false));
    await waitFor(() => expect(h.result.current.messages.map(message => message.id)).toEqual(["account-b-m1", "account-b-m2"]));
    await h.release(stale, page("account-a", 1, false));
    expect(h.result.current.messages.map(message => message.id)).toEqual(["account-b-m1", "account-b-m2"]);
    expect(h.result.current.loadingMessages).toBe(false);
    expect(h.errors).toEqual([]);
  });

  it("pages the new key one page at a time while the superseded load is still unanswered", async () => {
    const h = mount();
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    const stale = h.pending("account-a")[0];
    h.rerender({ accountId: "account-b" });
    await waitFor(() => expect(h.pending("account-b")).toHaveLength(1));
    await h.release(h.pending("account-b")[0], page("account-b", 1, true));
    await waitFor(() => expect(h.result.current.loadingMessages).toBe(false));
    // The list asks for page 2, then page 3 while page 2 is in flight (e.g. fast scrolling).
    act(() => { h.result.current.setMessagesPage(2); });
    await waitFor(() => expect(h.pending("account-b", 2)).toHaveLength(1));
    act(() => { h.result.current.setMessagesPage(3); });
    await act(async () => { await Promise.resolve(); });
    expect(h.pending("account-b", 3)).toHaveLength(0);
    await h.release(stale, page("account-a", 1, true));
    expect(h.result.current.loadingMessages).toBe(true);
    await h.release(h.pending("account-b", 2)[0], page("account-b", 3, true));
    await waitFor(() => expect(h.pending("account-b", 3)).toHaveLength(1));
    await h.release(h.pending("account-b", 3)[0], page("account-b", 5, false));
    await waitFor(() => expect(h.result.current.loadingMessages).toBe(false));
    expect(h.result.current.messages.map(message => message.id)).toEqual(
      ["account-b-m1", "account-b-m2", "account-b-m3", "account-b-m4", "account-b-m5", "account-b-m6"]);
    expect(h.result.current.hasMoreMessages).toBe(false);
    expect(h.errors).toEqual([]);
  });
});

describe("first load of a new key", () => {
  it("reads page 1 even when the key changes while a later page is current", async () => {
    const h = mount();
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    await h.release(h.pending("account-a")[0], page("account-a", 1, true));
    act(() => { h.result.current.setMessagesPage(2); });
    await waitFor(() => expect(h.pending("account-a", 2)).toHaveLength(1));
    await h.release(h.pending("account-a", 2)[0], page("account-a", 3, true));
    await waitFor(() => expect(h.result.current.loadingMessages).toBe(false));
    h.rerender({ accountId: "account-a", folderId: "account-a:Archive" });
    await waitFor(() => expect(h.held).toHaveLength(1));
    expect(h.pending("account-a", 1)).toHaveLength(1);
    await h.release(h.held[0], page("account-a", 7, false));
    await waitFor(() => expect(h.result.current.messages.map(message => message.id)).toEqual(["account-a-m7", "account-a-m8"]));
    await act(async () => { await Promise.resolve(); });
    expect(h.held).toHaveLength(0);
  });
});

describe("first page requested alongside a mailbox switch", () => {
  const folderParam = (item: Held) => new URL(item.url, "http://x").searchParams.get("folderId");
  async function loadedOnA(props?: Props) {
    const h = mount(props);
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    await h.release(h.pending("account-a")[0], page("account-a", 1, false));
    await waitFor(() => expect(h.result.current.loadingMessages).toBe(false));
    return h;
  }

  it("is taken by the next mailbox's first load when the URL is identical, without a second request", async () => {
    const h = await loadedOnA();
    act(() => { h.result.current.prefetchFirstPage("account-b"); });
    expect(h.pending("account-b")).toHaveLength(1);
    const prefetched = h.pending("account-b")[0];
    // Invariant (a): the request names only the next mailbox's own folder.
    expect(folderParam(prefetched)).toBe("account-b:INBOX");
    expect(prefetched.url).not.toContain("account-a");
    h.rerender({ accountId: "account-b" });
    await act(async () => { await Promise.resolve(); });
    expect(h.pending("account-b")).toEqual([prefetched]);
    await h.release(prefetched, page("account-b", 1, false));
    await waitFor(() => expect(h.result.current.messages.map(message => message.id)).toEqual(["account-b-m1", "account-b-m2"]));
    expect(prefetched.signal?.aborted).toBe(false);
    expect(h.errors).toEqual([]);
  });

  it.each([false, true])("loads after the switch when the speculative inbox read fails (settled before commit: %s)", async settledBeforeCommit => {
    const h = await loadedOnA();
    act(() => { h.result.current.prefetchFirstPage("account-b"); });
    const prefetched = h.pending("account-b")[0];
    const missingFolder = () => Response.json({ code: "folder_account_mismatch" }, { status: 400 });
    // The folder GET creates a cold mailbox's folders while its speculative list read runs.
    if (settledBeforeCommit) await h.release(prefetched, missingFolder());
    h.rerender({ accountId: "account-b" });
    if (!settledBeforeCommit) await h.release(prefetched, missingFolder());
    await waitFor(() => expect(h.pending("account-b")).toHaveLength(1));
    const committedRead = h.pending("account-b")[0];
    expect(committedRead).not.toBe(prefetched);
    expect(folderParam(committedRead)).toBe("account-b:INBOX");
    await h.release(committedRead, page("account-b", 1, false));
    await waitFor(() => expect(h.result.current.messages.map(message => message.id)).toEqual(["account-b-m1", "account-b-m2"]));
    expect(h.result.current.messageListError).toBeNull();
    expect(h.errors).toEqual([]);
  });

  it("is never shown under the current mailbox and is aborted when the next view asks for another URL", async () => {
    const h = await loadedOnA();
    act(() => { h.result.current.prefetchFirstPage("account-b"); });
    const prefetched = h.pending("account-b")[0];
    // A late answer before the switch committed changes nothing on A.
    await h.release(prefetched, page("account-b", 1, false));
    expect(h.result.current.messages.map(message => message.id)).toEqual(["account-a-m1", "account-a-m2"]);
    h.rerender({ accountId: "account-b", folderId: "account-b:Posteingang" });
    await waitFor(() => expect(h.pending("account-b")).toHaveLength(1));
    expect(prefetched.signal?.aborted).toBe(true);
    const own = h.pending("account-b")[0];
    expect(folderParam(own)).toBe("account-b:Posteingang");
    await h.release(own, page("account-b", 3, false));
    await waitFor(() => expect(h.result.current.messages.map(message => message.id)).toEqual(["account-b-m3", "account-b-m4"]));
  });

  it("is aborted when the switch does not commit, and the mailbox then loads on its own", async () => {
    const h = await loadedOnA();
    act(() => { h.result.current.prefetchFirstPage("account-b"); });
    const prefetched = h.pending("account-b")[0];
    act(() => { h.result.current.dropFirstPagePrefetch(); });
    expect(prefetched.signal?.aborted).toBe(true);
    h.rerender({ accountId: "account-b" });
    await waitFor(() => expect(h.pending("account-b").filter(item => item !== prefetched)).toHaveLength(1));
  });

  it("is not predicted from a search or a folder other than the inbox", async () => {
    for (const props of [{ accountId: "account-a", query: "rechnung" }, { accountId: "account-a", folderId: "account-a:Archive" }]) {
      const h = await loadedOnA(props);
      act(() => { h.result.current.prefetchFirstPage("account-b"); });
      expect(h.pending("account-b")).toHaveLength(0);
      cleanup();
    }
  });
});

describe("refresh after a sync that wrote nothing", () => {
  it("keeps a first page already on screen and re-reads one that failed or is still loading", async () => {
    const h = mount();
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    // Still loading: the refresh reads the page.
    let refreshed: Promise<boolean> | undefined;
    act(() => { refreshed = h.result.current.refreshMailboxData({ skipIfCurrent: true }); });
    expect(h.pending("account-a")).toHaveLength(2);
    await h.release(h.pending("account-a")[1], page("account-a", 1, false));
    await act(async () => { await refreshed; });
    await h.release(h.pending("account-a")[0], page("account-a", 1, false));
    await waitFor(() => expect(h.result.current.loadingMessages).toBe(false));
    // On screen: nothing is requested.
    await act(async () => { expect(await h.result.current.refreshMailboxData({ skipIfCurrent: true })).toBe(true); });
    expect(h.held).toHaveLength(0);
    // A failed refresh clears it; the next skip-if-current refresh reads again.
    act(() => { refreshed = h.result.current.refreshMailboxData(); });
    await h.release(h.held[0], new Response("nope", { status: 500 }));
    await act(async () => { await refreshed; });
    act(() => { refreshed = h.result.current.refreshMailboxData({ skipIfCurrent: true }); });
    expect(h.held).toHaveLength(1);
    await h.release(h.held[0], page("account-a", 3, false));
    await act(async () => { await refreshed; });
    expect(h.result.current.messages.map(message => message.id)).toEqual(["account-a-m3", "account-a-m4"]);
  });
});

describe("a list visited earlier in this tab", () => {
  const ids = (h: ReturnType<typeof mount>) => h.result.current.messages.map(message => message.id);
  const pageOf = (accountId: string, numbers: number[], hasMore = false, unread?: boolean) => Response.json({
    items: numbers.map(n => ({ ...row(accountId, n), ...(unread === undefined ? {} : { unread }) })), hasMore, total: numbers.length
  });
  // Loads A's inbox and B's inbox once each, so both first pages are cached; ends on `end`.
  async function visitedAandB(end: Props = { accountId: "account-b" }) {
    const cache = new MailboxViewCache();
    const h = mount({ accountId: "account-a" }, cache);
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    await h.release(h.pending("account-a")[0], pageOf("account-a", [1, 2]));
    h.rerender({ accountId: "account-b" });
    await waitFor(() => expect(h.pending("account-b")).toHaveLength(1));
    await h.release(h.pending("account-b")[0], pageOf("account-b", [1, 2]));
    await waitFor(() => expect(ids(h)).toEqual(["account-b-m1", "account-b-m2"]));
    if (end.accountId !== "account-b") h.rerender(end);
    return { h, cache };
  }

  it("shows the cached first page in the same commit as the click, then the re-read replaces it", async () => {
    const { h } = await visitedAandB();
    h.rerender({ accountId: "account-a" });
    // No wait: the cached rows are there right after the rerender, and the re-read is in flight.
    expect(ids(h)).toEqual(["account-a-m1", "account-a-m2"]);
    expect(h.result.current.totalMessages).toBe(2);
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    // The fresh page wins: a row that is gone disappears, a new one appears, flags come from the server.
    await h.release(h.pending("account-a")[0], pageOf("account-a", [0, 1], true, true));
    await waitFor(() => expect(ids(h)).toEqual(["account-a-m0", "account-a-m1"]));
    expect(h.result.current.messages.every(message => message.unread)).toBe(true);
    expect(h.result.current.hasMoreMessages).toBe(true);
    expect(h.held).toHaveLength(0);
    expect(h.errors).toEqual([]);
  });

  it("re-reads a cached list that said there is no more, exactly once", async () => {
    const { h } = await visitedAandB({ accountId: "account-a" });
    expect(h.result.current.hasMoreMessages).toBe(false);
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    await h.release(h.pending("account-a")[0], pageOf("account-a", [1, 2]));
    await act(async () => { await Promise.resolve(); });
    expect(h.held).toHaveLength(0);
  });

  it("keeps local changes: a row removed on screen is not shown again on the revisit", async () => {
    const { h } = await visitedAandB({ accountId: "account-a" });
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    await h.release(h.pending("account-a")[0], pageOf("account-a", [1, 2, 3]));
    await waitFor(() => expect(ids(h)).toHaveLength(3));
    act(() => { h.result.current.setMessages(prev => prev.filter(message => message.id !== "account-a-m2")); });
    h.rerender({ accountId: "account-b" });
    h.rerender({ accountId: "account-a" });
    expect(ids(h)).toEqual(["account-a-m1", "account-a-m3"]);
  });

  it("A -> B -> A: the last click wins and B's late answer changes nothing", async () => {
    const { h } = await visitedAandB({ accountId: "account-a" });
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    const firstA = h.pending("account-a")[0];
    h.rerender({ accountId: "account-b" });
    expect(ids(h)).toEqual(["account-b-m1", "account-b-m2"]);
    expect(firstA.signal?.aborted).toBe(true);
    await waitFor(() => expect(h.pending("account-b")).toHaveLength(1));
    const lateB = h.pending("account-b")[0];
    h.rerender({ accountId: "account-a" });
    expect(ids(h)).toEqual(["account-a-m1", "account-a-m2"]);
    expect(lateB.signal?.aborted).toBe(true);
    await h.release(lateB, pageOf("account-b", [7, 8]));
    await h.release(firstA, pageOf("account-a", [7, 8]));
    expect(ids(h)).toEqual(["account-a-m1", "account-a-m2"]);
    await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
    await h.release(h.pending("account-a")[0], pageOf("account-a", [3]));
    await waitFor(() => expect(ids(h)).toEqual(["account-a-m3"]));
    expect(h.errors).toEqual([]);
  });

  it("A -> B -> C: a list never shown before starts empty, and B's late re-read never lands on C", async () => {
    const { h } = await visitedAandB({ accountId: "account-a" });
    h.rerender({ accountId: "account-b" });
    await waitFor(() => expect(h.pending("account-b")).toHaveLength(1));
    const lateB = h.pending("account-b")[0];
    h.rerender({ accountId: "account-c" });
    expect(ids(h)).toEqual([]);
    expect(h.result.current.totalMessages).toBeNull();
    await h.release(lateB, pageOf("account-b", [1, 2]));
    expect(ids(h)).toEqual([]);
    await waitFor(() => expect(h.pending("account-c")).toHaveLength(1));
    await h.release(h.pending("account-c")[0], pageOf("account-c", [1]));
    await waitFor(() => expect(ids(h)).toEqual(["account-c-m1"]));
  });

  it("is keyed by folder and view, and not used for a free-text search", async () => {
    const { h, cache } = await visitedAandB({ accountId: "account-a", folderId: "account-a:Archive" });
    const live = () => h.pending("account-a").filter(item => !item.signal?.aborted);
    expect(ids(h)).toEqual([]);
    h.rerender({ accountId: "account-a", query: "rechnung" });
    expect(ids(h)).toEqual([]);
    await waitFor(() => expect(live()).toHaveLength(1));
    await h.release(live()[0], pageOf("account-a", [5]));
    await waitFor(() => expect(ids(h)).toEqual(["account-a-m5"]));
    h.rerender({ accountId: "account-a" });
    expect(ids(h)).toEqual(["account-a-m1", "account-a-m2"]);
    const inboxUrl = live()[0]?.url ?? "";
    expect(new URL(inboxUrl, "http://x").searchParams.get("folderId")).toBe("account-a:INBOX");
    h.rerender({ accountId: "account-a", query: "rechnung" });
    expect(ids(h)).toEqual([]);
    // A cached page is never read under another mailbox.
    expect(cache.readList(inboxUrl, "account-a")?.rows).toHaveLength(2);
    expect(cache.readList(inboxUrl, "account-b")).toBeNull();
  });

  for (const status of [401, 403]) {
    it(`a ${status} on the re-read clears the cached rows and the mailbox's cache, then shows the error`, async () => {
      const { h, cache } = await visitedAandB({ accountId: "account-a" });
      expect(ids(h)).toEqual(["account-a-m1", "account-a-m2"]);
      await waitFor(() => expect(h.pending("account-a")).toHaveLength(1));
      await h.release(h.pending("account-a")[0], Response.json({ ok: false }, { status }));
      await waitFor(() => expect(ids(h)).toEqual([]));
      expect(h.result.current.messageListError).toBe("Error");
      expect(h.result.current.totalMessages).toBeNull();
      h.rerender({ accountId: "account-b" });
      expect(ids(h)).toEqual(["account-b-m1", "account-b-m2"]);
      h.rerender({ accountId: "account-a" });
      expect(ids(h)).toEqual([]);
      expect(cache.readFolders("account-a")).toBeNull();
    });
  }
});

describe("mailbox view cache lifetime", () => {
  const folder = (accountId: string) => ({ id: `${accountId}:INBOX`, accountId, name: "Inbox" }) as Folder;
  const listEntry = (accountId: string) => ({ accountId, rows: [row(accountId, 1)], groupMeta: [], hasMore: false, total: 1, loadedCount: 1 });
  type CacheProps = { sessionKey: string | null; accountIds: string[]; activeAccountId: string; folders: Folder[] };

  function mountCache(initialProps: CacheProps) {
    return renderHook((props: CacheProps) => useMailboxViewCache(props), { initialProps });
  }

  it("keeps the active mailbox's folders, and clears everything on logout and on a session change", () => {
    const props: CacheProps = { sessionKey: "user-1", accountIds: ["account-a", "account-b"], activeAccountId: "account-a",
      folders: [folder("account-a")] };
    const h = mountCache(props);
    const cache = h.result.current;
    h.rerender({ ...props, activeAccountId: "account-b", folders: [folder("account-b")] });
    cache.writeList("/api/accounts/account-b/threads?page=1", listEntry("account-b"));
    expect(cache.readFolders("account-a")).toEqual([folder("account-a")]);
    expect(cache.readFolders("account-b")).toEqual([folder("account-b")]);
    h.rerender({ ...props, sessionKey: null, activeAccountId: "", folders: [] });
    expect(cache.readFolders("account-a")).toBeNull();
    expect(cache.readList("/api/accounts/account-b/threads?page=1", "account-b")).toBeNull();
    h.rerender(props);
    expect(cache.readFolders("account-a")).toEqual([folder("account-a")]);
    h.rerender({ ...props, sessionKey: "user-2" });
    expect(h.result.current).toBe(cache);
    // The new session's own folders are cached again; the previous user's are gone.
    expect(cache.readFolders("account-a")).toEqual([folder("account-a")]);
    expect(cache.readFolders("account-b")).toBeNull();
  });

  it("drops a mailbox that is no longer granted", () => {
    const props: CacheProps = { sessionKey: "user-1", accountIds: ["account-a", "account-b"], activeAccountId: "account-a",
      folders: [folder("account-a")] };
    const h = mountCache(props);
    const cache = h.result.current;
    cache.writeList("/api/accounts/account-b/threads?page=1", listEntry("account-b"));
    cache.writeFolders("account-b", [folder("account-b")]);
    h.rerender({ ...props, accountIds: ["account-a"] });
    expect(cache.readFolders("account-b")).toBeNull();
    expect(cache.readList("/api/accounts/account-b/threads?page=1", "account-b")).toBeNull();
    expect(cache.readFolders("account-a")).toEqual([folder("account-a")]);
  });

  it("holds at most eight lists, never rows of another mailbox, and no empty list", () => {
    const cache = new MailboxViewCache();
    for (let n = 0; n < 9; n++) cache.writeList(`/u${n}`, listEntry("account-a"));
    expect(cache.readList("/u0", "account-a")).toBeNull();
    expect(cache.readList("/u8", "account-a")?.rows).toHaveLength(1);
    cache.writeList("/mixed", { ...listEntry("account-a"), rows: [row("account-a", 1), row("account-b", 2)] });
    expect(cache.readList("/mixed", "account-a")?.rows.map(message => message.id)).toEqual(["account-a-m1"]);
    expect(cache.readList("/mixed", "account-b")).toBeNull();
    cache.writeList("/mixed", { ...listEntry("account-a"), rows: [] });
    expect(cache.readList("/mixed", "account-a")).toBeNull();
  });
});
