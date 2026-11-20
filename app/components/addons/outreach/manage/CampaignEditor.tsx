"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { Campaign, CampaignInput, CampaignScheduleResponse } from "@/lib/addons/outreach/types";
import { useOutreachManage, useUnsavedChanges } from "./manageContext";
import { ConfirmDialog, ErrorNote, Field, SectionHeader, nativeControlClass, useOutreachFormat } from "./ui";
import { ContentFields, hasContent, type ContentValue } from "./HtmlContent";
import { ListChecklist, SenderSelect, TrackingSwitches } from "./SendingFields";

type Form = Required<Pick<CampaignInput, "name" | "senderIdentityId" | "listIds" | "excludedListIds" | "trackOpens" | "trackClicks">> & ContentValue;

const NEW_CAMPAIGN: Form = {
  name: "", subject: "", previewText: "", senderIdentityId: null, templateId: null, html: "", text: "",
  listIds: [], excludedListIds: [], trackOpens: true, trackClicks: true
};

function formOf(campaign: Campaign | null): Form {
  if (!campaign) return NEW_CAMPAIGN;
  const { name, subject, previewText, senderIdentityId, templateId, html, text, listIds, excludedListIds, trackOpens, trackClicks } = campaign;
  return { name, subject, previewText, senderIdentityId, templateId, html, text, listIds, excludedListIds, trackOpens, trackClicks };
}

