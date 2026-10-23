import type { Message } from "@/lib/data";
import { isMessageContentUnloaded } from "@/lib/ui/messageView";
import type { ThreadWindowState } from "../useThreadContent";

export function getVisibleThreadMessages(params: {
  activeThread: Message[];
  showComposeInline: boolean;
  composeDraftId: string | null;
}) {
  const { activeThread, showComposeInline, composeDraftId } = params;
  if (!showComposeInline || !composeDraftId) {
    return activeThread;
  }
  return activeThread.filter((message) => message.id !== composeDraftId);
}

// The messages ThreadView actually renders. Inline compose placement must be
// derived from this list rather than `activeThread`: a slot beneath a message
// that is not rendered leaves the composer with nowhere to mount.
export function getRenderedThreadMessages(params: {
  activeMessage: Message | null | undefined;
  activeThread: Message[];
  supportsThreads: boolean;
  threadContentById: Record<string, Message[]>;
  threadContentLoading: string | null;
  showComposeInline: boolean;
  composeDraftId: string | null;
}) {
  const {
    activeMessage,
    activeThread,
    supportsThreads,
    threadContentById,
    threadContentLoading,
    showComposeInline,
    composeDraftId
  } = params;
  if (!activeMessage) return [];
  const activeThreadId = activeMessage.threadId ?? activeMessage.messageId ?? activeMessage.id;
  const hasFullThread = (threadContentById[activeThreadId]?.length ?? 0) > 0;
  const isThreadLoading = threadContentLoading === activeThreadId;
  // When threads are disabled, the right pane shows only the selected
  // message — `activeThread` may still contain siblings (from the
  // `threadContentById` cache or threadId matches in the visible list).
  const showOnlyActiveMessage = !supportsThreads || (isThreadLoading && !hasFullThread);
  const baseThread = showOnlyActiveMessage
    ? [activeThread.find((item) => item.id === activeMessage.id) ?? activeMessage]
    : activeThread;
  return getVisibleThreadMessages({ activeThread: baseThread, showComposeInline, composeDraftId });
}

/**
 * Which window load controls the reader shows. A cursor alone does not mean
 * rows are missing: in the threaded list every member of the conversation is
 * usually loaded already and merged into the reader. Once the rendered rows of
 * the thread cover the window's total, nothing is left to load in either
 * direction.
 */
export function getThreadWindowPageControls(params: {
  threadWindow: Pick<ThreadWindowState, "total" | "hasOlder" | "hasNewer"> | null | undefined;
  threadId: string;
  renderedThread: Pick<Message, "id" | "threadId">[];
}) {
  const { threadWindow, threadId, renderedThread } = params;
  if (!threadWindow) return { older: false, newer: false };
  const renderedIds = new Set(
    renderedThread.filter((message) => message.threadId === threadId).map((message) => message.id)
  );
  const complete = renderedIds.size >= threadWindow.total;
  return {
    older: threadWindow.hasOlder && !complete,
    newer: threadWindow.hasNewer && !complete
  };
}

export function getInlineComposePlacement(params: {
  activeThread: Message[];
  showComposeInline: boolean;
  composeReplyMessage: Message | null;
}) {
  const { activeThread, showComposeInline, composeReplyMessage } = params;
  const replyMessageInThread = composeReplyMessage
    ? activeThread.some((message) => message.id === composeReplyMessage.id)
    : false;

  return {
    replyMessageInThread,
    showComposeAtTop: showComposeInline && (!composeReplyMessage || !replyMessageInThread),
    composeReplyMessageId:
      showComposeInline && replyMessageInThread && composeReplyMessage
        ? composeReplyMessage.id
        : null
  };
}

export function getComposeThreadFocusMessageId(params: {
  showComposeInline: boolean;
  composeReplyMessage: Pick<Message, "id"> | null;
  activeMessage: Pick<Message, "id"> | null | undefined;
  composeDraftId: string | null;
}) {
  const { showComposeInline, composeReplyMessage, activeMessage, composeDraftId } = params;
  if (!showComposeInline) return null;
  return composeReplyMessage?.id ?? activeMessage?.id ?? composeDraftId;
}

/**
 * Cards without an explicit collapse entry open only for the selected message
 * and the newest unread one. Collapsed cards never read their body.
 */
export function getDefaultExpandedMessageIds(
  thread: Pick<Message, "id" | "seen" | "dateValue">[],
  activeMessageId?: string | null
) {
  const ids = new Set<string>();
  if (activeMessageId) ids.add(activeMessageId);
  let newestUnread: Pick<Message, "id" | "dateValue"> | null = null;
  thread.forEach((message) => {
    if (message.seen) return;
    if (!newestUnread || message.dateValue >= newestUnread.dateValue) newestUnread = message;
  });
  if (newestUnread) ids.add((newestUnread as Pick<Message, "id">).id);
  return ids;
}

export function isThreadMessageCollapsed(
  messageId: string,
  collapsedMessages: Record<string, boolean>,
  defaultExpandedIds: Set<string>
) {
  return collapsedMessages[messageId] ?? !defaultExpandedIds.has(messageId);
}

/**
 * Print what the reader shows: expanded cards whose body has not been read
 * yet are loaded first, so the printout never contains an empty body.
 */
export async function printWithLoadedBodies(params: {
  renderedThread: Message[];
  collapsedMessages: Record<string, boolean>;
  activeMessageId?: string | null;
  ensureMessageContent: (message: Message) => Promise<Message | null>;
  print: () => void;
  afterRender?: () => Promise<void>;
}) {
  const { renderedThread, collapsedMessages, activeMessageId, ensureMessageContent, print } = params;
  const defaultExpandedIds = getDefaultExpandedMessageIds(renderedThread, activeMessageId);
  const pending = renderedThread.filter(
    (message) =>
      !isThreadMessageCollapsed(message.id, collapsedMessages, defaultExpandedIds) &&
      isMessageContentUnloaded(message)
  );
  if (pending.length > 0) {
    await Promise.all(pending.map((message) => ensureMessageContent(message)));
    await params.afterRender?.();
  }
  print();
}
