"use client";

import { useLocale, useTranslations } from "next-intl";

import { useCallback, useEffect, useState } from "react";
import { Theme } from "@radix-ui/themes";
import type { Account } from "@/lib/data";
import AccountTabContent from "@/app/components/account-settings/tabs/AccountTabContent";
import MembersTabContent from "@/app/components/account-settings/tabs/MembersTabContent";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/app/components/ui/dialog";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { adminActionRow, adminHeaderRow } from "./adminLayout";
import type { AdminAccount, AdminUser } from "./types";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";

const emptyAccount = (): Account => ({ id: "", name: "", email: "", avatar: "", imap: { host: "", port: 993, secure: true, user: "", password: "" }, smtp: { host: "", port: 465, secure: true, user: "", password: "" } });
/** The creating admin becomes the owner, so the new mailbox appears in the admin's views and sidebar right away. */
export function CreateMailbox({ apiFetch, onClose, onCreated, onAccessChanged }: { apiFetch: AdminFetch; onClose: () => void; onCreated: () => void; onAccessChanged?: () => Promise<void> }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const [account, setAccount] = useState(emptyAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [imapSecurity, setImapSecurity] = useState<"tls" | "starttls" | "none">("tls");
  const [smtpSecurity, setSmtpSecurity] = useState<"tls" | "starttls" | "none">("tls");
  const [detecting, setDetecting] = useState<"imap" | "smtp" | null>(null);
  const [probes, setProbes] = useState<Partial<Record<"imap" | "smtp", { tls: boolean; starttls: boolean }>>>({});
  const probe = async (protocol: "imap" | "smtp") => {
    setDetecting(protocol); setError(null);
    try {
      const result = await adminRequest<{ supportsTLS: boolean; supportsStartTLS: boolean }>(apiFetch, "/api/probe", { ...jsonMutation("POST", { protocol, host: account[protocol].host, port: account[protocol].port }), signal: AbortSignal.timeout(6000) });
      setProbes(previous => ({ ...previous, [protocol]: { tls: result.supportsTLS, starttls: result.supportsStartTLS } }));
    } catch (error) { setError(error); }
    finally { setDetecting(null); }
  };
  const create = async () => {
    setBusy(true); setError(null);
    try {
      const { id, ...body } = account; void id;
      await adminRequest(apiFetch, "/api/admin/accounts", jsonMutation("POST", body));
      onCreated();
      await onAccessChanged?.();
      onClose();
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="sm:max-w-3xl" aria-describedby={undefined} showCloseButton={!busy}>
    <DialogTitle className="pr-6">{t("mailboxes.create")}</DialogTitle><Theme asChild><div className="flex max-h-[75dvh] flex-col gap-3 overflow-auto">
      <p className="text-sm">{t("mailboxes.help")}</p>{Boolean(error) && <p role="alert">{formatAdminError(error, t, locale)}</p>}
      <fieldset disabled={busy} className="min-h-0"><AccountTabContent editingAccount={account} isExistingAccount={false} imapDetecting={detecting === "imap"} smtpDetecting={detecting === "smtp"}
        imapProbe={probes.imap ?? null} smtpProbe={probes.smtp ?? null} imapSecurity={imapSecurity} smtpSecurity={smtpSecurity} onImapSecurityChange={setImapSecurity} onSmtpSecurityChange={setSmtpSecurity}
        onClose={onClose} onSave={() => void create()} onDelete={onClose} canSave={!busy && Boolean(account.email && account.imap.host && account.imap.user && account.imap.password && account.smtp.host && account.smtp.user && account.smtp.password)}
        onUpdateAccount={setAccount} onRunProbe={protocol => void probe(protocol)} /></fieldset>
    </div></Theme>
  </DialogContent></Dialog>;
}
export default function AdminMailboxes({ apiFetch = fetch, users, onAccessChanged }: { apiFetch?: AdminFetch; users: AdminUser[]; onAccessChanged?: () => Promise<void> }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminAccount | null>(null);
  const [members, setMembers] = useState<AdminAccount | null>(null);
  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try { setAccounts((await adminRequest<{ accounts: AdminAccount[] }>(apiFetch, "/api/admin/accounts")).accounts); }
    catch (error) { setError(error); }
    finally { setBusy(false); }
  }, [apiFetch]);
  useEffect(() => { void load(); }, [load]);
  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError(null);
    try { await adminRequest(apiFetch, `/api/admin/accounts/${encodeURIComponent(deleting.id)}`, jsonMutation("DELETE")); setDeleting(null); await load(); }
    catch (error) { setError(error); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4" aria-label={t("tabs.mailboxes")}><div className={adminHeaderRow}><h3 className="font-medium">{t("tabs.mailboxes")}</h3><div className={adminActionRow}><Button variant="outline" disabled={busy} onClick={() => void load()}>{t("mailboxes.refresh")}</Button><Button onClick={() => setCreating(true)}>{t("mailboxes.create")}</Button></div></div>
    {Boolean(error) && !deleting && <p role="alert">{formatAdminError(error, t, locale)}</p>}{busy && <p role="status">{t("loading")}</p>}
    {!busy && !error && !accounts.length && <p className="text-sm text-muted-foreground">{t("mailboxes.noneVisible")}</p>}
    {accounts.map(account => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div className="min-w-0 break-words">{account.name || account.email}<p className="text-sm text-muted-foreground">{account.email} · {t("mailboxes.memberCount", {count: account.members.length})}</p></div>
      <div className={adminActionRow}><Button variant="outline" onClick={() => setMembers(account)}>{t("mailboxes.manageMembers")}</Button><Button variant="destructive" onClick={() => { setError(null); setDeleting(account); }}>{t("mailboxes.delete")}</Button></div></div>)}
    {creating && <CreateMailbox apiFetch={apiFetch} onAccessChanged={onAccessChanged} onClose={() => setCreating(false)} onCreated={() => void load()} />}
    {deleting && <AdminConfirmDialog title={t("mailboxes.delete")} description={t("mailboxes.deleteConfirm", {email: deleting.email})} busy={busy} error={error ? formatAdminError(error, t, locale) : undefined} onCancel={() => setDeleting(null)} onConfirm={() => void remove()} />}
    {members && <Dialog open onOpenChange={open => { if (!open) setMembers(null); }}><DialogContent className="sm:max-w-3xl" aria-describedby={undefined}><DialogTitle>{t("mailboxes.membersTitle", {email: members.email})}</DialogTitle><Theme asChild><div className="max-h-[70dvh] overflow-auto"><MembersTabContent accountId={members.id} admin initialMembers={members.members} users={users} apiFetch={apiFetch} onChanged={() => void load()} /></div></Theme></DialogContent></Dialog>}
  </section>;
}