function sameForm(a: Form, b: Form) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** `datetime-local` value (browser time) for an epoch, rounded to the minute. */
function localInputValue(epoch: number) {
  const date = new Date(epoch);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DEFAULT_SCHEDULE_OFFSET_MS = 60 * 60 * 1000;

/** A campaign without its body, as list, schedule and report answers carry it. */
export type CampaignMeta = Omit<Campaign, "html" | "text">;

export default function CampaignEditor({ campaign, onScheduled }: { campaign: Campaign | null; onScheduled?: (campaign: CampaignMeta, recipients: number) => void }) {
  const t = useTranslations("outreach");
  const { api, canEdit, navigate, lists } = useOutreachManage();
  const format = useOutreachFormat();
  const [current, setCurrent] = useState(campaign);
  const [saved, setSaved] = useState(() => formOf(campaign));
  const [form, setForm] = useState(saved);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [dialog, setDialog] = useState<"schedule" | "delete" | null>(null);
  const [when, setWhen] = useState<"now" | "later">("now");
  /** When the send dialog opened: a later send time must lie after it. */
  const [dialogOpenedAt, setDialogOpenedAt] = useState(0);
  /** Who the campaign would reach right now, as the server counts it (consent, suppression, excluded lists). */
  const [recipientCount, setRecipientCount] = useState(0);
  /** The draft version the server counted for; scheduling is refused if the draft changed since. */
  const [countedVersion, setCountedVersion] = useState<{ updatedAt: number; contentVersion: string } | undefined>(undefined);
  const [sendAt, setSendAt] = useState(() => localInputValue(Date.now() + DEFAULT_SCHEDULE_OFFSET_MS));
  const dirty = !sameForm(form, saved);
  const markClean = useUnsavedChanges(`campaign:${current?.id ?? "new"}`, canEdit && dirty);
  const readOnly = !canEdit;
  const { ensure: ensureLists } = lists;
  useEffect(() => { ensureLists(); }, [ensureLists]);

  /** Saves pending changes; returns the stored campaign (creating it the first time). */
  const persist = async (): Promise<Campaign> => {
    const sent = form;
    const body: CampaignInput = { ...sent, name: sent.name.trim() };
    const result = current
      ? await api.send<{ campaign: Campaign }>("PATCH", `campaigns/${encodeURIComponent(current.id)}`, body)
      : await api.send<{ campaign: Campaign }>("POST", "campaigns", body);
    const next = formOf(result.campaign);
    setCurrent(result.campaign); setSaved(next);
    // Input typed while the request ran stays and remains unsaved.
    setForm(previous => previous === sent ? next : previous);
    return result.campaign;
  };
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key); setError(null); setNotice(null);
    try { await action(); } catch (caught) { setError(caught); }
    finally { setBusy(null); }
  };
  const save = () => run("save", async () => {
    const stored = await persist();
    setNotice(t("campaigns.saved"));
    if (!current) { markClean(); navigate({ section: "campaigns", id: stored.id }); }
  });
  const sendTest = () => run("test", async () => {
    const stored = dirty || !current ? await persist() : current;
    await api.send("POST", `campaigns/${encodeURIComponent(stored.id)}/test`, { to: testTo.trim() });
    setNotice(t("campaigns.testSent", { to: testTo.trim() }));
  });
  /** Saves the draft and asks the server who it would reach, so the confirmation shows the real number. */
  const openSchedule = () => run("count", async () => {
    const stored = dirty || !current ? await persist() : current;
    // Bound to the version shown here: a collaborator's later edit makes the server refuse instead of counting it.
    const result = await api.send<CampaignScheduleResponse>("POST", `campaigns/${encodeURIComponent(stored.id)}/schedule`,
      { sendAt: null, dryRun: true, expectedUpdatedAt: stored.updatedAt });
    setRecipientCount(result.recipients);
    setCountedVersion({ updatedAt: result.campaign.updatedAt, contentVersion: result.contentVersion });
    setDialogOpenedAt(Date.now());
    setDialog("schedule");
  });
  const schedule = () => run("schedule", async () => {
    const stored = dirty || !current ? await persist() : current;
    const at = when === "now" ? null : new Date(sendAt).getTime();
    const result = await api.send<CampaignScheduleResponse>("POST", `campaigns/${encodeURIComponent(stored.id)}/schedule`, { sendAt: at,
      expectedUpdatedAt: countedVersion?.updatedAt, expectedContentVersion: countedVersion?.contentVersion });
    setDialog(null);
    markClean();
    onScheduled?.(result.campaign, result.recipients);
    if (!onScheduled) navigate({ section: "campaigns", id: stored.id });
  });
  const remove = () => run("delete", async () => {
    if (current) await api.send("DELETE", `campaigns/${encodeURIComponent(current.id)}`);
    markClean();
    navigate({ section: "campaigns" });
  });

  const listById = new Map((lists.data ?? []).map(list => [list.id, list]));
  const included = form.listIds.map(id => listById.get(id)).filter(list => list !== undefined);
  const laterAt = new Date(sendAt).getTime();
  const laterInvalid = when === "later" && (!Number.isFinite(laterAt) || laterAt <= dialogOpenedAt);
  const missing = [
    !form.subject.trim() && t("campaigns.missing.subject"),
    !hasContent(form) && t("campaigns.missing.content"),
    form.listIds.length === 0 && t("campaigns.missing.lists")
  ].filter((value): value is string => Boolean(value));

  return (
    <>
      <SectionHeader title={current ? current.name || t("campaigns.untitled") : t("campaigns.newTitle")}
        description={readOnly ? t("campaigns.draftReadOnly") : t("campaigns.draftDescription")}
        onBack={() => navigate({ section: "campaigns" })}
        actions={canEdit ? <>
          {current ? <Button variant="ghost" disabled={busy !== null} onClick={() => setDialog("delete")}><Trash2 />{t("campaigns.delete")}</Button> : null}
          <Button variant="outline" disabled={busy !== null || !form.name.trim() || (!dirty && Boolean(current))} onClick={() => void save()}>
            {busy === "save" ? t("actions.working") : t("actions.save")}
          </Button>
          <Button disabled={busy !== null || !form.name.trim() || missing.length > 0} onClick={() => void openSchedule()}><Send />{busy === "count" ? t("actions.working") : t("campaigns.sendOrSchedule")}</Button>
        </> : undefined} />
      <ErrorNote error={dialog ? null : error} />
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      {canEdit && missing.length > 0 ? <p className="text-xs text-muted-foreground">{t("campaigns.missing.intro", { items: missing.join(", ") })}</p> : null}

      <section aria-label={t("campaigns.settings")} className="grid grid-cols-1 gap-4 rounded-lg border p-4 md:grid-cols-2">
        <Field label={t("campaigns.name")} hint={t("campaigns.nameHint")}>
          <input required readOnly={readOnly} className={nativeControlClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
        </Field>
        <SenderSelect value={form.senderIdentityId} disabled={readOnly} onChange={senderIdentityId => setForm({ ...form, senderIdentityId })} />
        <ListChecklist legend={t("campaigns.lists")} selected={form.listIds} disabledIds={form.excludedListIds} disabled={readOnly}
          onChange={listIds => setForm({ ...form, listIds })} />
        <ListChecklist legend={t("campaigns.excludedLists")} hint={t("campaigns.excludedHint")} selected={form.excludedListIds} disabledIds={form.listIds} disabled={readOnly}
          onChange={excludedListIds => setForm({ ...form, excludedListIds })} />
        <TrackingSwitches trackOpens={form.trackOpens} trackClicks={form.trackClicks} disabled={readOnly}
          onChange={value => setForm({ ...form, ...value })} />
      </section>

      <section aria-label={t("campaigns.content")} className="flex flex-col gap-3 rounded-lg border p-4">
        <h3 className="font-medium">{t("campaigns.content")}</h3>
        <ContentFields idPrefix="campaign" value={form} readOnly={readOnly}
          onChange={content => setForm(previous => ({ ...previous, ...content }))} />
      </section>

      {canEdit ? (
        <section aria-labelledby="campaign-test" className="flex flex-col gap-2 rounded-lg border p-4">
          <h3 id="campaign-test" className="font-medium">{t("campaigns.testTitle")}</h3>
          <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void sendTest(); }}>
            <div className="min-w-56 flex-1">
              <Field label={t("campaigns.testTo")} hint={t("campaigns.testHint")}>
                <input type="email" required className={nativeControlClass} value={testTo} onChange={event => setTestTo(event.target.value)} />
              </Field>
            </div>
            <Button type="submit" variant="outline" disabled={busy !== null || !testTo.trim() || !form.name.trim() || !hasContent(form)}>
              {busy === "test" ? t("actions.working") : t("campaigns.sendTest")}
            </Button>
          </form>
        </section>
      ) : null}

      {dialog === "schedule" ? (
        <ConfirmDialog title={t("campaigns.scheduleTitle")}
          description={t("campaigns.scheduleDescription", { count: recipientCount, formatted: format.number(recipientCount), lists: included.map(list => list.name).join(", ") })}
          confirmLabel={when === "now" ? t("campaigns.confirmSendNow") : t("campaigns.confirmSchedule")}
          busy={busy === "schedule"} error={error} disabled={laterInvalid}
          onCancel={() => { setDialog(null); setError(null); }} onConfirm={() => void schedule()}>
          <p className="text-xs text-muted-foreground">{t("campaigns.recipientsNote")}</p>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="sr-only">{t("campaigns.whenLegend")}</legend>
            <label className="flex items-center gap-2 max-md:min-h-11">
              <input type="radio" name="campaign-when" checked={when === "now"} onChange={() => setWhen("now")} />{t("campaigns.sendNow")}
            </label>
            <label className="flex items-center gap-2 max-md:min-h-11">
              <input type="radio" name="campaign-when" checked={when === "later"} onChange={() => setWhen("later")} />{t("campaigns.sendLater")}
            </label>
            {when === "later" ? (
              <input type="datetime-local" aria-label={t("campaigns.sendAt")} className={nativeControlClass} value={sendAt} onChange={event => setSendAt(event.target.value)} />
            ) : null}
            {laterInvalid ? <p className="text-xs text-destructive">{t("campaigns.sendAtPast")}</p> : null}
          </fieldset>
          {dirty ? <p className="text-xs text-muted-foreground">{t("campaigns.savesFirst")}</p> : null}
        </ConfirmDialog>
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog title={t("campaigns.deleteTitle")} description={t("campaigns.deleteDescription", { name: form.name || t("campaigns.untitled") })}
          confirmLabel={t("campaigns.delete")} destructive busy={busy === "delete"} error={error}
          onCancel={() => { setDialog(null); setError(null); }} onConfirm={() => void remove()} />
      ) : null}
    </>
  );
}
