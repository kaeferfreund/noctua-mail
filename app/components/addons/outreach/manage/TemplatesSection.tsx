"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Archive, Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { EmailTemplate, EmailTemplateInput } from "@/lib/addons/outreach/types";
import { useOutreachManage, useResource, useUnsavedChanges } from "./manageContext";
import { ConfirmDialog, EmptyState, ErrorNote, Field, LoadingNote, RowButton, SectionHeader, nativeControlClass, useOutreachFormat } from "./ui";
import { HtmlPreview, HtmlSourceEditor } from "./HtmlContent";

export default function TemplatesSection({ id }: { id: string | null }) {
  if (id) return <TemplateEditorLoader key={id} templateId={id} />;
  return <TemplateList />;
}

function TemplateList() {
  const t = useTranslations("outreach");
  const { canEdit, navigate, templates } = useOutreachManage();
  const format = useOutreachFormat();
  const { ensure, reload } = templates;
  // Always fresh when the list opens: an editor may have changed names or archived one.
  useEffect(() => { ensure(); void reload(); }, [ensure, reload]);
  const active = (templates.data ?? []).filter(template => !template.archivedAt);
  const create = () => navigate({ section: "templates", id: "new" });
  return (
    <>
      <SectionHeader title={t("templates.title")} description={t("templates.description")}
        actions={canEdit ? <Button onClick={create}><Plus />{t("templates.new")}</Button> : undefined} />
      <ErrorNote error={templates.error} onRetry={() => void templates.reload()} />
      {!templates.data && templates.loading ? <LoadingNote /> : null}
      {templates.data && active.length === 0 ? (
        <EmptyState title={t("templates.emptyTitle")} text={canEdit ? t("templates.emptyText") : t("templates.emptyTextReadOnly")}
          action={canEdit ? <Button onClick={create}><Plus />{t("templates.new")}</Button> : undefined} />
      ) : null}
      {active.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {active.map(template => (
            <li key={template.id}>
              <RowButton onClick={() => navigate({ section: "templates", id: template.id })}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{template.name}</span>
                  {template.subject ? <span className="truncate text-xs text-muted-foreground">{template.subject}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{t("templates.updated", { date: format.date(template.updatedAt) })}</span>
              </RowButton>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

const EMPTY_TEMPLATE: Required<EmailTemplateInput> = { name: "", subject: "", previewText: "", html: "", text: "" };

function TemplateEditorLoader({ templateId }: { templateId: string }) {
  const t = useTranslations("outreach");
  const { api, navigate } = useOutreachManage();
  const isNew = templateId === "new";
  const loaded = useResource(
    () => isNew ? Promise.resolve(null) : api.get<{ template: EmailTemplate }>(`templates/${encodeURIComponent(templateId)}`).then(body => body.template),
    [api, templateId, isNew]
  );
  const back = () => navigate({ section: "templates" });
  if (!isNew && !loaded.data) {
    return (
      <>
        <SectionHeader title={t("templates.editTitle")} onBack={back} />
        <ErrorNote error={loaded.error} onRetry={() => void loaded.reload()} />
        {loaded.loading ? <LoadingNote /> : null}
      </>
    );
  }
  return <TemplateEditor template={loaded.data ?? null} onBack={back} />;
}

function TemplateEditor({ template, onBack }: { template: EmailTemplate | null; onBack: () => void }) {
  const t = useTranslations("outreach");
  const { api, canEdit, navigate, templates } = useOutreachManage();
  const initial = template ? { name: template.name, subject: template.subject, previewText: template.previewText, html: template.html, text: template.text } : EMPTY_TEMPLATE;
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const dirty = (Object.keys(form) as Array<keyof typeof form>).some(key => form[key] !== saved[key]);
  const markClean = useUnsavedChanges(`template:${template?.id ?? "new"}`, canEdit && dirty);
  const readOnly = !canEdit;

  const save = async () => {
    setBusy(true); setError(null); setNotice(false);
    try {
      const sent = form;
      const body = { ...sent, name: sent.name.trim() };
      const result = template
        ? await api.send<{ template: EmailTemplate }>("PATCH", `templates/${encodeURIComponent(template.id)}`, body)
        : await api.send<{ template: EmailTemplate }>("POST", "templates", body);
      const next = { name: result.template.name, subject: result.template.subject, previewText: result.template.previewText, html: result.template.html, text: result.template.text };
      setSaved(next); setNotice(true);
      // Input typed while the request ran stays and remains unsaved.
      setForm(previous => previous === sent ? next : previous);
      void templates.reload();
      if (!template) { markClean(); navigate({ section: "templates", id: result.template.id }); }
    } catch (caught) { setError(caught); }
    finally { setBusy(false); }
  };
  const archive = async () => {
    if (!template) return;
    setBusy(true); setError(null);
    try {
      await api.send("DELETE", `templates/${encodeURIComponent(template.id)}`);
      markClean();
      void templates.reload();
      navigate({ section: "templates" });
    } catch (caught) { setError(caught); setBusy(false); }
  };

  return (
    <>
      <SectionHeader title={template ? template.name || t("templates.untitled") : t("templates.newTitle")} onBack={onBack}
        actions={canEdit ? <>
          {template ? <Button variant="ghost" disabled={busy} onClick={() => setArchiving(true)}><Archive />{t("templates.archive")}</Button> : null}
          <Button disabled={busy || !form.name.trim() || (!dirty && Boolean(template))} onClick={() => void save()}>{busy ? t("actions.working") : t("actions.save")}</Button>
        </> : undefined} />
      <ErrorNote error={error} />
      {notice ? <p role="status" className="text-sm text-muted-foreground">{t("templates.saved")}</p> : null}
      {dirty && canEdit ? <p className="text-xs text-muted-foreground">{t("unsaved.hint")}</p> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={t("templates.name")}>
          <input required readOnly={readOnly} className={nativeControlClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label={t("content.subject")}>
          <input readOnly={readOnly} className={nativeControlClass} value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} />
        </Field>
        <Field label={t("content.previewText")} hint={t("content.previewTextHint")}>
          <input readOnly={readOnly} className={nativeControlClass} value={form.previewText} onChange={event => setForm({ ...form, previewText: event.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HtmlSourceEditor label={t("content.html")} value={form.html} readOnly={readOnly} onChange={html => setForm({ ...form, html })} />
        <HtmlPreview subject={form.subject} html={form.html} text={form.text} />
      </div>
      <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium">{t("templates.textVersion")}</summary>
        <p className="my-2 text-xs text-muted-foreground">{t("templates.textVersionHint")}</p>
        <textarea aria-label={t("templates.textVersion")} readOnly={readOnly} value={form.text} onChange={event => setForm({ ...form, text: event.target.value })}
          className={`${nativeControlClass} h-40 font-mono text-xs`} />
      </details>
      {archiving && template ? (
        <ConfirmDialog title={t("templates.archiveTitle")} description={t("templates.archiveDescription", { name: template.name })}
          confirmLabel={t("templates.archive")} destructive busy={busy} error={error}
          onCancel={() => setArchiving(false)} onConfirm={() => void archive()} />
      ) : null}
    </>
  );
}
