"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/i18n/format";

import { useCallback, useEffect, useState } from "react";
import type { AdminAuditEntry } from "@/lib/data";
import { Button } from "@/app/components/ui/button";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { adminRequest, type AdminFetch } from "@/app/hooks/useAdminApi";
import tableStyles from "@/app/components/account-settings/SettingsTable.module.css";
import { adminHeaderRow, adminSectionTitle } from "./adminLayout";

export default function AdminAuditLog({ apiFetch = fetch }: { apiFetch?: AdminFetch }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const dateTime = (value: number | string) => formatDate(new Date(value), locale, {hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(async (before?: string) => {
    setBusy(true); setError(null);
    try {
      const data = await adminRequest<{ entries: AdminAuditEntry[]; nextCursor: string | null }>(apiFetch, `/api/admin/audit?limit=50${before === undefined ? "" : `&before=${encodeURIComponent(before)}`}`);
      setEntries(previous => before === undefined ? data.entries : [...previous, ...data.entries.filter(entry => !previous.some(old => old.id === entry.id))]);
      setNextCursor(data.nextCursor);
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  }, [apiFetch]);
  useEffect(() => { void load(); }, [load]);
  return <section className="space-y-4" aria-label={t("audit.title")}><div className={adminHeaderRow}><h3 className={adminSectionTitle}>{t("audit.title")}</h3><Button variant="outline" disabled={busy} onClick={() => void load()}>{t("audit.refresh")}</Button></div>
    {Boolean(error) && <p role="alert">{formatAdminError(error, t, locale)}</p>}
    {entries.length > 0 && <div className={tableStyles.tableScroll}><table><thead><tr><th>{t("audit.time")}</th><th>{t("audit.action")}</th><th>{t("audit.actor")}</th><th>{t("audit.target")}</th></tr></thead>
      <tbody>{entries.map(entry => <tr key={entry.id}><td className="whitespace-nowrap">{dateTime(entry.createdAt)}</td><td>{entry.action}</td><td className="break-all">{entry.actorUserId}</td><td className="break-all">{entry.targetUserId ?? "—"} / {entry.targetAccountId ?? "—"}</td></tr>)}</tbody></table></div>}
    {!busy && !entries.length && <p>{t("audit.empty")}</p>}
    <Button variant="outline" disabled={busy || !nextCursor || !entries.length} onClick={() => void load(nextCursor ?? undefined)}>{busy ? t("loading") : t("audit.older")}</Button>
  </section>;
}
