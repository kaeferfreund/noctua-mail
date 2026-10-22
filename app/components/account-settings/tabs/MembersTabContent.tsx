"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountRole } from "@/lib/data";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import AdminConfirmDialog from "@/app/components/admin/AdminConfirmDialog";
import type { AdminUser, Member, MemberCandidate } from "@/app/components/admin/types";
import { adminRequest, errorMessage, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";

const roles: AccountRole[] = ["viewer", "editor", "manager"];
export default function MembersTabContent({ accountId, accessRole, apiFetch = fetch, admin = false, initialMembers, users, currentUserId, onChanged }: {
  accountId: string; accessRole?: AccountRole; apiFetch?: AdminFetch; admin?: boolean; initialMembers?: Member[]; users?: AdminUser[]; currentUserId?: string; onChanged?: () => void;
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers ?? []);
  const [directory, setDirectory] = useState<(MemberCandidate & { disabled?: boolean })[]>(admin ? users ?? [] : []);
  const [actor, setActor] = useState(currentUserId ?? "");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
      } catch (error) { if (active) setError(errorMessage(error)); }
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
      .catch(error => { if (active) { setDirectory([]); setError(errorMessage(error)); } })
      .finally(() => { if (active) setDirectoryLoading(false); });
    return () => { active = false; };
  }, [allowed, admin, loadCandidates]);
  if (!allowed) return null;
  const enabledManagers = members.filter(member => !member.disabled && (member.isOwner || member.role === "manager")).length;
  const available = directory.filter(user => !user.disabled && !members.some(member => member.userId === user.id));
  const mutate = async (userId: string, nextRole: AccountRole | null) => {
    setBusy(true); setError("");
    try {
      const base = admin ? "/api/admin/accounts" : "/api/accounts";
      const result = await adminRequest<{ cleanupPending?: boolean }>(apiFetch, `${base}/${encodeURIComponent(accountId)}/members/${encodeURIComponent(userId)}`,
        nextRole ? jsonMutation("PUT", { role: nextRole }) : jsonMutation("DELETE"));
      setPending(null); setTarget(""); await load(); if (!admin) setDirectory(await loadCandidates()); onChanged?.();
      if (result.cleanupPending) setError("Access was revoked; server cleanup is pending.");
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4 overflow-auto p-1">
    <p className="text-sm text-muted-foreground">Owners cannot be changed here. Keep at least one enabled manager. You may remove yourself when another manager remains.</p>
    {loading && <p role="status">Loading members…</p>}
    {error && !pending && <p role="alert" className="text-destructive">{error}</p>}
    <table className="w-full text-left text-sm"><caption className="sr-only">Mailbox members</caption>
      <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{members.map(member => {
        const lastManager = !member.disabled && member.role === "manager" && enabledManagers <= 1;
        return <tr key={member.userId} className="border-b"><td className="py-3">{member.name || member.email}<div className="text-muted-foreground">{member.email}</div>{member.isOwner && <span>Owner</span>}</td>
          <td><select aria-label={`Role for ${member.email}`} value={member.role} disabled={busy || member.disabled || member.isOwner || (!admin && (!actor || member.userId === actor))}
            onChange={event => { setError(""); setPending({ member, role: event.target.value as AccountRole }); }}>
            {roles.map(role => <option key={role} value={role} disabled={lastManager && role !== "manager"}>{role}</option>)}
          </select></td><td>{member.disabled ? "Disabled" : "Enabled"}</td>
          <td><Button variant="outline" disabled={busy || member.isOwner || lastManager || !actor} title={member.isOwner ? "Owner cannot be removed" : lastManager ? "Last enabled manager" : undefined}
            onClick={() => { setError(""); setPending({ member, role: null }); }}>Remove</Button></td></tr>;
      })}</tbody></table>
    {!admin && <form className="flex items-end gap-3" onSubmit={event => { event.preventDefault(); setTarget(""); setSearch(query.trim()); }}>
      <label className="grid gap-1 text-sm">Find users<Input value={query} maxLength={128} onChange={event => setQuery(event.target.value)} /></label><Button disabled={directoryLoading}>Search users</Button>
      <p className="text-sm text-muted-foreground">Up to 100 enabled non-members. Search by name or email.</p>
    </form>}
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); if (target) void mutate(target, role); }}>
      <label className="grid gap-1 text-sm">Add existing enabled user<select aria-label="Add existing enabled user" value={target} disabled={busy || loading || directoryLoading} onChange={event => setTarget(event.target.value)}>
        <option value="">Choose a user</option>{available.map(user => <option key={user.id} value={user.id}>{user.name || user.email} ({user.email})</option>)}
      </select></label>
      <label className="grid gap-1 text-sm">New member role<select value={role} onChange={event => setRole(event.target.value as AccountRole)}>{roles.map(role => <option key={role} value={role}>{role}</option>)}</select></label>
      <Button disabled={busy || !target}>Add member</Button>
    </form>

    {pending && <AdminConfirmDialog title={pending.role ? "Change member role" : "Remove member"} description={`${pending.member.email}: ${pending.role ? `change role to ${pending.role}` : "revoke mailbox access"}.`}
      busy={busy} error={error} onCancel={() => { setPending(null); setError(""); }} onConfirm={() => void mutate(pending.member.userId, pending.role)} />}
  </div>;
}
