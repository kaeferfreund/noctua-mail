"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Archive, Pencil, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/app/components/ui/dialog";
import { OPT_IN_MODES, type ContactList, type ContactListInput, type OptInMode } from "@/lib/addons/outreach/types";
import { useOutreachManage } from "./manageContext";
import { ConfirmDialog, EmptyState, ErrorNote, Field, LoadingNote, SectionHeader, nativeControlClass, useOutreachFormat, outreachRootClass } from "./ui";

export default function ListsSection() {
  const t = useTranslations("outreach");
  const { api, canEdit, lists, navigate } = useOutreachManage();
  const format = useOutreachFormat();
  const [editing, setEditing] = useState<ContactList | "new" | null>(null);
  const [archiving, setArchiving] = useState<ContactList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { ensure } = lists;
  useEffect(() => { ensure(); }, [ensure]);
  const active = (lists.data ?? []).filter(list => !list.archivedAt);
  const archived = (lists.data ?? []).filter(list => list.archivedAt);

  const archive = async (list: ContactList) => {
    setBusy(true); setError(null);
    try {
      await api.send("DELETE", `lists/${encodeURIComponent(list.id)}`);
      setArchiving(null);
      await lists.reload();
    } catch (caught) { setError(caught); }
    finally { setBusy(false); }
  };

  return (
    <>
      <SectionHeader title={t("lists.title")} description={t("lists.description")}
        actions={canEdit ? <Button onClick={() => setEditing("new")}><Plus />{t("lists.new")}</Button> : undefined} />
      <ErrorNote error={lists.error} onRetry={() => void lists.reload()} />
      {!lists.data && lists.loading ? <LoadingNote /> : null}
      {lists.data && active.length === 0 ? (
        <EmptyState title={t("lists.emptyTitle")} text={canEdit ? t("lists.emptyText") : t("lists.emptyTextReadOnly")}
          action={canEdit ? <Button onClick={() => setEditing("new")}><Plus />{t("lists.new")}</Button> : undefined} />
      ) : null}
      {active.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {active.map(list => (
            <li key={list.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{list.name}</span>
                  <Badge variant="outline">{t(`lists.optIn.${list.optIn}`)}</Badge>
                </p>
                {list.description ? <p className="truncate text-sm text-muted-foreground">{list.description}</p> : null}
              </div>
              <span className="text-sm text-muted-foreground tabular-nums">{t("lists.members", { count: list.memberCount, formatted: format.number(list.memberCount) })}</span>
              <div className="flex flex-wrap gap-1">
                <Button variant="outline" size="sm" onClick={() => navigate({ section: "contacts", listId: list.id })}><Users />{t("lists.showContacts")}</Button>
                {canEdit ? <>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(list)} aria-label={t("lists.editNamed", { name: list.name })}><Pencil />{t("actions.edit")}</Button>
                  <Button variant="ghost" size="sm" onClick={() => { setError(null); setArchiving(list); }} aria-label={t("lists.archiveNamed", { name: list.name })}><Archive />{t("lists.archive")}</Button>
                </> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {archived.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("lists.archived", { count: archived.length })}</summary>
          <ul className="mt-2 flex flex-col gap-1 pl-4 text-muted-foreground">
            {archived.map(list => <li key={list.id}>{list.name}</li>)}
          </ul>
        </details>
      ) : null}
      {editing ? <ListDialog list={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void lists.reload(); }} /> : null}
      {archiving ? (
        <ConfirmDialog title={t("lists.archiveTitle")} description={t("lists.archiveDescription", { name: archiving.name })}
          confirmLabel={t("lists.archive")} destructive busy={busy} error={error}
          onCancel={() => setArchiving(null)} onConfirm={() => void archive(archiving)} />
      ) : null}
    </>
  );
}

function ListDialog({ list, onClose, onSaved }: { list: ContactList | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("outreach");
  const { api } = useOutreachManage();
  const [form, setForm] = useState<Required<ContactListInput>>({ name: list?.name ?? "", description: list?.description ?? "", optIn: list?.optIn ?? "single" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const body = { name: form.name.trim(), description: form.description.trim(), optIn: form.optIn };
      if (list) await api.send("PATCH", `lists/${encodeURIComponent(list.id)}`, body);
      else await api.send("POST", "lists", body);
      onSaved();
    } catch (caught) { setError(caught); setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className={cn(outreachRootClass, "sm:max-w-md")}>
        <DialogTitle>{list ? t("lists.editTitle") : t("lists.newTitle")}</DialogTitle>
        <DialogDescription>{t("lists.dialogDescription")}</DialogDescription>
        <form id="outreach-list-form" className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <Field label={t("lists.name")}><input required autoFocus className={nativeControlClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label={t("lists.descriptionLabel")}><input className={nativeControlClass} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></Field>
          <Field label={t("lists.optInLabel")} hint={t("lists.optInHint")}>
            <select className={nativeControlClass} value={form.optIn} onChange={event => setForm({ ...form, optIn: event.target.value as OptInMode })}>
              {OPT_IN_MODES.map(mode => <option key={mode} value={mode}>{t(`lists.optIn.${mode}`)}</option>)}
            </select>
          </Field>
        </form>
        <ErrorNote error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>{t("actions.cancel")}</Button>
          <Button type="submit" form="outreach-list-form" disabled={busy || !form.name.trim()}>{busy ? t("actions.working") : t("actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
