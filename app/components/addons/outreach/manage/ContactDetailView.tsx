"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import type { ContactDetail, SuppressionReason, TrackingEvent, TrackingEventsResponse } from "@/lib/addons/outreach/types";
import { AdminApiError } from "./outreachApi";
import { useOutreachManage, usePagedResource, useResource, useUnsavedChanges } from "./manageContext";
import { ConfirmDialog, ErrorNote, Field, Figure, LoadingNote, SectionHeader, nativeControlClass, useOutreachFormat } from "./ui";
import { contactName } from "./ContactsSection";
import SendsTable from "./SendsTable";

const EVENT_PAGE = 50;

/** The server's 409 asking for `confirmResubscribe` before a person with an unsubscribe on record is subscribed. */
export function isResubscribeConfirmation(error: unknown) {
  return error instanceof AdminApiError && error.status === 409 && error.code === "resubscribe_confirmation_required";
}

/** The unsubscribe date the server names in that 409 (`ResubscribeConfirmationRequired.unsubscribedAt`). */
export function resubscribeDate(error: unknown) {
  const value = error instanceof AdminApiError ? error.data.unsubscribedAt : null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Latest unsubscribe the contact view knows of, globally or from `listId`; null when none is shown. */
export function lastUnsubscribe(contact: ContactDetail, listId: string) {
  const member = contact.lists.find(membership => membership.listId === listId);
  const times = [contact.emailConsent === "unsubscribed" ? contact.consentAt : null, member?.status === "unsubscribed" ? member.unsubscribedAt : null]
    .filter((value): value is number => typeof value === "number");
  return times.length > 0 ? Math.max(...times) : null;
}

/** The question before re-subscribing someone who unsubscribed: names the address and, when known, the date. */
export function useResubscribeQuestion() {
  const t = useTranslations("outreach");
  const format = useOutreachFormat();
  return (email: string, unsubscribedAt: number | null) => unsubscribedAt !== null
    ? t("contacts.resubscribeDescription", { email, date: format.date(unsubscribedAt) })
    : t("contacts.resubscribeDescriptionUndated", { email });
}

type Confirm = "delete" | "suppress" | { resubscribe: string; unsubscribedAt: number | null };

export default function ContactDetailView({ contactId }: { contactId: string }) {
  const t = useTranslations("outreach");
  const { api, navigate } = useOutreachManage();
  const path = `contacts/${encodeURIComponent(contactId)}`;
  const loaded = useResource(() => api.get<{ contact: ContactDetail }>(path).then(body => body.contact), [api, path]);
  // Writes answer with the updated contact; it replaces the loaded one.
  const [updated, setContact] = useState<ContactDetail | null>(null);
  const contact = updated ?? loaded.data;
  const back = () => navigate({ section: "contacts" });

  if (!contact) {
    return (
      <>
        <SectionHeader title={t("contacts.detailTitle")} onBack={back} />
        <ErrorNote error={loaded.error} onRetry={() => void loaded.reload()} />
        {loaded.loading ? <LoadingNote /> : null}
      </>
    );
  }
  return <ContactDetailBody contact={contact} path={path} onChange={setContact} onBack={back} />;
}

function ContactDetailBody({ contact, path, onChange, onBack }: { contact: ContactDetail; path: string; onChange: (contact: ContactDetail) => void; onBack: () => void }) {
  const t = useTranslations("outreach");
  const { api, canEdit, isManager, lists, navigate } = useOutreachManage();
  const format = useOutreachFormat();
  const resubscribeQuestion = useResubscribeQuestion();
  const [form, setForm] = useState({ email: contact.email, firstName: contact.firstName, lastName: contact.lastName });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [addListId, setAddListId] = useState("");
  const { ensure: ensureLists } = lists;
  useEffect(() => { ensureLists(); }, [ensureLists]);
  const dirty = form.email !== contact.email || form.firstName !== contact.firstName || form.lastName !== contact.lastName;
  const markClean = useUnsavedChanges(`contact:${contact.id}`, dirty);
  // What is in the inputs right now; a save answer must not replace what was typed meanwhile.
  const typed = useRef(form);
  useEffect(() => { typed.current = form; });

  /** Runs one write; an action may answer with the next question to ask instead of a contact. */
  const run = async (key: string, action: () => Promise<{ contact: ContactDetail } | { ask: Confirm } | void>) => {
    setBusy(key); setError(null); setSaved(false);
    try {
      const result = await action();
      if (result && "contact" in result) onChange(result.contact);
      setConfirm(result && "ask" in result ? result.ask : null);
      return true;
    } catch (caught) { setError(caught); return false; }
    finally { setBusy(null); }
  };
  const save = () => run("save", async () => {
    const sent = form;
    const result = await api.send<{ contact: ContactDetail }>("PATCH", path, { email: sent.email.trim(), firstName: sent.firstName.trim(), lastName: sent.lastName.trim() });
    const current = typed.current;
    // Typed during the request: keep the inputs as they are; they stay unsaved against the new contact.
    if (current.email === sent.email && current.firstName === sent.firstName && current.lastName === sent.lastName) {
      setForm({ email: result.contact.email, firstName: result.contact.firstName, lastName: result.contact.lastName });
      setSaved(true);
    }
    return result;
  });
  const subscription = (listId: string, action: "subscribe" | "unsubscribe", confirmResubscribe = false) => run(`list:${listId}`, async () => {
    try {
      const result = await api.send<{ contact: ContactDetail }>("POST", `${path}/subscriptions`,
        { listId, action, consentSource: "manual", ...(confirmResubscribe ? { confirmResubscribe: true } : {}) });
      void lists.reload();
      setAddListId("");
      return result;
    } catch (caught) {
      // The person unsubscribed: ask first, subscribe only on an explicit confirmation.
      if (action === "subscribe" && !confirmResubscribe && isResubscribeConfirmation(caught)) {
        return { ask: { resubscribe: listId, unsubscribedAt: resubscribeDate(caught) ?? lastUnsubscribe(contact, listId) } };
      }
      throw caught;
    }
  });
  const setSuppressed = (suppressed: boolean) => run("suppress", () => api.send<{ contact: ContactDetail }>("POST", `${path}/suppression`, { suppressed }));
  const remove = async () => {
    if (await run("delete", () => api.send<void>("DELETE", path).then(() => undefined))) {
      void lists.reload();
      markClean();
      navigate({ section: "contacts" });
    }
  };

  const memberIds = new Set(contact.lists.map(membership => membership.listId));
  const joinable = (lists.data ?? []).filter(list => !list.archivedAt && !memberIds.has(list.id));
  const name = contactName(contact);

  return (
    <>
      <SectionHeader title={contact.email} description={name || undefined} onBack={onBack}
        actions={canEdit ? <Button variant="destructive" onClick={() => setConfirm("delete")}><Trash2 />{t("contacts.delete")}</Button> : undefined} />
      <ErrorNote error={error} />
      {saved ? <p role="status" className="text-sm text-muted-foreground">{t("contacts.saved")}</p> : null}

      <section aria-labelledby="contact-data" className="flex flex-col gap-3 rounded-lg border p-4">
        <h3 id="contact-data" className="font-medium">{t("contacts.data")}</h3>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-3" onSubmit={event => { event.preventDefault(); void save(); }}>
          <Field label={t("contacts.email")}>
            <input type="email" required readOnly={!canEdit} className={nativeControlClass} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label={t("contacts.firstName")}>
            <input readOnly={!canEdit} className={nativeControlClass} value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })} />
          </Field>
          <Field label={t("contacts.lastName")}>
            <input readOnly={!canEdit} className={nativeControlClass} value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })} />
          </Field>
          {canEdit ? (
            <div className="sm:col-span-3">
              <Button type="submit" disabled={!dirty || busy !== null}>{busy === "save" ? t("actions.working") : t("actions.save")}</Button>
            </div>
          ) : null}
        </form>
        {Object.keys(contact.properties).length > 0 ? (
          <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            {Object.entries(contact.properties).map(([key, value]) => (
              <div key={key} className="contents"><dt className="truncate text-muted-foreground">{key}</dt><dd className="truncate">{String(value)}</dd></div>
            ))}
          </dl>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("contacts.createdFrom", { date: format.dateTime(contact.createdAt), source: contact.source || "–" })}</p>
      </section>

      <section aria-labelledby="contact-consent" className="flex flex-col gap-2 rounded-lg border p-4">
        <h3 id="contact-consent" className="font-medium">{t("contacts.consentTitle")}</h3>
        <p className="text-sm">
          <Badge variant={contact.emailConsent === "subscribed" ? "secondary" : "outline"} className="mr-2">{t(`consent.${contact.emailConsent}`)}</Badge>
          {contact.consentAt
            ? t("contacts.consentSince", { date: format.dateTime(contact.consentAt), source: contact.consentSource || "–" })
            : t("contacts.consentUnknown")}
        </p>
        {contact.suppressedReason ? (
          <p className="text-sm text-destructive">
            {t("contacts.suppressedSince", { reason: t(`suppression.${contact.suppressedReason}`), date: contact.suppressedAt ? format.dateTime(contact.suppressedAt) : "–" })}
          </p>
        ) : <p className="text-sm text-muted-foreground">{t("contacts.notSuppressed")}</p>}
        {contact.suppressedReason && contact.suppressedReason !== "manual" ? (
          // The server keeps bounce and complaint blocks for good; say why instead of offering a button that fails.
          <p className="text-xs text-muted-foreground">{t(`contacts.suppressionLocked.${contact.suppressedReason as Exclude<SuppressionReason, "manual">}`)}</p>
        ) : isManager ? (
          <div>
            {contact.suppressedReason
              ? <Button variant="outline" disabled={busy !== null} onClick={() => void setSuppressed(false)}>{t("contacts.unsuppress")}</Button>
              : <Button variant="outline" disabled={busy !== null} onClick={() => setConfirm("suppress")}>{t("contacts.suppress")}</Button>}
          </div>
        ) : contact.suppressedReason || !canEdit ? null : <p className="text-xs text-muted-foreground">{t("contacts.suppressManagerOnly")}</p>}
      </section>

      <section aria-labelledby="contact-lists" className="flex flex-col gap-2 rounded-lg border p-4">
        <h3 id="contact-lists" className="font-medium">{t("contacts.listsTitle")}</h3>
        {contact.lists.length === 0 ? <p className="text-sm text-muted-foreground">{t("contacts.noLists")}</p> : (
          <ul className="divide-y">
            {contact.lists.map(membership => (
              <li key={membership.listId} className="flex flex-wrap items-center gap-2 py-2">
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline max-sm:basis-full"
                  onClick={() => navigate({ section: "contacts", listId: membership.listId })}>{membership.listName}</button>
                <Badge variant={membership.status === "subscribed" ? "secondary" : "outline"}>{t(`memberStatus.${membership.status}`)}</Badge>
                <span className="text-xs text-muted-foreground">
                  {membership.status === "unsubscribed" && membership.unsubscribedAt ? format.date(membership.unsubscribedAt)
                    : membership.subscribedAt ? format.date(membership.subscribedAt) : ""}
                </span>
                {canEdit && membership.status !== "subscribed"
                  ? <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void subscription(membership.listId, "subscribe")}>{t("contacts.subscribe")}</Button>
                  : null}
                {canEdit && membership.status !== "unsubscribed"
                  ? <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void subscription(membership.listId, "unsubscribe")}>{t("contacts.unsubscribe")}</Button>
                  : null}
              </li>
            ))}
          </ul>
        )}
        {canEdit && joinable.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <Field label={t("contacts.addToList")}>
                <select className={nativeControlClass} value={addListId} onChange={event => setAddListId(event.target.value)}>
                  <option value="">{t("contacts.chooseList")}</option>
                  {joinable.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
                </select>
              </Field>
            </div>
            <Button variant="outline" disabled={!addListId || busy !== null} onClick={() => void subscription(addListId, "subscribe")}>{t("contacts.subscribe")}</Button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="contact-activity" className="flex flex-col gap-3">
        <h3 id="contact-activity" className="font-medium">{t("contacts.activityTitle")}</h3>
        <div className="grid grid-cols-3 gap-2">
          <Figure label={t("stats.sent")} value={contact.stats.sent} />
          <Figure label={t("stats.opened")} value={contact.stats.opened} />
          <Figure label={t("stats.clicked")} value={contact.stats.clicked} />
        </div>
        {contact.lastSends.length > 0
          ? <SendsTable sends={contact.lastSends} caption={t("contacts.lastSends")} showRecipient={false} />
          : <p className="text-sm text-muted-foreground">{t("contacts.nothingSent")}</p>}
        <ContactEvents contactId={contact.id} />
      </section>

      {confirm === "delete" ? (
        <ConfirmDialog title={t("contacts.deleteTitle")} description={t("contacts.deleteDescription", { email: contact.email })}
          confirmLabel={t("contacts.deleteConfirm")} destructive busy={busy === "delete"} error={error}
          onCancel={() => { setConfirm(null); setError(null); }} onConfirm={() => void remove()}>
          {/* The server keeps a hash of the address that counts as an unsubscribe (erased_addresses). */}
          <p className="text-sm text-muted-foreground">{t("contacts.deleteKeepsBlock")}</p>
        </ConfirmDialog>
      ) : null}
      {confirm === "suppress" ? (
        <ConfirmDialog title={t("contacts.suppressTitle")} description={t("contacts.suppressDescription", { email: contact.email })}
          confirmLabel={t("contacts.suppress")} busy={busy === "suppress"} error={error}
          onCancel={() => { setConfirm(null); setError(null); }} onConfirm={() => void setSuppressed(true)} />
      ) : null}
      {typeof confirm === "object" && confirm !== null ? (
        <ConfirmDialog title={t("contacts.resubscribeTitle")} description={resubscribeQuestion(contact.email, confirm.unsubscribedAt)} confirmLabel={t("contacts.resubscribeConfirm")}
          busy={busy === `list:${confirm.resubscribe}`} error={error}
          onCancel={() => { setConfirm(null); setError(null); }} onConfirm={() => void subscription(confirm.resubscribe, "subscribe", true)} />
      ) : null}
    </>
  );
}

