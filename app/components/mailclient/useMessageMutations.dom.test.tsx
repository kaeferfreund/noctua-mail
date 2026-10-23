import { render } from "@/lib/i18n/testRender";
import { afterEach, expect, test } from "bun:test";
import { useLayoutEffect, useState } from "react";
import { act, cleanup, waitFor } from "@testing-library/react";
import type { Folder, Message } from "@/lib/data";
import { useMessageMutations } from "./useMessageMutations";
import { applyFolderStreamUpdates, type FolderStreamUpdate } from "./folderStreamUpdates";

afterEach(cleanup);
const inbox: Folder = { id: "synthetic:INBOX", name: "INBOX", accountId: "synthetic", count: 300, unreadCount: 110 };
const message = { id: "synthetic-message", folderId: inbox.id, seen: false, flags: [] } as unknown as Message;
const noop = () => {};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function harness() {
  const posts: ReturnType<typeof deferred<Response>>[] = [], reads: ReturnType<typeof deferred<Response>>[] = [];
  const paths: string[] = [], errors: string[] = [];
  let mutate!: (next: Message, flag: "seen" | "answered" | "flagged", value: boolean) => Promise<void>;
  let stream!: (updates: FolderStreamUpdate[]) => void;
  function Harness({ accountId }: { accountId: string }) {
    const [folders, setFolders] = useState([inbox]);
    const actions = useMessageMutations({
      activeAccountId: accountId, searchScope: "folder", viewMessage: null, hasFilteredSearchCriteria: false,
      apiFetch: async (input, init) => {
        paths.push(String(input));
        const result = deferred<Response>();
        (init?.method === "POST" ? posts : reads).push(result);
        return result.promise;
      },
      readErrorMessage: async () => "Synthetic refresh failure", reportError: error => { errors.push(error); },
      pushNotice: noop, updateMessagesWithCurrentResultPrune: noop, setViewMessage: noop, setActiveMessageId: noop,
      setFolders, setPendingMessageActions: noop, evictMessageCaches: noop, shouldKeepMessageInCurrentResults: () => true,
      undoMoveOperation: noop, confirmUnsubscribe: async () => false, applyMoveReconcileSuppression: noop,
      setActiveTopicSuggestionMessages: noop, updateThreadCacheWithFlags: noop, updateThreadCacheWithCategory: noop,
      queueFilteredSearchRefresh: noop
    });
    useLayoutEffect(() => {
      mutate = actions.updateFlagState;
      stream = updates => setFolders(previous => applyFolderStreamUpdates(previous, updates));
    }, [actions.updateFlagState]);
    return <output aria-label="Inbox unread">{folders[0].unreadCount}</output>;
  }
  const page = render(<Harness accountId="synthetic" />);
  const count = () => Number(page.getByLabelText("Inbox unread").textContent);
  return { page, posts, reads, paths, errors, count, mutate: (...args: Parameters<typeof mutate>) => mutate(...args),
    stream: (unseen: number) => act(() => stream([{ id: inbox.id, unseen }])),
    switchAccount: () => page.rerender(<Harness accountId="other" />) };
}
const response = (value: unknown) => new Response(JSON.stringify(value));
for (const order of ["count-before-mutation", "count-after-mutation", "stale-count-before-mutation", "watcher-off"] as const) {
  test(`QA-101 ${order}: one read transition settles at 109 without a second decrement`, async () => {
    const h = harness();
    let pending!: Promise<void>;
    act(() => { pending = h.mutate(message, "seen", true); });
    if (order === "count-before-mutation") h.stream(109);
    if (order === "stale-count-before-mutation") h.stream(110);
    await act(async () => { h.posts[0].resolve(response({ flags: ["\\Seen"] })); await pending; });
    // This used to be 108 when a 109 stream count beat the POST response.
    expect(h.count()).toBe(order === "count-before-mutation" ? 109 : 110);
    expect(h.reads).toHaveLength(1);
    if (order === "count-after-mutation") h.stream(109);
    await act(async () => { h.reads[0].resolve(response([{ ...inbox, unreadCount: 109 }])); });
    await waitFor(() => expect(h.count()).toBe(109));
    h.stream(109); expect(h.count()).toBe(109);
    expect(h.paths[1]).toBe("/api/accounts/synthetic/folders");
    expect(h.errors).toEqual([]);
    // Mark unread and then new mail use the same absolute server counts.
    act(() => { pending = h.mutate({ ...message, seen: true, flags: ["\\Seen"] }, "seen", false); });
    await act(async () => { h.posts[1].resolve(response({ flags: [] })); await pending; });
    await act(async () => { h.reads[1].resolve(response([inbox])); });
    expect(h.count()).toBe(110);
    h.stream(111); expect(h.count()).toBe(111);
  });
}
test("QA-101 discards out-of-order folder reads and reads from a departed account", async () => {
  const h = harness();
  let first!: Promise<void>, second!: Promise<void>;
  act(() => { first = h.mutate(message, "seen", true); });
  await act(async () => { h.posts[0].resolve(response({ flags: ["\\Seen"] })); await first; });
  act(() => { second = h.mutate({ ...message, id: "synthetic-second" }, "answered", true); });
  await act(async () => { h.posts[1].resolve(response({ flags: ["\\Answered", "\\Seen"] })); await second; });
  await act(async () => { h.reads[1].resolve(response([{ ...inbox, unreadCount: 108 }])); });
  await act(async () => { h.reads[0].resolve(response([{ ...inbox, unreadCount: 109 }])); });
  expect(h.count()).toBe(108);
  act(() => { first = h.mutate(message, "seen", true); });
  await act(async () => { h.posts[2].resolve(response({ flags: ["\\Seen"] })); await first; });
  h.switchAccount();
  await act(async () => { h.reads[2].resolve(response([{ ...inbox, unreadCount: 107 }])); });
  expect(h.count()).toBe(108);
});
test("QA-101 unrelated flags do not fetch folders", async () => {
  const h = harness();
  let pending!: Promise<void>;
  act(() => { pending = h.mutate(message, "flagged", true); });
  await act(async () => { h.posts[0].resolve(response({ flags: ["\\Flagged"] })); await pending; });
  expect(h.reads).toHaveLength(0); expect(h.count()).toBe(110);
});
