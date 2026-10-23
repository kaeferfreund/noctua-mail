import { afterEach, expect, it } from "bun:test";
import { createRef } from "react";
import { cleanup, render } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import MessageListOrchestrator, { type MessageListOrchestratorProps } from "./MessageListOrchestrator";
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
