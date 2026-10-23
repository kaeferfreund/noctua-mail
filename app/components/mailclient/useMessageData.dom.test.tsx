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

function mount() {
  const held: Held[] = [];
  const errors: string[] = [];
  const apiFetch: UseMessageDataParams["apiFetch"] = (input, init) => new Promise<Response>(resolve => {
    held.push({ url: String(input), signal: init?.signal ?? undefined, resolve });
  });
  const view = renderHook(({ accountId }: { accountId: string }) => {
    const messagesKey = `${accountId}|folder|${accountId}:INBOX`;
    const currentKeyRef = useRef(messagesKey);
    currentKeyRef.current = messagesKey;
    return useMessageData({
      messagesKey, activeAccountId: accountId, searchScope: "folder", activeFolderId: `${accountId}:INBOX`,
      isRelatedSearch: false, relatedQueryId: "", selectedSearchFields: [], searchBadges: DEFAULT_SEARCH_BADGES,
      effectiveSearchBadges: [], currentSearchExcludedFolderIds: [], supportsThreads: true, groupBy: "date",
      threadDateSource: "latestReceivedDateValue", sortBy: "date", query: "", authState: "ok", apiFetch,
      readErrorMessage: async () => "Error", reportError: message => { errors.push(message); },
      setRelatedContext: () => {}, relatedContext: null, setCollapsedGroups: () => {}, setCollapsedThreads: () => {},
      currentKeyRef
    });
  }, { initialProps: { accountId: "account-a" } });
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
