"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
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
  retry?: (schedule: ScheduledSendView) => Promise<void>;
  unschedule: (schedule: ScheduledSendView) => Promise<void>;
  sendNow: (message: Message, schedule: ScheduledSendView) => Promise<void>;
  /** Opens „Senden planen“ for a saved draft; absent for members who may not send. */
  schedule?: (message: Message) => void;
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

/**
 * „Senden planen“ for a saved draft without opening compose (row menu, quick actions,
 * reader). Null when the member may not send; `busy` while its schedule sends it.
 */
export function useDraftScheduleAction(message: Message) {
  const controls = useContext(ScheduledSendContext);
  const schedule = useDraftSchedule(message);
  const open = controls?.schedule;
  if (!open) return null;
  return { open: () => open(message), busy: schedule?.status === "sending" };
}

const KNOWN_REASONS = new Set(["send_failed", "smtp_rejected", "send_uncertain", "interrupted", "manual_interrupted", "draft_invalid", "security_revoked", "permission_revoked", "identity_unavailable", "draft_missing", "draft_deleted", "draft_changed", "account_missing"]);
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
  if (schedule.status === "cancelled") {
    const title = t("barCancelled", { reason: reason(schedule) });
    return <Badge size="1" variant="soft" color="gray" className={badgeStyles.badge}
      title={title} aria-label={title} data-scheduled-send="cancelled">{t("badgeCancelled")}</Badge>;
  }
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
  const cancelled = schedule.status === "cancelled";
  const run = (action: () => Promise<void>) => { setBusy(true); void action().finally(() => setBusy(false)); };
  return (
    <div className={`${styles.bar} ${failed ? styles.barFailed : ""}`} role={failed ? "alert" : "status"} data-scheduled-send-bar={schedule.status}>
      <span className={styles.barText}>
        {failed ? <TriangleAlert size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
        {sending ? t("barSending") : failed ? t("barFailed", { time, reason: reason(schedule) }) : cancelled ? t("barCancelled", { reason: reason(schedule) }) : t("barScheduled", { time })}
      </span>
      {!sending && (
        <span className={styles.barActions}>
          {!cancelled && <Button size="1" variant="soft" disabled={busy} onClick={() => run(() => controls.sendNow(message, schedule))}>{t("sendNow")}</Button>}
          {(failed || cancelled) && controls.retry && <Button size="1" variant="soft" disabled={busy}
            onClick={() => run(() => controls.retry!(schedule))}>{t("retry")}</Button>}
          <Button size="1" variant="soft" color="gray" disabled={busy} onClick={() => run(() => controls.unschedule(schedule))}>{t(failed || cancelled ? "dismiss" : "unschedule")}</Button>
        </span>
      )}
    </div>
  );
}


/** Includes entries whose draft disappeared, so a job cancellation never silently vanishes. */
export function ScheduledSendList() {
  const t = useTranslations("Compose.schedule");
  const locale = useLocale();
  const reason = useReasonText();
  const controls = useContext(ScheduledSendContext);
  const [busy, setBusy] = useState(false);
  const rows = controls ? [...controls.byDraftId.values()] : [];
  if (!controls || !rows.length) return null;
  const run = (action: () => Promise<void>) => { setBusy(true); void action().finally(() => setBusy(false)); };
  return <Popover>
    <PopoverTrigger asChild><Button size="1" variant="soft" color="gray" aria-label={t("listTitle")}>
      <Clock size={14} aria-hidden="true" /><span className="hidden sm:inline">{t("listTitle")}</span> ({rows.length})
    </Button></PopoverTrigger>
    <PopoverContent align="end" aria-label={t("listTitle")} className={styles.list}>
      <h2>{t("listTitle")}</h2>
      <ul>
        {rows.map(row => <li key={row.id}>
          <strong>{row.subject || t("untitled")}</strong>
          <span>{formatScheduledSendTime(row.sendAt, locale)}</span>
          <p>{row.status === "failed" ? t("barFailed", { time: formatScheduledSendTime(row.sendAt, locale), reason: reason(row) })
            : row.status === "cancelled" ? t("barCancelled", { reason: reason(row) })
              : row.status === "sending" ? t("barSending") : t("barScheduled", { time: formatScheduledSendTime(row.sendAt, locale) })}</p>
          {row.status !== "sending" && <div className={styles.barActions}>
            {controls.retry && <Button size="1" variant="soft" disabled={busy} onClick={() => run(() => controls.retry!(row))}>{t("retry")}</Button>}
            <Button size="1" variant="soft" color="gray" disabled={busy} onClick={() => run(() => controls.unschedule(row))}>{t(row.status === "failed" || row.status === "cancelled" ? "dismiss" : "unschedule")}</Button>
          </div>}
        </li>)}
      </ul>
    </PopoverContent>
  </Popover>;
}
