import { useTranslations } from "next-intl";
import { Badge } from "@radix-ui/themes";
import { AtSign } from "lucide-react";
import { badgeColors } from "@/lib/ui/badgeColors";
import styles from "../folder/FolderBadges.module.css";

type MailboxBadgeProps = {
  /** Short mailbox name shown on the badge. */
  label: string;
  /** Full mailbox address for the tooltip. */
  email: string;
  /** Opens the message in its own mailbox; without it the badge is static. */
  onOpen?: () => void;
};

/**
 * Marks a message that lives in another mailbox of the domain (a conversation
 * merged across mailboxes, or a row of the domain view).
 */
export default function MailboxBadge({ label, email, onOpen }: MailboxBadgeProps) {
  const t = useTranslations("Domain");
  const title = onOpen ? t("openInMailbox", { mailbox: email }) : t("mailbox", { mailbox: email });
  const content = (
    <>
      <AtSign size={12} aria-hidden="true" />
      <span className={styles.badgeLabel}>{label}</span>
    </>
  );
  return (
    <Badge size="1" variant="soft" color={badgeColors.mailbox} asChild data-mailbox-badge="">
      {onOpen ? (
        <button
          type="button"
          title={title}
          aria-label={title}
          className={styles.badgeButton}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {content}
        </button>
      ) : (
        <span title={title} className={styles.badgeButton}>{content}</span>
      )}
    </Badge>
  );
}
