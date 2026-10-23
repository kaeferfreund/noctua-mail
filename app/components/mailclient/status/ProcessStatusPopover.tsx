"use client";

import { useLocale, useTranslations } from "next-intl";

import { useMemo } from "react";
import { X } from "lucide-react";
import { Badge, Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { getFolderDisplayName } from "@/lib/i18n/folderNames";
import type { UiLocale } from "@/lib/i18n/config";
import type { Folder } from "@/lib/data";
import type { SyncJobProgress } from "../types";
import {
  BottomStatusTriggerButton,
  type BottomStatusTone
} from "./BottomStatusSection";
import StatusPanelFrame from "@/app/components/shell/StatusPanelFrame";
import TooltipIconButton from "@/app/components/TooltipIconButton";

type ProcessStatusPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSyncing: boolean;
  isRecomputingThreads: boolean;
  isRecomputingCategories: boolean;
  syncingFolders: Set<string>;
  syncProgressItems: SyncJobProgress[];
  accountFolders: Folder[];
};

type StatusTranslator = ReturnType<typeof useTranslations<"Shell.status">>;

function formatSyncPercent(percent?: number) {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return "";
  const normalized = Math.max(0, Math.min(100, percent));
  return normalized % 1 === 0 ? `${normalized.toFixed(0)}%` : `${normalized.toFixed(1)}%`;
}

function formatSyncCount(progress: SyncJobProgress) {
  const processed =
    typeof progress.processed === "number" && Number.isFinite(progress.processed)
      ? Math.max(0, Math.round(progress.processed))
      : 0;
  if (
    typeof progress.estimatedTotal === "number" &&
    Number.isFinite(progress.estimatedTotal) &&
    progress.estimatedTotal > 0
  ) {
    return `${processed}/${Math.max(0, Math.round(progress.estimatedTotal))}`;
  }
  if (processed <= 0) return "";
  return `${processed}`;
}

function formatRetryLabel(progress: SyncJobProgress, t: StatusTranslator) {
  const { retryAttempt, maxRetries } = progress;
  if (typeof retryAttempt === "number" && typeof maxRetries === "number") {
    return t("retryCount", { attempt: retryAttempt, max: maxRetries });
  }
  return t("retry");
}

function formatSyncProgressSummary(progress: SyncJobProgress, t: StatusTranslator) {
  const modeLabel = t(`modes.${progress.mode}`);
  if (progress.phase === "retrying") {
    return `${modeLabel} · ${formatRetryLabel(progress, t)}`;
  }
  const countLabel = formatSyncCount(progress);
  const percentLabel = formatSyncPercent(progress.percent);
  const metrics = [percentLabel, countLabel].filter(Boolean).join(" · ");
  const explicitMessage = progress.message?.trim();
  if (explicitMessage) {
    return metrics ? `${modeLabel} · ${explicitMessage} · ${metrics}` : `${modeLabel} · ${explicitMessage}`;
  }
  const phaseLabel = t(`phases.${progress.phase}`);
  return metrics ? `${modeLabel} · ${phaseLabel} · ${metrics}` : `${modeLabel} · ${phaseLabel}`;
}

function resolveSyncScopeLabel(progress: SyncJobProgress, folderById: Map<string, Folder>, locale: UiLocale, t: StatusTranslator) {
  const folder = progress.folderId ? folderById.get(progress.folderId) : undefined;
  const folderName = folder ? getFolderDisplayName(folder, locale) : undefined;
  return folderName || progress.mailboxPath || t("mailbox");
}

