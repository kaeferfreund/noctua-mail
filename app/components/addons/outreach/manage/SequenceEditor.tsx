"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Pause, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import type { Sequence, SequenceInput, SequenceReport, SequenceStatus } from "@/lib/addons/outreach/types";
import { useOutreachManage, useResource, useUnsavedChanges } from "./manageContext";
import { ConfirmDialog, ErrorNote, Field, LoadingNote, SectionHeader, SequenceStatusBadge, StatsFigures, nativeControlClass, useOutreachFormat } from "./ui";
import { ContentFields, hasContent } from "./HtmlContent";
import { LabeledSwitch, SenderSelect, TrackingSwitches } from "./SendingFields";

/** A step while it is edited: `key` identifies it in the UI, `id` only once the server stored it. */
type StepForm = { key: string; id?: string; delayMinutes: number; name: string; subject: string; previewText: string; templateId: string | null; html: string; text: string; enabled: boolean };
type Form = { name: string; triggerListId: string | null; senderIdentityId: string | null; trackOpens: boolean; trackClicks: boolean; steps: StepForm[] };

const DELAY_UNITS = [
  { unit: "days", minutes: 1440 },
  { unit: "hours", minutes: 60 },
  { unit: "minutes", minutes: 1 }
] as const;
type DelayUnit = (typeof DELAY_UNITS)[number]["unit"];

/** The largest unit that expresses the delay exactly: 4320 → 3 days, 90 → 90 minutes. */
export function splitDelay(delayMinutes: number): { amount: number; unit: DelayUnit } {
  const match = DELAY_UNITS.find(entry => delayMinutes > 0 && delayMinutes % entry.minutes === 0) ?? DELAY_UNITS[2];
  return { amount: delayMinutes / match.minutes, unit: match.unit };
}

function unitMinutes(unit: DelayUnit) {
  return DELAY_UNITS.find(entry => entry.unit === unit)!.minutes;
}

let stepCounter = 0;
const newStepKey = () => `new:${++stepCounter}`;

function formOf(sequence: Sequence | null): Form {
  if (!sequence) return { name: "", triggerListId: null, senderIdentityId: null, trackOpens: true, trackClicks: true, steps: [] };
  return {
    name: sequence.name, triggerListId: sequence.triggerListId, senderIdentityId: sequence.senderIdentityId,
    trackOpens: sequence.trackOpens, trackClicks: sequence.trackClicks,
    steps: [...sequence.steps].sort((a, b) => a.position - b.position).map(step => ({
      key: step.id, id: step.id, delayMinutes: step.delayMinutes, name: step.name, subject: step.subject, previewText: step.previewText,
      templateId: step.templateId, html: step.html, text: step.text, enabled: step.enabled
    }))
  };
}

/** Compares what the server would store; the UI keys of new steps do not count. */
function comparable(form: Form) {
  return JSON.stringify({ ...form, steps: form.steps.map(({ key: _key, ...step }) => step) });
}

function inputOf(form: Form): SequenceInput {
  return {
    name: form.name.trim(), triggerListId: form.triggerListId, senderIdentityId: form.senderIdentityId,
    trackOpens: form.trackOpens, trackClicks: form.trackClicks,
    steps: form.steps.map(({ key: _key, ...step }) => step)
  };
}

