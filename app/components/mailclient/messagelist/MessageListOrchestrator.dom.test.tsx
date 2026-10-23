import { afterEach, expect, it } from "bun:test";
import { createRef } from "react";
import { act, cleanup } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import type { Message } from "@/lib/data";
import MessageListOrchestrator, { type MessageListHandle, type MessageListOrchestratorProps } from "./MessageListOrchestrator";
const noop = () => {};
afterEach(cleanup);
function props(scope: "folder" | "all", searchActive: boolean): MessageListOrchestratorProps {
  return {
    scrollRef: createRef(), messageView: "card", searchScope: scope,
    searchActive, isRelatedSearch: false, relatedNotice: "", searchCriteriaLabel: "Synthetic no hits",
    searchCriteriaBadges: [], onClearSearch: noop,
    showListLoadingState: false, listLoading: false, sortedMessagesCount: 0, filteredMessagesCount: 0,
    messageListError: null, emptyListSyncing: false,
    listViewState: {
      groupedMessages: [], visibleMessages: [], draggingMessageIds: new Set(), collapsedGroups: {},
      collapsedThreads: {}, pendingMessageActions: new Set(), supportsThreads: true,
      includeThreadAcrossFolders: false, searchScope: scope, activeFolderId: "synthetic:INBOX",
      messageById: new Map(), messageTopicsById: new Map(), suggestedThreadIds: new Set(),
      pendingSuggestedThreadIds: new Set(), sortDir: "desc", showMessageSize: false,
      listIsNarrow: false, preferToDisplay: false, activeTopic: null
    },
    listViewActions: {
      setSortKey: noop, setSortDir: noop, setCollapsedGroups: noop, setCollapsedThreads: noop,
      setLastSelectedIdRef: noop, handleMessageDragStart: noop, handleMessageDragEnd: noop,
      handleRowClick: noop, handleSelectMessage: noop, selectRangeTo: noop, toggleMessageSelection: noop,
      selectCollapsedThread: noop, handleAddSuggestedThread: noop
    },
    listViewHelpers: {
      buildThreadTree: () => [], flattenThread: () => [], getThreadLatestDate: () => 0,
      getGroupLabel: () => null, renderSelectIndicators: () => null, renderFolderBadges: () => null,
      renderQuickActions: () => null, renderMessageMenu: () => null, handleShowRelated: noop, isTrashFolder: () => false
    },
    mutationInputs: {
      activeAccountId: "synthetic", activeMessageId: "", activeFolderId: "synthetic:INBOX", searchScope: scope,
      includeThreadAcrossFoldersForList: false, supportsThreads: true, folders: [], folderById: new Map(),
      messages: [], threadScopeMessages: [], visibleMessages: [], sortedMessages: [], collapsedThreads: {},
      hasFilteredSearchCriteria: searchActive, viewMessage: null, isFlaggedMessage: () => false,
      isTrashFolder: () => false, shouldKeepMessageInCurrentResults: () => true,
      setFolders: noop, setMessages: noop, setGroupMeta: noop, setActiveMessageId: noop,
      setViewMessage: noop, setPendingMessageActions: noop, refreshFolders: async () => {},
      apiFetch: async () => { throw new Error("An empty-list render must not mutate mail"); },
      readErrorMessage: async () => "", reportError: noop, pushNotice: noop,
      confirmDelete: async () => "cancel", confirmUnsubscribe: async () => false, undoMoveOperation: async () => {},
      noticeSuccessTimeout: 0, evictMessageCaches: noop, reconcileActiveTopicSuggestionRemovals: noop,
      setActiveTopicSuggestionMessages: noop, updateMessagesWithCurrentResultPrune: noop,
      applyMoveReconcileSuppression: noop, updateThreadCacheWithFlags: noop,
      updateThreadCacheWithCategory: noop, queueFilteredSearchRefresh: noop
    }
  };
}
for (const scope of ["folder", "all"] as const) it(`QA-012 uses the search empty state in ${scope} scope, including a virtual folder`, () => {
  const input = props(scope, true);
  const page = render(<Theme><MessageListOrchestrator {...input} /></Theme>);
  expect(page.getByText("No messages match this search.")).toBeTruthy();
  expect(page.queryByText("No messages in this folder.")).toBeNull();
  page.rerender(<Theme><MessageListOrchestrator {...input} activeVirtualFolderName="Focused" /></Theme>);
  expect(page.getByText("No messages match this search.")).toBeTruthy();
});
it("QA-012 preserves ordinary folder, syncing, related search, and failure states", () => {
  const input = props("folder", false);
  const page = render(<Theme><MessageListOrchestrator {...input} /></Theme>);
  expect(page.getByText("No messages in this folder.")).toBeTruthy();
  page.rerender(<Theme><MessageListOrchestrator {...input} isRelatedSearch /></Theme>);
  expect(page.getByText("No messages match this search.")).toBeTruthy();
  page.rerender(<Theme><MessageListOrchestrator {...input} searchActive emptyListSyncing /></Theme>);
  expect(page.getByText("Syncing messages…")).toBeTruthy();
  page.rerender(<Theme><MessageListOrchestrator {...input} searchActive messageListError="Synthetic failure" /></Theme>);
  expect(page.getByText("Failed to load messages. Synthetic failure")).toBeTruthy();
});

