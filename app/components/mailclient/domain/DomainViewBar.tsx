import { useTranslations } from "next-intl";
import { Button, Card } from "@radix-ui/themes";
import { Archive, FileText, Inbox, Send, ShieldOff, Trash2, X } from "lucide-react";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import type { DomainFolderRole } from "@/lib/domainView";
import styles from "./DomainViewBar.module.css";

const ROLE_ICONS: Record<DomainFolderRole, typeof Inbox> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  archive: Archive,
  trash: Trash2,
  spam: ShieldOff
};

type DomainViewBarProps = {
  /** Folder roles offered, in display order. */
  roles: readonly DomainFolderRole[];
  /** The role whose folder is open, or null when none of them is. */
  activeRole: DomainFolderRole | null;
  onRoleChange: (role: DomainFolderRole) => void;
  /** Domain view only: the way back to the single mailbox. */
  onClose?: () => void;
};

/**
 * One row of special-folder buttons above the message list: in a single mailbox
 * and in the domain view (there with the close button at the row's end).
 */
export default function DomainViewBar({ roles, activeRole, onRoleChange, onClose }: DomainViewBarProps) {
  const t = useTranslations("Domain");
  return (
    <Card size="1" className={styles.bar} data-domain-view-bar={onClose ? "domain" : "mailbox"}>
      <div className={styles.roles} role="group" aria-label={t(onClose ? "folderSwitch" : "folderSwitchMailbox")}>
        {roles.map((value) => {
          const Icon = ROLE_ICONS[value];
          const active = value === activeRole;
          return (
            <Button
              key={value}
              size="1"
              variant={active ? "soft" : "ghost"}
              color={active ? undefined : "gray"}
              className={styles.role}
              aria-pressed={active}
              data-domain-role={value}
              onClick={() => { if (!active) onRoleChange(value); }}
            >
              <Icon size={12} aria-hidden="true" />
              {t(`roles.${value}`)}
            </Button>
          );
        })}
      </div>
      {onClose ? (
        <TooltipIconButton
          size="1"
          variant="ghost"
          color="gray"
          className={styles.close}
          tooltip={t("close")}
          aria-label={t("close")}
          onClick={onClose}
        >
          <X size={12} />
        </TooltipIconButton>
      ) : null}
    </Card>
  );
}
