"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/i18n/format";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { adminHeaderRow, adminSectionTitle } from "./adminLayout";
import type { AdminInvite } from "./types";

/** Status badge colours: open invites stand out, finished ones recede. */
const statusBadge: Record<AdminInvite["status"], string> = {
  issued: "border-transparent bg-(--accent-a3) text-(--accent-11)",
  redeemed: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  revoked: "border-transparent bg-destructive/10 text-destructive",
  expired: "text-muted-foreground"
};

type Pending = { type: "cleanup" } | { type: "revoke"; invite: AdminInvite };

/** Invite history with per-invite revoke and a cleanup of redeemed, expired and revoked codes. */
export default function AdminInviteHistory({ apiFetch, revision }: { apiFetch: AdminFetch; revision: number }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const dateTime = (value: number | string) => formatDate(new Date(value), locale, {hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [cleaned, setCleaned] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void adminRequest<{ invites: AdminInvite[] }>(apiFetch, "/api/admin/invites").then(data => { if (active) { setError(null); setInvites(data.invites.map(({ id, email, issuedBy, issuerDeleted, createdAt, expiresAt, status }) => ({ id, email, issuedBy, issuerDeleted, createdAt, expiresAt, status }))); } }).catch(error => { if (active) setError(error); });
    return () => { active = false; };
  }, [apiFetch, revision, reload]);
  const label = (invite: AdminInvite) => invite.email || t("invites.legacy");
  const issuer = (invite: AdminInvite) => invite.issuedBy || t(invite.issuerDeleted ? "invites.deletedIssuer" : "invites.operator");
  const close = () => { setPending(null); setActionError(null); };
  const confirm = async () => {
    if (!pending || busy) return;
    setBusy(true); setActionError(null);
    try {
      if (pending.type === "cleanup") setCleaned((await adminRequest<{ deleted: number }>(apiFetch, "/api/admin/invites", jsonMutation("DELETE"))).deleted);
      else { await adminRequest(apiFetch, `/api/admin/invites/${encodeURIComponent(pending.invite.id)}/revoke`, jsonMutation("POST")); setCleaned(null); }
      setPending(null); setReload(value => value + 1);
    } catch (error) { setActionError(error); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    <div className={adminHeaderRow}><h3 className={adminSectionTitle}>{t("invites.history")}</h3>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => { setActionError(null); setPending({ type: "cleanup" }); }}>{t("invites.cleanup")}</Button></div>
    {Boolean(error) && <p role="alert">{formatAdminError(error, t, locale)}</p>}
    {cleaned !== null && <p role="status" className="text-sm text-muted-foreground">{t("invites.cleaned", {count: cleaned})}</p>}
    {invites.length > 0 && <ul className="m-0 list-none divide-y rounded-md border bg-(--color-panel-solid) p-0">{invites.map(invite => <li key={invite.id} data-invite className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 break-words font-medium" data-user-text>{label(invite)}</span>
          <Badge variant="outline" className={`font-normal ${statusBadge[invite.status]}`}>{t(`invites.status.${invite.status}`)}</Badge></div>
        <p className="m-0 text-xs text-muted-foreground">{t("invites.issuedBy", {name: issuer(invite)})} · {invite.expiresAt ? t("invites.expires", {time: dateTime(invite.expiresAt)}) : t("invites.noExpiry")}</p>
      </div>
      {invite.status === "issued" && <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive max-md:min-h-11" disabled={busy} aria-label={t("invites.revokeFor", {name: label(invite)})}
        onClick={() => { setActionError(null); setPending({ type: "revoke", invite }); }}>{t("invites.revoke")}</Button>}
    </li>)}</ul>}
    {pending && <AdminConfirmDialog busy={busy} error={actionError ? formatAdminError(actionError, t, locale) : undefined} onCancel={close} onConfirm={() => void confirm()}
      title={pending.type === "cleanup" ? t("invites.cleanup") : t("invites.revokeTitle")}
      description={pending.type === "cleanup" ? t("invites.cleanupConfirm") : t("invites.revokeConfirm", {name: label(pending.invite)})} />}
  </div>;
}
