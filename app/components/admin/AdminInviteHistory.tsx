"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/i18n/format";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { Button } from "@/app/components/ui/button";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { adminHeaderRow } from "./adminLayout";
import type { AdminInvite } from "./types";

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
    <div className={adminHeaderRow}><h3 className="font-medium">{t("invites.history")}</h3>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => { setActionError(null); setPending({ type: "cleanup" }); }}>{t("invites.cleanup")}</Button></div>
    {Boolean(error) && <p role="alert">{formatAdminError(error, t, locale)}</p>}
    {cleaned !== null && <p role="status" className="text-sm text-muted-foreground">{t("invites.cleaned", {count: cleaned})}</p>}
    {invites.map(invite => <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm">{label(invite)} · {t(`invites.status.${invite.status}`)} · {t("invites.issuedBy", {name: issuer(invite)})} · {invite.expiresAt ? t("invites.expires", {time: dateTime(invite.expiresAt)}) : t("invites.noExpiry")}</p>
      {invite.status === "issued" && <Button variant="outline" size="sm" disabled={busy} aria-label={t("invites.revokeFor", {name: label(invite)})}
        onClick={() => { setActionError(null); setPending({ type: "revoke", invite }); }}>{t("invites.revoke")}</Button>}
    </div>)}
    {pending && <AdminConfirmDialog busy={busy} error={actionError ? formatAdminError(actionError, t, locale) : undefined} onCancel={close} onConfirm={() => void confirm()}
      title={pending.type === "cleanup" ? t("invites.cleanup") : t("invites.revokeTitle")}
      description={pending.type === "cleanup" ? t("invites.cleanupConfirm") : t("invites.revokeConfirm", {name: label(pending.invite)})} />}
  </div>;
}
