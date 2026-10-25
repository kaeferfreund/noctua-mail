"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/i18n/format";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { nativeControlBaseClass, nativeControlClass } from "@/app/components/account-settings/Field";
import SettingsFrame, { SettingsTitle } from "@/app/components/shell/SettingsFrame";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { createAuthClient, type NoctuaAuthClient, type Proof } from "@/lib/authClient";
import ReauthDialog from "@/app/components/auth/ReauthDialog";
import AdminConfirmDialog from "./AdminConfirmDialog";
import AdminSecretDialog, { type AdminSecret } from "./AdminSecretDialog";
import AdminAuditLog from "./AdminAuditLog";
import AdminInviteHistory from "./AdminInviteHistory";
import AdminMailboxes from "./AdminMailboxes";
import AdminSpamSettings from "./AdminSpamSettings";
import AdminDomainIcons from "./AdminDomainIcons";
import { ADMIN_SECTIONS } from "@/lib/navigation/deepLinks";
import { adminActionRow, adminHeaderRow } from "./adminLayout";
import type { AdminUser } from "./types";

type Action = { user: AdminUser; type: "role" | "status" | "delete" | "recovery" | "mfa-reset" | "sessions" | "passkey"; role?: "admin" | "user" };
function isOwner(user: AdminUser) { return user.accounts?.some(account => account.isOwner === true) ?? false; }
function securityValue(value: boolean | undefined) { return value === undefined ? "users.unknown" : value ? "users.yes" : "users.no"; }

export type AdminSection = (typeof ADMIN_SECTIONS)[number];
type NavigationProps = { section?: AdminSection; onSectionChange?: (section: AdminSection) => void };

