"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/app/components/ui/dialog";
import SettingsFrame, { SettingsTitle } from "@/app/components/shell/SettingsFrame";
import { adminRequest, errorMessage, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { createAuthClient, type NoctuaAuthClient, type Proof } from "@/lib/authClient";
import ReauthDialog from "@/app/components/auth/ReauthDialog";
import AdminConfirmDialog from "./AdminConfirmDialog";
import AdminAuditLog from "./AdminAuditLog";
import AdminMailboxes from "./AdminMailboxes";
import type { AdminUser, AdminInvite } from "./types";

type Action = { user: AdminUser; type: "role" | "status" | "delete" | "recovery" | "mfa-reset" | "sessions" | "passkey"; role?: "admin" | "user" };
const actionTitles: Record<Action["type"], string> = { role: "Change user role", status: "Change user status", delete: "Delete user", recovery: "Initiate recovery", "mfa-reset": "Reset MFA", sessions: "Revoke sessions", passkey: "Remove passkey" };
function isOwner(user: AdminUser) { return user.accounts?.some(account => account.isOwner === true) ?? false; }
function securityValue(value: boolean | undefined) { return value === undefined ? "Unknown" : value ? "Yes" : "No"; }

export default function AdminPanel({ isAdminUser, apiFetch = fetch, client, onClose }: { isAdminUser: boolean; apiFetch?: AdminFetch; client?: NoctuaAuthClient; onClose: () => void }) {
  // Mount only for admins so no hidden panel fetches or secrets survive closing.
  return isAdminUser ? <AdminPanelContent apiFetch={apiFetch} client={client} onClose={onClose} /> : null;
}
function AdminPanelContent({ apiFetch, client, onClose }: { apiFetch: AdminFetch; client?: NoctuaAuthClient; onClose: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tab, setTab] = useState<"users" | "mailboxes" | "invites" | "audit">("users");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [actionError, setActionError] = useState("");
  const [owner, setOwner] = useState("");
  const [reauthOpen, setReauthOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [passkeyId, setPasskeyId] = useState("");
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviteRevision, setInviteRevision] = useState(0);
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const auth = useMemo(() => client ?? createAuthClient(apiFetch), [client, apiFetch]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setUsers((await adminRequest<{ users: AdminUser[] }>(apiFetch, "/api/admin/users")).users); }
    catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }, [apiFetch]);
  useEffect(() => { void load(); }, [load]);
  const begin = (action: Action) => { setActionError(""); setPending(action); setOwner(""); setReauthOpen(false); setVerified(false); setPasskeyId(""); };
  const cancel = () => { setPending(null); setActionError(""); setReauthOpen(false); setVerified(false); setPasskeyId(""); setOwner(""); };
  const sensitive = pending && ["recovery", "mfa-reset", "sessions", "passkey"].includes(pending.type);
  const submit = async (proof?: Proof) => {
    if (!pending || busy) return;
    if (sensitive && !proof) { setReauthOpen(true); return; }
    setBusy(true); setActionError("");
    try {
      const grant = proof?.grant;
      const base = `/api/admin/users/${encodeURIComponent(pending.user.id)}`;
      if (pending.type === "role") await adminRequest(apiFetch, base, jsonMutation("PATCH", { role: pending.role }));
      if (pending.type === "status") await adminRequest(apiFetch, base, jsonMutation("PATCH", { disabled: !pending.user.disabled }));
      if (pending.type === "delete") await adminRequest(apiFetch, base, jsonMutation("DELETE", owner ? { reassignOwnerTo: owner } : {}));
      if (pending.type === "recovery") {
        const result = await adminRequest<{ url: string }>(apiFetch, `${base}/recovery`, jsonMutation("POST", { confirmedTarget: true }, grant));
        setCopied(""); setSecret({ title: "One-time recovery link", value: result.url });
      }
      if (pending.type === "mfa-reset") await adminRequest(apiFetch, `${base}/mfa-reset`, jsonMutation("POST", { confirmedTarget: true }, grant));
      if (pending.type === "sessions") await adminRequest(apiFetch, `${base}/sessions`, jsonMutation("DELETE", undefined, grant));
      if (pending.type === "passkey") await adminRequest(apiFetch, `${base}/passkeys/${encodeURIComponent(passkeyId)}`, jsonMutation("DELETE", undefined, grant));
      cancel(); await load();
    } catch (error) { setReauthOpen(false); setActionError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const invite = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await adminRequest<{ invite: { code: string } }>(apiFetch, "/api/admin/users", jsonMutation("POST", { email, name, role: inviteRole }));
      setCopied(""); setSecret({ title: "One-time invite code", value: data.invite.code }); setEmail(""); setName(""); setInviteRevision(value => value + 1);
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <SettingsFrame open onClose={() => { if (!busy) onClose(); }}><div className="flex h-full min-h-0 flex-col gap-4">
    <div className="flex items-center justify-between"><SettingsTitle>Admin</SettingsTitle><Button variant="outline" disabled={busy} onClick={onClose}>Close admin</Button></div>
    <nav aria-label="Administration sections" className="flex flex-wrap gap-2">{(["users", "mailboxes", "invites", "audit"] as const).map(value => <Button key={value} variant={tab === value ? "default" : "outline"} aria-pressed={tab === value} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)}</Button>)}</nav>
    <div className="min-h-0 flex-1 overflow-auto">
      {error && <p role="alert" className="mb-3 text-destructive">{error}</p>}
      {tab === "users" && <section className="space-y-4" aria-label="Users"><div className="flex justify-between"><h3 className="font-medium">Users</h3><Button variant="outline" disabled={loading || busy} onClick={() => void load()}>Refresh users</Button></div>
        {loading && <p role="status">Loading users…</p>}
        <table className="w-full text-left text-sm"><thead><tr><th>Name / email</th><th>Role</th><th>Status</th><th>Security</th><th>Mailboxes</th><th>Actions</th></tr></thead>
          <tbody>{users.map(user => <tr key={user.id} className="border-b align-top"><td className="p-2">{user.name || "—"}<div>{user.email}</div></td>
            <td className="p-2"><select aria-label={`Role for ${user.email}`} value={user.role} disabled={busy} onChange={event => begin({ user, type: "role", role: event.target.value as "admin" | "user" })}><option value="user">user</option><option value="admin">admin</option></select></td>
            <td className="p-2">{user.disabled ? "Disabled" : user.disabled === false ? "Enabled" : "Unknown"}</td>
            <td className="p-2">Password: {securityValue(user.hasPassword)}<br />TOTP: {securityValue(user.twoFactorEnabled)}<br />Passkeys: {user.passkeyCount ?? user.passkeys?.length ?? "Unknown"}</td>
            <td className="p-2">{user.accounts?.map(account => <div key={account.id}>{account.name || account.email} · {account.role}{(account.isOwner === true) ? " · Owner" : ""}</div>)}</td>
            <td className="flex flex-wrap gap-2 p-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => begin({ user, type: "status" })}>{user.disabled ? "Enable" : "Disable"}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => begin({ user, type: "sessions" })}>Revoke sessions</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => begin({ user, type: "recovery" })}>Recovery</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => begin({ user, type: "mfa-reset" })}>Reset MFA</Button>
              <Button size="sm" variant="outline" disabled={busy || !user.passkeys?.length} onClick={() => begin({ user, type: "passkey" })}>Remove passkey</Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => begin({ user, type: "delete" })}>Delete user</Button></td></tr>)}</tbody></table>
      </section>}
      {tab === "invites" && <section className="space-y-4" aria-label="Invites"><h3 className="font-medium">Invite a user</h3><p className="text-sm text-muted-foreground">The email-bound code is single-use and expires in one day. Hand it over personally. The recipient chooses their own password.</p>
        <form onSubmit={event => void invite(event)} className="grid max-w-lg gap-3"><label className="grid gap-1">Name<Input required value={name} onChange={event => setName(event.target.value)} /></label><label className="grid gap-1">Email<Input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label className="grid gap-1">Invite role<select value={inviteRole} onChange={event => setInviteRole(event.target.value as "user" | "admin")}><option value="user">user</option><option value="admin">admin</option></select></label><Button disabled={busy}>Issue targeted invite</Button></form>
        <InviteHistory apiFetch={apiFetch} revision={inviteRevision} />
      </section>}
      {tab === "mailboxes" && <AdminMailboxes apiFetch={apiFetch} users={users} />}
      {tab === "audit" && <AdminAuditLog apiFetch={apiFetch} />}
    </div>
    {pending && !reauthOpen && <AdminConfirmDialog title={actionTitles[pending.type]} description={`${pending.user.email}: ${pending.type === "role" ? `set role to ${pending.role}` : pending.type === "status" ? `${pending.user.disabled ? "enable" : "disable"} this user` : "this action changes the user's access"}.`} busy={busy} error={actionError}
      disabled={Boolean(((pending.type === "recovery" || pending.type === "mfa-reset") && !verified) || (pending.type === "delete" && isOwner(pending.user) && !owner) || (pending.type === "passkey" && !passkeyId.trim()))}
      onCancel={cancel} onConfirm={() => void submit()}>
      {pending.type === "delete" && <label className="grid gap-1">Reassign owned mailboxes to<select value={owner} onChange={event => setOwner(event.target.value)}><option value="">Choose an enabled user</option>{users.filter(user => user.id !== pending.user.id && user.disabled === false).map(user => <option key={user.id} value={user.id}>{user.email}</option>)}</select></label>}
      {(pending.type === "recovery" || pending.type === "mfa-reset") && <label className="flex items-start gap-2"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} />I verified this person&apos;s identity out of band. Recovery links are handed over personally, never emailed.</label>}
      {pending.type === "passkey" && <label className="grid gap-1">Passkey<select aria-label="Passkey" value={passkeyId} onChange={event => setPasskeyId(event.target.value)}><option value="">Choose a passkey</option>{pending.user.passkeys?.map(key => <option key={key.id} value={key.id}>{key.name || "Unnamed passkey"}{key.createdAt == null ? "" : ` · ${new Date(key.createdAt).toLocaleString()}`}</option>)}</select></label>}

    </AdminConfirmDialog>}
    {reauthOpen && pending && <ReauthDialog purpose="admin.recovery" client={auth} onCancel={cancel} onVerified={proof => submit(proof)} />}
    {secret && <Dialog open onOpenChange={open => { if (!open) { setSecret(null); setCopied(""); } }}><DialogContent aria-describedby={undefined}><DialogTitle>{secret.title}</DialogTitle><DialogDescription>Shown once. Copy now for personal handover; closing discards this value.</DialogDescription><code className="break-all">{secret.value}</code><Button onClick={() => {
      void navigator.clipboard.writeText(secret.value).then(() => setCopied("Copied.")).catch(() => setCopied("Copy failed. Select and copy the value manually."));
    }}>Copy</Button>{copied && <p role="status">{copied}</p>}<Button variant="outline" onClick={() => { setSecret(null); setCopied(""); }}>Done</Button></DialogContent></Dialog>}
  </div></SettingsFrame>;
}
function InviteHistory({ apiFetch, revision }: { apiFetch: AdminFetch; revision: number }) {
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void adminRequest<{ invites: typeof invites }>(apiFetch, "/api/admin/invites").then(data => { if (active) setInvites(data.invites.map(({ id, email, issuedBy, createdAt, expiresAt, status }) => ({ id, email, issuedBy, createdAt, expiresAt, status }))); }).catch(error => { if (active) setError(errorMessage(error)); });
    return () => { active = false; };
  }, [apiFetch, revision]);
  return <div className="space-y-2"><h3 className="font-medium">Invite history</h3>{error && <p role="alert">{error}</p>}{invites.map(invite => <p key={invite.id} className="text-sm">{invite.email || "Legacy invite"} · {invite.status} · Issued by {invite.issuedBy || "Operator"} · {invite.expiresAt ? `Expires ${new Date(invite.expiresAt).toLocaleString()}` : "No expiry"}</p>)}</div>;
}
