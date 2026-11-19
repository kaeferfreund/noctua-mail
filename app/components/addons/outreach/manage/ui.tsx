"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/app/components/ui/dialog";
import { formatDate, formatNumber, formatTime } from "@/lib/i18n/format";
import type { UiLocale } from "@/lib/i18n/config";
import type { CampaignStatus, SendStats, SequenceStatus } from "@/lib/addons/outreach/types";
import { cn } from "@/lib/utils";
import { outreachErrorKey } from "./outreachApi";
import styles from "./OutreachManage.module.css";

/** Class of the area's scoped baseline (no preflight in this app); portalled dialogs carry it too. */
export const outreachRootClass = styles.root;

export { nativeControlClass } from "@/app/components/account-settings/Field";
export { default as Field } from "@/app/components/account-settings/Field";

export function useOutreachFormat() {
  const locale = useLocale() as UiLocale;
  return {
    locale,
    number: (value: number) => formatNumber(value, locale),
    /** `part` of `whole` as a rounded percentage; empty when nothing to divide by. */
    percent: (part: number, whole: number) => whole > 0 ? formatNumber(part / whole, locale, { style: "percent", maximumFractionDigits: 1 }) : "–",
    date: (value: number) => formatDate(value, locale),
    dateTime: (value: number) => `${formatDate(value, locale)} ${formatTime(value, locale)}`
  };
}

/** A failed request as a readable sentence, never raw JSON. */
export function ErrorNote({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const t = useTranslations("outreach");
  if (!error) return null;
  const { key, detail } = outreachErrorKey(error);
  return (
    <div role="alert" className={cn("flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive", className)}>
      <span className="min-w-0 flex-1">{t(key)}{detail ? ` ${t("errors.detail", { detail })}` : ""}</span>
      {onRetry ? <Button size="sm" variant="outline" onClick={onRetry}>{t("actions.retry")}</Button> : null}
    </div>
  );
}

export function LoadingNote() {
  const t = useTranslations("outreach");
  return <p role="status" className="px-1 py-6 text-sm text-muted-foreground">{t("loading")}</p>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-6">
      <p className="font-medium">{title}</p>
      <p className="max-w-prose text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function SectionHeader({ title, description, actions, onBack }: { title: string; description?: string; actions?: ReactNode; onBack?: () => void }) {
  const t = useTranslations("outreach");
  return (
    <div className="flex flex-wrap items-start gap-3">
      {onBack ? (
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t("actions.back")} title={t("actions.back")} className="max-md:size-11">
          <ArrowLeft />
        </Button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 max-sm:basis-full max-sm:justify-end">{actions}</div> : null}
    </div>
  );
}

export function ConfirmDialog({ title, description, children, confirmLabel, destructive, busy, error, disabled, onCancel, onConfirm }: {
  title: string; description: string; children?: ReactNode; confirmLabel: string; destructive?: boolean; busy: boolean;
  error?: unknown; disabled?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const t = useTranslations("outreach");
  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onCancel(); }}>
      <DialogContent showCloseButton={!busy} className={cn(outreachRootClass, "sm:max-w-md")}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
        <ErrorNote error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>{t("actions.cancel")}</Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={busy || disabled} onClick={onConfirm}>
            {busy ? t("actions.working") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CAMPAIGN_BADGE: Record<CampaignStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline", scheduled: "secondary", sending: "default", sent: "secondary", cancelled: "outline", failed: "destructive"
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const t = useTranslations("outreach");
  return <Badge variant={CAMPAIGN_BADGE[status]}>{t(`campaigns.status.${status}`)}</Badge>;
}

export function SequenceStatusBadge({ status }: { status: SequenceStatus }) {
  const t = useTranslations("outreach");
  return <Badge variant={status === "live" ? "default" : "outline"}>{t(`sequences.status.${status}`)}</Badge>;
}

/** One figure with an optional share bar (plain CSS, no chart library). */
export function Figure({ label, value, part, whole, hint }: { label: string; value: number; part?: number; whole?: number; hint?: string }) {
  const format = useOutreachFormat();
  const share = part !== undefined && whole !== undefined && whole > 0 ? Math.min(1, part / whole) : null;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums">{format.number(value)}</span>
        {share !== null ? <span className="text-sm text-muted-foreground tabular-nums">{format.percent(part!, whole!)}</span> : null}
      </span>
      {share !== null ? (
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="block h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
        </span>
      ) : null}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** Delivered = sent minus bounced; the base for open and click rates. */
export function deliveredOf(stats: SendStats) {
  return Math.max(0, stats.sent - stats.bounced);
}

/** The five report figures shared by campaign, sequence step and overview. */
export function StatsFigures({ stats }: { stats: SendStats }) {
  const t = useTranslations("outreach");
  const format = useOutreachFormat();
  const delivered = deliveredOf(stats);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <Figure label={t("stats.delivered")} value={delivered} part={delivered} whole={stats.sent} />
      <Figure label={t("stats.opened")} value={stats.opened} part={stats.opened} whole={delivered}
        hint={stats.machineOpens > 0 ? t("stats.machineOpens", { count: stats.machineOpens, formatted: format.number(stats.machineOpens) }) : undefined} />
      <Figure label={t("stats.clicked")} value={stats.clicked} part={stats.clicked} whole={delivered} />
      <Figure label={t("stats.bounced")} value={stats.bounced} part={stats.bounced} whole={stats.sent} />
      <Figure label={t("stats.unsubscribed")} value={stats.unsubscribed} part={stats.unsubscribed} whole={delivered} />
    </div>
  );
}

/** Compact "opened / clicked" rates for list rows. */
export function useRates() {
  const t = useTranslations("outreach");
  const format = useOutreachFormat();
  return (stats: SendStats) => {
    const delivered = deliveredOf(stats);
    return t("stats.rowRates", {
      recipients: format.number(stats.recipients),
      opened: format.percent(stats.opened, delivered),
      clicked: format.percent(stats.clicked, delivered)
    });
  };
}

/** Rows of a simple list: a whole-row button on every width (keyboard and touch friendly). */
export function RowButton({ onClick, children, label }: { onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="flex w-full min-w-0 flex-col gap-1 rounded-md px-3 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11 sm:flex-row sm:items-center sm:gap-3">
      {children}
    </button>
  );
}
