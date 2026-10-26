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
import { nativeControlBaseClass, nativeControlClass } from "@/app/components/account-settings/Field";
import tableStyles from "@/app/components/account-settings/SettingsTable.module.css";
import { Badge } from "@/app/components/ui/badge";
import StatusBadge from "@/app/components/account-settings/StatusBadge";
import { adminSectionTitle } from "@/app/components/admin/adminLayout";
import { Crown, Search } from "lucide-react";

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
  const [loadedDirectoryRequest, setLoadedDirectoryRequest] = useState<{ load: unknown } | null>(null);
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
    void loadCandidates().then(candidates => { if (active) setDirectory(candidates); })
      .catch(error => { if (active) { setDirectory([]); setError(error); } })
      .finally(() => { if (active) setLoadedDirectoryRequest({ load: loadCandidates }); });
    return () => { active = false; };
  }, [allowed, admin, loadCandidates]);
  const directoryLoading = allowed && !admin && loadedDirectoryRequest?.load !== loadCandidates;
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
    {!admin && <div className="space-y-1"><h3 className={adminSectionTitle}>{t("tabs.members")}</h3><p className="text-sm text-muted-foreground">{t("members.help")}</p></div>}
    {admin && <p className="text-sm text-muted-foreground">{t("members.help")}</p>}
    {cleanupPending && <p role="status">{t("members.cleanup")}</p>}
    {loading && <p role="status">{t("members.loading")}</p>}
    {Boolean(error) && !pending && <p role="alert" className="text-destructive">{formatAdminError(error, adminT, locale)}</p>}
    <div data-members-table className={tableStyles.tableScroll}><table className="min-w-[34rem]"><caption className="sr-only">{t("members.caption")}</caption>
      <thead><tr><th>{t("members.member")}</th><th>{t("members.role")}</th><th>{t("members.status")}</th><th><span className="sr-only">{t("members.actions")}</span></th></tr></thead>
      <tbody>{members.map(member => {
        const lastManager = !member.disabled && member.role === "manager" && enabledManagers <= 1;
        return <tr key={member.userId}><td><div className="flex items-center gap-1.5"><span className={tableStyles.primary} data-user-text>{member.name || member.email}</span>
          {member.isOwner && <Badge variant="outline" className="font-normal text-muted-foreground"><Crown aria-hidden="true" className="text-amber-600 dark:text-amber-400" />{t("members.owner")}</Badge>}</div>
          <div className={tableStyles.secondary} data-user-text>{member.email}</div></td>
          <td><select className={nativeControlBaseClass} aria-label={t("members.roleFor", {email: member.email})} value={member.role} disabled={busy || member.disabled || member.isOwner || (!admin && (!actor || member.userId === actor))}
            onChange={event => { setError(null); setPending({ member, role: event.target.value as AccountRole }); }}>
            {roles.map(role => <option key={role} value={role} disabled={lastManager && role !== "manager"}>{t(`roles.${role}`)}</option>)}
          </select></td><td><StatusBadge enabled={!member.disabled}>{member.disabled ? t("members.disabled") : t("members.enabled")}</StatusBadge></td>
          <td className="text-end"><Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busy || member.isOwner || lastManager || !actor} title={member.isOwner ? t("members.ownerCannotRemove") : lastManager ? t("members.lastManager") : undefined}
            onClick={() => { setError(null); setPending({ member, role: null }); }}>{t("members.remove")}</Button></td></tr>;
      })}</tbody></table></div>
    <div className="space-y-2 border-t pt-4">
      <h4 className="text-sm font-medium">{t("members.add")}</h4>
      <div className="flex flex-wrap items-center gap-2 text-sm md:flex-nowrap">
        {!admin && <form role="search" className="flex min-w-0 items-center gap-1 max-md:w-full md:w-44 md:shrink" onSubmit={event => { event.preventDefault(); setTarget(""); setSearch(query.trim()); }}>
          <Input className="min-w-0 flex-1" aria-label={t("members.find")} placeholder={t("members.find")} value={query} maxLength={128} onChange={event => setQuery(event.target.value)} />
          <Button variant="outline" size="icon" className="max-md:size-11" disabled={directoryLoading} aria-label={t("members.search")} title={t("members.search")}><Search /></Button>
        </form>}
        <form className="flex min-w-0 flex-wrap items-center gap-2 max-md:w-full md:flex-1 md:flex-nowrap" onSubmit={event => { event.preventDefault(); if (target) void mutate(target, role); }}>
          <select className={`${nativeControlClass} md:w-auto md:flex-1`} aria-label={t("members.addEnabled")} value={target} disabled={busy || loading || directoryLoading} onChange={event => setTarget(event.target.value)}>
            <option value="">{t("members.choose")}</option>{available.map(user => <option key={user.id} value={user.id}>{user.name || user.email} ({user.email})</option>)}
          </select>
          <select className={`${nativeControlClass} md:w-28 md:shrink-0`} aria-label={t("members.newRole")} value={role} onChange={event => setRole(event.target.value as AccountRole)}>{roles.map(role => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}</select>
          <Button className="shrink-0 whitespace-nowrap" aria-label={t("members.add")} disabled={busy || !target}>{t("members.addButton")}</Button>
        </form>
      </div>
      {!admin && <p className="text-xs text-muted-foreground">{t("members.searchHelp")}</p>}
    </div>

    {pending && <AdminConfirmDialog title={pending.role ? t("members.changeRole") : t("members.removeTitle")} description={pending.role ? t("members.confirmRole", {email: pending.member.email, role: t(`roles.${pending.role}`)}) : t("members.confirmRemove", {email: pending.member.email})}
      busy={busy} error={error ? formatAdminError(error, adminT, locale) : undefined} onCancel={() => { setPending(null); setError(null); }} onConfirm={() => void mutate(pending.member.userId, pending.role)} />}
  </div>;
}
