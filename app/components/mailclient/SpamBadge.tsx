"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button } from "@radix-ui/themes";
import { ShieldAlert } from "lucide-react";
import type { Message } from "@/lib/data";
import { badgeColors } from "@/lib/ui/badgeColors";
import badgeStyles from "./message/MessageBadge.module.css";

type SpamMarked = Pick<Message, "spamVerdict" | "spamReasons">;

export function isSuspicious(message: SpamMarked) {
  return message.spamVerdict === "spam";
}

/** "Verdächtig" mark of the spam detector; the reasons are in the tooltip. */
export default function SpamBadge({ message, showText = true }: { message: SpamMarked; showText?: boolean }) {
  const t = useTranslations("Reader.spam");
  if (!isSuspicious(message)) return null;
  const reasons = (message.spamReasons ?? []).filter(Boolean);
  const title = reasons.length ? t("titleWithReasons", { reasons: reasons.join(" · ") }) : t("title");
  return (
    <Badge size="1" variant="soft" color={badgeColors.suspicious} className={badgeStyles.badge} title={title} aria-label={title} data-spam-badge="">
      <ShieldAlert size={12} aria-hidden="true" />
      {showText ? t("badge") : null}
    </Badge>
  );
}

type SpamCorrection = { canCorrect: boolean; markNotSuspicious: (message: Message) => Promise<void> };
const SpamCorrectionContext = createContext<SpamCorrection | null>(null);

export function SpamCorrectionProvider({ value, children }: { value: SpamCorrection; children: ReactNode }) {
  return <SpamCorrectionContext.Provider value={value}>{children}</SpamCorrectionContext.Provider>;
}

/** Reader action next to the badge: removes the mark and teaches "Kein Spam" (manager+). */
export function SpamCorrectionButton({ message }: { message: Message }) {
  const t = useTranslations("Reader.spam");
  const correction = useContext(SpamCorrectionContext);
  const [busy, setBusy] = useState(false);
  if (!correction?.canCorrect || !isSuspicious(message)) return null;
  return (
    <Button size="1" variant="soft" color="gray" disabled={busy} title={t("notSuspiciousTitle")}
      onClick={() => { setBusy(true); void correction.markNotSuspicious(message).finally(() => setBusy(false)); }}>
      {t("notSuspicious")}
    </Button>
  );
}
