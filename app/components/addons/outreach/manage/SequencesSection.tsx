"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { Sequence, SequenceSummary } from "@/lib/addons/outreach/types";
import { useOutreachManage, useResource } from "./manageContext";
import { EmptyState, ErrorNote, LoadingNote, RowButton, SectionHeader, SequenceStatusBadge, useOutreachFormat, useRates } from "./ui";
import SequenceEditor from "./SequenceEditor";

export default function SequencesSection({ id }: { id: string | null }) {
  if (id === "new") return <SequenceEditor key="new" sequence={null} />;
  if (id) return <SequenceLoader key={id} sequenceId={id} />;
  return <SequenceList />;
}

function SequenceList() {
  const t = useTranslations("outreach");
  const { api, canEdit, navigate, lists } = useOutreachManage();
  const format = useOutreachFormat();
  const rates = useRates();
  const sequences = useResource(() => api.get<{ sequences: SequenceSummary[] }>("sequences").then(body => body.sequences), [api]);
  const { ensure } = lists;
  useEffect(() => { ensure(); }, [ensure]);
  const create = () => navigate({ section: "sequences", id: "new" });
  const listName = (id: string | null) => id ? lists.data?.find(list => list.id === id)?.name ?? t("campaigns.unknownList") : t("sequences.noTrigger");
  return (
    <>
      <SectionHeader title={t("sequences.title")} description={t("sequences.description")}
        actions={canEdit ? <Button onClick={create}><Plus />{t("sequences.new")}</Button> : undefined} />
      <ErrorNote error={sequences.error} onRetry={() => void sequences.reload()} />
      {!sequences.data && sequences.loading ? <LoadingNote /> : null}
      {sequences.data && sequences.data.length === 0 ? (
        <EmptyState title={t("sequences.emptyTitle")} text={canEdit ? t("sequences.emptyText") : t("sequences.emptyTextReadOnly")}
          action={canEdit ? <Button onClick={create}><Plus />{t("sequences.new")}</Button> : undefined} />
      ) : null}
      {sequences.data && sequences.data.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {sequences.data.map(sequence => (
            <li key={sequence.id}>
              <RowButton onClick={() => navigate({ section: "sequences", id: sequence.id })}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{sequence.name || t("sequences.untitled")}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("sequences.rowSummary", { list: listName(sequence.triggerListId), steps: sequence.stepCount, active: format.number(sequence.activeEnrollments) })}
                  </span>
                </span>
                <SequenceStatusBadge status={sequence.status} />
                {sequence.status !== "draft" ? <span className="text-xs text-muted-foreground tabular-nums">{rates(sequence.stats)}</span> : null}
              </RowButton>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function SequenceLoader({ sequenceId }: { sequenceId: string }) {
  const t = useTranslations("outreach");
  const { api, navigate } = useOutreachManage();
  const loaded = useResource(() => api.get<{ sequence: Sequence }>(`sequences/${encodeURIComponent(sequenceId)}`).then(body => body.sequence), [api, sequenceId]);
  if (!loaded.data) {
    return (
      <>
        <SectionHeader title={t("sequences.title")} onBack={() => navigate({ section: "sequences" })} />
        <ErrorNote error={loaded.error} onRetry={() => void loaded.reload()} />
        {loaded.loading ? <LoadingNote /> : null}
      </>
    );
  }
  return <SequenceEditor sequence={loaded.data} />;
}
