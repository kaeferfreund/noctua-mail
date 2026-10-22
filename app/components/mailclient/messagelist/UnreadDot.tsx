import styles from "./MessageListCommon.module.css";

type UnreadDotProps = {
  seen: boolean;
};

// Status only: read state is toggled from the row menu, the bulk menu and the
// r/u shortcuts, so a click here falls through to the row. Read rows keep an
// empty slot of the same size so the leading column does not shift.
export default function UnreadDot({ seen }: UnreadDotProps) {
  if (seen) {
    return <span data-unread-dot="" className={styles.unreadDotSlot} aria-hidden="true" />;
  }
  return (
    <span
      data-unread-dot=""
      className={`${styles.unreadDotSlot} ${styles.unreadDot}`}
      role="img"
      aria-label="Unread"
    />
  );
}
