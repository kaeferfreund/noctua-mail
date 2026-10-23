import { nextMessageAfterRemoval } from "./successfulRemoval";
import { useTranslations } from "next-intl";
import type React from "react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { Badge, Card, Flex, Text } from "@radix-ui/themes";
import { Search, X } from "lucide-react";

import listMetaStyles from "./MessageListMeta.module.css";
import listPaneStyles from "./MessageListPane.module.css";

import MessageListPane from "./MessageListPane";
import MessageListView from "./MessageListView";
import {
  type MessageListViewActions,
  type MessageListViewHelpers,
  type MessageListViewState,
  type MessageViewMode
} from "./messageListViewTypes";
import { createSelectionStore, type SelectionStore } from "./selectionStore";
import { usePruneMessageSelection } from "./usePruneMessageSelection";
import type { MessageGroupMeta, VisibleMessageEntry } from "./listModel";
import type { Folder, Message } from "@/lib/data";
import type { DeleteConfirmAction, DeleteConfirmState, NoticeInput } from "../types";
import {
  useMessageMoveActions,
  type MoveMessagesToFolder,
  type UndoMoveTarget
} from "../useMessageMoveActions";
import { useMessageDeleteActions } from "../useMessageDeleteActions";
import { useMessageMutations } from "../useMessageMutations";
import TooltipIconButton from "@/app/components/TooltipIconButton";

/**
 * The message-list pane: search banner + loading/empty states + the
 * virtualized list view, composed into one component so the parent
 * renders a single `<MessageListOrchestrator {...} />` rather than
 * assembling the subtree inline. The list's toolbar (count, view, sort and
 * group) lives in the shell header, so MailClient renders it there.
 *
 * The view mode arrives as `messageView` (MailClient owns it through
 * `useMessageViewMode`, since the header menu sets it); the list renders a
 * deferred copy of it so rapid view changes don't block the UI.
 *
 * Sort / group / thread-date state stays with the parent: those values
 * flow into cross-cutting data-fetch memos (`sortedMessages`,
 * `useMessageData`, `useSyncController` cache keys) that live above
 * this component.
 *
 * Phase 4c additionally owns:
 *   - `selectionStore` (+ `lastSelectedIdRef`)
 *   - The three list-mutation hooks (move / delete / mutations)
 *
 * DEVIATION (phase 4c): `pendingMessageActions` stays in MailClient
 * for now — it's read from MailClient-level render helpers
 * (renderQuickActions / renderMessageMenu) and from ThreadMessageCard
 * inside `MessageViewPane`, which sits *outside* the orchestrator
 * subtree. Moving the state in would require a subscription dance
 * (useSyncExternalStore) to re-render those consumers, which isn't
 * worth the churn for this phase. The setter is threaded through as
 * a prop so the moved mutation hooks can still write it. The handle
 * re-exposes the setter for compose-send code paths that already
 * flowed it through MailClient-level state.
 *
 * Any MailClient-level consumer that still needs to reach into these
 * (keyboard shortcuts, drag hook, renderMessageMenu closures) does so
 * through `listHandleRef` — see `MessageListHandle`.
 */

/**
 * Handle published through `listHandleRef` for MailClient-level code
 * that still needs to trigger list mutations or read selection state.
 *
 * Everything exposed here has at least one caller OUTSIDE the
 * orchestrator's JSX subtree. Handlers consumed only by props going
 * into the orchestrator (e.g. `listViewActions.handleDeleteMessage`)
 * do not need to be on the handle; they stay internal.
 */
