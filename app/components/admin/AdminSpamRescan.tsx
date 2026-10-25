"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/app/components/ui/button";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import type { UiLocale } from "@/lib/i18n/config";
import { formatDate, formatTime } from "@/lib/i18n/format";
import {
  SPAM_RESCAN_EVENT,
  SPAM_RESCAN_PERIODS,
  type SpamRescanItem,
  type SpamRescanJob,
  type SpamRescanPeriod,
  type SpamRescanPreview
} from "@/lib/mail/spam/rescanTypes";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";

type RescanState = { preview: SpamRescanPreview; job: SpamRescanJob | null; items: SpamRescanItem[] };
type Mailbox = { accountId: string; email: string };

const POLL_MS = 1_500;
/** Buttons stack on phones and keep a 44 px touch target there. */
const stackedActions = "flex flex-col gap-2 sm:flex-row sm:flex-wrap max-md:[&_button]:min-h-11";
const isActive = (job: SpamRescanJob | null) => job?.status === "running" || job?.status === "moving";
const movable = (item: SpamRescanItem) => item.moveStatus === null || item.moveStatus === "error";
const announce = () => window.dispatchEvent(new CustomEvent(SPAM_RESCAN_EVENT));

/** „Posteingang jetzt prüfen“ per own mailbox (doc/SPAM-DETECTION.md): one panel open at a time. */
export default function AdminSpamRescan({ apiFetch, mailboxes }: { apiFetch: AdminFetch; mailboxes: Mailbox[] }) {
  const t = useTranslations("Admin.spam.rescan");
  const [open, setOpen] = useState<string | null>(null);
  return <section className="space-y-3" aria-labelledby="spam-rescan-heading">
    <h3 id="spam-rescan-heading" className="font-medium">{t("heading")}</h3>
    <p className="max-w-2xl text-sm text-muted-foreground">{t("help")}</p>
    {mailboxes.length === 0 && <p className="text-sm">{t("noMailboxes")}</p>}
    <ul className="m-0 list-none space-y-3 p-0">
      {mailboxes.map((mailbox) => <li key={mailbox.accountId} className="space-y-3 rounded-md border p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 break-words font-medium">{mailbox.email}</span>
          {open === mailbox.accountId
            ? <Button variant="outline" className="max-md:min-h-11" onClick={() => setOpen(null)}>{t("close")}</Button>
            : <Button variant="outline" className="max-md:min-h-11" aria-label={t("openFor", { email: mailbox.email })} onClick={() => setOpen(mailbox.accountId)}>{t("open")}</Button>}
        </div>
        {open === mailbox.accountId && <SpamRescanPanel apiFetch={apiFetch} accountId={mailbox.accountId} />}
      </li>)}
    </ul>
  </section>;
}

