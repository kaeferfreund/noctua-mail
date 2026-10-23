import { useTranslations } from "next-intl";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import type React from "react";
import {
  ArrowDownWideNarrow,
  ListChevronsDownUp,
  ListChevronsUpDown,
  MessagesSquare,
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
import { Separator } from "@/app/components/ui/separator";
import ToolbarButton from "@/app/components/ToolbarButton";
import type { MessageGroup } from "./listModel";
import type { MessageListGroupBy, MessageViewMode, ThreadsMode } from "./messageListViewTypes";
import styles from "./MessageListHeader.module.css";

/**
 * The message list's toolbar, rendered in the shell header next to the folder
 * title: count, view menu, sort & group menu and expand/collapse all. The
 * header is a `@container/header`, so the count, the sort label, the
 * separator and the menu chevrons drop out when it gets narrow; phones keep
 * only the two menus. Older pages load when the list scrolls to its end.
 */
export type MessageListHeaderProps = {
  state: {
    searchScope: "folder" | "all";
    loadedMessageCount: number;
    totalMessages: number | null;
    listLoading: boolean;
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
  const t = useTranslations("List");
  const VIEW_OPTIONS: ReadonlyArray<MenuOption<MessageViewMode> & { icon: LucideIcon }> = [
    { value: "threads", label: t("threads"), icon: MessagesSquare },
    { value: "compact", label: t("compact"), icon: Rows3 },
    { value: "card", label: t("cards"), icon: StretchHorizontal },
    { value: "table", label: t("table"), icon: Table2 }
  ];

  const SORT_OPTIONS: ReadonlyArray<MenuOption<MessageListSortBy>> = [
    { value: "date", label: t("date") },
    { value: "size", label: t("size") }
  ];

  const GROUP_OPTIONS: ReadonlyArray<MenuOption<MessageListGroupBy> & { shortLabel?: string }> = [
    { value: "date", label: t("date") },
    { value: "week", label: t("week") },
    { value: "sender", label: t("sender") },
    { value: "domain", label: t("senderDomain"), shortLabel: t("domain") },
    { value: "year", label: t("year") },
    { value: "event", label: t("event") },
    { value: "folder", label: t("folder") },
    { value: "none", label: t("none") }
  ];

  const THREAD_DATE_OPTIONS: ReadonlyArray<MenuOption<ThreadDateSource>> = [
    { value: "latestReceivedDateValue", label: t("received") },
    { value: "latestDateValue", label: t("lastActivity") }
  ];

  const {
    searchScope,
    loadedMessageCount,
    totalMessages,
    listLoading,
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
  const countParams = {
    count: loadedMessageCount, total: totalMessages ?? loadedMessageCount,
    totalKnown: totalMessages !== null ? "yes" : "no", loading: listLoading ? "yes" : "no"
  };
  const countText = t("messageCount", countParams);
  const countTitle = t("messageCountLoaded", countParams);

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
      ? t("sizeSortDisabled")
      : !isThreadDateSensitiveGroupBy(effectiveGroupBy)
        ? t("dateGroupingRequired")
        : t("folderUnavailable");
  const threadsHint =
    threadsUnavailableReason ??
    (threadsScopeAvailable ? undefined : t("scopeSearchDisabled"));
  const threadsOptions: ReadonlyArray<MenuOption<ThreadsMode>> = [
    { value: "off", label: t("off") },
    { value: "on", label: t("on") },
    { value: "scope", label: t("onScoped"), disabled: !threadsScopeAvailable }
  ];
  // Disabled menu items are skipped by keyboard focus, so the reasons shown in
  // the menu would never be announced; the trigger name carries the full state.
  const threadsState = !threadsAllowed
    ? t("threadsOff")
    : threadsMode === "off"
      ? t("threadsOff")
      : threadsMode === "on"
        ? t("threadsOn")
        : t("threadsScoped");
  const sortTooltip = t("sortDescription", {
    sort: currentSort.label, group: currentGroup.label,
    grouping: groupingDisabled ? "disabled" : isGrouped ? "grouped" : "none", threads: threadsState
  });

  const hasExpandedGroup = groupedMessages.some(
    (group) => !(collapsedGroups[group.key] ?? group.variant === "topic-suggestions")
  );
  // "None" grouping and size sort still render collapsible sections (All,
  // Flagged, Done, topic suggestions), so visibility follows the rendered groups.
  const hasToggleableGroup = groupedMessages.some(
    (group) => group.items.length > 0 || group.allowToggleWhenEmpty
  );

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span
        className="ml-1 hidden whitespace-nowrap text-xs text-muted-foreground tabular-nums @4xl/header:inline"
        title={countTitle}
      >
        {countText}
      </span>
      <Separator orientation="vertical" className="mx-1 hidden @3xl/header:block data-[orientation=vertical]:h-4" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarButton
            menu
            tooltip={t("viewDescription", { view: currentView.label })}
            icon={<CurrentViewIcon className="size-4" />}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={styles.viewMenu}>
          <MenuRadioSection
            label={t("view")}
            value={localView}
            options={VIEW_OPTIONS}
            onValueChange={handleViewChange}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarButton
            menu
            tooltip={sortTooltip}
            icon={<ArrowDownWideNarrow className="size-4" />}
            label={sortTriggerLabel}
            labelClassName="hidden @3xl/header:inline-block"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={styles.sortMenu}>
          <MenuRadioSection
            label={t("sortBy")}
            value={localSort}
            options={SORT_OPTIONS}
            onValueChange={handleSortChange}
          />
          <DropdownMenuSeparator />
          <MenuRadioSection
            label={t("groupBy")}
            hint={groupingDisabled ? t("sizeSortDisabled") : undefined}
            value={effectiveGroupBy}
            options={groupOptions}
            disabled={groupingDisabled}
            onValueChange={handleGroupChange}
          />
          {showThreadDate && (
            <>
              <DropdownMenuSeparator />
              <MenuRadioSection
                label={t("threadDate")}
                value={localThreadDateSource}
                options={THREAD_DATE_OPTIONS}
                onValueChange={handleThreadDateSourceChange}
              />
            </>
          )}
          <DropdownMenuSeparator />
          <MenuRadioSection
            label={t("threads")}
            hint={threadsHint}
            value={threadsAllowed ? threadsMode : "off"}
            options={threadsOptions}
            disabled={!threadsAllowed}
            onValueChange={handleThreadsModeChange}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {hasToggleableGroup && (
        <ToolbarButton
          tooltip={hasExpandedGroup ? t("collapseGroups") : t("expandGroups")}
          icon={
            hasExpandedGroup ? (
              <ListChevronsDownUp className="size-4" />
            ) : (
              <ListChevronsUpDown className="size-4" />
            )
          }
          className="hidden md:inline-flex"
          onClick={handleToggleGroups}
        />
      )}
    </div>
  );
}