export type MessageListHandle = {
  selectionStore: SelectionStore;
  lastSelectedIdRef: React.MutableRefObject<string | null>;
  setPendingMessageActions: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleArchiveMessage: (message: Message) => Promise<void>;
  handleUnsubscribe: (message: Message) => Promise<void>;
  handleDeleteMessage: (
    message: Message,
    options?: { allowThreadDeletion?: boolean }
  ) => Promise<void>;
  handleDeleteMessagesByIds: (ids: string[], options?: { selectedIds: string[] }) => Promise<void>;
  handleMoveMessages: (destinationFolderId: string, messageIds?: string[]) => void;
  moveMessagesToFolder: MoveMessagesToFolder;
  handleMarkSpam: (message: Message) => Promise<void>;
  handleMarkNotSpam: (message: Message) => Promise<void>;
  handleSetCategory: (
    message: Message,
    category: "newsletter" | "notification" | "transactional" | null
  ) => Promise<void>;
  updateFlagState: (
    message: Message,
    flag: "seen" | "answered" | "flagged" | "draft" | "deleted",
    value: boolean
  ) => Promise<void>;
  updateFlagStateBulk: (
    messages: Message[],
    flag: "seen" | "answered" | "flagged" | "draft" | "deleted",
    value: boolean
  ) => Promise<void>;
  updateKeywordFlag: (
    message: Message,
    keyword: string,
    value: boolean
  ) => Promise<void>;
  updateKeywordFlagBulk: (
    messages: Message[],
    keyword: string,
    value: boolean
  ) => Promise<void>;
  toggleFlaggedFlag: (
    message: Message,
    collapsedThreadMessages?: Message[]
  ) => Promise<void>;
  toggleTodoFlag: (
    message: Message,
    collapsedThreadMessages?: Message[],
    clickedBadge?: "todo" | "done"
  ) => Promise<void>;
  clearTodoFlag: (message: Message) => Promise<void>;
};

/**
 * The list-view state slots the caller supplies. `selectionStore` is
 * omitted because the orchestrator owns it (phase 4c) and merges it
 * in before rendering `MessageListView`. `pendingMessageActions`
 * stays on this shape — see the class-level comment for why it
 * doesn't move in phase 4c.
 */
export type MessageListOrchestratorListViewState = Omit<
  MessageListViewState,
  "selectionStore"
>;

/**
 * The list-view actions the caller supplies. `handleDeleteMessage`,
 * `toggleFlaggedFlag`, and `toggleTodoFlag` are owned by the
 * orchestrator (phase 4c — they come from the internal mutation
 * hooks) and merged in before rendering `MessageListView`.
 */
export type MessageListOrchestratorListViewActions = Omit<
  MessageListViewActions,
  "handleDeleteMessage" | "toggleFlaggedFlag" | "toggleTodoFlag"
>;

/**
 * Inputs for the three mutation hooks now owned by the orchestrator.
 *
 * Several of these fields — `messages`, `setMessages`,
 * `collapsedThreads`, `threadScopeMessages`, `visibleMessages`, and
 * `sortedMessages` — still live in `MailClient` and are threaded
 * through here so the orchestrator-owned hooks can operate on the
 * caller's message and derived list state. This wider prop surface is
 * intentional in the current design.
 */
export type MessageListOrchestratorMutationInputs = {
  activeAccountId: string;
  activeMessageId: string;
  activeFolderId: string;
  searchScope: "folder" | "all";
  includeThreadAcrossFoldersForList: boolean;
  supportsThreads: boolean;
  folders: Folder[];
  folderById: Map<string, { name: string }>;
  messages: Message[];
  threadScopeMessages: Message[];
  visibleMessages: VisibleMessageEntry[];
  sortedMessages: Message[];
  // The renderer's current navigation rows, read when an action needs them.
  getNavigationRows?: () => Message[];
  collapsedThreads: Record<string, boolean>;
  hasFilteredSearchCriteria: boolean;
  viewMessage: Message | null;
  isFlaggedMessage: (message: Message) => boolean;
  isTrashFolder: (folderId?: string | null) => boolean;
  shouldKeepMessageInCurrentResults: (message: Message) => boolean;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setGroupMeta: React.Dispatch<React.SetStateAction<MessageGroupMeta[]>>;
  setActiveMessageId: React.Dispatch<React.SetStateAction<string>>;
  setViewMessage: (msg: Message | null) => void;
  setPendingMessageActions: React.Dispatch<React.SetStateAction<Set<string>>>;
  refreshFolders: () => Promise<unknown>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readErrorMessage: (res: Response) => Promise<string>;
  reportError: (message: string) => void;
  pushNotice: (input: NoticeInput) => void;
  confirmDelete: (input: DeleteConfirmState) => Promise<DeleteConfirmAction>;
  confirmUnsubscribe: (sender: string, listId?: string) => Promise<boolean>;
  undoMoveOperation: (
    targets: UndoMoveTarget[],
    accountId: string,
    successTitle?: string
  ) => Promise<void>;
  noticeSuccessTimeout: number;
  evictMessageCaches: (messageIds: string[]) => void;
  reconcileActiveTopicSuggestionRemovals: (messageIds: string[]) => void;
  setActiveTopicSuggestionMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  updateMessagesWithCurrentResultPrune: (
    updater: (message: Message) => Message | null,
    options?: { source?: string }
  ) => void;
  applyMoveReconcileSuppression: (messages: Message[]) => void;
  applyDeleteReconcileSuppression?: (input: {
    targets?: Message[];
    messageIds?: Array<string | null | undefined>;
    fallbackFolderId?: string | null;
  }) => void;
  markDeleteReconcileSuppression?: (targets: Message[]) => void;
  markMessagesMutated?: () => void;
  updateThreadCacheWithFlags: (messageId: string, flags: string[]) => void;
  updateThreadCacheWithCategory: (
    messageId: string,
    category: string | null,
    categoryScore: number | null,
    categorySignals: string[]
  ) => void;
  queueFilteredSearchRefresh: (hasCriteria: boolean) => void;
};

