import { useTranslations } from "next-intl";
import { Paperclip } from "lucide-react";
import badgeStyles from "../message/MessageBadge.module.css";

/** Paperclip of a list row whose message (or collapsed thread) has attachments: a bare, muted glyph, no badge box. */
export default function AttachmentBadge() {
  const t = useTranslations("List");
  return (
    <span
      role="img"
      className={badgeStyles.attachmentIcon}
      title={t("attachments")}
      aria-label={t("attachments")}
      data-attachment-badge=""
    >
      <Paperclip size={14} strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
