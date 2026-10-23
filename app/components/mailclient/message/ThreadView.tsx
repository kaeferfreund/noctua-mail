import { useTranslations } from "next-intl";
import React from "react";
import type { MessageTranslationEntry } from "./messageTranslation";
import type { MessageTab } from "./types";
import { resolveInReplyToRef } from "../utils/messageHelpers";
import type { Message } from "@/lib/data";
import { Button, Text } from "@radix-ui/themes";
import ThreadMessageCard from "./ThreadMessageCard";
import type { ThreadMessageCardProps } from "./ThreadMessageCard";
import {
  getDefaultExpandedMessageIds,
  getRenderedThreadMessages,
  getThreadWindowPageControls,
  isThreadMessageCollapsed
} from "./threadViewState";
import type { ThreadWindowState } from "../useThreadContent";
import styles from "./ThreadView.module.css";

export type ThreadViewCardProps = Omit<ThreadMessageCardProps,
  "message" | "actionPending" | "isCollapsed" | "messageTab" | "contentLoading" |
  "fontScale" | "zoomValue" | "translation" | "replyTarget" | "replyReferenceId" | "replyIsForward"
> & {
  pendingMessageActions: Set<string>;
  collapsedMessages: Record<string, boolean>;
  messageTabs: Record<string, MessageTab>;
  messageContentLoading: Record<string, boolean>;
  messageContentErrorById?: Record<string, string>;
  messageFontScale: Record<string, number>;
  messageZoom: Record<string, number>;
  messageTranslations?: Record<string, MessageTranslationEntry>;
  messageByMessageId: Map<string, Message>;
};

type ThreadViewProps = {
  showComposeInline: boolean;
  activeMessage: Message | null;
  activeThread: Message[];
  supportsThreads: boolean;
  threadContentById: Record<string, Message[]>;
  threadContentLoading: string | null;
  threadContentErrorById: Record<string, string>;
  /** Paging state of the active thread's bounded window, when it is windowed. */
  threadWindow?: ThreadWindowState | null;
  onLoadThreadPage?: (direction: "older" | "newer") => void;
  messageCardProps: ThreadViewCardProps;
  composeDraftId: string | null;
  composeReplyMessageId: string | null;
  renderComposeInlineCard: (() => React.ReactNode) | null;
};

export default function ThreadView({
  showComposeInline,
  activeMessage,
  activeThread,
  supportsThreads,
  threadContentById,
  threadContentLoading,
  threadContentErrorById,
  threadWindow,
  onLoadThreadPage,
  messageCardProps,
  composeDraftId,
  composeReplyMessageId,
  renderComposeInlineCard
}: ThreadViewProps) {
  const t = useTranslations("Reader");
  // Keep collection identity out of the memoized cards. Shared handlers stay
  // unwrapped so changed closures (mailbox, role, policy) remain observable.
  const { pendingMessageActions, collapsedMessages, messageTabs,
    messageContentLoading, messageContentErrorById, messageFontScale, messageZoom,
    messageTranslations, messageByMessageId, ...sharedCardProps } = messageCardProps;
  if (!activeMessage) {
    return showComposeInline ? null : (
      <Text size="2" color="gray" className={styles.empty}>{t("selectThread")}</Text>
    );
  }
  const activeThreadId = activeMessage.threadId ?? activeMessage.messageId ?? activeMessage.id;
  const activeThreadError = activeThreadId ? threadContentErrorById[activeThreadId] : "";
  const visibleThread = getRenderedThreadMessages({
    activeMessage,
    activeThread,
    supportsThreads,
    threadContentById,
    threadContentLoading,
    showComposeInline,
    composeDraftId
  });
  const defaultExpandedIds = getDefaultExpandedMessageIds(visibleThread, activeMessage.id);
  const { threadViewMode } = messageCardProps;
  const windowLoading = threadWindow?.loading ?? null;
  const pageControls = onLoadThreadPage
    ? getThreadWindowPageControls({ threadWindow, threadId: activeThreadId, renderedThread: visibleThread })
    : { older: false, newer: false };
  const newestVisibleId = visibleThread.reduce<Message | null>(
    (newest, message) => (!newest || message.dateValue >= newest.dateValue ? message : newest),
    null
  )?.id;
  const renderPageControl = (direction: "older" | "newer") => (
    <div key={`page-${direction}`} className={styles.pageControl} data-reader-print-exclude="">
      <Button
        size="1"
        variant="soft"
        color="gray"
        disabled={Boolean(windowLoading)}
        onClick={() => onLoadThreadPage?.(direction)}
      >
        {windowLoading === direction
          ? t("loadingMessages")
          : t(direction === "older" ? "loadOlderMessages" : "loadNewerMessages")}
      </Button>
      {threadWindow?.error ? (
        <Text size="1" color="red" role="alert">{t("threadLoadError")}</Text>
      ) : null}
    </div>
  );
  return (
    <>
      {activeThreadError ? (
        <div className={styles.pageControl} role="alert" data-reader-print-exclude="">
          <Text size="1" color="red">{t("threadLoadError")}</Text>
        </div>
      ) : null}
      {pageControls.older ? renderPageControl("older") : null}
      {visibleThread.map((message) => {
        const reply = resolveInReplyToRef(message, messageByMessageId);
        const isCollapsed = isThreadMessageCollapsed(message.id, collapsedMessages, defaultExpandedIds);
        const isCompactCollapsed = threadViewMode === "compact" && isCollapsed;
        return (
          <React.Fragment key={message.id}>
            {pageControls.newer && message.id === newestVisibleId ? renderPageControl("newer") : null}
            <div className={`${styles.threadItem} ${isCompactCollapsed ? styles.compactThreadItem : ""}`}>
              <ThreadMessageCard
                message={message}
                bodyLoadError={messageContentErrorById?.[message.id] ?? null}
                {...sharedCardProps}
                actionPending={pendingMessageActions.has(message.id)}
                isCollapsed={isCollapsed}
                messageTab={messageTabs[message.id]}
                contentLoading={Boolean(messageContentLoading[message.id])}
                fontScale={messageFontScale[message.id] ?? 1}
                zoomValue={messageZoom[message.id] ?? 1}
                translation={messageTranslations?.[message.id]}
                replyTarget={reply?.target}
                replyReferenceId={reply?.refId}
                replyIsForward={reply?.isForward}
              />
              {composeReplyMessageId === message.id && renderComposeInlineCard?.()}
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
}
