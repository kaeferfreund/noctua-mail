"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { Campaign, CampaignSummary } from "@/lib/addons/outreach/types";
import { useOutreachManage, useResource } from "./manageContext";
import { CampaignStatusBadge, EmptyState, ErrorNote, LoadingNote, RowButton, SectionHeader, useOutreachFormat, useRates } from "./ui";
import CampaignEditor, { type CampaignMeta } from "./CampaignEditor";
import CampaignReportView from "./CampaignReportView";

export default function CampaignsSection({ id }: { id: string | null }) {
  if (id === "new") return <CampaignEditor key="new" campaign={null} />;
  if (id) return <CampaignLoader key={id} campaignId={id} />;
  return <CampaignList />;
}

function CampaignList() {
  const t = useTranslations("outreach");
  const { api, canEdit, navigate } = useOutreachManage();
  const format = useOutreachFormat();
  const rates = useRates();
  const campaigns = useResource(() => api.get<{ campaigns: CampaignSummary[] }>("campaigns").then(body => body.campaigns), [api]);
  const sorted = [...(campaigns.data ?? [])].sort((a, b) => (b.sendAt ?? b.updatedAt) - (a.sendAt ?? a.updatedAt));
  const create = () => navigate({ section: "campaigns", id: "new" });
  return (
    <>
      <SectionHeader title={t("campaigns.title")} description={t("campaigns.description")}
        actions={canEdit ? <Button onClick={create}><Plus />{t("campaigns.new")}</Button> : undefined} />
      <ErrorNote error={campaigns.error} onRetry={() => void campaigns.reload()} />
      {!campaigns.data && campaigns.loading ? <LoadingNote /> : null}
      {campaigns.data && sorted.length === 0 ? (
        <EmptyState title={t("campaigns.emptyTitle")} text={canEdit ? t("campaigns.emptyText") : t("campaigns.emptyTextReadOnly")}
          action={canEdit ? <Button onClick={create}><Plus />{t("campaigns.new")}</Button> : undefined} />
      ) : null}
      {sorted.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {sorted.map(campaign => (
            <li key={campaign.id}>
              <RowButton onClick={() => navigate({ section: "campaigns", id: campaign.id })}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{campaign.name || t("campaigns.untitled")}</span>
                  <span className="truncate text-xs text-muted-foreground">{campaignWhen(campaign, t, format.dateTime)}</span>
                </span>
                <CampaignStatusBadge status={campaign.status} />
                {campaign.status !== "draft" ? <span className="text-xs text-muted-foreground tabular-nums">{rates(campaign.stats)}</span> : null}
              </RowButton>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

type Translate = ReturnType<typeof useTranslations<"outreach">>;

export function campaignWhen(campaign: Pick<Campaign, "status" | "sendAt" | "startedAt" | "finishedAt" | "updatedAt">, t: Translate, dateTime: (value: number) => string) {
  if (campaign.finishedAt) return t("campaigns.when.finished", { date: dateTime(campaign.finishedAt) });
  if (campaign.startedAt) return t("campaigns.when.started", { date: dateTime(campaign.startedAt) });
  if (campaign.sendAt && campaign.status === "scheduled") return t("campaigns.when.scheduled", { date: dateTime(campaign.sendAt) });
  return t("campaigns.when.updated", { date: dateTime(campaign.updatedAt) });
}

function CampaignLoader({ campaignId }: { campaignId: string }) {
  const t = useTranslations("outreach");
  const { api, navigate } = useOutreachManage();
  const path = `campaigns/${encodeURIComponent(campaignId)}`;
  const loaded = useResource(() => api.get<{ campaign: Campaign }>(path).then(body => body.campaign), [api, path]);
  // Scheduling or cancelling hands the newer state over without a reload; after scheduling it
  // carries the recipient count the server answered.
  const [changed, setChanged] = useState<{ campaign: CampaignMeta; recipients: number | null } | null>(null);
  if (changed) {
    return <CampaignReportView campaign={changed.campaign} scheduledRecipients={changed.recipients}
      onChanged={campaign => setChanged({ campaign, recipients: null })} />;
  }
  if (!loaded.data) {
    return (
      <>
        <SectionHeader title={t("campaigns.title")} onBack={() => navigate({ section: "campaigns" })} />
        <ErrorNote error={loaded.error} onRetry={() => void loaded.reload()} />
        {loaded.loading ? <LoadingNote /> : null}
      </>
    );
  }
  if (loaded.data.status === "draft") {
    return <CampaignEditor campaign={loaded.data} onScheduled={(campaign, recipients) => setChanged({ campaign, recipients })} />;
  }
  return <CampaignReportView campaign={loaded.data} scheduledRecipients={null} onChanged={campaign => setChanged({ campaign, recipients: null })} />;
}
