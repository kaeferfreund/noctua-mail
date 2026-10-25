"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Button } from "@radix-ui/themes";
import { Clock, TriangleAlert } from "lucide-react";
import type { Message } from "@/lib/data";
import type { ScheduledSendView } from "@/lib/scheduledSendView";
import { formatScheduledSendTime } from "@/lib/scheduleSendTime";
import { badgeColors } from "@/lib/ui/badgeColors";
import badgeStyles from "../message/MessageBadge.module.css";
import styles from "./ScheduledSend.module.css";

export type ScheduledSendControls = {
  /** Open, sending and failed schedules of the active mailbox, by draft row id. */
  byDraftId: ReadonlyMap<string, ScheduledSendView>;
  unschedule: (schedule: ScheduledSendView) => Promise<void>;
  sendNow: (message: Message, schedule: ScheduledSendView) => Promise<void>;
};

const ScheduledSendContext = createContext<ScheduledSendControls | null>(null);

export function ScheduledSendProvider({ value, children }: { value: ScheduledSendControls; children: ReactNode }) {
  return <ScheduledSendContext.Provider value={value}>{children}</ScheduledSendContext.Provider>;
}

/** A schedule belongs to the draft only: the Sent copy shares the Message-ID-derived row id. */
export function useDraftSchedule(message: Pick<Message, "id" | "draft">) {
  const controls = useContext(ScheduledSendContext);
  return message.draft ? controls?.byDraftId.get(message.id) : undefined;
}

const KNOWN_REASONS = new Set(["send_failed", "smtp_rejected", "send_uncertain", "interrupted", "draft_invalid"]);
function useReasonText() {
  const t = useTranslations("Compose.schedule");
  return (schedule: ScheduledSendView) =>
    t(`reasons.${(KNOWN_REASONS.has(schedule.lastError ?? "") ? schedule.lastError : "unknown") as "unknown"}`);
}

/** „Geplant · 25. Okt., 08:00“ in the drafts list; red „Fehlgeschlagen“ after the last attempt failed. */
export function ScheduledSendBadge({ message }: { message: Pick<Message, "id" | "draft"> }) {
  const t = useTranslations("Compose.schedule");
  const locale = useLocale();
  const reason = useReasonText();
  const schedule = useDraftSchedule(message);
  if (!schedule) return null;
  const time = formatScheduledSendTime(schedule.sendAt, locale);
  if (schedule.status === "failed") {
    const title = t("badgeFailedTitle", { time, reason: reason(schedule) });
    return (
      <Badge size="1" variant="soft" color="red" className={badgeStyles.badge} title={title} aria-label={title} data-scheduled-send="failed">
        <TriangleAlert size={12} aria-hidden="true" />
        {t("badgeFailed")}
      </Badge>
    );
  }
  const label = t("badge", { time });
  return (
    <Badge size="1" variant="soft" color={badgeColors.compose} className={badgeStyles.badge} title={label} data-scheduled-send={schedule.status}>
      <Clock size={12} aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** Bar on an opened scheduled draft: „Jetzt senden“ / „Planung aufheben“. */
export function ScheduledSendBar({ message }: { message: Message }) {
  const t = useTranslations("Compose.schedule");
  const locale = useLocale();
  const reason = useReasonText();
  const controls = useContext(ScheduledSendContext);
  const schedule = useDraftSchedule(message);
  const [busy, setBusy] = useState(false);
  if (!controls || !schedule) return null;
  const time = formatScheduledSendTime(schedule.sendAt, locale);
  const sending = schedule.status === "sending";
  const failed = schedule.status === "failed";
  const run = (action: () => Promise<void>) => { setBusy(true); void action().finally(() => setBusy(false)); };
  return (
    <div className={`${styles.bar} ${failed ? styles.barFailed : ""}`} role={failed ? "alert" : "status"} data-scheduled-send-bar={schedule.status}>
      <span className={styles.barText}>
        {failed ? <TriangleAlert size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
        {sending ? t("barSending") : failed ? t("barFailed", { time, reason: reason(schedule) }) : t("barScheduled", { time })}
      </span>
      {!sending && (
        <span className={styles.barActions}>
          <Button size="1" variant="soft" disabled={busy} onClick={() => run(() => controls.sendNow(message, schedule))}>{t("sendNow")}</Button>
          <Button size="1" variant="soft" color="gray" disabled={busy} onClick={() => run(() => controls.unschedule(schedule))}>{t("unschedule")}</Button>
        </span>
      )}
    </div>
  );
}