export default function AdminPanel({ section, onSectionChange, isAdminUser, apiFetch = fetch, client, onClose, currentUserId, onAccessChanged }: NavigationProps & { currentUserId?: string; onAccessChanged?: () => Promise<void>; isAdminUser: boolean; apiFetch?: AdminFetch; client?: NoctuaAuthClient; onClose: () => void }) {
  // Mount only for admins so no hidden panel fetches or secrets survive closing.
  return isAdminUser ? <AdminPanelContent section={section} onSectionChange={onSectionChange} currentUserId={currentUserId} onAccessChanged={onAccessChanged} apiFetch={apiFetch} client={client} onClose={onClose} /> : null;
}
function AdminPanelContent({ section, onSectionChange, apiFetch, client, onClose, currentUserId, onAccessChanged }: NavigationProps & { currentUserId?: string; onAccessChanged?: () => Promise<void>; apiFetch: AdminFetch; client?: NoctuaAuthClient; onClose: () => void }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const dateTime = (value: number | string) => formatDate(new Date(value), locale, {hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [localTab, setLocalTab] = useState<AdminSection>("users");
  const tab = section ?? localTab;
  const setTab = onSectionChange ?? setLocalTab;
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [owner, setOwner] = useState("");
  const [reauthOpen, setReauthOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [passkeyId, setPasskeyId] = useState("");
  const [secret, setSecret] = useState<AdminSecret | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviteRevision, setInviteRevision] = useState(0);
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const auth = useMemo(() => client ?? createAuthClient(apiFetch), [client, apiFetch]);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setUsers((await adminRequest<{ users: AdminUser[] }>(apiFetch, "/api/admin/users")).users); }
    catch (error) { setError(error); }
    finally { setLoading(false); }
  }, [apiFetch]);
  useEffect(() => { void load(); }, [load]);
  const begin = (action: Action) => { setActionError(null); setPending(action); setOwner(""); setReauthOpen(false); setVerified(false); setPasskeyId(""); };
  const cancel = () => { setPending(null); setActionError(null); setReauthOpen(false); setVerified(false); setPasskeyId(""); setOwner(""); };
  const sensitive = pending && ["recovery", "mfa-reset", "sessions", "passkey"].includes(pending.type);
  const submit = async (proof?: Proof) => {
    if (!pending || busy) return;
    if (sensitive && !proof) { setReauthOpen(true); return; }
    setBusy(true); setActionError(null);
    try {
      const grant = proof?.grant;
      const base = `/api/admin/users/${encodeURIComponent(pending.user.id)}`;
      if (pending.type === "role") await adminRequest(apiFetch, base, jsonMutation("PATCH", { role: pending.role }));
      if (pending.type === "status") await adminRequest(apiFetch, base, jsonMutation("PATCH", { disabled: !pending.user.disabled }));
      if (pending.type === "delete") await adminRequest(apiFetch, base, jsonMutation("DELETE", owner ? { reassignOwnerTo: owner } : {}));
      if (pending.type === "recovery") {
        const result = await adminRequest<{ url: string }>(apiFetch, `${base}/recovery`, jsonMutation("POST", { confirmedTarget: true }, grant));
        setSecret({ kind: "recovery", value: result.url });
      }
      if (pending.type === "mfa-reset") await adminRequest(apiFetch, `${base}/mfa-reset`, jsonMutation("POST", { confirmedTarget: true }, grant));
      if (pending.type === "sessions") await adminRequest(apiFetch, `${base}/sessions`, jsonMutation("DELETE", undefined, grant));
      if (pending.type === "passkey") await adminRequest(apiFetch, `${base}/passkeys/${encodeURIComponent(passkeyId)}`, jsonMutation("DELETE", undefined, grant));
      cancel(); await load();
    } catch (error) { setReauthOpen(false); setActionError(error); }
    finally { setBusy(false); }
  };
  const invite = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const data = await adminRequest<{ invite: { code: string } }>(apiFetch, "/api/admin/users", jsonMutation("POST", { email, name, role: inviteRole }));
      setSecret({ kind: "invite", value: data.invite.code }); setEmail(""); setName(""); setInviteRevision(value => value + 1);
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  };
  return <SettingsFrame open onClose={() => { if (!busy) onClose(); }}><div className="flex h-full min-h-0 flex-col gap-4">
    <div className={adminHeaderRow}><SettingsTitle>{t("title")}</SettingsTitle><Button variant="outline" disabled={busy} onClick={onClose}>{t("close")}</Button></div>
    <nav aria-label={t("sections")} className={adminActionRow}>{ADMIN_SECTIONS.map(value => <Button key={value} variant={tab === value ? "default" : "outline"} aria-pressed={tab === value} onClick={() => setTab(value)}>{t(`tabs.${value}`)}</Button>)}</nav>
    <div className="min-h-0 flex-1 overflow-auto">
      {Boolean(error) && <p role="alert" className="mb-3 text-destructive">{formatAdminError(error, t, locale)}</p>}
      {tab === "users" && <section className="space-y-4" aria-label={t("tabs.users")}><div className={adminHeaderRow}><h3 className="font-medium">{t("tabs.users")}</h3><Button variant="outline" disabled={loading || busy} onClick={() => void load()}>{t("users.refresh")}</Button></div>
        {loading && <p role="status">{t("users.loading")}</p>}
        <table className="w-full text-left text-sm"><thead><tr><th>{t("users.nameEmail")}</th><th>{t("role")}</th><th>{t("status")}</th><th>{t("users.security")}</th><th>{t("tabs.mailboxes")}</th><th>{t("actions")}</th></tr></thead>
          <tbody>{users.map(user => <tr key={user.id} className="border-b align-top"><td className="p-2">{user.name || "—"}<div>{user.email}</div></td>
            <td className="p-2"><select className={nativeControlBaseClass} aria-label={t("users.roleFor", {email: user.email})} value={user.role} disabled={busy} onChange={event => begin({ user, type: "role", role: event.target.value as "admin" | "user" })}><option value="user">{t("roles.user")}</option><option value="admin">{t("roles.admin")}</option></select></td>
            <td className="p-2">{user.disabled ? t("users.disabled") : user.disabled === false ? t("users.enabled") : t("users.unknown")}</td>
            <td className="p-2">{t("users.password", {value: t(securityValue(user.hasPassword))})}<br />{t("users.totp", {value: t(securityValue(user.twoFactorEnabled))})}<br />{t("users.passkeys", {value: user.passkeyCount ?? user.passkeys?.length ?? t("users.unknown")})}</td>
            <td className="p-2">{user.accounts?.map(account => <div key={account.id}>{account.name || account.email} · {t(`roles.${account.role}`)}{(account.isOwner === true) ? <> · {t("owner")}</> : null}</div>)}</td>
            <td className="flex flex-wrap gap-2 p-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => begin({ user, type: "status" })}>{user.disabled ? t("users.enable") : t("users.disable")}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => begin({ user, type: "sessions" })}>{t("actionTitles.sessions")}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => begin({ user, type: "recovery" })}>{t("users.recovery")}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => begin({ user, type: "mfa-reset" })}>{t("actionTitles.mfa-reset")}</Button>
              <Button size="sm" variant="outline" disabled={busy || !user.passkeys?.length} onClick={() => begin({ user, type: "passkey" })}>{t("actionTitles.passkey")}</Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => begin({ user, type: "delete" })}>{t("actionTitles.delete")}</Button></td></tr>)}</tbody></table>
      </section>}
      {tab === "invites" && <section className="space-y-4" aria-label={t("tabs.invites")}><h3 className="font-medium">{t("invites.heading")}</h3><p className="text-sm text-muted-foreground">{t("invites.help")}</p>
        <form onSubmit={event => void invite(event)} className="grid max-w-lg gap-3"><label className="grid gap-1">{t("name")}<Input required value={name} onChange={event => setName(event.target.value)} /></label><label className="grid gap-1">{t("email")}<Input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label className="grid gap-1">{t("invites.role")}<select className={nativeControlClass} value={inviteRole} onChange={event => setInviteRole(event.target.value as "user" | "admin")}><option value="user">{t("roles.user")}</option><option value="admin">{t("roles.admin")}</option></select></label><Button disabled={busy}>{t("invites.issue")}</Button></form>
        <AdminInviteHistory apiFetch={apiFetch} revision={inviteRevision} />
      </section>}
      {tab === "mailboxes" && <AdminMailboxes apiFetch={apiFetch} users={users} currentUserId={currentUserId} onAccessChanged={onAccessChanged} />}
      {tab === "audit" && <AdminAuditLog apiFetch={apiFetch} />}
      {tab === "spam" && <AdminSpamSettings apiFetch={apiFetch} />}
      {tab === "domains" && <AdminDomainIcons apiFetch={apiFetch} />}
    </div>
    {pending && !reauthOpen && <AdminConfirmDialog title={t(`actionTitles.${pending.type}`)} description={pending.type === "role" ? t("confirmations.role", {email: pending.user.email, role: t(`roles.${pending.role!}`)}) : pending.type === "status" ? t(pending.user.disabled ? "confirmations.enable" : "confirmations.disable", {email: pending.user.email}) : t("confirmations.access", {email: pending.user.email})} busy={busy} error={actionError ? formatAdminError(actionError, t, locale) : undefined}
      disabled={Boolean(((pending.type === "recovery" || pending.type === "mfa-reset") && !verified) || (pending.type === "delete" && isOwner(pending.user) && !owner) || (pending.type === "passkey" && !passkeyId.trim()))}
      onCancel={cancel} onConfirm={() => void submit()}>
      {pending.type === "delete" && <label className="grid gap-1">{t("users.reassign")}<select className={nativeControlClass} value={owner} onChange={event => setOwner(event.target.value)}><option value="">{t("users.chooseEnabled")}</option>{users.filter(user => user.id !== pending.user.id && user.disabled === false).map(user => <option key={user.id} value={user.id}>{user.email}</option>)}</select></label>}
      {(pending.type === "recovery" || pending.type === "mfa-reset") && <label className="flex items-start gap-2"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} />{t("users.verified")}</label>}
      {pending.type === "passkey" && <label className="grid gap-1">{t("users.passkey")}<select className={nativeControlClass} aria-label={t("users.passkey")} value={passkeyId} onChange={event => setPasskeyId(event.target.value)}><option value="">{t("users.choosePasskey")}</option>{pending.user.passkeys?.map(key => <option key={key.id} value={key.id}>{key.name || t("users.unnamedPasskey")}{key.createdAt == null ? "" : ` · ${dateTime(key.createdAt)}`}</option>)}</select></label>}

    </AdminConfirmDialog>}
    {reauthOpen && pending && <ReauthDialog purpose="admin.recovery" client={auth} onCancel={cancel} onVerified={proof => submit(proof)} />}
    {secret && <AdminSecretDialog key={secret.value} secret={secret} onClose={() => setSecret(null)} />}
  </div></SettingsFrame>;
}
