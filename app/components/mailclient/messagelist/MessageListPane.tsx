import type React from "react";
import styles from "./MessageListPane.module.css";

type MessageListPaneProps = {
  refs: {
    listPaneRef: React.RefObject<HTMLDivElement | null>;
  };
  children: React.ReactNode;
};

/**
 * Scroll container of the message list. It fills the resizable panel it is
 * rendered in; MailClient measures its width with a ResizeObserver on
 * `listPaneRef` to drive the narrow-list modes.
 */
export default function MessageListPane({ refs, children }: MessageListPaneProps) {
  const { listPaneRef } = refs;

  return (
    <aside className={styles.pane} ref={listPaneRef}>
      {children}
    </aside>
  );
}
