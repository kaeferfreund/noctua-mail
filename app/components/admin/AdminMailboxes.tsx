"use client";

import { useCallback, useEffect, useState } from "react";
import { Theme } from "@radix-ui/themes";
import type { Account } from "@/lib/data";
import AccountTabContent from "@/app/components/account-settings/tabs/AccountTabContent";
import MembersTabContent from "@/app/components/account-settings/tabs/MembersTabContent";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/app/components/ui/dialog";
import AdminConfirmDialog from "./AdminConfirmDialog";
import type { AdminAccount, AdminUser } from "./types";
import { adminRequest, errorMessage, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";

const emptyAccount = (): Account => ({ id: "", name: "", email: "", avatar: "", imap: { host: "", port: 993, secure: true, user: "", password: "" }, smtp: { host: "", port: 465, secure: true, user: "", password: "" } });
function CreateMailbox({ apiFetch, onClose, onCreated }: { apiFetch: AdminFetch; onClose: () => void; onCreated: () => void }) {
  const [account, setAccount] = useState(emptyAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imapSecurity, setImapSecurity] = useState<"tls" | "starttls" | "none">("tls");
  const [smtpSecurity, setSmtpSecurity] = useState<"tls" | "starttls" | "none">("tls");
  const [detecting, setDetecting] = useState<"imap" | "smtp" | null>(null);
  const [probes, setProbes] = useState<Partial<Record<"imap" | "smtp", { tls: boolean; starttls: boolean }>>>({});
  const probe = async (protocol: "imap" | "smtp") => {
    setDetecting(protocol); setError("");
    try {
      const result = await adminRequest<{ supportsTLS: boolean; supportsStartTLS: boolean }>(apiFetch, "/api/probe", { ...jsonMutation("POST", { protocol, host: account[protocol].host, port: account[protocol].port }), signal: AbortSignal.timeout(6000) });
      setProbes(previous => ({ ...previous, [protocol]: { tls: result.supportsTLS, starttls: result.supportsStartTLS } }));
    } catch (error) { setError(errorMessage(error)); }
    finally { setDetecting(null); }
  };
  const create = async () => {
    setBusy(true); setError("");
    try {
      const { id, ...body } = account; void id;
      await adminRequest(apiFetch, "/api/admin/accounts", jsonMutation("POST", body));
      onCreated(); onClose();
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="sm:max-w-3xl" aria-describedby={undefined} showCloseButton={!busy}>
    <DialogTitle>Create mailbox</DialogTitle><Theme asChild><div className="flex max-h-[75dvh] flex-col gap-3 overflow-auto">
      <p className="text-sm">Creates an ownerless mailbox. Grant members after creation.</p>{error && <p role="alert">{error}</p>}
      <fieldset disabled={busy} className="min-h-0"><AccountTabContent editingAccount={account} isExistingAccount={false} imapDetecting={detecting === "imap"} smtpDetecting={detecting === "smtp"}
        imapProbe={probes.imap ?? null} smtpProbe={probes.smtp ?? null} imapSecurity={imapSecurity} smtpSecurity={smtpSecurity} onImapSecurityChange={setImapSecurity} onSmtpSecurityChange={setSmtpSecurity}
        onClose={onClose} onSave={() => void create()} onDelete={onClose} canSave={!busy && Boolean(account.email && account.imap.host && account.imap.user && account.imap.password && account.smtp.host && account.smtp.user && account.smtp.password)}
        onUpdateAccount={setAccount} onRunProbe={protocol => void probe(protocol)} /></fieldset>
    </div></Theme>
  </DialogContent></Dialog>;
}
export default function AdminMailboxes({ apiFetch = fetch, users }: { apiFetch?: AdminFetch; users: AdminUser[] }) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminAccount | null>(null);
  const [members, setMembers] = useState<AdminAccount | null>(null);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { setAccounts((await adminRequest<{ accounts: AdminAccount[] }>(apiFetch, "/api/admin/accounts")).accounts); }
    catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }, [apiFetch]);
  useEffect(() => { void load(); }, [load]);
  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError("");
    try { await adminRequest(apiFetch, `/api/admin/accounts/${encodeURIComponent(deleting.id)}`, jsonMutation("DELETE")); setDeleting(null); await load(); }
    catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4" aria-label="Mailboxes"><div className="flex justify-between gap-2"><h3 className="font-medium">Mailboxes</h3><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => void load()}>Refresh mailboxes</Button><Button onClick={() => setCreating(true)}>Create mailbox</Button></div></div>
    {error && !deleting && <p role="alert">{error}</p>}{busy && <p role="status">Loading…</p>}
    {accounts.map(account => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div>{account.name || account.email}<p className="text-sm text-muted-foreground">{account.email} · {account.members.length} members</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setMembers(account)}>Manage members</Button><Button variant="destructive" onClick={() => { setError(""); setDeleting(account); }}>Delete mailbox</Button></div></div>)}
    {creating && <CreateMailbox apiFetch={apiFetch} onClose={() => setCreating(false)} onCreated={() => void load()} />}
    {deleting && <AdminConfirmDialog title="Delete mailbox" description={`Permanently delete ${deleting.email} and its local data?`} busy={busy} error={error} onCancel={() => setDeleting(null)} onConfirm={() => void remove()} />}
    {members && <Dialog open onOpenChange={open => { if (!open) setMembers(null); }}><DialogContent className="sm:max-w-3xl" aria-describedby={undefined}><DialogTitle>Members of {members.email}</DialogTitle><div className="max-h-[70dvh] overflow-auto"><MembersTabContent accountId={members.id} admin initialMembers={members.members} users={users} apiFetch={apiFetch} onChanged={() => void load()} /></div></DialogContent></Dialog>}
  </section>;
}
