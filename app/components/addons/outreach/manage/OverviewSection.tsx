"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/app/components/ui/button";
import type { CampaignSummary, OutreachOverview } from "@/lib/addons/outreach/types";
import { useOutreachManage, useResource } from "./manageContext";
import { CampaignStatusBadge, EmptyState, ErrorNote, Figure, LoadingNote, RowButton, SectionHeader, StatsFigures, useOutreachFormat, useRates } from "./ui";

const RECENT_CAMPAIGNS = 5;

export default function OverviewSection() {
  const t = useTranslations("outreach");
  const { api, navigate, canEdit } = useOutreachManage();
  const format = useOutreachFormat();
  const rates = useRates();
  const overview = useResource(() => api.get<OutreachOverview>("overview"), [api]);
  const campaigns = useResource(() => api.get<{ campaigns: CampaignSummary[] }>("campaigns").then(body => body.campaigns), [api]);
  const recent = [...(campaigns.data ?? [])]
    .sort((a, b) => (b.finishedAt ?? b.sendAt ?? b.updatedAt) - (a.finishedAt ?? a.sendAt ?? a.updatedAt))
    .slice(0, RECENT_CAMPAIGNS);
  const data = overview.data;

  return (
    <>
      <SectionHeader title={t("overview.title")} description={t("overview.description")} />
      <ErrorNote error={overview.error} onRetry={() => void overview.reload()} />
      {!data && overview.loading ? <LoadingNote /> : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Figure label={t("overview.contacts")} value={data.contacts} />
            <Figure label={t("overview.subscribed")} value={data.subscribed} part={data.subscribed} whole={data.contacts} />
            <Figure label={t("overview.lists")} value={data.lists} />
            <Figure label={t("overview.campaigns")} value={data.campaigns} />
            <Figure label={t("overview.sequencesLive")} value={data.sequencesLive} />
          </div>
          <section aria-labelledby="outreach-last30" className="flex flex-col gap-2">
            <h3 id="outreach-last30" className="font-medium">{t("overview.last30Days", { sent: format.number(data.last30Days.sent) })}</h3>
            <StatsFigures stats={data.last30Days} />
          </section>
          {data.contacts === 0 ? (
            <EmptyState title={t("overview.emptyTitle")} text={t("overview.emptyText")}
              action={<Button variant="outline" onClick={() => navigate({ section: "contacts" })}>{t("overview.toContacts")}</Button>} />
          ) : null}
        </>
      ) : null}
      <section aria-labelledby="outreach-recent" className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 id="outreach-recent" className="flex-1 font-medium">{t("overview.recentCampaigns")}</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate({ section: "campaigns" })}>{t("overview.allCampaigns")}</Button>
        </div>
        <ErrorNote error={campaigns.error} onRetry={() => void campaigns.reload()} />
        {campaigns.data && recent.length === 0 ? (
          <EmptyState title={t("campaigns.emptyTitle")} text={canEdit ? t("campaigns.emptyText") : t("campaigns.emptyTextReadOnly")}
            action={canEdit ? <Button onClick={() => navigate({ section: "campaigns", id: "new" })}>{t("campaigns.new")}</Button> : undefined} />
        ) : null}
        {recent.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {recent.map(campaign => (
              <li key={campaign.id}>
                <RowButton onClick={() => navigate({ section: "campaigns", id: campaign.id })}>
                  <span className="min-w-0 flex-1 truncate font-medium">{campaign.name || t("campaigns.untitled")}</span>
                  <CampaignStatusBadge status={campaign.status} />
                  <span className="text-xs text-muted-foreground tabular-nums">{rates(campaign.stats)}</span>
                </RowButton>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
