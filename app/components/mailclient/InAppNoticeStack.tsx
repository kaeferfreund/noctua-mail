import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Mail,
  TriangleAlert,
  X,
  type LucideIcon
} from "lucide-react";
import styles from "./InAppNoticeStack.module.css";

export type InAppNoticeType = "info" | "success" | "warning" | "error";
export type InAppNoticeIcon = "mail";

export type InAppNotice = {
  id: string;
  type: InAppNoticeType;
  icon?: InAppNoticeIcon;
  title: string;
  description?: string;
  wrapDescription?: boolean;
  fullDetail?: string;
  messageId?: string;
  ids?: string[];
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  expiresAt?: number | null;
};

/**
 * "floating" is the fixed toast over the panes (and in the detached compose
 * and calendar windows); "sidebar" is the slim card docked in the sidebar
 * footer above the account card.
 */
export type InAppNoticePlacement = "floating" | "sidebar";

type InAppNoticeStackProps = {
  placement?: InAppNoticePlacement;
  className?: string;
  style?: CSSProperties;
  state: {
    inAppNotices: InAppNotice[];
  };
  actions: {
    onOpenNotice: (notice: InAppNotice) => void;
    onDismissNotice: (noticeId: string) => void;
  };
};

const ICON_BY_TYPE: Record<InAppNoticeType, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle
};
const ICON_BY_NAME: Record<InAppNoticeIcon, LucideIcon> = {
  mail: Mail
};

const DISMISS_ANIMATION_DURATION = 140; // ms
// The sidebar card must stay slim: older notices stay queued (and keep their
// timers) and surface again when a newer one is dismissed.
export const SIDEBAR_NOTICE_LIMIT = 2;

const CLASS_NAMES = {
  floating: {
    stack: "inapp-notice-stack",
    notice: "inapp-notice",
    icon: "notice-icon",
    text: "notice-text",
    title: "notice-title",
    description: "notice-description",
    descriptionWrap: "notice-description-wrap",
    controls: "notice-controls",
    action: "notice-action",
    dismiss: "icon-button ghost notice-dismiss"
  },
  sidebar: {
    stack: styles.sidebarStack,
    notice: styles.sidebarNotice,
    icon: styles.icon,
    text: styles.text,
    title: styles.title,
    description: styles.description,
    descriptionWrap: styles.descriptionWrap,
    controls: styles.controls,
    action: styles.action,
    dismiss: styles.dismiss
  }
} satisfies Record<InAppNoticePlacement, Record<string, string>>;

export default function InAppNoticeStack({
  placement = "floating",
  className,
  style,
  state,
  actions
}: InAppNoticeStackProps) {
  const { inAppNotices } = state;
  const { onOpenNotice, onDismissNotice } = actions;
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const dismissingIdsRef = useRef<Set<string>>(new Set());
  const dismissAnimationTimersRef = useRef<Map<string, number>>(new Map());

  const handleDismiss = useCallback((noticeId: string) => {
    if (dismissingIdsRef.current.has(noticeId)) return;
    const nextDismissingIds = new Set(dismissingIdsRef.current);
    nextDismissingIds.add(noticeId);
    dismissingIdsRef.current = nextDismissingIds;
    setDismissingIds(nextDismissingIds);

    const timer = window.setTimeout(() => {
      onDismissNotice(noticeId);
      dismissAnimationTimersRef.current.delete(noticeId);
      const next = new Set(dismissingIdsRef.current);
      next.delete(noticeId);
      dismissingIdsRef.current = next;
      setDismissingIds(next);
    }, DISMISS_ANIMATION_DURATION);

    dismissAnimationTimersRef.current.set(noticeId, timer);
  }, [onDismissNotice]);

  useEffect(() => {
    const expireTimers = inAppNotices
      .filter((notice) => typeof notice.expiresAt === "number")
      .map((notice) =>
        window.setTimeout(() => {
          handleDismiss(notice.id);
        }, Math.max(0, (notice.expiresAt as number) - Date.now()))
      );
    return () => {
      expireTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [handleDismiss, inAppNotices]);

  useEffect(() => {
    const timersRef = dismissAnimationTimersRef;
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const runNoticeAction = async (notice: InAppNotice) => {
    if (!notice.onAction) return;
    try {
      await notice.onAction();
    } finally {
      handleDismiss(notice.id);
    }
  };

  const docked = placement === "sidebar";
  const classNames = CLASS_NAMES[placement];
  const visibleNotices = docked ? inAppNotices.slice(-SIDEBAR_NOTICE_LIMIT) : inAppNotices;

  // The live region stays mounted while empty so screen readers announce
  // notices that are added to it later.
  return (
    <div
      className={[styles.stack, classNames.stack, className].filter(Boolean).join(" ")}
      style={style}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      data-placement={placement}
    >
      {visibleNotices.map((notice) => {
        const openable =
          Boolean(notice.messageId || (notice.ids && notice.ids.length > 0)) ||
          notice.type === "error";
        const tooltip =
          notice.fullDetail && notice.fullDetail !== notice.description
            ? notice.fullDetail
            : undefined;
        const TypeIcon = notice.icon ? ICON_BY_NAME[notice.icon] : ICON_BY_TYPE[notice.type];
        const isDismissing = dismissingIds.has(notice.id);
        return (
          <div
            key={notice.id}
            className={
              docked
                ? classNames.notice
                : `inapp-notice inapp-notice-${notice.type} ${openable ? "openable" : ""} ${isDismissing ? "dismissing" : ""}`
            }
            data-tone={notice.type}
            data-openable={openable || undefined}
            data-dismissing={isDismissing || undefined}
            role={openable ? "button" : undefined}
            tabIndex={openable ? 0 : -1}
            title={tooltip}
            onClick={() => {
              if (openable) {
                onOpenNotice(notice);
              }
            }}
            onKeyDown={(event) => {
              if (!openable) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenNotice(notice);
              }
            }}
          >
            <div className={classNames.icon} aria-hidden="true">
              <TypeIcon size={14} />
            </div>
            <div className={classNames.text}>
              <strong className={classNames.title}>{notice.title}</strong>
              {notice.description ? (
                <span
                  className={
                    notice.wrapDescription
                      ? `${classNames.description} ${classNames.descriptionWrap}`
                      : classNames.description
                  }
                >
                  {notice.description}
                </span>
              ) : null}
            </div>
            <div className={classNames.controls}>
              {notice.actionLabel && notice.onAction ? (
                <button
                  type="button"
                  className={classNames.action}
                  onClick={(event) => {
                    event.stopPropagation();
                    void runNoticeAction(notice);
                  }}
                >
                  {notice.actionLabel}
                </button>
              ) : null}
              <button
                type="button"
                className={classNames.dismiss}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDismiss(notice.id);
                }}
                aria-label="Dismiss notification"
                title="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
