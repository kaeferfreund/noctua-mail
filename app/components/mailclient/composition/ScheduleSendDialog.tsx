"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/app/components/ui/dialog";
import { DialogLayerContext, DIALOG_LAYERS } from "@/app/components/ui/dialogLayers";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import { nativeControlBaseClass } from "@/app/components/account-settings/Field";
import { useIsMobile } from "@/app/hooks/use-mobile";
import {
  SCHEDULED_SEND_MIN_AHEAD_MS, browserTimeZone, computeSchedulePresets, customTimeOptions, formatLocalDate, formatScheduledSendTime, localDateOf,
  parseLocalDate, resolveCustomTime, type SchedulePresetKind
} from "@/lib/scheduleSendTime";
import styles from "./ScheduleSendDialog.module.css";

type ScheduleSendDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves true when the send was scheduled (the dialog then closes). */
  onSchedule: (sendAt: number) => Promise<boolean>;
  existingSendAt?: number;
  now?: () => number;
  timeZone?: string;
};

type Selection = SchedulePresetKind | "custom";
type CustomError = "invalid" | "past" | "nonexistent" | "tooSoon" | null;

/** „Senden planen“: presets in the browser's zone plus a custom date and quarter-hour time. */
export default function ScheduleSendDialog({ open, onOpenChange, ...props }: ScheduleSendDialogProps) {
  const isMobile = useIsMobile();
  const t = useTranslations("Compose.schedule");
  // Remount per opening so presets and the custom default start from the current clock.
  const body = open ? <ScheduleSendForm {...props} onCancel={() => onOpenChange(false)} /> : null;
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" aria-describedby={undefined} className={`${styles.sheet} z-(--layer-dialog-overlay)`}>
          <SheetTitle className={styles.title}>{t("title")}</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    // One step above the compose modal, which shares the base dialog layer.
    <DialogLayerContext.Provider value={DIALOG_LAYERS.base}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined} className={styles.dialog}>
          <DialogTitle className={styles.title}>{t("title")}</DialogTitle>
          {body}
        </DialogContent>
      </Dialog>
    </DialogLayerContext.Provider>
  );
}

function ScheduleSendForm({ onSchedule, onCancel, existingSendAt, now: clock = Date.now, timeZone: zone }: Omit<ScheduleSendDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const t = useTranslations("Compose.schedule");
  const locale = useLocale();
  const timeZone = zone ?? browserTimeZone();
  const [openedAt] = useState(clock);
  const presets = computeSchedulePresets(openedAt, timeZone);
  const today = formatLocalDate(localDateOf(openedAt, timeZone));
  const [selection, setSelection] = useState<Selection>(presets[0].kind);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(() => customTimeOptions(localDateOf(openedAt, timeZone), openedAt, timeZone)[0]?.value ?? "");
  const [error, setError] = useState<CustomError>(null);
  const [submitting, setSubmitting] = useState(false);
  const errorId = useId();
  const name = useId();
  const parsedDate = parseLocalDate(date);
  const timeOptions = parsedDate ? customTimeOptions(parsedDate, clock(), timeZone) : [];
  const customSelected = selection === "custom";
  const pastDate = Boolean(parsedDate) && date < today;
  const format = (sendAt: number) => formatScheduledSendTime(sendAt, locale, timeZone);

  const chooseCustom = (nextDate: string, nextTime: string) => {
    setSelection("custom");
    setError(null);
    setDate(nextDate);
    setTime(nextTime);
  };
  const changeDate = (nextDate: string) => {
    const parsed = parseLocalDate(nextDate);
    const options = parsed ? customTimeOptions(parsed, clock(), timeZone) : [];
    // Keep the chosen time when it exists on the new day, otherwise take its first valid time.
    chooseCustom(nextDate, options.some(option => option.value === time) ? time : options[0]?.value ?? "");
  };

  const submit = async () => {
    const now = clock();
    let sendAt: number;
    if (customSelected) {
      if (parsedDate && date < formatLocalDate(localDateOf(now, timeZone))) { setError("past"); return; }
      const resolved = resolveCustomTime(date, time, now, timeZone);
      if (!resolved.ok) { setError(resolved.reason); return; }
      sendAt = resolved.sendAt;
    } else {
      // Presets come from the opening clock; one that has passed since then is recomputed.
      sendAt = computeSchedulePresets(now, timeZone).find(preset => preset.kind === selection)?.sendAt
        ?? presets.find(preset => preset.kind === selection)!.sendAt;
      if (sendAt <= now) { setError("past"); return; }
    }
    if (sendAt < now + SCHEDULED_SEND_MIN_AHEAD_MS) { setError("tooSoon"); return; }
    setSubmitting(true);
    try {
      if (await onSchedule(sendAt)) onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  const row = (kind: Selection, label: string, trailing: ReactNode) => (
    <label key={kind} className={styles.option} data-schedule-option={kind}>
      <input type="radio" name={name} value={kind} checked={selection === kind} className={styles.radio}
        onChange={() => { setSelection(kind); setError(null); }} />
      <span className={styles.optionLabel}>{label}</span>
      {trailing}
    </label>
  );

  return (
    // noValidate: the inline error replaces the browser's min/required bubbles.
    <form className={styles.form} noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
      {existingSendAt !== undefined && <p className={styles.hint} role="status">{t("existing", { time: format(existingSendAt) })}</p>}
      <div className={styles.options} role="radiogroup" aria-label={t("title")}>
        {presets.map(preset => row(preset.kind, t(`presets.${preset.kind}`),
          <span className={styles.optionTime}>{format(preset.sendAt)}</span>))}
      </div>
      <hr className={styles.divider} />
      <div className={styles.customRow}>
        {row("custom", t("custom"), null)}
        <div className={styles.customControls}>
          <input type="date" aria-label={t("dateLabel")} value={date} min={today} required
            className={`${nativeControlBaseClass} ${styles.control} ${customSelected && error && (pastDate || !parsedDate) ? styles.controlInvalid : ""}`}
            aria-invalid={customSelected && error && (pastDate || !parsedDate) ? true : undefined}
            onFocus={() => setSelection("custom")} onChange={event => changeDate(event.target.value)} />
          <select aria-label={t("timeLabel")} value={time} disabled={!timeOptions.length}
            className={`${nativeControlBaseClass} ${styles.control} ${customSelected && error ? styles.controlInvalid : ""}`}
            aria-invalid={customSelected && error ? true : undefined} aria-describedby={customSelected && error ? errorId : undefined}
            onFocus={() => setSelection("custom")} onChange={event => chooseCustom(date, event.target.value)}>
            {!timeOptions.some(option => option.value === time) && <option value={time}>{time || t("timePlaceholder")}</option>}
            {timeOptions.map(option => <option key={option.value} value={option.value}>{option.value}</option>)}
          </select>
        </div>
      </div>
      {customSelected && !timeOptions.length && parsedDate && !pastDate && !error && <p className={styles.hint}>{t("errors.noTimes")}</p>}
      {error && <p id={errorId} role="alert" className={styles.error}>{t(`errors.${error}`)}</p>}
      <div className={styles.footer}>
        <Button type="button" variant="secondary" className={styles.footerButton} onClick={onCancel} disabled={submitting}>{t("cancel")}</Button>
        <Button type="submit" className={styles.footerButton} disabled={submitting}>{submitting ? t("submitting") : t("submit")}</Button>
      </div>
    </form>
  );
}
