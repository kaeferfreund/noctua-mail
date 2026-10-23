import { useTranslations } from "next-intl";
import { memo } from "react";
import type React from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageGroup } from "./listModel";
import styles from "./MessageGroupRow.module.css";

type MessageGroupRowProps = {
  group: MessageGroup;
  isCollapsed: boolean;
  top?: number;
  height: number;
  showDivider?: boolean;
  virtualItemClassName?: string;
  getGroupLabel: (group: MessageGroup) => React.ReactNode;
  onOpenChange: (open: boolean) => void;
  renderAsVirtualItem?: boolean;
};

function MessageGroupRow({
  group,
  isCollapsed,
  top = 0,
  height,
  showDivider = false,
  virtualItemClassName = "",
  getGroupLabel,
  onOpenChange,
  renderAsVirtualItem = true
}: MessageGroupRowProps) {
  const t = useTranslations("List");
  const isFlagged = group.key === "Flagged";
  const totalCount = group.count ?? group.items.length;
  const loadedCount = group.items.length;
  const isPartiallyLoaded = group.count !== undefined && loadedCount < group.count;
  const countLabel = t("groupCount", { loaded: loadedCount, total: totalCount, partial: isPartiallyLoaded ? "yes" : "no" });
  const showCount = group.showCount ?? true;
  const isEmpty = loadedCount === 0;
  const canToggle = !isEmpty || group.allowToggleWhenEmpty === true;
  const isTopicSuggestionGroup = group.variant === "topic-suggestions";

  return (
    <Collapsible.Root
      className={cn(renderAsVirtualItem && virtualItemClassName, showDivider && styles.divider)}
      style={
        renderAsVirtualItem
          ? { transform: `translateY(${top}px)`, height }
          : { height }
      }
      open={!isCollapsed}
      onOpenChange={(open) => {
        if (!canToggle) return;
        onOpenChange(open);
      }}
    >
      <Collapsible.Trigger asChild disabled={!canToggle}>
        <button
          type="button"
          className={cn(styles.header, isFlagged && styles.flagged)}
          data-topic-suggestion-group={isTopicSuggestionGroup ? "true" : undefined}
        >
          <span className={styles.chevron} aria-hidden="true">
            {canToggle && <ChevronRight size={14} strokeWidth={2} />}
          </span>
          <span className={styles.label}>{getGroupLabel(group)}</span>
          {/* The flex layout drops the space visually; it keeps the
              accessible name "Today 3" instead of "Today3". */}
          {showCount && (
            <>
              {" "}
              <span className={styles.count} title={group.countIsLoaded ? t("loadedGroupCount", { count: loadedCount }) : undefined}>{countLabel}</span>
            </>
          )}
        </button>
      </Collapsible.Trigger>
    </Collapsible.Root>
  );
}

export default memo(MessageGroupRow);