for (const scenario of ["next", "previous", "end", "failed"] as const) it(`archive continuation: ${scenario}`, async () => {
  const input = props("folder", false);
  const messages = ["c", "a", "b"].map(id => ({ id, accountId: "synthetic", folderId: "synthetic:INBOX" }) as Message);
  const active = scenario === "previous" ? messages[2] : messages[1];
  const handle = { current: null as MessageListHandle | null };
  let selected: Message | null = active;
  let activeId = active.id;
  Object.assign(input.mutationInputs, {
    messages, viewMessage: active, activeMessageId: active.id,
    navigationRows: scenario === "end" ? [active] : messages,
    shouldKeepMessageInCurrentResults: () => false,
    setViewMessage: (message: Message | null) => { selected = message; },
    setActiveMessageId: (id: string) => { activeId = id; },
    apiFetch: async () => Response.json({ action: "moved", archiveFolderId: "synthetic:Archive" }, { status: scenario === "failed" ? 500 : 200 })
  });
  render(<Theme><MessageListOrchestrator {...input} listHandleRef={handle} /></Theme>);
  await act(async () => { await handle.current!.handleArchiveMessage(active); });
  const expected = scenario === "next" ? messages[2] : scenario === "previous" ? messages[1] : scenario === "failed" ? active : null;
  expect(selected as Message | null).toBe(expected);
  expect(activeId).toBe(expected?.id ?? "");
});

for (const selectedDuringRequest of ["target", "other"] as const) it(`archive completion uses the current reader: ${selectedDuringRequest}`, async () => {
  const input = props("folder", false);
  const messages = ["target", "next", "other"].map(id => ({ id, accountId: "synthetic", folderId: "synthetic:INBOX" }) as Message);
  const handle = { current: null as MessageListHandle | null };
  let complete!: (response: Response) => void;
  const response = new Promise<Response>(resolve => { complete = resolve; });
  let selected: Message | null = null;
  Object.assign(input.mutationInputs, {
    messages, navigationRows: messages, shouldKeepMessageInCurrentResults: () => false,
    setViewMessage: (message: Message | null) => { selected = message; },
    apiFetch: () => response
  });
  const view = render(<Theme><MessageListOrchestrator {...input} listHandleRef={handle} /></Theme>);
  let pending!: Promise<void>;
  act(() => { pending = handle.current!.handleArchiveMessage(messages[0]); });
  const current = selectedDuringRequest === "target" ? messages[0] : messages[2];
  selected = current;
  const updated = { ...input, mutationInputs: { ...input.mutationInputs, activeMessageId: current.id, viewMessage: current } };
  view.rerender(<Theme><MessageListOrchestrator {...updated} listHandleRef={handle} /></Theme>);
  await act(async () => { complete(Response.json({ action: "moved", archiveFolderId: "synthetic:Archive" })); await pending; });
  expect(selected as Message | null).toBe(selectedDuringRequest === "target" ? messages[1] : current);
});