export default function ProcessStatusPopover({
  open,
  onOpenChange,
  isSyncing,
  isRecomputingThreads,
  isRecomputingCategories,
  syncingFolders,
  syncProgressItems,
  accountFolders
}: ProcessStatusPopoverProps) {
  const t = useTranslations("Shell.status");
  const locale = useLocale();
  const folderById = useMemo(
    () => new Map(accountFolders.map((folder) => [folder.id, folder])),
    [accountFolders]
  );
  const syncingFolderItems = Array.from(syncingFolders)
    .map((folderId) => folderById.get(folderId))
    .filter((folder): folder is Folder => Boolean(folder));
  const sortedSyncProgressItems = useMemo(
    () => [...syncProgressItems].sort((left, right) => right.updatedAt - left.updatedAt),
    [syncProgressItems]
  );
  const syncProgressFolderIds = useMemo(
    () =>
      new Set(
        sortedSyncProgressItems
          .map((progress) => progress.folderId)
          .filter((folderId): folderId is string => Boolean(folderId))
      ),
    [sortedSyncProgressItems]
  );
  const fallbackSyncingFolderItems = syncingFolderItems.filter(
    (folder) => !syncProgressFolderIds.has(folder.id)
  );
  const syncRows = [
    ...sortedSyncProgressItems.map((progress) => ({
      key: progress.jobId,
      title: resolveSyncScopeLabel(progress, folderById, locale, t),
      detail: formatSyncProgressSummary(progress, t)
    })),
    ...fallbackSyncingFolderItems.map((folder) => ({
      key: `fallback-${folder.id}`,
      title: getFolderDisplayName(folder, locale),
      detail: t("preparingSync")
    }))
  ];
  const additionalProcessRows = [
    isRecomputingThreads ? t("recomputingThreads") : "",
    isRecomputingCategories ? t("recomputingCategories") : ""
  ].filter(Boolean);
  const activeProcessCount = syncRows.length + additionalProcessRows.length;
  const latestSyncProgress = sortedSyncProgressItems[0] ?? null;
  const latestSyncStatusValue = (() => {
    if (latestSyncProgress) {
      const scopeLabel = resolveSyncScopeLabel(latestSyncProgress, folderById, locale, t);
      const modeLabel = t(`modes.${latestSyncProgress.mode}`);
      if (latestSyncProgress.phase === "retrying") {
        return t("syncRetryScope", { mode: modeLabel, retry: formatRetryLabel(latestSyncProgress, t), scope: scopeLabel });
      }
      // During the post-fetch finalizing tail the percent sits at 100, so
      // surface the step message instead — that's where the spinner outlives
      // the fetch and the user wants to know what's happening.
      const finalizingMessage = latestSyncProgress.message?.trim();
      if (latestSyncProgress.phase === "finalizing" && finalizingMessage) {
        return `${scopeLabel}: ${finalizingMessage}`;
      }
      const percentLabel = formatSyncPercent(latestSyncProgress.percent);
      return t("syncingScope", { scope: scopeLabel, mode: modeLabel, percent: percentLabel || "none" });
    }
    if (syncingFolderItems.length > 0) {
      return t("syncingFolders", { folder: getFolderDisplayName(syncingFolderItems[0], locale), more: syncingFolderItems.length - 1 });
    }
    return isSyncing ? t("syncingMailbox") : "";
  })();
  const processStatusItems = [
    latestSyncStatusValue,
    ...additionalProcessRows
  ].filter(Boolean);
  const processStatusValue = processStatusItems.length > 0 ? processStatusItems.join(" · ") : t("idle");
  const processStatusTone: BottomStatusTone = processStatusItems.length > 0 ? "normal" : "muted";

  return (
    <StatusPanelFrame open={open} onOpenChange={onOpenChange} title={t("processes")}
      trigger={<BottomStatusTriggerButton
          label={t("processes")}
          value={processStatusValue}
          tone={processStatusTone}
        />}
      contentProps={{ className: "bottom-popover bottom-popover-process",
        side: "top",
        align: "start",
        sideOffset: 8, }}
    >
        <Flex align="center" justify="between" className="popover-title-row">
          <Flex align="baseline" gap="3">
            <Heading size="3" weight="medium" className="reminder-main-title">
              {t("processes")}
            </Heading>
            <Badge color="gray" variant="soft" radius="full">
              {activeProcessCount}
            </Badge>
          </Flex>
          <TooltipIconButton
            variant="ghost"
            color="gray"
            size="2"
            tooltip={t("closeProcesses")}
            onClick={() => onOpenChange(false)}
          >
            <X size={16} />
          </TooltipIconButton>
        </Flex>
        <Box className="popover-body">
          {activeProcessCount > 0 ? (
            <Card size="1" className="process-item-card">
              <div className="process-list">
                {syncRows.map((row) => (
                  <div key={row.key} className="process-row">
                    <Text size="2" weight="medium" className="process-row-title">
                      {row.title}
                    </Text>
                    <Text size="1" color="gray" className="process-row-detail">
                      {row.detail}
                    </Text>
                  </div>
                ))}
                {additionalProcessRows.map((row) => (
                  <div key={row} className="process-row">
                    <Text size="2" weight="medium" className="process-row-title">
                      {row}
                    </Text>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Flex align="center" justify="center" p="4" className="empty-state">
              <Text size="2" color="gray">{t("noProcesses")}</Text>
            </Flex>
          )}
        </Box>
    </StatusPanelFrame>
  );
}
