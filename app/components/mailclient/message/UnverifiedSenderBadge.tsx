"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@radix-ui/themes";
import { ShieldQuestionMark } from "lucide-react";
import type { Message } from "@/lib/data";
import { badgeColors } from "@/lib/ui/badgeColors";
import badgeStyles from "./MessageBadge.module.css";

/**
 * "Nicht bestätigt" mark of an opened message: the receiving server confirmed
 * neither SPF nor DKIM for the From domain (`senderVerified === false` from the
 * detail route). Nothing for verified senders, own mail or unknown state.
 */
export default function UnverifiedSenderBadge({ message }: { message: Pick<Message, "senderVerified"> }) {
  const t = useTranslations("Reader");
  if (message.senderVerified !== false) return null;
  const title = t("unverifiedSenderTitle");
  return (
    <Badge size="1" variant="soft" color={badgeColors.unverifiedSender} className={badgeStyles.badge}
      title={title} aria-label={title} data-unverified-sender-badge="">
      <ShieldQuestionMark size={12} aria-hidden="true" />
      {t("unverifiedSenderBadge")}
    </Badge>
  );
}
