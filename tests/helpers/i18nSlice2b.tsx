import { createRef, type ComponentProps } from "react";
import type { Message } from "@/lib/data";
import type { MessageListViewProps } from "@/app/components/mailclient/messagelist/messageListViewTypes";
import { createSelectionStore } from "@/app/components/mailclient/messagelist/selectionStore";
import ThreadMessageCard from "@/app/components/mailclient/message/ThreadMessageCard";

const noop = () => {};
export const syntheticReviewMessage: Message = {
  id: "synthetic-review-message", accountId: "synthetic-review", folderId: "synthetic-review:INBOX",
  threadId: "synthetic-review-thread", subject: "Synthetic review message", from: "Synthetic Sender <sender@example.test>",
  to: "recipient@example.test", preview: "Synthetic review body", body: "Synthetic review body",
  date: "2026-10-22T12:30:00Z", dateValue: Date.parse("2026-10-22T12:30:00Z"),
  groupKey: "Today", recent: true, priority: "high", flags: ["\\Recent", "\\Seen"]
};

export function reviewListProps(): Omit<MessageListViewProps, "view"> {
  const message = syntheticReviewMessage;
  return {
    refs: { scrollRef: createRef<HTMLDivElement>() },
    state: {
      groupedMessages: [{ key: "Today", label: "Today", count: 1, items: [message] }],
      visibleMessages: [{ message, depth: 0, threadId: message.threadId! }],
      selectionStore: createSelectionStore(), draggingMessageIds: new Set(), collapsedGroups: {}, collapsedThreads: {},
      pendingMessageActions: new Set(), supportsThreads: false, includeThreadAcrossFolders: false,
      searchScope: "folder", activeFolderId: message.folderId, messageById: new Map([[message.id, message]]),
      messageTopicsById: new Map(), suggestedThreadIds: new Set(), pendingSuggestedThreadIds: new Set(),
      sortDir: "desc", showMessageSize: false, listIsNarrow: true, preferToDisplay: false, activeTopic: null,
      senderIconsEnabled: false
    },
    actions: {
      setSortKey: noop, setSortDir: noop, setCollapsedGroups: noop, setCollapsedThreads: noop,
      setLastSelectedIdRef: noop, handleMessageDragStart: noop, handleMessageDragEnd: noop,
      handleRowClick: noop, handleSelectMessage: noop, selectRangeTo: noop, toggleMessageSelection: noop,
      selectCollapsedThread: noop, handleDeleteMessage: noop, toggleFlaggedFlag: noop, toggleTodoFlag: noop,
      toggleRowRead: noop, handleAddSuggestedThread: noop
    },
    helpers: {
      buildThreadTree: () => [], flattenThread: () => [], getThreadLatestDate: () => 0,
      getGroupLabel: () => "Heute", renderSelectIndicators: () => null, renderFolderBadges: () => null,
      renderQuickActions: () => null, renderMessageMenu: () => <button data-message-action="menu">Menü</button>,
      handleShowRelated: noop, isTrashFolder: () => false
    }
  };
}

export function reviewReaderProps(): ComponentProps<typeof ThreadMessageCard> {
  return {
    message: syntheticReviewMessage, messageRefs: { current: new Map() }, actionPending: false,
    includeThreadAcrossFolders: false, activeFolderId: syntheticReviewMessage.folderId,
    threadPathById: () => "Synthetic folder", folderById: () => undefined,
    setSearchScope: noop, setActiveFolderId: noop, isDraftMessage: () => false,
    getImapFlagBadges: () => [{ kind: "category-transactional", label: "Transaktions-E-Mails" }],
    toggleFlaggedFlag: noop, toggleTodoFlag: noop, renderQuickActions: () => null,
    renderMessageMenu: () => <button data-message-action="menu">Menü</button>,
    isCollapsed: false, setCollapsedMessages: noop, setMessageTabs: noop,
    fetchSource: noop, ensureMessageContent: async () => null, contentLoading: false,
    setMessageFontScale: noop, fontScale: 1, adjustMessageZoom: noop, resetMessageZoom: noop,
    zoomValue: 1, darkMode: false, hasHtmlContent: () => false,
    renderSourcePanel: () => null,
    handleSelectMessage: noop, getPrimaryEmail: () => null,
    findRecipientAlias: () => null, onOpenRecipientAlias: noop, handleUnsubscribe: noop,
    readErrorMessage: async () => "", reportError: noop, senderIconsEnabled: false
  };
}
