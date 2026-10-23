import { isReaderRowActivation } from "@/lib/ui/readerFocus";
import { useReaderNavigationRows } from "./useReaderNavigationRows";
import { useLocale, useTranslations } from "next-intl";
import CollabRowBadges from "@/app/components/collab/CollabRowBadges";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { CSSProperties } from "react";
import { GitBranch, MoveRight, Search, Trash2 } from "lucide-react";
import { Badge, Checkbox, Text, VisuallyHidden } from "@radix-ui/themes";
import { CaretRightIcon } from "@radix-ui/react-icons";
import { badgeColors } from "@/lib/ui/badgeColors";
import { describeMessageSize } from "@/lib/ui/byteSize";
import type { Message } from "@/lib/data";
import SenderIcon from "../SenderIcon";
import TopicBadge from "../TopicBadge";
import badgeStyles from "../message/MessageBadge.module.css";
import { getMessageListDateDisplay } from "./messageDateDisplay";
import { selectAllVisibleMessages } from "./listSelection";
import { useSelectionSnapshot } from "./selectionStore";
import MessageListRenderer from "./MessageListRenderer";
import type { MessageTableProps } from "./messageListViewTypes";
import { useMessageListItems } from "./useMessageListItems";
import {
  applyToggleWithAnimation,
  getDragThreadMessageIds,
  getThreadRowDisplayMeta,
  getThreadRowSelectionMeta,
  handleCollapsedThreadRootClick,
  handleMessageRowKeyDown,
  handleRowCheckboxChange,
  hasSelectionModifier,
  isRowAnimatedFromGroupToggle,
  type ToggleAnimation
} from "./listInteractions";
import { isTopicSuggestionGroupKey } from "./topicSuggestionGroup";
import TopicSuggestionAcceptButton from "./TopicSuggestionAcceptButton";
import FromAddressHoverCard from "./FromAddressHoverCard";
import groupStyles from "./MessageCardList.module.css";
import styles from "./MessageTable.module.css";
import TooltipIconButton from "@/app/components/TooltipIconButton";

