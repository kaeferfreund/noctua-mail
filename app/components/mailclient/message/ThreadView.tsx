import { useTranslations } from "next-intl";
import React from "react";
import type { MessageTranslationEntry } from "./messageTranslation";
import type { MessageTab } from "./types";
import { resolveInReplyToRef } from "../utils/messageHelpers";
import type { Message } from "@/lib/data";
import { Text } from "@radix-ui/themes";
import { needsMessageContentHydration } from "@/lib/ui/messageView";
import ThreadMessageCard from "./ThreadMessageCard";
import type { ThreadMessageCardProps } from "./ThreadMessageCard";
import { getRenderedThreadMessages } from "./threadViewState";
import styles from "./ThreadView.module.css";

export type ThreadViewCardProps = Omit<ThreadMessageCardProps,
  "message" | "actionPending" | "isCollapsed" | "messageTab" | "contentLoading" |
  "fontScale" | "zoomValue" | "translation" | "replyTarget" | "replyReferenceId" | "replyIsForward"
> & {
  pendingMessageActions: Set<string>;
  collapsedMessages: Record<string, boolean>;
  messageTabs: Record<string, MessageTab>;
  messageContentLoading: Record<string, boolean>;
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
  messageCardProps,
  composeDraftId,
  composeReplyMessageId,
  renderComposeInlineCard
}: ThreadViewProps) {
  const t = useTranslations("Reader");
  // Keep collection identity out of the memoized cards. Shared handlers stay
  // unwrapped so changed closures (mailbox, role, policy) remain observable.
  const { pendingMessageActions, collapsedMessages, messageTabs,
    messageContentLoading, messageFontScale, messageZoom, messageTranslations,
    messageByMessageId, ...sharedCardProps } = messageCardProps;
  return (
    <>
      {activeMessage ? (
        (() => {
          const activeThreadId =
            activeMessage.threadId ?? activeMessage.messageId ?? activeMessage.id;
          const isThreadLoading = Boolean(
            activeThreadId && threadContentLoading === activeThreadId
          );
          const activeThreadError = activeThreadId ? threadContentErrorById[activeThreadId] : "";
          const activeMessageFromThread =
            activeThread.find((item) => item.id === activeMessage.id) ?? activeMessage;
          const activeMessageBodyLoading =
            isThreadLoading && needsMessageContentHydration(activeMessageFromThread);
          const activeMessageBodyError =
            !isThreadLoading &&
            Boolean(activeThreadError) &&
            needsMessageContentHydration(activeMessageFromThread);
          const visibleThread = getRenderedThreadMessages({
            activeMessage,
            activeThread,
            supportsThreads,
            threadContentById,
            threadContentLoading,
            showComposeInline,
            composeDraftId
          });
          const { threadViewMode } = messageCardProps;
          return (
            <>
              {visibleThread.map((message) => {
                const reply = resolveInReplyToRef(message, messageByMessageId);
                const isCompactCollapsed =
                  threadViewMode === "compact" && Boolean(collapsedMessages[message.id]);
                return (
                <div
                  key={message.id}
                  className={`${styles.threadItem} ${isCompactCollapsed ? styles.compactThreadItem : ""}`}
                >
                  <ThreadMessageCard
                    message={message}
                    bodyLoading={activeMessageBodyLoading && message.id === activeMessageFromThread.id}
                    bodyLoadError={
                      activeMessageBodyError && message.id === activeMessageFromThread.id
                        ? activeThreadError
                        : null
                    }
                    {...sharedCardProps}
                    actionPending={pendingMessageActions.has(message.id)}
                    isCollapsed={Boolean(collapsedMessages[message.id])}
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
                );
              })}
            </>
          );
        })()
      ) : showComposeInline ? null : (
        <Text size="2" color="gray" className={styles.empty}>{t("selectThread")}</Text>
      )}
    </>
  );
}
