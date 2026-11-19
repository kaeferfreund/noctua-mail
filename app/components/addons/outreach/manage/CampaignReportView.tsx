"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Ban, RefreshCw } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { CampaignReport } from "@/lib/addons/outreach/types";
import { useOutreachManage, usePagedResource } from "./manageContext";
import { CampaignStatusBadge, ConfirmDialog, ErrorNote, LoadingNote, SectionHeader, StatsFigures, TraceLine, useOutreachFormat } from "./ui";
import type { CampaignMeta } from "./CampaignEditor";
import { campaignWhen } from "./CampaignsSection";
import SendsTable from "./SendsTable";

/** A campaign past its draft: when it goes or went out, cancel while it is pending, and its report. */
export default function CampaignReportView({ campaign, scheduledRecipients, onChanged }: {
  campaign: CampaignMeta; scheduledRecipients: number | null; onChanged: (campaign: CampaignMeta) => void;
}) {
  const t = useTranslations("outreach");
  const { api, canEdit, navigate, lists } = useOutreachManage();
  const format = useOutreachFormat();
  const path = `campaigns/${encodeURIComponent(campaign.id)}`;
  const paged = usePagedResource(
    (cursor: string | null) => api.get<CampaignReport>(`${path}/report`, { cursor }),
    page => ({ items: page.recipients, next: page.nextCursor }),
    [api, path, campaign.status]
  );
  const report = paged.first;
  const recipients = paged.items;
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { ensure: ensureLists } = lists;
  useEffect(() => { ensureLists(); }, [ensureLists]);

  const cancel = async () => {
    setBusy(true); setError(null);
    try {
      const result = await api.send<{ campaign: CampaignMeta }>("POST", `${path}/cancel`);
      setConfirmCancel(false);
      onChanged(result.campaign);
    } catch (caught) { setError(caught); }
    finally { setBusy(false); }
  };
  const refresh = () => void report.reload();

  // Status, times and actions follow the newest state: the reloaded report or a newer prop (after cancelling).
  const shown: CampaignMeta = report.data && report.data.campaign.updatedAt >= campaign.updatedAt ? report.data.campaign : campaign;
  const pending = shown.status === "scheduled" || shown.status === "sending";
  const stats = report.data?.stats;
  const listNames = (ids: string[]) => ids.map(id => lists.data?.find(list => list.id === id)?.name ?? t("campaigns.unknownList")).join(", ");

  return (
    <>
      <SectionHeader title={shown.name || t("campaigns.untitled")} description={campaignWhen(shown, t, format.dateTime)}
        onBack={() => navigate({ section: "campaigns" })}
        actions={<>
          <CampaignStatusBadge status={shown.status} />
          <Button variant="ghost" size="sm" onClick={refresh} disabled={report.loading}><RefreshCw />{t("actions.refresh")}</Button>
          {canEdit && pending ? <Button variant="destructive" onClick={() => { setError(null); setConfirmCancel(true); }}><Ban />{t("campaigns.cancel")}</Button> : null}
        </>} />
      {scheduledRecipients !== null && pending ? (
        <p role="status" className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {shown.sendAt && shown.status === "scheduled"
            ? t("campaigns.scheduledFor", { count: scheduledRecipients, formatted: format.number(scheduledRecipients), date: format.dateTime(shown.sendAt) })
            : t("campaigns.sendingTo", { count: scheduledRecipients, formatted: format.number(scheduledRecipients) })}
        </p>
      ) : null}
      <TraceLine action="scheduled" userId={shown.scheduledByUserId} via={shown.scheduledVia} />
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border p-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-muted-foreground">{t("content.subject")}</dt><dd className="truncate">{shown.subject || "–"}</dd>
        <dt className="text-muted-foreground">{t("campaigns.lists")}</dt><dd>{listNames(shown.listIds) || "–"}</dd>
        {shown.excludedListIds.length > 0 ? <><dt className="text-muted-foreground">{t("campaigns.excludedLists")}</dt><dd>{listNames(shown.excludedListIds)}</dd></> : null}
        <dt className="text-muted-foreground">{t("sending.tracking")}</dt>
        <dd>{shown.trackOpens || shown.trackClicks
          ? [shown.trackOpens && t("sending.trackOpens"), shown.trackClicks && t("sending.trackClicks")].filter(Boolean).join(", ")
          : t("sending.trackingOff")}</dd>
      </dl>
      <ErrorNote error={paged.error} onRetry={() => void report.reload()} />
      {!report.data && report.loading ? <LoadingNote /> : null}
      {stats ? (
        <>
          <section aria-labelledby="campaign-figures" className="flex flex-col gap-2">
            <h3 id="campaign-figures" className="font-medium">{t("report.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("report.progress", { recipients: format.number(stats.recipients), sent: format.number(stats.sent), queued: format.number(stats.queued), failed: format.number(stats.failed), skipped: format.number(stats.skipped) })}
            </p>
            <StatsFigures stats={stats} />
            <p className="text-xs text-muted-foreground">{t("report.ratesNote")}</p>
          </section>
          <section aria-labelledby="campaign-links" className="flex flex-col gap-2">
            <h3 id="campaign-links" className="font-medium">{t("report.links")}</h3>
            {report.data!.links.length === 0 ? <p className="text-sm text-muted-foreground">{t("report.noLinks")}</p> : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("report.links")}</caption>
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">{t("report.url")}</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">{t("report.uniqueClicks")}</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">{t("report.clicks")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...report.data!.links].sort((a, b) => b.uniqueClicks - a.uniqueClicks).map(link => (
                      <tr key={link.url}>
                        <td className="max-w-[20rem] truncate px-3 py-2" title={link.url}>{link.url}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{format.number(link.uniqueClicks)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{format.number(link.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section aria-labelledby="campaign-recipients" className="flex flex-col gap-2">
            <h3 id="campaign-recipients" className="font-medium">{t("report.recipients")}</h3>
            {recipients.length === 0
              ? <p className="text-sm text-muted-foreground">{pending ? t("report.noRecipientsYet") : t("report.noRecipients")}</p>
              : <SendsTable sends={recipients} caption={t("report.recipients")} />}
            {paged.next !== null ? (
              <div><Button variant="outline" size="sm" disabled={paged.loadingMore} onClick={() => void paged.loadMore()}>{t("actions.loadMore")}</Button></div>
            ) : null}
          </section>
        </>
      ) : null}
      {confirmCancel ? (
        <ConfirmDialog title={t("campaigns.cancelTitle")}
          description={shown.status === "sending" ? t("campaigns.cancelSendingDescription") : t("campaigns.cancelScheduledDescription")}
          confirmLabel={t("campaigns.cancel")} destructive busy={busy} error={error}
          onCancel={() => setConfirmCancel(false)} onConfirm={() => void cancel()} />
      ) : null}
    </>
  );
}