export default function MessageTable({
  state,
  actions,
  helpers,
  refs
}: MessageTableProps) {
  const locale = useLocale();
  const t = useTranslations("List");
  const {
    groupedMessages,
    visibleMessages,
    selectionStore,
    draggingMessageIds,
    collapsedGroups,
    collapsedThreads,
    pendingMessageActions,
    pendingSuggestedThreadIds,
    supportsThreads,
    includeThreadAcrossFolders,
    searchScope,
    activeFolderId,
    messageById,
    messageTopicsById,
    sortDir,
    showMessageSize,
    preferToDisplay,
    activeTopic,
    userEmail,
    findRecipientAlias,
    dateFormat,
    topicColorRows,
    senderIconsEnabled,
    listIsNarrow
  } = state;
  const { scrollRef } = refs;
  const {
    setSortKey,
    setSortDir,
    setCollapsedGroups,
    setCollapsedThreads,
    setLastSelectedIdRef,
    handleMessageDragStart,
    handleMessageDragEnd,
    handleRowClick,
    onOpenReader,
    onNavigationRowsChange,
    handleSelectMessage,
    toggleMessageSelection,
    selectRangeTo,
    selectCollapsedThread,
    handleDeleteMessage,
    handleAddSuggestedThread
  } = actions;

  const {
    buildThreadTree,
    flattenThread,
    getThreadLatestDate,
    getGroupLabel,
    renderSelectIndicators,
    renderFolderBadges,
    isTrashFolder,
    renderMessageMenu,
    handleShowRelated
  } = helpers;

  const { ids: selectedMessageIds, activeId: activeMessageId } =
    useSelectionSnapshot(selectionStore);
  const activeMessage = activeMessageId ? messageById.get(activeMessageId) ?? null : null;
  const threadScopeMessages = groupedMessages.flatMap((group) => group.items);

  const [optimisticRow, setOptimisticRow] = useState<{
    id: string;
    selected: boolean;
    active: boolean;
  } | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  const scheduleClear = () => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = window.setTimeout(() => {
      clearTimerRef.current = null;
      setOptimisticRow(null);
    }, 350);
  };

  const [lastGroupToggle, setLastGroupToggle] = useState<ToggleAnimation | null>(null);
  const [animationClock, setAnimationClock] = useState(0);

  useEffect(() => {
    if (!animationClock) return;
    const timer = window.setTimeout(() => setAnimationClock(0), 220);
    return () => {
      window.clearTimeout(timer);
    };
  }, [animationClock]);

  const narrowRows = useIsMobile() || listIsNarrow;
  const rowHeight = narrowRows ? 72 : 44;
  const groupHeight = 32;
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
    mode: "flat"
  });

  useReaderNavigationRows(listItems, onNavigationRowsChange);

  return (
    <div className={styles.table}>
      <div className={`${styles.row} ${styles.rowHeader}`}>
        <div data-message-cell="unread" className={styles.cellSelect} aria-hidden="true">
          <Checkbox
            size="1"
            checked={
              visibleMessages.length > 0 &&
              visibleMessages.every((item) => selectedMessageIds.has(item.message.id))
            }
            aria-label={t("selectAll")}
            onClick={(event) => {
              event.stopPropagation();
              const allIds = visibleMessages.map((item) => item.message.id);
              if (allIds.every((id) => selectedMessageIds.has(id))) {
                selectionStore.clearSelection();
              } else {
                selectAllVisibleMessages({
                  visibleMessages,
                  collapsedThreads,
                  threadScopeMessages,
                  supportsThreads,
                  selectionStore,
                  setLastSelectedId: setLastSelectedIdRef
                });
              }
            }}
          />
        </div>
        <div data-message-cell="from" className={styles.cellFrom}>
          <button
            className={styles.sortButton}
            onClick={() => {
              setSortKey("from");
              setSortDir(sortDir === "asc" ? "desc" : "asc");
            }}
          >{t("fromTo")}</button>
        </div>
        <div data-message-cell="subject" className={styles.cellSubject}>
          <button
            className={styles.sortButton}
            onClick={() => {
              setSortKey("subject");
              setSortDir(sortDir === "asc" ? "desc" : "asc");
            }}
          >{t("subject")}</button>
        </div>
        {showMessageSize && (
          <div
            data-message-cell="size" className={styles.cellSize}
            title={t("sizeSortHint")}
          >{t("size")}</div>
        )}
        <div data-message-cell="date" className={styles.cellDate}>
          <button
            className={styles.sortButton}
            onClick={() => {
              setSortKey("date");
              setSortDir(sortDir === "asc" ? "desc" : "asc");
            }}
          >{t("date")}</button>
        </div>
        <div data-message-cell="actions" className={styles.cellActions} aria-hidden="true">
          {"\u00A0"}
        </div>
      </div>
      <MessageListRenderer
        items={listItems}
        scrollRef={scrollRef}
        className={styles.virtualList}
        rowHeight={rowHeight}
        groupHeight={groupHeight}
        collapsedGroups={collapsedGroups}
        getGroupLabel={getGroupLabel}
        onGroupOpenChange={(groupKey, open) => {
          applyToggleWithAnimation({
            key: groupKey,
            open,
            setLastToggle: setLastGroupToggle,
            setAnimationClock,
            setCollapsedState: setCollapsedGroups
          });
        }}
      classNames={{
        virtualItem: styles.virtualItem,
        suggestionSection: groupStyles.suggestionSection,
        suggestionSectionRows: groupStyles.suggestionSectionRows,
        suggestionSectionRow: groupStyles.suggestionSectionRow,
        rowEnter: styles.rowEnter
      }}
        isRowAnimated={({ item }) =>
          isRowAnimatedFromGroupToggle({
            animationClock,
            lastGroupToggle,
            groupKey: item.groupKey
          })
        }
        renderRow={({ item, index }) => {
          const message = item.message;
          const isSuggestionRow = isTopicSuggestionGroupKey(item.groupKey);
          const showAddSuggestionAction =
            isSuggestionRow && item.threadIndex === 0 && item.depth === 0;
          const isAddSuggestionPending = pendingSuggestedThreadIds.has(item.threadGroupId);
          const dateDisplay = getMessageListDateDisplay(
            item.displayDateValue,
            item.displayDate,
            dateFormat, locale
          );
          const {
            isThreadSelectionRoot,
            threadSelectionIds,
            isThreadSelectionAllSelected,
            isThreadSelectionPartiallySelected,
            rowSelected,
            checkboxState,
            showThreadSelectionActive
          } = getThreadRowSelectionMeta({
            item,
            supportsThreads,
            selectedMessageIds,
            activeMessageId: activeMessageId ?? null,
            includeSubThreadRoots: true
          });
          const isDragging = draggingMessageIds.has(message.id);
          const optimistic =
            optimisticRow && optimisticRow.id === message.id
              ? optimisticRow
              : null;
          const effectiveSelected = optimistic ? optimistic.selected : rowSelected;
          const effectiveCheckboxState: boolean | "indeterminate" = optimistic
            ? optimistic.selected
            : checkboxState;
          const effectiveActive =
            message.id === activeMessageId || showThreadSelectionActive || Boolean(optimistic?.active);
          const isDisabled = pendingMessageActions.has(message.id);
          const showRowDivider = index > 0 && !item.isFirstInGroup;
          const { isCollapsedThreadRoot, displaySeen } = getThreadRowDisplayMeta({
            item
          });
          const rowClassName = [
            styles.row,
            showRowDivider ? styles.rowDivider : "",
            effectiveActive ? styles.rowActive : "",
            item.depth > 0 ? styles.threadChild : "",
            !showThreadSelectionActive &&
            activeThreadKey === item.threadGroupId &&
            message.id !== activeMessage?.id
              ? styles.threadSibling
              : "",
            !displaySeen ? styles.rowUnread : "",
            effectiveSelected ? styles.rowSelected : "",
            isDragging ? styles.rowDragging : "",
            isDisabled ? styles.rowDisabled : "",
            isSuggestionRow ? styles.rowSuggestion : ""
          ]
            .filter(Boolean)
            .join(" ");

          const firstTopicColor = topicColorRows ? (messageTopicsById?.get(message.threadId)?.[0]?.color ?? null) : null;
          const topicTintVar = firstTopicColor ? ({ "--topic-tint": `var(--${firstTopicColor}-a3)`, "--topic-tint-selected": `var(--${firstTopicColor}-a4)` } as CSSProperties) : undefined;

          return (
            <div
              className={rowClassName}
              data-message-list-row="true"
              data-message-layout="stacked"
              data-message-narrow={narrowRows}
              data-message-id={message.id}
              data-active={message.id === activeMessageId}
              data-selected={effectiveSelected}
              style={topicTintVar}
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
              onPointerDown={(event) => {
                if (isDisabled) return;
                if (event.button !== 0) return;
                const target = event.target as HTMLElement | null;
                const isRowControl = Boolean(target?.closest('[data-no-row-select="true"]'));
                const isCheckbox = Boolean(target?.closest('[role="checkbox"]'));
                const isInteractive = Boolean(
                  target?.closest("button, a, input, select, textarea")
                );
                if (isRowControl || (isInteractive && !isCheckbox)) return;
                const isToggle = event.metaKey || event.ctrlKey;
                const isRange = event.shiftKey;
                setOptimisticRow({
                  id: message.id,
                  selected:
                    isCheckbox || isToggle
                      ? isThreadSelectionRoot && isThreadSelectionPartiallySelected
                        ? true
                        : !rowSelected
                      : true,
                  active: !isCheckbox && !isToggle && !isRange
                });
                scheduleClear();
                if (!isCheckbox && !isToggle && !isRange) {
                  handleSelectMessage(message);
                }
              }}
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
                <span data-message-cell="unread" className={styles.cellSelect}>
                  {renderSelectIndicators(message)}
                  <Checkbox
                    size="1"
                    checked={effectiveCheckboxState}
                    data-message-select="message"
                    aria-label={t("selectMessage")}
                    disabled={isDisabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRowCheckboxChange({
                        shiftKey: event.shiftKey,
                        messageId: message.id,
                        isThreadSelectionRoot,
                        threadSelectionIds,
                        isThreadSelectionAllSelected,
                        selectionStore,
                        selectRangeTo,
                        toggleMessageSelection,
                        setLastSelectedIdRef
                      });
                    }}
                  />
                </span>
                <span
                  data-message-cell="from" className={styles.cellFrom}
                  style={{ paddingLeft: `${item.depth * 14}px` }}
                >
                  {item.threadIndex === 0 && item.threadSize > 1 ? (
                    <>
                      <span
                        data-no-row-select="true"
                        className={`${styles.threadCaret} ${
                          item.isCollapsed ? "" : styles.threadCaretOpen
                        }`}
                        title={item.isCollapsed ? t("expandThread") : t("collapseThread")}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setCollapsedThreads((prev) => ({
                            ...prev,
                            [item.threadGroupId]: !item.isCollapsed
                          }));
                        }}
                      >
                        <CaretRightIcon />
                      </span>
                      <Badge
                        size="1"
                        variant="soft"
                        color={badgeColors.threadIndicator}
                        className={`${badgeStyles.badge} ${styles.threadIndicatorInline}`}
                      >
                        <GitBranch size={12} />
                        <span title={t("threadMessageCount", { count: item.threadSize ?? 0 })}>{item.threadSize}</span>
                      </Badge>
                    </>
                  ) : (
                    <span className={`${styles.threadCaret} ${styles.threadCaretSpacer}`}>
                      <CaretRightIcon />
                    </span>
                  )}
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
                    <span className={styles.recipientIcon} title={t("recipients")} aria-label={t("recipients")}>
                      <MoveRight size={12} />
                    </span>
                  )}
                  <FromAddressHoverCard
                    participants={item.fromParticipants}
                    fallbackTooltip={item.fromTooltip}
                  >
                    <span className={styles.cellFromText} title={item.fromTooltip}>
                      {item.fromText}
                    </span>
                  </FromAddressHoverCard>
                </span>
                <span
                  data-message-cell="subject" className={styles.cellSubject}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCollapsedThreadRootClick({
                      event,
                      supportsThreads,
                      isCollapsedThreadRoot,
                      fullFlat: item.fullFlat,
                      message,
                      isFlaggedGroup: item.isFlaggedGroup,
                      selectCollapsedThread,
                      onDefault: () => {
                        if (hasSelectionModifier(event)) {
                          handleRowClick(event, message);
                        } else {
                          handleSelectMessage(message);
                        }
                      }
                    });
                  }}
                >
                  {renderFolderBadges(item.folderIds)}
                  <span data-message-subject-line="" style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 6 }}><span data-message-subject="" className={styles.cellSubjectText}>{message.subject}</span><span data-mobile-collab=""><CollabRowBadges message={message} /></span></span>
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
                    data-message-action="delete"
                    aria-label={t("delete")}
                    disabled={pendingMessageActions.has(message.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteMessage(message);
                    }}
                  >
                    <Trash2 size={14} />
                  </TooltipIconButton>
                  <TooltipIconButton
                    size="1"
                    variant="ghost"
                    color="gray"
                    data-message-action="related"
                    tooltip={t("findRelated")}
                    disabled={pendingMessageActions.has(message.id)}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleShowRelated(message);
                    }}
                  >
                    <Search size={14} />
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
          );
        }}
      />
    </div>
  );

}
