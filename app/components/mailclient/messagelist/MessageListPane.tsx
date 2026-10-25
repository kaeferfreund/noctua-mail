import { useTranslations } from "next-intl";
import type React from "react";
import { ArrowDown, RefreshCw } from "lucide-react";
import { usePullToRefresh } from "./usePullToRefresh";
import styles from "./MessageListPane.module.css";

type MessageListPaneProps = {
  refs: {
    listPaneRef: React.RefObject<HTMLDivElement | null>;
  };
  /** Phone only: pulling the list down from its top runs this sync. */
  onPullRefresh?: () => Promise<unknown>;
  children: React.ReactNode;
};

/**
 * Scroll container of the message list. It fills the resizable panel it is
 * rendered in; MailClient measures its width with a ResizeObserver on
 * `listPaneRef` to drive the narrow-list modes.
 */
export default function MessageListPane({ refs, onPullRefresh, children }: MessageListPaneProps) {
  const t = useTranslations("List");
  const { listPaneRef } = refs;
  const pull = usePullToRefresh(listPaneRef, onPullRefresh);

  return (
    <aside
      tabIndex={-1}
      className={styles.pane}
      ref={listPaneRef}
      data-pull-state={onPullRefresh ? pull.state : undefined}
      aria-busy={pull.state === "refreshing" || undefined}
      style={pull.offset ? { "--pull-offset": `${pull.offset}px` } as React.CSSProperties : undefined}
    >
      {onPullRefresh ? (
        <div className={styles.pullIndicator} data-pull-indicator="">
          <span className={styles.pullIcon}>
            {pull.state === "refreshing" ? <RefreshCw size={18} aria-hidden /> : <ArrowDown size={18} aria-hidden />}
          </span>
          <span role="status" className={styles.pullLabel}>
            {pull.state === "refreshing" ? t("refreshingMailbox")
              : pull.state === "armed" ? t("releaseToRefresh")
                : pull.state === "pulling" ? t("pullToRefresh") : ""}
          </span>
        </div>
      ) : null}
      {children}
    </aside>
  );
}
