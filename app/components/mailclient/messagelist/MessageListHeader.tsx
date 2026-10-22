import { startTransition, useEffect, useId, useRef, useState } from "react";
import type React from "react";
import {
  ArrowDownWideNarrow,
  ListChevronsDownUp,
  ListChevronsUpDown,
  MessagesSquare,
  RefreshCw,
  Rows3,
  StretchHorizontal,
  Table2,
  type LucideIcon
} from "lucide-react";
import { isThreadDateSensitiveGroupBy, type ThreadDateSource } from "@/lib/threadDate";
import { isFlatMessageListSort, type MessageListSortBy } from "@/lib/messageListSort";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/app/components/ui/dropdown-menu";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import ToolbarMenuTrigger from "@/app/components/ToolbarMenuTrigger";
import type { MessageGroup } from "./listModel";
import type { MessageListGroupBy, MessageViewMode, ThreadsMode } from "./messageListViewTypes";
import styles from "./MessageListHeader.module.css";

export type MessageListHeaderProps = {
  state: {
    listWidth: number;
    searchScope: "folder" | "all";
    loadedMessageCount: number;
    totalMessages: number | null;
    listLoading: boolean;
    loadingMessages: boolean;
    hasMoreMessages: boolean;
    messageView: MessageViewMode;
    groupBy: MessageListGroupBy;
    messageSort: MessageListSortBy;
    eventGroupingAvailable: boolean;
    threadDateSource: ThreadDateSource;
    threadsMode: ThreadsMode;
    threadsScopeAvailable: boolean;
    threadsAllowed: boolean;
    groupedMessages: MessageGroup[];
    collapsedGroups: Record<string, boolean>;
  };
  actions: {
    setMessagesPage: React.Dispatch<React.SetStateAction<number>>;
    setMessageView: React.Dispatch<React.SetStateAction<MessageViewMode>>;
    setGroupBy: React.Dispatch<React.SetStateAction<MessageListGroupBy>>;
    setMessageSort: (sortBy: MessageListSortBy) => void;
    setThreadDateSource: React.Dispatch<React.SetStateAction<ThreadDateSource>>;
    setThreadsMode: React.Dispatch<React.SetStateAction<ThreadsMode>>;
    toggleAllGroups: () => void;
  };
};

type MenuOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
};

const VIEW_OPTIONS: ReadonlyArray<MenuOption<MessageViewMode> & { icon: LucideIcon }> = [
  { value: "threads", label: "Threads", icon: MessagesSquare },
  { value: "compact", label: "Compact", icon: Rows3 },
  { value: "card", label: "Cards", icon: StretchHorizontal },
  { value: "table", label: "Table", icon: Table2 }
];

const SORT_OPTIONS: ReadonlyArray<MenuOption<MessageListSortBy>> = [
  { value: "date", label: "Date" },
  { value: "size", label: "Size" }
];

const GROUP_OPTIONS: ReadonlyArray<MenuOption<MessageListGroupBy> & { shortLabel?: string }> = [
  { value: "date", label: "Date" },
  { value: "week", label: "Week" },
  { value: "sender", label: "Sender" },
  { value: "domain", label: "Sender domain", shortLabel: "Domain" },
  { value: "year", label: "Year" },
  { value: "event", label: "Event" },
  { value: "folder", label: "Folder" },
  { value: "none", label: "None" }
];

const THREAD_DATE_OPTIONS: ReadonlyArray<MenuOption<ThreadDateSource>> = [
  { value: "latestReceivedDateValue", label: "Received" },
  { value: "latestDateValue", label: "Last activity" }
];

// Below this list width the sort trigger drops its text label and shows the
// icon only, so the one-row toolbar keeps room for the count.
const SORT_LABEL_MIN_LIST_WIDTH = 400;

const countFormat = new Intl.NumberFormat();

