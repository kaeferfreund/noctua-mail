import { afterEach, describe, expect, it } from "bun:test";
import { useRef } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Message } from "@/lib/data";
import { DEFAULT_SEARCH_BADGES } from "./useSearchState";
import { useMessageData, type UseMessageDataParams } from "./useMessageData";

afterEach(cleanup);

type Held = { url: string; signal?: AbortSignal; resolve: (res: Response) => void };
const row = (accountId: string, n: number) => ({ id: `${accountId}-m${n}`, accountId, threadId: `${accountId}-t${n}`,
  subject: `Subject ${accountId} ${n}` }) as Message;
const page = (accountId: string, from: number, hasMore: boolean) =>
  Response.json({ items: [row(accountId, from), row(accountId, from + 1)], hasMore, total: 6 });

type Props = { accountId: string; folderId?: string; query?: string };

function mount(initialProps: Props = { accountId: "account-a" }) {
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
      currentKeyRef
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