export type MessageListOrchestratorProps = {
  // Scroll container ref. Attached to the pane's scrolling `<aside>` AND
  // passed to the list view as its `scrollRef` — the virtualization logic
  // reads scroll offsets from the same element the pane rendered. These
  // two consumers are always the same element, so the orchestrator takes
  // a single ref and distributes it internally rather than exposing two
  // props that could diverge.
  scrollRef: React.RefObject<HTMLDivElement | null>;

  // Current layout (card / table / compact / threads), owned by MailClient.
  messageView: MessageViewMode;

  // Out-ref for MailClient-level consumers that need to reach into
  // orchestrator-owned state (selection store, pending actions) or
  // trigger a list mutation externally (keyboard shortcuts, the drag
  // hook, renderMessageMenu closures). See `MessageListHandle` for
  // the full surface.
  listHandleRef?: React.MutableRefObject<MessageListHandle | null>;

  // Search-banner UI (only rendered when `searchActive || isRelatedSearch`).
  searchActive: boolean;
  isRelatedSearch: boolean;
  relatedNotice: string;
  searchCriteriaLabel: string;
  searchCriteriaBadges: Array<{ key: string; label: string }>;
  onClearSearch: () => void;

  // List-view state / actions / helpers. The concrete `view` mode
  // (card / table / compact / threads) is supplied from `messageView`,
  // so the caller does not pass it in `listViewState` as well.
  // `selectionStore` and `pendingMessageActions` are merged in by the
  // orchestrator; `handleDeleteMessage`, `toggleFlaggedFlag`, and
  // `toggleTodoFlag` come from the internal mutation hooks.
  listViewState: MessageListOrchestratorListViewState;
  listViewActions: MessageListOrchestratorListViewActions;
  listViewHelpers: MessageListViewHelpers;

  // Loading + empty-state banners.
  showListLoadingState: boolean;
  listLoading: boolean;
  sortedMessagesCount: number;
  filteredMessagesCount: number;
  messageListError: string | null;
  emptyListSyncing: boolean;
  activeVirtualFolderName?: string;
  searchScope: "folder" | "all";

  // Inputs for the internally-owned mutation hooks. See
  // `MessageListOrchestratorMutationInputs` for the note on which
  // fields are temporary until phase 4d.
  mutationInputs: MessageListOrchestratorMutationInputs;
};

