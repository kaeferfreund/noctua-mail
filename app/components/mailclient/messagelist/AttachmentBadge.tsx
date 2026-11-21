import { useTranslations } from "next-intl";
import { Badge } from "@radix-ui/themes";
import { Paperclip } from "lucide-react";
import { badgeColors } from "@/lib/ui/badgeColors";
import badgeStyles from "../message/MessageBadge.module.css";

/** Paperclip of a list row whose message (or collapsed thread) has attachments. */
export default function AttachmentBadge() {
  const t = useTranslations("List");
  return (
    <Badge
      size="1"
      variant="soft"
      color={badgeColors.attachment}
      className={badgeStyles.badge}
      title={t("attachments")}
      aria-label={t("attachments")}
      data-attachment-badge=""
    >
      <Paperclip size={12} />
    </Badge>
  );
}
