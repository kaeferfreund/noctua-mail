import { isReaderRowActivation } from "@/lib/ui/readerFocus";
import { useReaderNavigationRows } from "./useReaderNavigationRows";
import { useLocale, useTranslations } from "next-intl";
import CollabRowBadges from "@/app/components/collab/CollabRowBadges";
import { useIsMobile } from "@/app/hooks/use-mobile";
import type React from "react";
import type { CSSProperties } from "react";
import { CalendarDays, GitBranch, MoveRight, Paperclip, Trash2 } from "lucide-react";
import { Badge, Text, VisuallyHidden } from "@radix-ui/themes";
import { badgeColors } from "@/lib/ui/badgeColors";
import { describeMessageSize } from "@/lib/ui/byteSize";
import type { Message } from "@/lib/data";
import SenderIcon from "../SenderIcon";
import { CALENDAR_INVITE_FLAG, hasMessageFlag } from "@/lib/messageFlags";
import badgeStyles from "../message/MessageBadge.module.css";
import CategoryBadge from "../CategoryBadge";
import SpamBadge from "../SpamBadge";
import FlagBadge from "../message/FlagBadge";
import MessageBadge from "../message/MessageBadge";
import TopicBadge from "../TopicBadge";
import {
  hasAiModifiedFlag,
  shouldShowAttachmentIcon,
  hasTodoFlag,
  hasDoneFlag
} from "../utils/messageHelpers";
import { getMessageListDateDisplay, useMessageListRelativeDayLabels } from "./messageDateDisplay";
import { useSelectionSnapshot } from "./selectionStore";
import ThreadMarkers from "./ThreadMarkers";
import MessageListRenderer from "./MessageListRenderer";
import FromAddressHoverCard from "./FromAddressHoverCard";
import type { MessageThreadListProps } from "./messageListViewTypes";
import { useMessageListItems } from "./useMessageListItems";
import { useThreadListAnimationState } from "./useThreadListAnimationState";
import { useRowSwipeActions } from "./useRowSwipeActions";
import {
  getDragThreadMessageIds,
  getThreadRowDisplayMeta,
  getThreadRowSelectionMeta,
  handleCollapsedThreadRootClick,
  handleMessageRowKeyDown,
  isRowAnimatedFromGroupToggle,
  isRowAnimatedFromNestedToggle
} from "./listInteractions";
import { getCollapsedThreadBadgeUnion } from "./threadBadgeUnion";
import { isTopicSuggestionGroupKey } from "./topicSuggestionGroup";
import TopicSuggestionAcceptButton from "./TopicSuggestionAcceptButton";
import groupStyles from "./MessageCardList.module.css";
import styles from "./MessageThreadList.module.css";
import TooltipIconButton from "@/app/components/TooltipIconButton";