function ContactEvents({ contactId }: { contactId: string }) {
  const t = useTranslations("outreach");
  const { api } = useOutreachManage();
  const events = usePagedResource(
    (before: number | null) => api.get<TrackingEventsResponse>("tracking/events", { contactId, includeMachine: true, limit: EVENT_PAGE, before }),
    page => ({ items: page.events, next: page.nextBefore }),
    [api, contactId]
  );
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">{t("contacts.events")}</h4>
      <ErrorNote error={events.error} onRetry={() => void events.first.reload()} />
      {events.first.data && events.items.length === 0 ? <p className="text-sm text-muted-foreground">{t("contacts.noEvents")}</p> : null}
      {events.items.length > 0 ? <EventList events={events.items} /> : null}
      {events.next !== null ? (
        <div><Button variant="outline" size="sm" disabled={events.loadingMore} onClick={() => void events.loadMore()}>{t("actions.loadMore")}</Button></div>
      ) : null}
    </div>
  );
}

export function EventList({ events }: { events: TrackingEvent[] }) {
  const t = useTranslations("outreach");
  const format = useOutreachFormat();
  return (
    <ul className="divide-y rounded-lg border text-sm">
      {events.map(event => {
        const place = [event.city, event.region, event.country].filter(Boolean).join(", ");
        const client = [event.clientName, event.clientOs].filter(Boolean).join(" · ");
        return (
          <li key={event.id} className="flex flex-col gap-0.5 px-3 py-2">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t(`events.${event.type}`)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{format.dateTime(event.at)}</span>
              {event.machine ? <Badge variant="outline" title={t("events.machineHint")}>{t("events.machine")}</Badge> : null}
            </span>
            {event.url ? <span className="truncate text-xs text-muted-foreground" title={event.url}>{event.url}</span> : null}
            {place || client ? <span className="text-xs text-muted-foreground">{[place, client].filter(Boolean).join(" — ")}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
