import { useTranslations } from "next-intl";
import type React from "react";
import { CalendarDays, Flag, Sparkles, Square, SquareCheckBig } from "lucide-react";
import { Badge } from "@radix-ui/themes";
import { getFlagBadgeColor } from "@/lib/ui/badgeColors";
import styles from "./MessageBadge.module.css";

export type MessageBadgeKind = "flagged" | "todo" | "done" | "calendar" | "ai-modified";

export type MessageBadgeProps = {
  kind: MessageBadgeKind;
  showLabel?: boolean;
  onClick?: (event: React.MouseEvent) => void;
};

export default function MessageBadge({ kind, showLabel = false, onClick }: MessageBadgeProps) {
  const t = useTranslations("Reader");
  const badgeConfig: Record<
    MessageBadgeKind,
    { icon: React.ElementType; label: string; title: string }
  > = {
    flagged: { icon: Flag, label: t("flagged"), title: t("unflagMessage") },
    todo: { icon: Square, label: t("todo"), title: t("markDone") },
    done: { icon: SquareCheckBig, label: t("done"), title: t("markTodo") },
    calendar: { icon: CalendarDays, label: t("calendarInviteBadge"), title: t("calendarInviteBadge") },
    "ai-modified": { icon: Sparkles, label: t("aiModified"), title: t("modifiedMcp") }
  };

  const config = badgeConfig[kind];
  const Icon = config.icon;

  if (onClick) {
    return (
      <Badge
        size="1"
        variant="soft"
        color={getFlagBadgeColor(kind)}
        className={styles.badge}
        asChild
      >
        <button
          type="button"
          className={styles.flagBadgeButton}
          title={config.title}
          aria-label={config.title}
          onClick={(event) => {
            event.stopPropagation();
            onClick(event);
          }}
        >
          <Icon size={12} />
          {showLabel && config.label}
        </button>
      </Badge>
    );
  }

  return (
    <Badge
      size="1"
      variant="soft"
      color={getFlagBadgeColor(kind)}
      className={styles.badge}
      title={config.title}
    >
      <Icon size={12} />
      {showLabel && config.label}
    </Badge>
  );
}
