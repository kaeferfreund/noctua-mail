"use client";

import { useLocale, useTranslations } from "next-intl";
import type { UiLocale } from "@/lib/i18n/config";
import { formatDate, formatTime } from "@/lib/i18n/format";
import type { Account, Folder } from "@/lib/data";
import type { SyncJobProgress } from "../types";
import { Button } from "@/app/components/ui/button";
import StatusPanelFrame from "@/app/components/shell/StatusPanelFrame";
import { BottomStatusTriggerButton } from "./BottomStatusSection";
import { syncNeedsAttention } from "./statusIndicator";

type Props = {
  embedded?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSyncing: boolean;
  isRecomputingThreads: boolean;
  isRecomputingCategories: boolean;
  syncingFolders: Set<string>;
  syncProgressItems: SyncJobProgress[];
  accountFolders: Folder[];
  accounts?: Pick<Account, "id" | "name">[];
  onRetrySync?: (job: SyncJobProgress) => void;
};

export default function ProcessStatusPopover({ embedded, open, onOpenChange, isSyncing,
  isRecomputingThreads, isRecomputingCategories, syncingFolders, syncProgressItems,
  accountFolders, accounts = [], onRetrySync }: Props) {
  const t = useTranslations("Shell.status");
  const locale = useLocale() as UiLocale;
  const folders = new Map(accountFolders.map(folder => [folder.id, folder]));
  const jobs = [...syncProgressItems].sort((a, b) => b.updatedAt - a.updatedAt);
  const fallbackFolders = [...syncingFolders].filter(id => !jobs.some(job => job.folderId === id))
    .map(id => folders.get(id)).filter(folder => !!folder);
  const mailboxName = (id: string) => accounts.find(account => account.id === id)?.name || t("mailbox");
  // Protocol messages and paths can contain account IDs. Use structured phases
  // and resolved names for the UI, including Details; never render raw job text.
  const scopeFolder = (job: SyncJobProgress) => folders.get(job.folderId ?? "") ?? folders.get(job.mailboxPath) ?? folders.get(`${job.accountId}:${job.mailboxPath}`);
  const scope = (job: SyncJobProgress) => t("scope", {
    mailbox: mailboxName(job.accountId), folder: scopeFolder(job)?.name || t("folder")
  });
  return <StatusPanelFrame embedded={embedded} open={open} onOpenChange={onOpenChange}
    title={t("process.title")} description={t("process.description")}
    trigger={<BottomStatusTriggerButton label={t("process.title")} value={t("idle")} />}
    contentProps={{ className: "bottom-popover bottom-popover-process" }}>
    <div className="space-y-3 text-sm">
      {jobs.map(job => <div key={job.jobId} className="space-y-1 break-words">
        <p className="font-medium">{scope(job)}</p>
        <p className="text-muted-foreground">{t(`mode.${job.mode}`)} · {t(`phase.${job.phase}`)}
          {job.phase === "retrying" ? ` (${job.retryAttempt ?? 0}/${job.maxRetries ?? "…"})` : ""}
          {Number.isFinite(job.percent) ? ` · ${Math.round(Math.max(0, Math.min(100, job.percent!)))}%` : ""}
        </p>
        {syncNeedsAttention(job) ? <div className="flex flex-wrap items-start gap-2">
          {onRetrySync ? <Button size="sm" variant="outline" onClick={() => onRetrySync(job)}>{t("retry")}</Button> : null}
          <details className="min-w-0 text-sm"><summary className="cursor-pointer py-1.5">{t("details")}</summary>
            <p>{t("progress", { processed: job.processed, total: job.estimatedTotal ?? job.processed })}</p>
            {job.maxRetries !== undefined ? <p>{t("retryDetail", { attempt: job.retryAttempt ?? 0, max: job.maxRetries })}</p> : null}
            <p>{t("updatedAt", { time: `${formatDate(job.updatedAt, locale)} ${formatTime(job.updatedAt, locale)}` })}</p>
          </details>
        </div> : <p className="text-xs text-muted-foreground">{t("progress", { processed: job.processed, total: job.estimatedTotal ?? job.processed })}</p>}
      </div>)}
      {fallbackFolders.map(folder => <p key={folder.id}>{t("scope", { mailbox: mailboxName(folder.accountId), folder: folder.name })} · {t("phase.starting")}</p>)}
      {isRecomputingThreads ? <p>{t("threads")}</p> : null}
      {isRecomputingCategories ? <p>{t("categories")}</p> : null}
      {!jobs.length && !fallbackFolders.length && !isRecomputingThreads && !isRecomputingCategories
        ? <p className="text-muted-foreground">{isSyncing ? t("syncing") : t("process.empty")}</p> : null}
    </div>
  </StatusPanelFrame>;
}
