import { memo, useCallback, useEffect, useState } from "react";
import type React from "react";
import type { ListItem, ListRowItem, MessageGroup } from "./listModel";
import MessageGroupRow from "./MessageGroupRow";
import SwipeableRow, { type RowSwipeActions } from "./SwipeableRow";
import { createSwipeOpenStore } from "./swipeGesture";
import VirtualizedList from "./VirtualizedList";

const SUGGESTION_SECTION_ROWS_TOP_GAP = 0;
const SUGGESTION_SECTION_BOTTOM_GAP = 12;

type MessageListRendererProps = {
  items: ListItem[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  rowHeight: number;
  groupHeight: number;
  collapsedGroups: Record<string, boolean>;
  getGroupLabel: (group: MessageGroup) => React.ReactNode;
  onGroupOpenChange: (groupKey: string, open: boolean) => void;
  classNames: {
    virtualItem: string;
    suggestionSection: string;
    suggestionSectionRows: string;
    suggestionSectionRow: string;
    rowEnter?: string;
  };
  isRowAnimated?: (args: { item: ListRowItem; index: number }) => boolean;
  renderRow: (args: { item: ListRowItem; index: number }) => React.ReactNode;
  /** Phone swipe actions per row; rows without them do not swipe. */
  getRowSwipe?: (item: ListRowItem) => RowSwipeActions | null;
};

function MessageListRenderer({
  items,
  scrollRef,
  className,
  rowHeight,
  groupHeight,
  collapsedGroups,
  getGroupLabel,
  onGroupOpenChange,
  classNames,
  isRowAnimated,
  renderRow,
  getRowSwipe
}: MessageListRendererProps) {
  // One open swipe row per list; scrolling the list closes it.
  const [swipeStore] = useState(createSwipeOpenStore);
  const swipeEnabled = Boolean(getRowSwipe);
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !swipeEnabled) return;
    const closeSwipe = () => swipeStore.set(null);
    scrollEl.addEventListener("scroll", closeSwipe, { passive: true });
    return () => scrollEl.removeEventListener("scroll", closeSwipe);
  }, [scrollRef, swipeEnabled, swipeStore]);

  const renderListRow = useCallback(
    (item: ListRowItem, index: number) => {
      const row = renderRow({ item, index });
      const swipe = getRowSwipe?.(item);
      if (!swipe) return row;
      return (
        <SwipeableRow rowKey={item.key} store={swipeStore} {...swipe}>
          {row}
        </SwipeableRow>
      );
    },
    [getRowSwipe, renderRow, swipeStore]
  );

  const getItemHeight = useCallback(
    (item: ListItem) => {
      if (item.type === "group") return groupHeight;
      if (item.type === "suggestion-section") {
        if (item.isCollapsed || item.rows.length === 0) return groupHeight;
        return (
          groupHeight +
          SUGGESTION_SECTION_ROWS_TOP_GAP +
          item.rows.length * rowHeight +
          SUGGESTION_SECTION_BOTTOM_GAP
        );
      }
      return rowHeight;
    },
    [groupHeight, rowHeight]
  );

  const renderItem = useCallback(
    ({ item, index, top }: { item: ListItem; index: number; top: number }) => {
      if (item.type === "group") {
        return (
          <MessageGroupRow
            key={`group-${item.group.key}`}
            group={item.group}
            isCollapsed={
              collapsedGroups[item.group.key] ??
              (item.group.variant === "topic-suggestions")
            }
            top={top}
            height={groupHeight}
            showDivider={index > 0}
            virtualItemClassName={classNames.virtualItem}
            getGroupLabel={getGroupLabel}
            onOpenChange={(open) => onGroupOpenChange(item.group.key, open)}
          />
        );
      }

      if (item.type === "suggestion-section") {
        const sectionHeight =
          item.isCollapsed || item.rows.length === 0
            ? groupHeight
            : groupHeight +
              SUGGESTION_SECTION_ROWS_TOP_GAP +
              item.rows.length * rowHeight +
              SUGGESTION_SECTION_BOTTOM_GAP;
        return (
          <div
            key={`suggestion-section-${item.key}`}
            className={classNames.virtualItem}
            style={{ transform: `translateY(${top}px)`, height: sectionHeight }}
          >
            <div className={classNames.suggestionSection}>
              <MessageGroupRow
                group={item.group}
                isCollapsed={item.isCollapsed}
                height={groupHeight}
                showDivider={index > 0}
                getGroupLabel={getGroupLabel}
                onOpenChange={(open) => onGroupOpenChange(item.group.key, open)}
                renderAsVirtualItem={false}
              />
              {!item.isCollapsed && item.rows.length > 0 && (
                <>
                  <div className={classNames.suggestionSectionRows}>
                    {item.rows.map((row, rowIndex) => {
                      const shouldAnimateRow =
                        isRowAnimated?.({ item: row, index: rowIndex }) ?? false;
                      return (
                        <div
                          key={`suggestion-row-${row.key}`}
                          className={`${classNames.suggestionSectionRow} ${
                            shouldAnimateRow && classNames.rowEnter ? classNames.rowEnter : ""
                          }`}
                          style={{ height: rowHeight }}
                        >
                          {renderListRow(row, rowIndex)}
                        </div>
                      );
                    })}
                  </div>
                  <div aria-hidden="true" style={{ height: SUGGESTION_SECTION_BOTTOM_GAP }} />
                </>
              )}
            </div>
          </div>
        );
      }

      const shouldAnimateRow = isRowAnimated?.({ item, index }) ?? false;

      return (
        <div
          key={`row-${item.key}`}
          className={`${classNames.virtualItem} ${
            shouldAnimateRow && classNames.rowEnter ? classNames.rowEnter : ""
          }`}
          style={{ transform: `translateY(${top}px)`, height: rowHeight }}
        >
          {renderListRow(item, index)}
        </div>
      );
    },
    [
      classNames,
      collapsedGroups,
      getGroupLabel,
      groupHeight,
      isRowAnimated,
      onGroupOpenChange,
      renderListRow,
      rowHeight
    ]
  );

  return (
    <VirtualizedList
      items={items}
      scrollRef={scrollRef}
      className={className}
      getItemHeight={getItemHeight}
      renderItem={renderItem}
    />
  );
}

export default memo(MessageListRenderer);
