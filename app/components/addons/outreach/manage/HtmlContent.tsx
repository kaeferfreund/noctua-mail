"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Braces, Eye, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { TEMPLATE_PLACEHOLDERS, type Contact, type ContactListResponse, type EmailTemplate, type RenderResponse } from "@/lib/addons/outreach/types";
import { useOutreachManage } from "./manageContext";
import { ErrorNote, Field, nativeControlClass } from "./ui";

const LIVE_PREVIEW_DELAY_MS = 300;

/**
 * Foreign HTML (templates, campaign bodies) is only ever shown here: an iframe with an empty
 * `sandbox` (no scripts, no same-origin access, no forms, no top navigation) fed through `srcdoc`.
 */
export function SandboxedHtml({ html, title }: { html: string; title: string }) {
  return (
    <iframe sandbox="" srcDoc={html} title={title} referrerPolicy="no-referrer"
      className="h-[28rem] w-full rounded-md border bg-white max-md:h-80" />
  );
}

/** HTML source with an insert-placeholder menu that inserts at the cursor. */
export function HtmlSourceEditor({ label, value, onChange, readOnly }: { label: string; value: string; onChange: (value: string) => void; readOnly?: boolean }) {
  const t = useTranslations("outreach");
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<{ start: number; end: number } | null>(null);
  const remember = () => { const area = ref.current; if (area) caret.current = { start: area.selectionStart, end: area.selectionEnd }; };
  const insert = (placeholder: string) => {
    const token = `{{ ${placeholder} }}`;
    const { start, end } = caret.current ?? { start: value.length, end: value.length };
    onChange(value.slice(0, start) + token + value.slice(end));
    const next = start + token.length;
    caret.current = { start: next, end: next };
    requestAnimationFrame(() => { const area = ref.current; if (area) { area.focus(); area.setSelectionRange(next, next); } });
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-medium">{label}</span>
        {!readOnly ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Braces />{t("content.insertPlaceholder")}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-56">
              {TEMPLATE_PLACEHOLDERS.map(placeholder => (
                <DropdownMenuItem key={placeholder} onSelect={() => insert(placeholder)} className="max-md:min-h-11">
                  <span className="flex flex-col">
                    <span>{t(`placeholders.${placeholder.replace(".", "_") as "first_name"}`)}</span>
                    <code className="text-xs text-muted-foreground">{`{{ ${placeholder} }}`}</code>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <textarea ref={ref} aria-label={label} value={value} readOnly={readOnly} spellCheck={false}
        onChange={event => { onChange(event.target.value); caret.current = { start: event.target.selectionStart, end: event.target.selectionEnd }; }}
        onSelect={remember} onKeyUp={remember} onClick={remember}
        className={`${nativeControlClass} h-[28rem] resize-y font-mono text-xs leading-relaxed max-md:h-72`} />
    </div>
  );
}

/**
 * Live preview of the source as typed, and on request the server's rendering for one contact
 * (or sample data) with its warnings.
 */
export function HtmlPreview({ subject, html, text }: { subject: string; html: string; text?: string }) {
  const t = useTranslations("outreach");
  const { api } = useOutreachManage();
  const [live, setLive] = useState(html);
  const [contact, setContact] = useState<Contact | null>(null);
  // A server rendering belongs to the source it was made from; editing the source hides it.
  const source = JSON.stringify([subject, html, text ?? ""]);
  const [renderedFor, setRenderedFor] = useState<{ source: string; result: RenderResponse } | null>(null);
  const rendered = renderedFor?.source === source ? renderedFor.result : null;
  const setRendered = (result: RenderResponse | null) => setRenderedFor(result ? { source, result } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const timer = setTimeout(() => setLive(html), LIVE_PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [html]);
  const render = async () => {
    setBusy(true); setError(null);
    try {
      setRendered(await api.send<RenderResponse>("POST", "render", { subject, html, ...(text ? { text } : {}), ...(contact ? { contactId: contact.id } : {}) }));
    } catch (caught) { setError(caught); }
    finally { setBusy(false); }
  };
  return (
    <section aria-label={t("content.preview")} className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1"><ContactPicker label={t("content.previewFor")} value={contact} onChange={setContact} /></div>
        <Button variant="outline" disabled={busy || !html.trim()} onClick={() => void render()}><Eye />{busy ? t("actions.working") : t("content.render")}</Button>
      </div>
      <ErrorNote error={error} />
      {rendered ? (
        <>
          <p className="text-sm"><span className="text-muted-foreground">{t("content.renderedSubject")}</span> {rendered.subject}</p>
          {rendered.warnings.length > 0 ? (
            <ul aria-label={t("content.warnings")} className="list-disc rounded-md border border-amber-500/40 bg-amber-500/10 py-2 pr-3 pl-7 text-sm">
              {rendered.warnings.map(warning => <li key={warning}>{warning}</li>)}
            </ul>
          ) : <p className="text-xs text-muted-foreground">{t("content.noWarnings")}</p>}
          <SandboxedHtml html={rendered.html} title={t("content.renderedFrame")} />
          <div><Button variant="ghost" size="sm" onClick={() => setRendered(null)}>{t("content.backToLive")}</Button></div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t("content.liveHint")}</p>
          {live.trim() ? <SandboxedHtml html={live} title={t("content.liveFrame")} /> : <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">{t("content.emptyPreview")}</p>}
        </>
      )}
    </section>
  );
}

const PICKER_RESULTS = 8;

/** Search a contact by address or name; used for rendered previews and test sends. */
export function ContactPicker({ label, value, onChange }: { label: string; value: Contact | null; onChange: (contact: Contact | null) => void }) {
  const t = useTranslations("outreach");
  const { api } = useOutreachManage();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [found, setResults] = useState<Contact[]>([]);
  const results = query.trim() ? found : [];
  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    let active = true;
    const timer = setTimeout(() => {
      api.get<ContactListResponse>("contacts", { q: term, pageSize: PICKER_RESULTS })
        .then(body => { if (active) setResults(body.contacts); })
        .catch(() => { if (active) setResults([]); });
    }, LIVE_PREVIEW_DELAY_MS);
    return () => { active = false; clearTimeout(timer); };
  }, [api, query]);
  if (value) {
    return (
      <Field label={label}>
        <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm max-md:min-h-11">
          <span className="min-w-0 flex-1 truncate">{value.email}</span>
          <Button variant="ghost" size="icon-sm" aria-label={t("content.clearContact")} onClick={() => onChange(null)}><X /></Button>
        </div>
      </Field>
    );
  }
  return (
    <Field label={label} hint={t("content.sampleDataHint")}>
      <div className="relative">
        <input type="search" className={nativeControlClass} value={query} placeholder={t("content.searchContact")}
          aria-controls={listId} aria-expanded={results.length > 0} role="combobox" aria-autocomplete="list"
          onChange={event => setQuery(event.target.value)} />
        {results.length > 0 ? (
          <ul id={listId} role="listbox" className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
            {results.map(contact => (
              <li key={contact.id} role="option" aria-selected={false}>
                <button type="button" className="w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none max-md:min-h-11"
                  onClick={() => { onChange(contact); setQuery(""); setResults([]); }}>{contact.email}</button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}

export type ContentValue = { subject: string; previewText: string; templateId: string | null; html: string; text: string };

/**
 * Subject, preview text and body of a campaign or sequence step: either copied from a saved
 * template (and kept in sync only when chosen again) or written as own HTML.
 */
export function ContentFields({ value, onChange, readOnly, idPrefix }: { value: ContentValue; onChange: (value: ContentValue) => void; readOnly?: boolean; idPrefix: string }) {
  const t = useTranslations("outreach");
  const { api, templates } = useOutreachManage();
  const [mode, setMode] = useState<"template" | "own">(value.templateId ? "template" : "own");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { ensure } = templates;
  useEffect(() => { ensure(); }, [ensure]);
  const chooseTemplate = async (templateId: string) => {
    if (!templateId) { onChange({ ...value, templateId: null }); return; }
    setLoading(true); setError(null);
    try {
      const { template } = await api.get<{ template: EmailTemplate }>(`templates/${encodeURIComponent(templateId)}`);
      onChange({
        subject: value.subject.trim() ? value.subject : template.subject,
        previewText: value.previewText.trim() ? value.previewText : template.previewText,
        templateId: template.id, html: template.html, text: template.text
      });
    } catch (caught) { setError(caught); }
    finally { setLoading(false); }
  };
  const available = (templates.data ?? []).filter(template => !template.archivedAt || template.id === value.templateId);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t("content.subject")}>
          <input readOnly={readOnly} className={nativeControlClass} value={value.subject} onChange={event => onChange({ ...value, subject: event.target.value })} />
        </Field>
        <Field label={t("content.previewText")} hint={t("content.previewTextHint")}>
          <input readOnly={readOnly} className={nativeControlClass} value={value.previewText} onChange={event => onChange({ ...value, previewText: event.target.value })} />
        </Field>
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" disabled={readOnly}>
        <legend className="sr-only">{t("content.source")}</legend>
        <span className="font-medium">{t("content.source")}</span>
        <label className="flex items-center gap-2 max-md:min-h-11">
          <input type="radio" name={`${idPrefix}-source`} checked={mode === "template"} onChange={() => setMode("template")} />{t("content.fromTemplate")}
        </label>
        <label className="flex items-center gap-2 max-md:min-h-11">
          <input type="radio" name={`${idPrefix}-source`} checked={mode === "own"} onChange={() => { setMode("own"); onChange({ ...value, templateId: null }); }} />{t("content.ownHtml")}
        </label>
      </fieldset>
      {mode === "template" ? (
        <Field label={t("content.template")} hint={t("content.templateHint")}>
          <select className={nativeControlClass} disabled={readOnly || loading} value={value.templateId ?? ""} onChange={event => void chooseTemplate(event.target.value)}>
            <option value="">{t("content.chooseTemplate")}</option>
            {available.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </Field>
      ) : null}
      <ErrorNote error={error ?? templates.error} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {mode === "own"
          ? <HtmlSourceEditor label={t("content.html")} value={value.html} readOnly={readOnly} onChange={html => onChange({ ...value, html })} />
          : null}
        <div className={mode === "own" ? undefined : "lg:col-span-2"}>
          <HtmlPreview subject={value.subject} html={value.html} text={value.text} />
        </div>
      </div>
    </div>
  );
}
