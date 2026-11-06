import { useTranslations } from "next-intl";
import { Button, Card, Text } from "@radix-ui/themes";
import { Archive, FileText, Inbox, Send, ShieldOff, Trash2, X } from "lucide-react";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import { DOMAIN_FOLDER_ROLES, type DomainFolderRole } from "@/lib/domainView";
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
  domain: string;
  role: DomainFolderRole;
  mailboxCount: number;
  onRoleChange: (role: DomainFolderRole) => void;
  onClose: () => void;
};

/** Heading of the domain view: which domain, which folder, and the way back. */
export default function DomainViewBar({ domain, role, mailboxCount, onRoleChange, onClose }: DomainViewBarProps) {
  const t = useTranslations("Domain");
  return (
    <Card size="1" className={styles.bar} data-domain-view-bar="">
      <div className={styles.heading}>
        <Text size="2" weight="bold" className={styles.title} title={domain}>{domain}</Text>
        <Text size="1" color="gray" className={styles.title}>
          {t("allMailboxes")} · {t("mailboxCount", { count: mailboxCount })}
        </Text>
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
      </div>
      <div className={styles.roles} role="group" aria-label={t("folderSwitch")}>
        {DOMAIN_FOLDER_ROLES.map((value) => {
          const Icon = ROLE_ICONS[value];
          const active = value === role;
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
    </Card>
  );
}