function SpamRescanPanel({ apiFetch, accountId }: { apiFetch: AdminFetch; accountId: string }) {
  const t = useTranslations("Admin.spam.rescan");
  const tAdmin = useTranslations("Admin");
  const locale = useLocale() as UiLocale;
  const [period, setPeriod] = useState<SpamRescanPeriod>("30d");
  const [withModel, setWithModel] = useState(true);
  const [state, setState] = useState<RescanState | null>(null);
  const [setup, setSetup] = useState(false);
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const base = `/api/admin/accounts/${encodeURIComponent(accountId)}/spam-rescan`;
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async (value: SpamRescanPeriod) => {
    const data = await adminRequest<RescanState>(apiFetch, `${base}?period=${value}`);
    setState(data);
    return data;
  }, [apiFetch, base]);

  useEffect(() => {
    let active = true;
    adminRequest<RescanState>(apiFetch, `${base}?period=30d`).then((data) => { if (active) setState(data); })
      .catch((reason) => { if (active) setError(reason); });
    return () => { active = false; };
  }, [apiFetch, base]);

  // The panel opens below its mailbox: bring it into view once its content has loaded.
  const loaded = state !== null;
  useEffect(() => { if (loaded) root.current?.scrollIntoView?.({ block: "nearest" }); }, [loaded]);

  const job = state?.job ?? null;
  const running = isActive(job);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => { void load(period).catch(setError); }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [running, state, load, period]);

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await work(); } catch (reason) { setError(reason); } finally { setBusy(false); }
  };
  const choosePeriod = (value: SpamRescanPeriod) => {
    setPeriod(value);
    setWithModel(value === "30d");
    void act(() => load(value));
  };
  const preview = state?.preview;
  const modelOn = withModel && !preview?.modelBlocked && (preview?.modelLimit ?? 0) > 0;
  const start = () => act(async () => {
    await adminRequest(apiFetch, base, jsonMutation("POST", { period, withModel: modelOn, modelLimit: modelOn ? preview!.modelLimit : 0 }));
    setSetup(false); setDeselected(new Set()); announce();
    await load(period);
  });
  const cancel = () => act(async () => {
    await adminRequest(apiFetch, `${base}/cancel`, { method: "POST" });
    announce();
    await load(period);
  });
  const items = state?.items ?? [];
  const selection = items.filter((item) => movable(item) && !deselected.has(item.id)).map((item) => item.id);
  const move = () => act(async () => {
    await adminRequest(apiFetch, `${base}/move`, jsonMutation("POST", { jobId: job!.id, ids: selection }));
    announce();
    await load(period);
  });
  const toggle = (id: string, checked: boolean) => setDeselected((current) => {
    const next = new Set(current);
    if (checked) next.delete(id); else next.add(id);
    return next;
  });

  const errorText = Boolean(error) && <p role="alert" className="text-destructive">{formatAdminError(error, tAdmin, locale)}</p>;
  if (!state) return <div ref={root}>{errorText || <p role="status" className="text-sm">{tAdmin("loading")}</p>}</div>;

  if (running && job) {
    return <div ref={root} className="space-y-2" role="status" aria-live="polite">
      <p>{job.phase ? t(`phase.${job.phase}`) : t("running")}</p>
      <progress className="w-full" max={Math.max(1, job.total)} value={Math.min(job.processed, Math.max(1, job.total))} aria-label={t("running")} />
      <p className="text-sm text-muted-foreground">{t("progress", { processed: job.processed, total: job.total })}</p>
      {errorText}
      <div className={stackedActions}><Button variant="outline" disabled={busy} onClick={() => void cancel()}>{t("cancel")}</Button></div>
    </div>;
  }

  if (setup || !job || job.status === "failed") {
    return <div ref={root} className="space-y-3">
      {job?.status === "failed" && !setup && <p className="text-sm">{t("state.failed")}</p>}
      <fieldset className="m-0 min-w-0 space-y-1 border-0 p-0" disabled={busy}>
        <legend className="mb-1 text-sm font-medium">{t("period")}</legend>
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-4">
          {SPAM_RESCAN_PERIODS.map((value) => <label key={value} className="flex min-h-11 items-center gap-2 sm:min-h-0">
            <input type="radio" name={`spam-rescan-period-${accountId}`} value={value} checked={period === value} onChange={() => choosePeriod(value)} />
            {t(`periods.${value}`)}
          </label>)}
        </div>
      </fieldset>
      {preview && <>
        <p className="text-sm">{t("inboxCount", { count: preview.inboxRows })}</p>
        <label className="flex min-h-11 items-center gap-2 sm:min-h-0">
          <input type="checkbox" checked={modelOn} disabled={busy || !!preview.modelBlocked || preview.modelLimit === 0}
            onChange={(event) => setWithModel(event.target.checked)} />{t("withModel")}
        </label>
        {preview.modelBlocked
          ? <p className="text-sm text-muted-foreground">{t(`modelBlocked.${preview.modelBlocked}`)}</p>
          : modelOn && <p className="text-sm text-muted-foreground">{t("modelCount", { count: preview.modelLimit })}
            {preview.unchecked > preview.modelLimit ? ` ${t("modelCapped", { unchecked: preview.unchecked, max: preview.modelLimit })}` : ""}</p>}
        {!preview.hasJunkFolder && <p className="text-sm">{t("noJunk")}</p>}
      </>}
      {errorText}
      <div className={stackedActions}>
        <Button disabled={busy || !preview} onClick={() => void start()}>{t("start")}</Button>
        {setup && job && <Button variant="outline" disabled={busy} onClick={() => setSetup(false)}>{t("close")}</Button>}
      </div>
    </div>;
  }

  const counts = job.counts;
  const time = `${formatDate(job.createdAt, locale)} ${formatTime(job.createdAt, locale)}`;
  const notice = job.status === "cancelled" ? t(job.error === "interrupted" ? "state.interrupted" : "state.cancelled")
    : job.error === "interrupted" ? t("state.moveInterrupted") : null;
  const selectable = items.filter(movable);
  return <div ref={root} className="space-y-3">
    <p className="font-medium">{t("summary", { time, period: t(`periods.${job.period}`), items: counts.items ?? items.length })}</p>
    {notice && <p className="text-sm">{notice}</p>}
    {counts.serverFlagged !== undefined && <p className="text-sm text-muted-foreground">
      {t("serverLine", { flagged: counts.serverFlagged, kept: counts.serverFlagged - (counts.serverFlagSelected ?? 0) })}</p>}
    {job.withModel && <p className="text-sm text-muted-foreground">{counts.modelBlocked ? t(`modelBlocked.${counts.modelBlocked}`)
      : counts.classifierMarked === undefined ? t("modelSkipped")
        : t("modelLine", { checked: counts.modelChecked ?? 0, calls: counts.modelCalls ?? 0, marked: counts.classifierMarked })}</p>}
    {counts.moved !== undefined && <p className="text-sm" role="status">
      {t("moveResult", { moved: counts.moved, gone: counts.gone ?? 0, changed: counts.changed ?? 0, errors: counts.errors ?? 0 })}</p>}
    {counts.truncated && <p className="text-sm">{t("truncated")}</p>}
    {items.length === 0 ? <p className="text-sm">{t("empty")}</p> : <>
      {selectable.length > 0 && <div className={stackedActions}>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDeselected(new Set())}>{t("selectAll")}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDeselected(new Set(selectable.map((item) => item.id)))}>{t("selectNone")}</Button>
      </div>}
      <ul aria-label={t("list")} className="m-0 max-h-[50vh] list-none divide-y overflow-auto rounded-md border p-0">
        {items.map((item) => <SpamRescanRow key={item.id} item={item} locale={locale} disabled={busy}
          checked={movable(item) && !deselected.has(item.id)} onToggle={(checked) => toggle(item.id, checked)} />)}
      </ul>
    </>}
    {errorText}
    <div className={stackedActions}>
      {selectable.length > 0 && <Button disabled={busy || selection.length === 0} onClick={() => void move()}>{t("move", { count: selection.length })}</Button>}
      <Button variant="outline" disabled={busy} onClick={() => { setSetup(true); setDeselected(new Set()); void act(() => load(period)); }}>{t("again")}</Button>
    </div>
    {selectable.length > 0 && <p className="text-sm text-muted-foreground">{t("moveHelp")}</p>}
  </div>;
}

