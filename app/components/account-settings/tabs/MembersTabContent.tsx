"use client";

import { useLocale, useTranslations } from "next-intl";

import { useCallback, useEffect, useState } from "react";
import type { AccountRole } from "@/lib/data";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import AdminConfirmDialog from "@/app/components/admin/AdminConfirmDialog";
import type { AdminUser, Member, MemberCandidate } from "@/app/components/admin/types";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";

const roles: AccountRole[] = ["viewer", "editor", "manager"];
export default function MembersTabContent({ accountId, accessRole, apiFetch = fetch, admin = false, initialMembers, users, currentUserId, onChanged }: {
  accountId: string; accessRole?: AccountRole; apiFetch?: AdminFetch; admin?: boolean; initialMembers?: Member[]; users?: AdminUser[]; currentUserId?: string; onChanged?: () => void;
}) {
  const t = useTranslations("Settings");
  const adminT = useTranslations("Admin");
  const locale = useLocale();
  const [members, setMembers] = useState<Member[]>(initialMembers ?? []);
  const [directory, setDirectory] = useState<(Pick<MemberCandidate, "id" | "email"> & { name?: string | null; disabled?: boolean })[]>(admin ? users ?? [] : []);
  const [actor, setActor] = useState(currentUserId ?? "");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState("");
  const [role, setRole] = useState<AccountRole>("viewer");
  const [pending, setPending] = useState<{ member: Member; role: AccountRole | null } | null>(null);
  const allowed = admin || accessRole === "manager";
  const load = useCallback(async () => {
    if (!allowed) return;
    if (admin) {
      // Admin accounts already carry a manager-visible membership DTO.
      const data = await adminRequest<{ accounts: { id: string; members: Member[] }[] }>(apiFetch, "/api/admin/accounts");
      setMembers(data.accounts.find(account => account.id === accountId)?.members ?? []);
    } else {
      const data = await adminRequest<{ members: Member[] }>(apiFetch, `/api/accounts/${encodeURIComponent(accountId)}/members`);
      setMembers(data.members);
    }
  }, [accountId, admin, allowed, apiFetch]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void (async () => {
      try {
        await load();
        if (!currentUserId) {
          const me = await adminRequest<{ user: { id: string } }>(apiFetch, "/api/auth/me");
          if (active) setActor(me.user.id);
        }
        if (admin && !users) {
          const data = await adminRequest<{ users: AdminUser[] }>(apiFetch, "/api/admin/users");
          if (active) setDirectory(data.users);
        }
      } catch (error) { if (active) setError(error); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [allowed, apiFetch, admin, currentUserId, users, load]);
  const loadCandidates = useCallback(async () => {
    const data = await adminRequest<{ candidates: MemberCandidate[] }>(apiFetch,
      `/api/accounts/${encodeURIComponent(accountId)}/members/candidates?q=${encodeURIComponent(search)}&limit=100`);
    return data.candidates;
  }, [accountId, apiFetch, search]);
  useEffect(() => {
    if (!allowed || admin) return;
    let active = true;
    setDirectoryLoading(true);
    void loadCandidates().then(candidates => { if (active) setDirectory(candidates); })
      .catch(error => { if (active) { setDirectory([]); setError(error); } })
      .finally(() => { if (active) setDirectoryLoading(false); });
    return () => { active = false; };
  }, [allowed, admin, loadCandidates]);
  if (!allowed) return null;
  const enabledManagers = members.filter(member => !member.disabled && (member.isOwner || member.role === "manager")).length;
  const available = directory.filter(user => !user.disabled && !members.some(member => member.userId === user.id));
  const mutate = async (userId: string, nextRole: AccountRole | null) => {
    setBusy(true); setError(null); setCleanupPending(false);
    try {
      const base = admin ? "/api/admin/accounts" : "/api/accounts";
      const result = await adminRequest<{ cleanupPending?: boolean }>(apiFetch, `${base}/${encodeURIComponent(accountId)}/members/${encodeURIComponent(userId)}`,
        nextRole ? jsonMutation("PUT", { role: nextRole }) : jsonMutation("DELETE"));
      setPending(null); setTarget(""); await load(); if (!admin) setDirectory(await loadCandidates()); onChanged?.();
      setCleanupPending(Boolean(result.cleanupPending));
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4 overflow-auto p-1">
    <p className="text-sm text-muted-foreground">{t("members.help")}</p>
    {cleanupPending && <p role="status">{t("members.cleanup")}</p>}
    {loading && <p role="status">{t("members.loading")}</p>}
    {Boolean(error) && !pending && <p role="alert" className="text-destructive">{formatAdminError(error, adminT, locale)}</p>}
    <table className="w-full text-left text-sm"><caption className="sr-only">{t("members.caption")}</caption>
      <thead><tr><th>{t("members.member")}</th><th>{t("members.role")}</th><th>{t("members.status")}</th><th>{t("members.actions")}</th></tr></thead>
      <tbody>{members.map(member => {
        const lastManager = !member.disabled && member.role === "manager" && enabledManagers <= 1;
        return <tr key={member.userId} className="border-b"><td className="py-3">{member.name || member.email}<div className="text-muted-foreground">{member.email}</div>{member.isOwner && <span>{t("members.owner")}</span>}</td>
          <td><select aria-label={t("members.roleFor", {email: member.email})} value={member.role} disabled={busy || member.disabled || member.isOwner || (!admin && (!actor || member.userId === actor))}
            onChange={event => { setError(null); setPending({ member, role: event.target.value as AccountRole }); }}>
            {roles.map(role => <option key={role} value={role} disabled={lastManager && role !== "manager"}>{t(`roles.${role}`)}</option>)}
          </select></td><td>{member.disabled ? t("members.disabled") : t("members.enabled")}</td>
          <td><Button variant="outline" disabled={busy || member.isOwner || lastManager || !actor} title={member.isOwner ? t("members.ownerCannotRemove") : lastManager ? t("members.lastManager") : undefined}
            onClick={() => { setError(null); setPending({ member, role: null }); }}>{t("members.remove")}</Button></td></tr>;
      })}</tbody></table>
    {!admin && <form className="flex items-end gap-3" onSubmit={event => { event.preventDefault(); setTarget(""); setSearch(query.trim()); }}>
      <label className="grid gap-1 text-sm">{t("members.find")}<Input value={query} maxLength={128} onChange={event => setQuery(event.target.value)} /></label><Button disabled={directoryLoading}>{t("members.search")}</Button>
      <p className="text-sm text-muted-foreground">{t("members.searchHelp")}</p>
    </form>}
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); if (target) void mutate(target, role); }}>
      <label className="grid gap-1 text-sm">{t("members.addEnabled")}<select aria-label={t("members.addEnabled")} value={target} disabled={busy || loading || directoryLoading} onChange={event => setTarget(event.target.value)}>
        <option value="">{t("members.choose")}</option>{available.map(user => <option key={user.id} value={user.id}>{user.name || user.email} ({user.email})</option>)}
      </select></label>
      <label className="grid gap-1 text-sm">{t("members.newRole")}<select value={role} onChange={event => setRole(event.target.value as AccountRole)}>{roles.map(role => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}</select></label>
      <Button disabled={busy || !target}>{t("members.add")}</Button>
    </form>

    {pending && <AdminConfirmDialog title={pending.role ? t("members.changeRole") : t("members.removeTitle")} description={pending.role ? t("members.confirmRole", {email: pending.member.email, role: t(`roles.${pending.role}`)}) : t("members.confirmRemove", {email: pending.member.email})}
      busy={busy} error={error ? formatAdminError(error, adminT, locale) : undefined} onCancel={() => { setPending(null); setError(null); }} onConfirm={() => void mutate(pending.member.userId, pending.role)} />}
  </div>;
}