export default function MessageThreadList({
  state,
  actions,
  helpers,
  refs
}: MessageThreadListProps) {
  const locale = useLocale();
  const t = useTranslations("List");
  const relativeDayLabels = useMessageListRelativeDayLabels();
  const {
    groupedMessages,
    collapsedGroups,
    collapsedThreads,
    supportsThreads,
    includeThreadAcrossFolders,
    searchScope,
    activeFolderId,
    messageById,
    messageTopicsById,
    selectionStore,
    draggingMessageIds,
    pendingMessageActions,
    pendingSuggestedThreadIds,
    preferToDisplay,
    activeTopic,
    userEmail,
    findRecipientAlias,
    dateFormat,
    showMessageSize,
    topicColorRows,
    senderIconsEnabled,
    listIsNarrow
  } = state;
  const { scrollRef } = refs;

  const {
    setCollapsedGroups,
    setCollapsedThreads,
    handleMessageDragStart,
    handleMessageDragEnd,
    handleRowClick,
    onOpenReader,
    onNavigationRowsChange,
    handleSelectMessage,
    selectRangeTo,
    toggleMessageSelection,
    selectCollapsedThread,
    handleDeleteMessage,
    toggleFlaggedFlag,
    toggleTodoFlag,
    handleAddSuggestedThread
  } = actions;

  const {
    buildThreadTree,
    flattenThread,
    getThreadLatestDate,
    getGroupLabel,
    renderFolderBadges,
    handleShowRelated,
    isTrashFolder,
    renderMessageMenu
  } = helpers;

  const {
    lastGroupToggle,
    lastThreadToggle,
    lastNestedToggle,
    animationClock,
    collapsedNestedMessages,
    toggleGroup,
    toggleThread,
    toggleNested
  } = useThreadListAnimationState();

  const narrowRows = useIsMobile() || listIsNarrow;
  const rowHeight = narrowRows ? 72 : 40;
  const groupHeight = 28;
  const { ids: selectedMessageIds, activeId: activeMessageId } =
    useSelectionSnapshot(selectionStore);
  const activeMessage = activeMessageId ? messageById.get(activeMessageId) ?? null : null;
  const activeThreadKey =
    activeMessage?.threadId ?? activeMessage?.messageId ?? activeMessage?.id;

  const listItems = useMessageListItems({
    groupedMessages,
    collapsedGroups,
    collapsedThreads,
    supportsThreads,
    includeThreadAcrossFolders,
    searchScope,
    activeFolderId,
    buildThreadTree,
    flattenThread,
    getThreadLatestDate,
    userEmail,
    preferToDisplay,
    findRecipientAlias,
    mode: "nested",
    collapsedNestedMessages
  });

  useReaderNavigationRows(listItems, onNavigationRowsChange);
  const getRowSwipe = useRowSwipeActions(actions, pendingMessageActions);

  return (
    <MessageListRenderer
      items={listItems}
      scrollRef={scrollRef}
      className={styles.virtualList}
      rowHeight={rowHeight}
      groupHeight={groupHeight}
      collapsedGroups={collapsedGroups}
      getGroupLabel={getGroupLabel}
      onGroupOpenChange={(groupKey, open) => {
        toggleGroup(groupKey, open, setCollapsedGroups);
      }}
      classNames={{
        virtualItem: styles.virtualItem,
        suggestionSection: groupStyles.suggestionSection,
        suggestionSectionRows: groupStyles.suggestionSectionRows,
        suggestionSectionRow: groupStyles.suggestionSectionRow,
        rowEnter: styles.rowEnter
      }}
      isRowAnimated={({ item }) => {
        const message = item.message;
        const animateFromGroup = isRowAnimatedFromGroupToggle({
          animationClock,
          lastGroupToggle,
          groupKey: item.groupKey
        });
        const animateFromThread =
          animationClock > 0 &&
          lastThreadToggle?.open &&
          lastThreadToggle.key === item.threadGroupId &&
          item.depth > 0 &&
          animationClock - lastThreadToggle.at < 220;
        const animateFromNested = isRowAnimatedFromNestedToggle({
          animationClock,
          lastNestedToggle,
          messageId: message.id,
          itemDepth: item.depth,
          fullFlat: item.fullFlat
        });
        return animateFromGroup || animateFromThread || animateFromNested;
      }}
      getRowSwipe={getRowSwipe}
      renderRow={({ item, index }) => {
        const message = item.message;
        const isSuggestionRow = isTopicSuggestionGroupKey(item.groupKey);
        const showAddSuggestionAction =
          isSuggestionRow && item.threadIndex === 0 && item.depth === 0;
        const isAddSuggestionPending = pendingSuggestedThreadIds.has(item.threadGroupId);
        const dateDisplay = getMessageListDateDisplay(
          item.displayDateValue,
          item.displayDate,
          dateFormat, locale, relativeDayLabels
        );
        const isDragging = draggingMessageIds.has(message.id);
        const isActive = message.id === activeMessageId;
        const isDisabled = pendingMessageActions.has(message.id);
        const showRowDivider = index > 0 && !item.isFirstInGroup;
        const {
          rowSelected,
          showThreadSelectionActive
        } = getThreadRowSelectionMeta({
          item,
          supportsThreads,
          selectedMessageIds,
          activeMessageId: activeMessageId ?? null,
          includeSubThreadRoots: true
        });
        const isActiveThread =
          Boolean(activeMessageId) &&
          item.fullFlat.some((entry) => entry.message.id === activeMessageId);
        const showCollapsedActive =
          item.isCollapsed &&
          item.threadIndex === 0 &&
          item.depth === 0 &&
          item.threadSize > 1 &&
          isActiveThread;
        const showRootActive = showCollapsedActive || showThreadSelectionActive;
        const { isCollapsedThreadRoot, displaySeen } = getThreadRowDisplayMeta({
          item
        });

        // Calculate badge union for collapsed threads
        const threadBadgeUnion = getCollapsedThreadBadgeUnion({
          isCollapsedThreadRoot,
          fullFlat: item.fullFlat
        }) ?? {
          threadCategories: [],
          threadHasFlagged: false,
          threadHasTodo: false,
          threadHasDone: false,
          threadHasAiModified: false,
          threadHasAttachments: false,
          threadHasCalendar: false
        };

        const rowContainerClassName = [
          styles.messageRowContainer,
          showRowDivider ? styles.rowDivider : "",
          isActive || showRootActive ? styles.rowActive : "",
          !showRootActive &&
          activeThreadKey === item.threadGroupId &&
          message.id !== activeMessage?.id
            ? styles.threadSibling
            : "",
          !displaySeen ? styles.rowUnread : "",
          rowSelected ? styles.rowSelected : "",
          isDragging ? styles.rowDragging : "",
          isDisabled ? styles.rowDisabled : "",
          isSuggestionRow ? styles.rowSuggestion : ""
        ]
          .filter(Boolean)
          .join(" ");

        const firstTopicColor = topicColorRows ? (messageTopicsById?.get(message.threadId)?.[0]?.color ?? null) : null;
        const topicTintVar = firstTopicColor ? ({ "--topic-tint": `var(--${firstTopicColor}-a3)`, "--topic-tint-selected": `var(--${firstTopicColor}-a4)` } as CSSProperties) : undefined;

        return (
          <div className={rowContainerClassName} style={topicTintVar}>
            <ThreadMarkers
              depth={item.depth}
              threadIndex={item.threadIndex}
              threadSize={item.threadSize}
              isCollapsed={item.isCollapsed}
              isLastInDepth={item.isLastInDepth}
              hasChildren={item.hasChildren}
              isNestedCollapsed={item.isNestedCollapsed}
              ancestorStopsHere={item.ancestorStopsHere}
              onToggleThread={() => {
                toggleThread(item.threadGroupId, item.isCollapsed, setCollapsedThreads);
              }}
              onToggleNested={() => {
                toggleNested(message.id, item.isNestedCollapsed);
              }}
            />
            <div
              className={styles.row}
              data-message-list-row="true"
              data-message-layout="stacked"
              data-message-narrow={narrowRows}
              data-message-id={message.id}
              data-active={message.id === activeMessageId}
              data-selected={rowSelected}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(event) => {
                const threadIds = getDragThreadMessageIds({
                  isCollapsedThreadRoot,
                  fullFlat: item.fullFlat
                });
                handleMessageDragStart(event, message, threadIds);
              }}
              onDragEnd={handleMessageDragEnd}
              onDoubleClick={(event) => {
                if (isReaderRowActivation(event)) onOpenReader?.(message);
              }}
              onClick={(event) => {
                handleCollapsedThreadRootClick({
                  event,
                  supportsThreads,
                  isCollapsedThreadRoot,
                  fullFlat: item.fullFlat,
                  message,
                  isFlaggedGroup: item.isFlaggedGroup,
                  selectCollapsedThread,
                  onDefault: () => handleRowClick(event, message)
                });
              }}
              onKeyDown={(event) => {
                handleMessageRowKeyDown({
                  event,
                  messageId: message.id,
                  onSelect: () => {
                    handleSelectMessage(message);
                    onOpenReader?.(message);
                  },
                  selectRangeTo,
                  toggleMessageSelection
                });
              }}
            >
                {item.threadIndex === 0 && item.threadSize > 1 && (
                  <Badge
                    size="1"
                    variant="soft"
                    color={badgeColors.threadIndicator}
                    className={badgeStyles.badge}
                  >
                    <GitBranch size={12} />
                    <span title={t("threadMessageCount", { count: item.threadSize ?? 0 })}>{item.threadSize}</span>
                  </Badge>
                )}

                <FromAddressHoverCard
                  participants={item.fromParticipants}
                  fallbackTooltip={item.fromTooltip}
                >
                  <span data-message-cell="from" className={styles.cellFrom} title={item.fromTooltip}>
                    {!displaySeen && <VisuallyHidden>{t("unread")}</VisuallyHidden>}
                    {!item.showRecipientIcon && (
                      <SenderIcon
                        accountId={message.accountId}
                        from={item.iconFrom}
                        fromEmail={item.iconFromEmail}
                        enabled={senderIconsEnabled}
                        className={styles.senderIcon}
                        title={item.fromTooltip}
                        unread={!displaySeen}
                      />
                    )}
                    {item.showRecipientIcon && (
                      <span
                        className={styles.recipientIcon}
                        title={t("recipients")}
                        aria-label={t("recipients")}
                      >
                        <MoveRight size={12} />
                      </span>
                    )}
                    <span className={styles.cellFromText}>{item.fromText}</span>
                  </span>
                </FromAddressHoverCard>

                <span data-message-cell="subject" className={styles.cellSubject}>
                  <span data-message-subject-line="" style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 6 }}><span data-message-subject="" className={styles.cellSubjectText}>{message.subject}</span><SpamBadge message={message} /><span data-mobile-collab=""><CollabRowBadges message={message} /></span></span>
                  {renderFolderBadges(item.folderIds)}
                  {(threadBadgeUnion.threadHasAttachments ||
                    shouldShowAttachmentIcon(message)) && (
                    <Badge
                      size="1"
                      variant="soft"
                      color={badgeColors.attachment}
                      className={badgeStyles.badge}
                      title={t("attachments")}
                      aria-label={t("attachments")}
                    >
                      <Paperclip size={12} />
                    </Badge>
                  )}
                  {(threadBadgeUnion.threadHasCalendar ||
                    hasMessageFlag(message.flags, CALENDAR_INVITE_FLAG)) && (
                    <Badge
                      size="1"
                      variant="soft"
                      color={badgeColors.calendarInvite}
                      className={badgeStyles.badge}
                      title={t("calendarInvite")}
                      aria-label={t("calendarInvite")}
                    >
                      <CalendarDays size={12} />
                    </Badge>
                  )}
                  {threadBadgeUnion.threadCategories.length > 0
                    ? threadBadgeUnion.threadCategories.map((category) => (
                        <CategoryBadge
                          key={category}
                          category={category as any}
                          showText={false}
                        />
                      ))
                    : message.category && (
                        <CategoryBadge category={message.category as any} showText={false} />
                      )}
                  {(threadBadgeUnion.threadHasFlagged || message.flagged) && (
                    <FlagBadge
                      onClick={() =>
                        toggleFlaggedFlag(
                          message,
                          isCollapsedThreadRoot ? item.fullFlat.map((entry) => entry.message) : undefined
                        )
                      }
                    />
                  )}
                  {(threadBadgeUnion.threadHasTodo || hasTodoFlag(message)) && (
                    <MessageBadge
                      kind="todo"
                      onClick={() =>
                        toggleTodoFlag(
                          message,
                          isCollapsedThreadRoot ? item.fullFlat.map((entry) => entry.message) : undefined,
                          "todo"
                        )
                      }
                    />
                  )}
                  {(threadBadgeUnion.threadHasDone || hasDoneFlag(message)) && (
                    <MessageBadge
                      kind="done"
                      onClick={() =>
                        toggleTodoFlag(
                          message,
                          isCollapsedThreadRoot ? item.fullFlat.map((entry) => entry.message) : undefined,
                          "done"
                        )
                      }
                    />
                  )}
                  {(threadBadgeUnion.threadHasAiModified || hasAiModifiedFlag(message)) && (
                    <MessageBadge kind="ai-modified" />
                  )}
                  {messageTopicsById?.get(message.threadId)?.map((topic) => (
                    <TopicBadge key={topic.id} topic={topic} size="1" preferShortName />
                  ))}
                  <CollabRowBadges message={message} />
                </span>

                {showMessageSize && (
                  <span data-message-cell="size" className={styles.cellSize}>
                    <Text as="span" size="1" title={describeMessageSize(message.sizeBytes, locale).title}>
                      {describeMessageSize(message.sizeBytes, locale).label}
                    </Text>
                  </span>
                )}

                <span data-message-cell="date" className={styles.cellDate}>
                  <Text as="span" size="1" title={dateDisplay.tooltip}>
                    {dateDisplay.text}
                  </Text>
                </span>

                <div data-message-cell="actions" className={styles.cellActions}>
                  <TooltipIconButton
                    size="1"
                    variant="ghost"
                    color="gray"
                    tooltip={
                      isTrashFolder(message.folderId)
                        ? t("deletePermanent")
                        : t("moveTrash")
                    }
                    aria-label={t("delete")}
                    data-message-action="delete"
                    disabled={pendingMessageActions.has(message.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteMessage(message);
                    }}
                  >
                    <Trash2 size={14} />
                  </TooltipIconButton>
                  {renderMessageMenu(message, "table", undefined, isCollapsedThreadRoot ? displaySeen : undefined)}
                  {showAddSuggestionAction && (
                    <TopicSuggestionAcceptButton
                      topicColor={activeTopic?.color}
                      isPending={isAddSuggestionPending}
                      disabled={isDisabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddSuggestedThread(item.threadGroupId);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
        );
      }}
    />
  );
}