function SpamRescanRow({ item, locale, checked, disabled, onToggle }: {
  item: SpamRescanItem; locale: UiLocale; checked: boolean; disabled: boolean; onToggle: (checked: boolean) => void;
}) {
  const t = useTranslations("Admin.spam.rescan");
  const subject = item.subject || t("noSubject");
  const score = item.score === null ? null : item.stage === "server-flag" ? t("serverScore", { score: item.score }) : t("confidence", { confidence: item.score });
  return <li className="flex gap-3 p-2">
    {movable(item)
      ? <input type="checkbox" className="mt-1 size-5 shrink-0 sm:size-4" checked={checked} disabled={disabled} aria-label={t("selectItem", { subject })}
        onChange={(event) => onToggle(event.target.checked)} />
      : <span className="size-5 shrink-0 sm:size-4" aria-hidden />}
    <div className="min-w-0 flex-1 space-y-0.5 text-sm">
      <p className="break-words font-medium">{subject}</p>
      <p className="break-words text-muted-foreground">{item.from} · {formatDate(item.dateValue, locale)}</p>
      <p className="text-xs text-muted-foreground">{[t(`stage.${item.stage}`), score, ...item.reasons].filter(Boolean).join(" · ")}</p>
      {item.moveStatus && <p className="text-xs font-medium">{t(`moveStatus.${item.moveStatus}`)}</p>}
    </div>
  </li>;
}
