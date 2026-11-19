"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/app/components/ui/dialog";
import { EMAIL_CONSENTS, type Contact, type ContactDetail, type ContactListResponse, type EmailConsent } from "@/lib/addons/outreach/types";
import { useOutreachManage, useResource } from "./manageContext";
import { EmptyState, ErrorNote, Field, LoadingNote, RowButton, SectionHeader, nativeControlClass, useOutreachFormat } from "./ui";
import ContactDetailView from "./ContactDetailView";

const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 300;

export default function ContactsSection({ id, listId }: { id: string | null; listId: string | null }) {
  if (id) return <ContactDetailView key={id} contactId={id} />;
  return <ContactsList initialListId={listId} />;
}

type Suppressed = "" | "true" | "false";

function ContactsList({ initialListId }: { initialListId: string | null }) {
  const t = useTranslations("outreach");
  const { api, navigate, canEdit, lists } = useOutreachManage();
  const format = useOutreachFormat();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [listId, setListId] = useState(initialListId ?? "");
  const [consent, setConsent] = useState<EmailConsent | "">("");
  const [suppressed, setSuppressed] = useState<Suppressed>("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const { ensure: ensureLists } = lists;
  useEffect(() => { ensureLists(); }, [ensureLists]);
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const result = useResource(
    () => api.get<ContactListResponse>("contacts", { q: search, listId, consent, suppressed, page, pageSize: PAGE_SIZE }),
    [api, search, listId, consent, suppressed, page]
  );
  const data = result.data;
  const filtered = Boolean(search || listId || consent || suppressed);
  const first = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const filterChange = <T,>(set: (value: T) => void) => (value: T) => { set(value); setPage(1); };

  return (
    <>
      <SectionHeader title={t("contacts.title")} description={t("contacts.description")}
        actions={canEdit ? <Button onClick={() => setAdding(true)}><Plus />{t("contacts.add")}</Button> : undefined} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("contacts.search")}>
          <input type="search" className={nativeControlClass} value={query} placeholder={t("contacts.searchPlaceholder")} onChange={event => setQuery(event.target.value)} />
        </Field>
        <Field label={t("contacts.filterList")}>
          <select className={nativeControlClass} value={listId} onChange={event => filterChange(setListId)(event.target.value)}>
            <option value="">{t("contacts.allLists")}</option>
            {(lists.data ?? []).filter(list => !list.archivedAt).map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
        </Field>
        <Field label={t("contacts.filterConsent")}>
          <select className={nativeControlClass} value={consent} onChange={event => filterChange(setConsent)(event.target.value as EmailConsent | "")}>
            <option value="">{t("contacts.anyConsent")}</option>
            {EMAIL_CONSENTS.map(value => <option key={value} value={value}>{t(`consent.${value}`)}</option>)}
          </select>
        </Field>
        <Field label={t("contacts.filterSuppressed")}>
          <select className={nativeControlClass} value={suppressed} onChange={event => filterChange(setSuppressed)(event.target.value as Suppressed)}>
            <option value="">{t("contacts.suppressedAny")}</option>
            <option value="false">{t("contacts.suppressedNo")}</option>
            <option value="true">{t("contacts.suppressedYes")}</option>
          </select>
        </Field>
      </div>
      <ErrorNote error={result.error} onRetry={() => void result.reload()} />
      {!data && result.loading ? <LoadingNote /> : null}
      {data && data.contacts.length === 0 ? (
        filtered
          ? <EmptyState title={t("contacts.noMatchTitle")} text={t("contacts.noMatchText")} />
          : <EmptyState title={t("contacts.emptyTitle")} text={canEdit ? t("contacts.emptyText") : t("contacts.emptyTextReadOnly")}
              action={canEdit ? <Button onClick={() => setAdding(true)}><Plus />{t("contacts.add")}</Button> : undefined} />
      ) : null}
      {data && data.contacts.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            {t("contacts.range", { first: format.number(first), last: format.number(last), total: format.number(data.total) })}
          </p>
          <ul className="divide-y rounded-lg border" aria-busy={result.loading}>
            {data.contacts.map(contact => <ContactRow key={contact.id} contact={contact} onOpen={() => navigate({ section: "contacts", id: contact.id })} />)}
          </ul>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" disabled={page <= 1 || result.loading} onClick={() => setPage(value => value - 1)}>{t("actions.previous")}</Button>
            <Button variant="outline" disabled={last >= data.total || result.loading} onClick={() => setPage(value => value + 1)}>{t("actions.next")}</Button>
          </div>
        </>
      ) : null}
      {adding ? <AddContactDialog defaultListId={listId} onClose={() => setAdding(false)}
        onCreated={contactId => { setAdding(false); navigate({ section: "contacts", id: contactId }); }} /> : null}
    </>
  );
}