export default function SequenceEditor({ sequence }: { sequence: Sequence | null }) {
  const t = useTranslations("outreach");
  const { api, canEdit, navigate, lists } = useOutreachManage();
  const [current, setCurrent] = useState(sequence);
  const [saved, setSaved] = useState(() => formOf(sequence));
  const [form, setForm] = useState(saved);
  const [open, setOpen] = useState<string | null>(() => saved.steps[0]?.key ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<SequenceStatus | "delete" | null>(null);
  /** Bumped by every save and status change, so the report shows the stored state. */
  const [reportVersion, setReportVersion] = useState(0);
  const dirty = comparable(form) !== comparable(saved);
  const markClean = useUnsavedChanges(`sequence:${current?.id ?? "new"}`, canEdit && dirty);
  const readOnly = !canEdit;
  const { ensure: ensureLists } = lists;
  useEffect(() => { ensureLists(); }, [ensureLists]);

  const persist = async (): Promise<Sequence> => {
    const sent = form;
    const result = current
      ? await api.send<{ sequence: Sequence }>("PATCH", `sequences/${encodeURIComponent(current.id)}`, inputOf(sent))
      : await api.send<{ sequence: Sequence }>("POST", "sequences", inputOf(sent));
    const stored = formOf(result.sequence);
    // The server keeps the step order; keeping the UI keys keeps the open step open.
    const next = { ...stored, steps: stored.steps.map((step, index) => ({ ...step, key: sent.steps[index]?.key ?? step.key })) };
    setCurrent(result.sequence); setSaved(next);
    // Input typed while the request ran stays and remains unsaved; new steps learn their ids.
    setForm(previous => previous === sent ? next : {
      ...previous,
      steps: previous.steps.map(step => step.id ? step : { ...step, id: next.steps.find(entry => entry.key === step.key)?.id })
    });
    setReportVersion(version => version + 1);
    return result.sequence;
  };
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key); setError(null); setNotice(null);
    try { await action(); } catch (caught) { setError(caught); }
    finally { setBusy(null); }
  };
  const save = () => run("save", async () => {
    const stored = await persist();
    setNotice(t("sequences.saved"));
    if (!current) { markClean(); navigate({ section: "sequences", id: stored.id }); }
  });
  const setStatus = (status: "live" | "paused") => run("status", async () => {
    // Pausing stops sending first; unsaved edits stay in the form and are saved separately.
    const stored = status === "paused" && current ? current : dirty || !current ? await persist() : current;
    const result = await api.send<{ sequence: Sequence }>("POST", `sequences/${encodeURIComponent(stored.id)}/status`, { status });
    setCurrent(result.sequence);
    setReportVersion(version => version + 1);
    setDialog(null);
    setNotice(status === "live" ? t("sequences.nowLive") : t("sequences.nowPaused"));
    if (!current) { markClean(); navigate({ section: "sequences", id: stored.id }); }
  });
  const remove = () => run("delete", async () => {
    if (current) await api.send("DELETE", `sequences/${encodeURIComponent(current.id)}`);
    markClean();
    navigate({ section: "sequences" });
  });

  const updateStep = (key: string, patch: Partial<StepForm>) =>
    setForm(previous => ({ ...previous, steps: previous.steps.map(step => step.key === key ? { ...step, ...patch } : step) }));
  const moveStep = (index: number, offset: -1 | 1) => setForm(previous => {
    const steps = [...previous.steps];
    const [step] = steps.splice(index, 1);
    steps.splice(index + offset, 0, step);
    return { ...previous, steps };
  });
  const removeStep = (key: string) => setForm(previous => ({ ...previous, steps: previous.steps.filter(step => step.key !== key) }));
  const addStep = () => {
    const key = newStepKey();
    setForm(previous => ({
      ...previous,
      steps: [...previous.steps, { key, delayMinutes: previous.steps.length === 0 ? 0 : 1440, name: "", subject: "", previewText: "", templateId: null, html: "", text: "", enabled: true }]
    }));
    setOpen(key);
  };

  const status = current?.status ?? "draft";
  const triggerList = lists.data?.find(list => list.id === form.triggerListId) ?? null;
  const enabledSteps = form.steps.filter(step => step.enabled).length;
  const incomplete = form.steps.some(step => step.enabled && (!step.subject.trim() || !hasContent(step)));
  const canGoLive = Boolean(form.name.trim() && form.triggerListId && enabledSteps > 0 && !incomplete);

  return (
    <>
      <SectionHeader title={current ? current.name || t("sequences.untitled") : t("sequences.newTitle")}
        description={readOnly ? t("sequences.readOnly") : t("sequences.editorDescription")}
        onBack={() => navigate({ section: "sequences" })}
        actions={<>
          <SequenceStatusBadge status={status} />
          {canEdit ? <>
            {current && status === "draft" ? <Button variant="ghost" disabled={busy !== null} onClick={() => setDialog("delete")}><Trash2 />{t("sequences.delete")}</Button> : null}
            <Button variant="outline" disabled={busy !== null || !form.name.trim() || (!dirty && Boolean(current))} onClick={() => void save()}>
              {busy === "save" ? t("actions.working") : t("actions.save")}
            </Button>
            {status === "live"
              ? <Button variant="outline" disabled={busy !== null} onClick={() => { setError(null); setDialog("paused"); }}><Pause />{t("sequences.pause")}</Button>
              : <Button disabled={busy !== null || !canGoLive} onClick={() => { setError(null); setDialog("live"); }}><Play />{status === "paused" ? t("sequences.resume") : t("sequences.goLive")}</Button>}
          </> : null}
        </>} />
      <ErrorNote error={dialog ? null : error} />
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      {status === "live" && canEdit ? <p className="text-xs text-muted-foreground">{t("sequences.liveEditHint")}</p> : null}
      {canEdit && !canGoLive && status !== "live" ? <p className="text-xs text-muted-foreground">{t("sequences.goLiveNeeds")}</p> : null}

      <section aria-label={t("sequences.settings")} className="grid grid-cols-1 gap-4 rounded-lg border p-4 md:grid-cols-2">
        <Field label={t("sequences.name")}>
          <input required readOnly={readOnly} className={nativeControlClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label={t("sequences.trigger")} hint={t("sequences.triggerHint")}>
          <select className={nativeControlClass} disabled={readOnly || status !== "draft"} value={form.triggerListId ?? ""} onChange={event => setForm({ ...form, triggerListId: event.target.value || null })}>
            <option value="">{t("sequences.chooseTrigger")}</option>
            {(lists.data ?? []).filter(list => !list.archivedAt || list.id === form.triggerListId).map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
        </Field>
        <SenderSelect value={form.senderIdentityId} disabled={readOnly} onChange={senderIdentityId => setForm({ ...form, senderIdentityId })} />
        <TrackingSwitches trackOpens={form.trackOpens} trackClicks={form.trackClicks} disabled={readOnly} onChange={value => setForm({ ...form, ...value })} />
      </section>

      <section aria-labelledby="sequence-steps" className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 id="sequence-steps" className="flex-1 font-medium">{t("sequences.steps")}</h3>
          {canEdit ? <Button variant="outline" size="sm" onClick={addStep}><Plus />{t("sequences.addStep")}</Button> : null}
        </div>
        {form.steps.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{canEdit ? t("sequences.noSteps") : t("sequences.noStepsReadOnly")}</p> : null}
        <ol className="flex flex-col gap-2">
          {form.steps.map((step, index) => (
            <StepCard key={step.key} step={step} index={index} count={form.steps.length} open={open === step.key} readOnly={readOnly}
              onToggle={() => setOpen(value => value === step.key ? null : step.key)}
              onChange={patch => updateStep(step.key, patch)}
              onMove={offset => moveStep(index, offset)} onRemove={() => removeStep(step.key)} />
          ))}
        </ol>
      </section>

      {current && status !== "draft" ? <SequenceReportPanel sequenceId={current.id} version={reportVersion} /> : null}

      {dialog === "live" ? (
        <ConfirmDialog title={status === "paused" ? t("sequences.resumeTitle") : t("sequences.goLiveTitle")}
          description={status === "paused"
            ? t("sequences.resumeDescription")
            : t("sequences.goLiveDescription", { list: triggerList?.name ?? "–", steps: enabledSteps })}
          confirmLabel={status === "paused" ? t("sequences.resume") : t("sequences.goLive")}
          busy={busy === "status"} error={error} onCancel={() => { setDialog(null); setError(null); }} onConfirm={() => void setStatus("live")}>
          {dirty ? <p className="text-xs text-muted-foreground">{t("campaigns.savesFirst")}</p> : null}
        </ConfirmDialog>
      ) : null}
      {dialog === "paused" ? (
        <ConfirmDialog title={t("sequences.pauseTitle")}
          description={t("sequences.pauseDescription", { list: triggerList?.name ?? "–" })}
          confirmLabel={t("sequences.pause")} busy={busy === "status"} error={error}
          onCancel={() => { setDialog(null); setError(null); }} onConfirm={() => void setStatus("paused")} />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog title={t("sequences.deleteTitle")} description={t("sequences.deleteDescription", { name: form.name || t("sequences.untitled") })}
          confirmLabel={t("sequences.delete")} destructive busy={busy === "delete"} error={error}
          onCancel={() => { setDialog(null); setError(null); }} onConfirm={() => void remove()} />
      ) : null}
    </>
  );
}

function StepCard({ step, index, count, open, readOnly, onToggle, onChange, onMove, onRemove }: {
  step: StepForm; index: number; count: number; open: boolean; readOnly: boolean;
  onToggle: () => void; onChange: (patch: Partial<StepForm>) => void; onMove: (offset: -1 | 1) => void; onRemove: () => void;
}) {
  const t = useTranslations("outreach");
  const delay = splitDelay(step.delayMinutes);
  // The chosen unit stays while the amount is 0 or not a whole multiple of a larger unit.
  const [unit, setUnit] = useState<DelayUnit>(delay.unit);
  const amount = step.delayMinutes / unitMinutes(unit);
  const delayLabel = step.delayMinutes === 0
    ? (index === 0 ? t("sequences.delay.immediately") : t("sequences.delay.together"))
    : t(`sequences.delay.after.${delay.unit}`, { count: delay.amount });
  const title = step.name || step.subject || t("sequences.untitledStep");
  return (
    <li className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <button type="button" onClick={onToggle} aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11">
          {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{t("sequences.stepTitle", { number: index + 1, title })}</span>
            <span className="text-xs text-muted-foreground">{delayLabel}</span>
          </span>
        </button>
        {!step.enabled ? <Badge variant="outline">{t("sequences.stepOff")}</Badge> : null}
        {!readOnly ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" className="max-md:size-11" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t("sequences.moveUp", { number: index + 1 })}><ArrowUp /></Button>
            <Button variant="ghost" size="icon-sm" className="max-md:size-11" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={t("sequences.moveDown", { number: index + 1 })}><ArrowDown /></Button>
            <Button variant="ghost" size="icon-sm" className="max-md:size-11" onClick={onRemove} aria-label={t("sequences.removeStep", { number: index + 1 })}><Trash2 /></Button>
          </div>
        ) : null}
      </div>
      {open ? (
        <div className="flex flex-col gap-3 border-t p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={t("sequences.stepName")}>
              <input readOnly={readOnly} className={nativeControlClass} value={step.name} onChange={event => onChange({ name: event.target.value })} />
            </Field>
            <Field label={index === 0 ? t("sequences.delay.firstLabel") : t("sequences.delay.label")}>
              <div className="flex gap-2">
                <input type="number" min={0} step={1} readOnly={readOnly} className={nativeControlClass} value={amount}
                  aria-label={t("sequences.delay.amount")}
                  onChange={event => onChange({ delayMinutes: Math.max(0, Math.round(Number(event.target.value) || 0)) * unitMinutes(unit) })} />
                <select className={nativeControlClass} disabled={readOnly} value={unit} aria-label={t("sequences.delay.unit")}
                  onChange={event => {
                    const next = event.target.value as DelayUnit;
                    setUnit(next);
                    onChange({ delayMinutes: Math.round(amount) * unitMinutes(next) });
                  }}>
                  {DELAY_UNITS.map(entry => <option key={entry.unit} value={entry.unit}>{t(`sequences.delay.units.${entry.unit}`)}</option>)}
                </select>
              </div>
            </Field>
            <div className="flex items-end">
              <LabeledSwitch label={t("sequences.stepEnabled")} checked={step.enabled} disabled={readOnly} onChange={enabled => onChange({ enabled })} />
            </div>
          </div>
          <ContentFields idPrefix={`step-${step.key}`} readOnly={readOnly}
            value={{ subject: step.subject, previewText: step.previewText, templateId: step.templateId, html: step.html, text: step.text }}
            onChange={content => onChange(content)} />
        </div>
      ) : null}
    </li>
  );
}

function SequenceReportPanel({ sequenceId, version }: { sequenceId: string; version: number }) {
  const t = useTranslations("outreach");
  const { api } = useOutreachManage();
  const format = useOutreachFormat();
  const report = useResource(() => api.get<SequenceReport>(`sequences/${encodeURIComponent(sequenceId)}/report`), [api, sequenceId, version]);
  const data = report.data;
  return (
    <section aria-labelledby="sequence-report" className="flex flex-col gap-3">
      <h3 id="sequence-report" className="font-medium">{t("sequences.reportTitle")}</h3>
      <ErrorNote error={report.error} onRetry={() => void report.reload()} />
      {!data && report.loading ? <LoadingNote /> : null}
      {data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t("sequences.enrollments", { active: format.number(data.enrollments.active), completed: format.number(data.enrollments.completed), cancelled: format.number(data.enrollments.cancelled) })}
          </p>
          {[...data.steps].sort((a, b) => a.position - b.position).map((step, index) => (
            <div key={step.stepId} className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">{t("sequences.stepTitle", { number: index + 1, title: step.name || t("sequences.untitledStep") })}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{t("sequences.stepSent", { sent: format.number(step.stats.sent) })}</span>
              </p>
              <StatsFigures stats={step.stats} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t("report.ratesNote")}</p>
        </>
      ) : null}
    </section>
  );
}
