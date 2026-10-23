"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDate, formatTime } from "@/lib/i18n/format";
import type { UiLocale } from "@/lib/i18n/config";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import RawTextPanel from "../message/RawTextPanel";
import {
  getExceptionDetail,
  getExceptionSummary,
  shouldOfferExceptionRelogin
} from "../utils/clientHelpers";
import type { ExceptionEntry } from "../types";
import {
  BottomStatusTriggerButton,
  type BottomStatusTone
} from "./BottomStatusSection";
import StatusPanelFrame from "@/app/components/shell/StatusPanelFrame";
import TooltipIconButton from "@/app/components/TooltipIconButton";

type ExceptionStatusPopoverProps = {
  embedded?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exceptionEntries: ExceptionEntry[];
  onClearExceptions: () => void;
  formatRelativeTime: (timestamp?: number | null) => string;
  reloginLabel?: string;
  onRelogin?: (entry: ExceptionEntry) => void;
};

export default function ExceptionStatusPopover({
  embedded,
  open,
  onOpenChange,
  exceptionEntries,
  onClearExceptions,
  formatRelativeTime,
  reloginLabel,
  onRelogin
}: ExceptionStatusPopoverProps) {
  const t = useTranslations("Shell.status");
  const locale = useLocale() as UiLocale;
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);
  const formatAbsoluteTime = (timestamp?: number | null): string | undefined => {
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return undefined;
    try {
      return `${formatDate(timestamp, locale)} ${formatTime(timestamp, locale)}`;
    } catch {
      return undefined;
    }
  };
  const latestException = exceptionEntries[0] ?? null;
  const selectedException = useMemo(() => {
    if (exceptionEntries.length === 0) return null;
    if (!selectedExceptionId) return exceptionEntries[0];
    return (
      exceptionEntries.find((entry) => entry.id === selectedExceptionId) ?? exceptionEntries[0]
    );
  }, [exceptionEntries, selectedExceptionId]);
  const selectedExceptionDetail = selectedException
    ? getExceptionDetail(selectedException.message)
    : null;
  const selectedExceptionCanRelogin = selectedException
    ? shouldOfferExceptionRelogin(selectedException.message)
    : false;
  const exceptionStatusValue = latestException ? getExceptionSummary(latestException.message) || t("error") : t("none");
  const exceptionStatusTone: BottomStatusTone = latestException ? "error" : "muted";

  const clearExceptions = () => {
    onClearExceptions();
    setSelectedExceptionId(null);
    onOpenChange(false);
  };

  return (
    <StatusPanelFrame embedded={embedded} description={t("exception.description")} open={open} onOpenChange={onOpenChange} title={t("exception.title")}
      count={exceptionEntries.length}
      trigger={<BottomStatusTriggerButton
          label={t("exception.title")}
          value={exceptionStatusValue}
          tone={exceptionStatusTone}
        />}
      contentProps={{ className: "bottom-popover", side: "top", align: "end", sideOffset: 8, }}
    >
        {embedded ? <Flex align="center" justify="between" className="popover-title exception-title">
          <Text size="1" weight="medium" className="bottom-popover-heading">
            {t("exception.title")}
          </Text>
          <TooltipIconButton
            variant="soft"
            color="gray"
            size="1"
            tooltip={t("clearExceptions")}
            onClick={clearExceptions}
          >
            <X size={12} />
          </TooltipIconButton>
        </Flex> : exceptionEntries.length > 0 ? <Flex justify="end" mb="3">
          <Button size="2" variant="soft" color="gray" onClick={clearExceptions}>{t("clearExceptions")}</Button>
        </Flex> : null}
        <Box className="popover-body">
          {exceptionEntries.length > 0 ? (
            <>
              <div className="exception-list">
                {exceptionEntries.map((entry) => {
                  const summary = getExceptionSummary(entry.message);
                  const active = selectedException?.id === entry.id;
                  const interactive = exceptionEntries.length > 1;
                  return (
                    <div
                      key={entry.id}
                      className={`exception-item ${active ? "active" : ""} ${interactive ? "interactive" : ""}`}
                      role={interactive ? "button" : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      onClick={interactive ? () => setSelectedExceptionId(entry.id) : undefined}
                      onKeyDown={
                        interactive
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedExceptionId(entry.id);
                              }
                            }
                          : undefined
                      }
                    >
                      <Text size="2" className="exception-item-summary">
                        {summary}
                      </Text>
                      <Text
                        size="1"
                        color="gray"
                        className="exception-item-time"
                        title={formatAbsoluteTime(entry.timestamp)}
                      >
                        {formatAbsoluteTime(entry.timestamp) ?? formatRelativeTime(entry.timestamp)}
                      </Text>
                    </div>
                  );
                })}
              </div>
              {selectedException && selectedExceptionDetail ? (
                <>
                  <Text
                    size="1"
                    color="gray"
                    className="exception-meta"
                    title={formatAbsoluteTime(selectedException.timestamp)}
                  >
                    {formatAbsoluteTime(selectedException.timestamp) ?? formatRelativeTime(selectedException.timestamp)}
                    {selectedException.status !== undefined ? ` · ${selectedException.status}` : ""}
                    {selectedException.requestPath ? ` · ${selectedException.requestPath}` : ""}
                  </Text>
                  <RawTextPanel
                    text={selectedExceptionDetail}
                    copyText={selectedExceptionDetail}
                    copyLabel={t("copyError")}
                    constrainHeight={false}
                  />
                  {selectedExceptionCanRelogin && onRelogin ? (
                    <Flex justify="end">
                      <Button size="1" variant="soft" onClick={() => onRelogin(selectedException)}>
                        {reloginLabel ?? t("relogin")}
                      </Button>
                    </Flex>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <Text size="2">{t("exception.empty")}</Text>
          )}
        </Box>
    </StatusPanelFrame>
  );
}