export function contactName(contact: Pick<Contact, "firstName" | "lastName">) {
  return [contact.firstName, contact.lastName].map(part => part.trim()).filter(Boolean).join(" ");
}

function ContactRow({ contact, onOpen }: { contact: Contact; onOpen: () => void }) {
  const t = useTranslations("outreach");
  const name = contactName(contact);
  return (
    <li>
      <RowButton onClick={onOpen}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{contact.email}</span>
          {name ? <span className="truncate text-xs text-muted-foreground">{name}</span> : null}
        </span>
        <span className="flex flex-wrap gap-1">
          <Badge variant={contact.emailConsent === "subscribed" ? "secondary" : "outline"}>{t(`consent.${contact.emailConsent}`)}</Badge>
          {contact.suppressedReason ? <Badge variant="destructive">{t("contacts.suppressedBadge")}</Badge> : null}
        </span>
      </RowButton>
    </li>
  );
}

function AddContactDialog({ defaultListId, onClose, onCreated }: { defaultListId: string; onClose: () => void; onCreated: (contactId: string) => void }) {
  const t = useTranslations("outreach");
  const { api, lists } = useOutreachManage();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [listId, setListId] = useState(defaultListId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [existing, setExisting] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const result = await api.send<{ contact: Contact; created: boolean }>("POST", "contacts", { email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim() });
      if (listId) {
        await api.send<{ contact: ContactDetail }>("POST", `contacts/${encodeURIComponent(result.contact.id)}/subscriptions`, { listId, action: "subscribe", consentSource: "manual" });
        void lists.reload();
      }
      if (!result.created) { setExisting(result.contact.id); setBusy(false); return; }
      onCreated(result.contact.id);
    } catch (caught) { setError(caught); setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>{t("contacts.addTitle")}</DialogTitle>
        <DialogDescription>{t("contacts.addDescription")}</DialogDescription>
        {existing ? (
          <p role="status" className="text-sm">{t("contacts.addExisting")}</p>
        ) : (
          <form id="outreach-add-contact" className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <Field label={t("contacts.email")}>
              <input type="email" required autoFocus className={nativeControlClass} value={email} onChange={event => setEmail(event.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("contacts.firstName")}><input className={nativeControlClass} value={firstName} onChange={event => setFirstName(event.target.value)} /></Field>
              <Field label={t("contacts.lastName")}><input className={nativeControlClass} value={lastName} onChange={event => setLastName(event.target.value)} /></Field>
            </div>
            <Field label={t("contacts.addToList")} hint={t("contacts.addToListHint")}>
              <select className={nativeControlClass} value={listId} onChange={event => setListId(event.target.value)}>
                <option value="">{t("contacts.noList")}</option>
                {(lists.data ?? []).filter(list => !list.archivedAt).map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
              </select>
            </Field>
          </form>
        )}
        <ErrorNote error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>{t("actions.cancel")}</Button>
          {existing
            ? <Button onClick={() => onCreated(existing)}>{t("contacts.openExisting")}</Button>
            : <Button type="submit" form="outreach-add-contact" disabled={busy || !email.trim()}>{busy ? t("actions.working") : t("contacts.addSubmit")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