export default function MessageListOrchestrator({
  scrollRef,
  messageView,
  listHandleRef,
  searchActive,
  isRelatedSearch,
  relatedNotice,
  searchCriteriaLabel,
  searchCriteriaBadges,
  onClearSearch,
  listViewState,
  listViewActions,
  listViewHelpers,
  showListLoadingState,
  listLoading,
  sortedMessagesCount,
  filteredMessagesCount,
  messageListError,
  emptyListSyncing,
  activeVirtualFolderName,
  mutationInputs
}: MessageListOrchestratorProps) {
  const t = useTranslations("List");
  // Render the list with a deferred value so rapid header toggles (e.g.
  // keyboard shortcuts stepping through views) don't block the UI while
  // the new view's layout computes.
  const deferredMessageView = useDeferredValue(messageView);
  const isCompactView = deferredMessageView === "compact";

  const [selectionStore] = useState<SelectionStore>(() =>
    createSelectionStore(mutationInputs.activeMessageId || null)
  );
  const lastSelectedIdRef = useRef<string | null>(null);
  usePruneMessageSelection(
    mutationInputs.threadScopeMessages,
    selectionStore,
    lastSelectedIdRef
  );

  const removalInputsRef = useRef(mutationInputs);
  useLayoutEffect(() => { removalInputsRef.current = mutationInputs; }, [mutationInputs]);

  // Both row actions and reader actions use the renderer's unique navigation order.
  const continueAfterRemoval = useCallback((removedIds: string[], navigationRows?: Message[]) => {
    const current = removalInputsRef.current;
    const removed = new Set(removedIds);
    if (!removed.has(current.activeMessageId) && !removed.has(current.viewMessage?.id ?? "")) return false;
    const next = nextMessageAfterRemoval(
      navigationRows ?? current.getNavigationRows?.() ?? current.visibleMessages.map(item => item.message), removed
    );
    current.setActiveMessageId(next?.id ?? "");
    current.setViewMessage(next);
    if (next) selectionStore.setSelection(new Set([next.id]), next.id);
    else selectionStore.clearSelection();
    lastSelectedIdRef.current = next?.id ?? null;
    return true;
  }, [selectionStore]);

  const { handleMoveMessages, moveMessagesToFolder } = useMessageMoveActions({
    activeAccountId: mutationInputs.activeAccountId,
    activeMessageId: mutationInputs.activeMessageId,
    activeFolderId: mutationInputs.activeFolderId,
    searchScope: mutationInputs.searchScope,
    includeThreadAcrossFoldersForList: mutationInputs.includeThreadAcrossFoldersForList,
    messages: mutationInputs.messages,
    selectionStore,
    folderById: mutationInputs.folderById,
    lastSelectedIdRef,
    setFolders: mutationInputs.setFolders,
    setMessages: mutationInputs.setMessages,
    setGroupMeta: mutationInputs.setGroupMeta,
    shouldKeepMessageInResults: mutationInputs.shouldKeepMessageInCurrentResults,
    setPendingMessageActions: mutationInputs.setPendingMessageActions,
    setActiveMessageId: mutationInputs.setActiveMessageId,
    setViewMessage: mutationInputs.setViewMessage,
    apiFetch: mutationInputs.apiFetch,
    readErrorMessage: mutationInputs.readErrorMessage,
    reportError: mutationInputs.reportError,
    pushNotice: mutationInputs.pushNotice,
    undoMoveOperation: mutationInputs.undoMoveOperation,
    noticeSuccessTimeout: mutationInputs.noticeSuccessTimeout,
    onMoveComplete: (messageIds) => {
      mutationInputs.evictMessageCaches(messageIds);
      mutationInputs.reconcileActiveTopicSuggestionRemovals(messageIds);
    },
    markMessagesMutated: mutationInputs.markMessagesMutated,
    applyDeleteReconcileSuppression: mutationInputs.applyDeleteReconcileSuppression
  });

  const { handleDeleteMessage, handleDeleteMessagesByIds } = useMessageDeleteActions({
    continueAfterRemoval,
    getNavigationRows: mutationInputs.getNavigationRows,
    activeAccountId: mutationInputs.activeAccountId,
    activeMessageId: mutationInputs.activeMessageId,
    supportsThreads: mutationInputs.supportsThreads,
    collapsedThreads: mutationInputs.collapsedThreads,
    includeFlaggedGroup: !(
      mutationInputs.searchScope === "folder" &&
      mutationInputs.isTrashFolder(mutationInputs.activeFolderId)
    ),
    searchScope: mutationInputs.searchScope,
    activeFolderId: mutationInputs.activeFolderId,
    includeThreadAcrossFoldersForList: mutationInputs.includeThreadAcrossFoldersForList,
    folders: mutationInputs.folders,
    messages: mutationInputs.messages,
    threadScopeMessages: mutationInputs.threadScopeMessages,
    visibleMessages: mutationInputs.visibleMessages,
    sortedMessages: mutationInputs.sortedMessages,
    isFlaggedMessage: mutationInputs.isFlaggedMessage,
    isTrashFolder: mutationInputs.isTrashFolder,
    moveMessagesToFolder,
    selectionStore,
    lastSelectedIdRef,
    setMessages: mutationInputs.setMessages,
    setGroupMeta: mutationInputs.setGroupMeta,
    shouldKeepMessageInResults: mutationInputs.shouldKeepMessageInCurrentResults,
    setPendingMessageActions: mutationInputs.setPendingMessageActions,
    setActiveMessageId: mutationInputs.setActiveMessageId,
    setViewMessage: mutationInputs.setViewMessage,
    refreshFolders: () => mutationInputs.refreshFolders(),
    apiFetch: mutationInputs.apiFetch,
    readErrorMessage: mutationInputs.readErrorMessage,
    reportError: mutationInputs.reportError,
    pushNotice: mutationInputs.pushNotice,
    confirmDelete: mutationInputs.confirmDelete,
    undoMoveOperation: mutationInputs.undoMoveOperation,
    noticeSuccessTimeout: mutationInputs.noticeSuccessTimeout,
    onMessagesRemoved: (messageIds) => {
      mutationInputs.evictMessageCaches(messageIds);
      mutationInputs.reconcileActiveTopicSuggestionRemovals(messageIds);
    },
    markMessagesMutated: mutationInputs.markMessagesMutated,
    markDeleteReconcileSuppression: mutationInputs.markDeleteReconcileSuppression
  });

  const {
    handleArchiveMessage,
    handleUnsubscribe,
    handleMarkSpam,
    handleMarkNotSpam,
    updateFlagState,
    updateFlagStateBulk,
    updateKeywordFlag,
    updateKeywordFlagBulk,
    handleSetCategory,
    clearTodoFlag,
    toggleTodoFlag,
    toggleFlaggedFlag
  } = useMessageMutations({
    continueAfterRemoval,
    getNavigationRows: mutationInputs.getNavigationRows,
    activeAccountId: mutationInputs.activeAccountId,
    searchScope: mutationInputs.searchScope,
    viewMessage: mutationInputs.viewMessage,
    hasFilteredSearchCriteria: mutationInputs.hasFilteredSearchCriteria,
    apiFetch: mutationInputs.apiFetch,
    readErrorMessage: mutationInputs.readErrorMessage,
    reportError: mutationInputs.reportError,
    pushNotice: mutationInputs.pushNotice,
    updateMessagesWithCurrentResultPrune:
      mutationInputs.updateMessagesWithCurrentResultPrune,
    setViewMessage: mutationInputs.setViewMessage,
    setActiveMessageId: mutationInputs.setActiveMessageId,
    setFolders: mutationInputs.setFolders,
    setPendingMessageActions: mutationInputs.setPendingMessageActions,
    evictMessageCaches: mutationInputs.evictMessageCaches,
    shouldKeepMessageInCurrentResults: mutationInputs.shouldKeepMessageInCurrentResults,
    undoMoveOperation: mutationInputs.undoMoveOperation,
    confirmUnsubscribe: mutationInputs.confirmUnsubscribe,
    applyMoveReconcileSuppression: mutationInputs.applyMoveReconcileSuppression,
    setActiveTopicSuggestionMessages: mutationInputs.setActiveTopicSuggestionMessages,
    updateThreadCacheWithFlags: mutationInputs.updateThreadCacheWithFlags,
    updateThreadCacheWithCategory: mutationInputs.updateThreadCacheWithCategory,
    queueFilteredSearchRefresh: mutationInputs.queueFilteredSearchRefresh
  });

  // Publish the handle. `selectionStore` and `lastSelectedIdRef` are
  // stable; the mutation-hook outputs re-create on their own deps, so
  // we need to re-publish when any of them change identity.
  useImperativeHandle<MessageListHandle | null, MessageListHandle>(
    listHandleRef,
    () => ({
      selectionStore,
      lastSelectedIdRef,
      setPendingMessageActions: mutationInputs.setPendingMessageActions,
      handleArchiveMessage,
      handleUnsubscribe,
      handleDeleteMessage,
      handleDeleteMessagesByIds,
      handleMoveMessages,
      moveMessagesToFolder,
      handleMarkSpam,
      handleMarkNotSpam,
      handleSetCategory,
      updateFlagState,
      updateFlagStateBulk,
      updateKeywordFlag,
      updateKeywordFlagBulk,
      toggleFlaggedFlag,
      toggleTodoFlag,
      clearTodoFlag
    }),
    [
      selectionStore,
      mutationInputs.setPendingMessageActions,
      handleArchiveMessage,
      handleUnsubscribe,
      handleDeleteMessage,
      handleDeleteMessagesByIds,
      handleMoveMessages,
      moveMessagesToFolder,
      handleMarkSpam,
      handleMarkNotSpam,
      handleSetCategory,
      updateFlagState,
      updateFlagStateBulk,
      updateKeywordFlag,
      updateKeywordFlagBulk,
      toggleFlaggedFlag,
      toggleTodoFlag,
      clearTodoFlag
    ]
  );

  return (
    <MessageListPane refs={{ listPaneRef: scrollRef }}>
      <div
        className={`${listPaneStyles.list} ${isCompactView ? listPaneStyles.listCompact : ""}`}
      >
        {(searchActive || isRelatedSearch) && (
          <Card size="1" className={listMetaStyles.searchCard}>
            <Flex
              align="center"
              justify="between"
              gap="3"
              className={listMetaStyles.searchRow}
            >
              <Flex align="center" gap="2" className={listMetaStyles.searchSummary}>
                <Search size={12} />
                {isRelatedSearch ? (
                  <Text size="1" color="gray">
                    {relatedNotice}
                  </Text>
                ) : (
                  <>
                    <Text size="1" color="gray">
                      {t("searching")}
                    </Text>
                    <div
                      className={listMetaStyles.searchCriteria}
                      aria-label={searchCriteriaLabel || t("allMessagesLower")}
                      title={searchCriteriaLabel || t("allMessages")}
                    >
                      {searchCriteriaBadges.map((badge) => (
                        <Badge
                          key={badge.key}
                          size="1"
                          variant="soft"
                          color="gray"
                          className={listMetaStyles.searchBadge}
                          title={badge.label}
                        >
                          <span className={listMetaStyles.searchBadgeLabel}>{badge.label}</span>
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </Flex>
              <TooltipIconButton
                size="1"
                variant="ghost"
                color="gray"
                onClick={onClearSearch}
                tooltip={t("clearSearch")}
              >
                <X size={12} />
              </TooltipIconButton>
            </Flex>
          </Card>
        )}

        {showListLoadingState && sortedMessagesCount === 0 && (
          <Card size="1" className={listMetaStyles.loadingCard}>
            <Text size="1" color="gray">{t("loadingMessages")}</Text>
          </Card>
        )}

        <MessageListView
          view={deferredMessageView}
          state={{
            ...listViewState,
            selectionStore
          }}
          actions={{
            ...listViewActions,
            handleDeleteMessage,
            toggleFlaggedFlag,
            toggleTodoFlag
          }}
          helpers={listViewHelpers}
          refs={{ scrollRef }}
        />

        {filteredMessagesCount === 0 && !showListLoadingState && (
          <div
            className={`${listPaneStyles.empty} ${
              messageListError ? listPaneStyles.emptyError : ""
            }`}
          >
            {messageListError
              ? t("loadFailed", { error: messageListError })
              : emptyListSyncing
                ? t("syncingMessages")
                : searchActive || isRelatedSearch
                  ? t("noSearchResults")
                  : activeVirtualFolderName
                    ? t("emptyNamedFolder", { folder: activeVirtualFolderName })
                    : t("emptyFolder")}
          </div>
        )}

        {listLoading && sortedMessagesCount > 0 && (
          <Card size="1" className={listMetaStyles.loadingCard}>
            <Text size="1" color="gray">{t("loadingMore")}</Text>
          </Card>
        )}
      </div>
    </MessageListPane>
  );
}