function MenuRadioSection<T extends string>({
  label,
  hint,
  value,
  options,
  disabled = false,
  onValueChange
}: {
  label: string;
  hint?: string;
  value: T;
  options: ReadonlyArray<MenuOption<T>>;
  disabled?: boolean;
  onValueChange: (value: T) => void;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <>
      <DropdownMenuLabel id={labelId}>{label}</DropdownMenuLabel>
      {hint ? (
        <div id={hintId} className={styles.menuHint}>
          {hint}
        </div>
      ) : null}
      <DropdownMenuRadioGroup
        value={value}
        // Radix menus report a click on the already-checked item too; the old
        // Select/SegmentedControl did not, and re-committing e.g. "Date" would
        // reset a table column sort.
        onValueChange={(next) => {
          if (next !== value) onValueChange(next as T);
        }}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
      >
        {options.map(({ value: optionValue, label: optionLabel, icon: Icon, disabled: optionDisabled }) => (
          <DropdownMenuRadioItem
            key={optionValue}
            value={optionValue}
            disabled={disabled || optionDisabled}
          >
            {Icon ? <Icon /> : null}
            {optionLabel}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

export default function MessageListHeader({ state, actions }: MessageListHeaderProps) {
  const {
    listWidth,
    searchScope,
    loadedMessageCount,
    totalMessages,
    listLoading,
    loadingMessages,
    hasMoreMessages,
    messageView,
    groupBy,
    messageSort,
    eventGroupingAvailable,
    threadDateSource,
    threadsMode,
    threadsScopeAvailable,
    threadsAllowed,
    groupedMessages,
    collapsedGroups
  } = state;
  const {
    setMessagesPage,
    setMessageView,
    setGroupBy,
    setMessageSort,
    setThreadDateSource,
    setThreadsMode,
    toggleAllGroups
  } = actions;
  const [localView, setLocalView] = useState(messageView);
  const [localGroupBy, setLocalGroupBy] = useState(groupBy);
  const [localSort, setLocalSort] = useState(messageSort);
  const [localThreadDateSource, setLocalThreadDateSource] = useState(threadDateSource);
  const viewFrameRef = useRef<number | null>(null);
  const groupFrameRef = useRef<number | null>(null);
  const sortFrameRef = useRef<number | null>(null);
  const threadDateFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalView(messageView);
  }, [messageView]);

  useEffect(() => {
    setLocalGroupBy(groupBy);
  }, [groupBy]);

  useEffect(() => {
    setLocalSort(messageSort);
  }, [messageSort]);

  useEffect(() => {
    setLocalThreadDateSource(threadDateSource);
  }, [threadDateSource]);

  const scheduleCommit = (ref: React.MutableRefObject<number | null>, fn: () => void) => {
    if (ref.current) window.cancelAnimationFrame(ref.current);
    ref.current = window.requestAnimationFrame(() => {
      ref.current = null;
      startTransition(fn);
    });
  };

  const handleViewChange = (next: MessageViewMode) => {
    setLocalView(next);
    scheduleCommit(viewFrameRef, () => setMessageView(next));
  };

  const handleGroupChange = (next: MessageListGroupBy) => {
    setLocalGroupBy(next);
    scheduleCommit(groupFrameRef, () => setGroupBy(next));
  };

  const handleSortChange = (next: MessageListSortBy) => {
    setLocalSort(next);
    scheduleCommit(sortFrameRef, () => setMessageSort(next));
  };

  const handleThreadDateSourceChange = (next: ThreadDateSource) => {
    setLocalThreadDateSource(next);
    scheduleCommit(threadDateFrameRef, () => setThreadDateSource(next));
  };

  const handleThreadsModeChange = (next: ThreadsMode) => {
    if (!threadsAllowed) return;
    startTransition(() => setThreadsMode(next));
  };

  const handleToggleGroups = () => {
    startTransition(() => toggleAllGroups());
  };

  // "349 of 10,848" reads as a count on its own; a bare "349" needs the noun.
  const countLabel =
    totalMessages !== null
      ? `${countFormat.format(loadedMessageCount)} of ${countFormat.format(totalMessages)}`
      : countFormat.format(loadedMessageCount);
  const countNoun = (totalMessages ?? loadedMessageCount) === 1 ? "message" : "messages";
  const loadingPrefix = listLoading ? "Loading… " : "";
  const countText = `${loadingPrefix}${totalMessages !== null ? countLabel : `${countLabel} ${countNoun}`}`;
  const countTitle = `${loadingPrefix}${countLabel} ${countNoun} loaded`;

  const currentView = VIEW_OPTIONS.find((option) => option.value === localView) ?? VIEW_OPTIONS[0];
  const CurrentViewIcon = currentView.icon;

  // Size ordering is a flat ranking of the whole mailbox, so grouping, the
  // thread-date choice and threads have nothing to act on.
  const groupingDisabled = isFlatMessageListSort(localSort);
  const effectiveGroupBy = groupingDisabled ? "none" : localGroupBy;
  const isGrouped = effectiveGroupBy !== "none";
  const showThreadDate = isThreadDateSensitiveGroupBy(effectiveGroupBy);
  const groupOptions = GROUP_OPTIONS.filter(
    ({ value }) =>
      (value !== "event" || eventGroupingAvailable) && (value !== "folder" || searchScope === "all")
  );
  const currentSort = SORT_OPTIONS.find((option) => option.value === localSort) ?? SORT_OPTIONS[0];
  const currentGroup =
    GROUP_OPTIONS.find((option) => option.value === effectiveGroupBy) ?? GROUP_OPTIONS[0];
  const sortTriggerLabel = isGrouped
    ? currentGroup.shortLabel ?? currentGroup.label
    : currentSort.label;
  const threadsUnavailableReason = threadsAllowed
    ? undefined
    : groupingDisabled
      ? "Off while sorting by size"
      : !isThreadDateSensitiveGroupBy(effectiveGroupBy)
        ? "Requires Date, Week or Year grouping"
        : "Not available in this folder";
  const threadsHint =
    threadsUnavailableReason ??
    (threadsScopeAvailable ? undefined : "Scoped views are inactive while searching everywhere");
  const threadsOptions: ReadonlyArray<MenuOption<ThreadsMode>> = [
    { value: "off", label: "Off" },
    { value: "on", label: "On" },
    { value: "scope", label: "On in scoped views", disabled: !threadsScopeAvailable }
  ];
  // Disabled menu items are skipped by keyboard focus, so the reasons shown in
  // the menu would never be announced; the trigger name carries the full state.
  const threadsState = !threadsAllowed
    ? "threads off"
    : threadsMode === "off"
      ? "threads off"
      : threadsMode === "on"
        ? "threads on"
        : "threads on in scoped views";
  const sortTooltip = `Sort & group: ${currentSort.label}${
    groupingDisabled
      ? ", grouping and threads off while sorting by size"
      : `${isGrouped ? `, grouped by ${currentGroup.label}` : ", not grouped"}, ${threadsState}`
  }`;

  const hasExpandedGroup = groupedMessages.some(
    (group) => !(collapsedGroups[group.key] ?? group.variant === "topic-suggestions")
  );
  // "None" grouping and size sort still render collapsible sections (All,
  // Flagged, Done, topic suggestions), so visibility follows the rendered groups.
  const hasToggleableGroup = groupedMessages.some(
    (group) => group.items.length > 0 || group.allowToggleWhenEmpty
  );

  return (
    <div className={styles.header}>
      <div className={styles.meta}>
        <span className={styles.count} title={countTitle}>
          {countText}
        </span>
        {hasMoreMessages && !loadingMessages && (
          <TooltipIconButton
            size="1"
            variant="ghost"
            color="gray"
            className={styles.iconButton}
            onClick={() => setMessagesPage((prev) => prev + 1)}
            tooltip="Load more"
          >
            <RefreshCw size={14} />
          </TooltipIconButton>
        )}
      </div>
      <div className={styles.actions}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarMenuTrigger
              tooltip={`View: ${currentView.label}`}
              icon={<CurrentViewIcon size={14} />}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.viewMenu}>
            <MenuRadioSection
              label="View"
              value={localView}
              options={VIEW_OPTIONS}
              onValueChange={handleViewChange}
            />
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarMenuTrigger
              tooltip={sortTooltip}
              icon={<ArrowDownWideNarrow size={14} />}
              label={listWidth >= SORT_LABEL_MIN_LIST_WIDTH ? sortTriggerLabel : undefined}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.sortMenu}>
            <MenuRadioSection
              label="Sort by"
              value={localSort}
              options={SORT_OPTIONS}
              onValueChange={handleSortChange}
            />
            <DropdownMenuSeparator />
            <MenuRadioSection
              label="Group by"
              hint={groupingDisabled ? "Off while sorting by size" : undefined}
              value={effectiveGroupBy}
              options={groupOptions}
              disabled={groupingDisabled}
              onValueChange={handleGroupChange}
            />
            {showThreadDate && (
              <>
                <DropdownMenuSeparator />
                <MenuRadioSection
                  label="Thread date"
                  value={localThreadDateSource}
                  options={THREAD_DATE_OPTIONS}
                  onValueChange={handleThreadDateSourceChange}
                />
              </>
            )}
            <DropdownMenuSeparator />
            <MenuRadioSection
              label="Threads"
              hint={threadsHint}
              value={threadsAllowed ? threadsMode : "off"}
              options={threadsOptions}
              disabled={!threadsAllowed}
              onValueChange={handleThreadsModeChange}
            />
          </DropdownMenuContent>
        </DropdownMenu>
        {hasToggleableGroup && (
          <TooltipIconButton
            size="1"
            variant="ghost"
            color="gray"
            className={styles.iconButton}
            onClick={handleToggleGroups}
            tooltip={hasExpandedGroup ? "Collapse all groups" : "Expand all groups"}
          >
            {hasExpandedGroup ? <ListChevronsDownUp size={14} /> : <ListChevronsUpDown size={14} />}
          </TooltipIconButton>
        )}
      </div>
    </div>
  );
}
