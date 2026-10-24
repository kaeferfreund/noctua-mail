"use client";

import { Flex, Heading } from "@radix-ui/themes";
import { useTranslations } from "next-intl";
import { X, ExternalLink } from "lucide-react";
import { openDetachedWindow } from "@/lib/ui/openDetachedWindow";
import { formatCalendarPageTitle } from "@/lib/appBranding";
import CalendarEventBrowser from "./CalendarEventBrowser";
import CalendarDropOverlay from "./CalendarDropOverlay";
import { useCalendarIcsDrop } from "./useCalendarIcsDrop";
import styles from "./CalendarSidebarPanel.module.css";
import TooltipIconButton from "@/app/components/TooltipIconButton";

type Props = {
  accountId: string;
  firstDay?: 0 | 1;
  onClose: () => void;
  onOpenMessage?: (messageId: string) => void;
  onFindRelatedByInviteUid?: (uid: string) => void;
};

export default function CalendarSidebarPanel({
  accountId,
  firstDay,
  onClose,
  onOpenMessage,
  onFindRelatedByInviteUid
}: Props) {
  const t = useTranslations("Calendar.panel");
  const { dropProps, isDragOver, status, resetStatus } = useCalendarIcsDrop({ accountId });

  const handleOpenWindow = () => {
    openDetachedWindow(`/calendar/window?accountId=${encodeURIComponent(accountId)}`, {
      title: formatCalendarPageTitle()
    });
  };

  return (
    <div className={styles.panel} {...dropProps}>
      <Flex align="center" justify="between" className={styles.header}>
        <Heading size="2">{t("title")}</Heading>
        <Flex gap="1" align="center">
          <TooltipIconButton
            size="1"
            variant="ghost"
            color="gray"
            tooltip={t("openWindow")}
            aria-label={t("openWindowLabel")}
            onClick={handleOpenWindow}
          >
            <ExternalLink size={13} />
          </TooltipIconButton>
          <TooltipIconButton
            size="1"
            variant="ghost"
            color="gray"
            onClick={onClose}
            tooltip={t("close")}
          >
            <X size={15} />
          </TooltipIconButton>
        </Flex>
      </Flex>
      <div className={styles.calendarContainer}>
        <CalendarEventBrowser
          accountId={accountId}
          firstDay={firstDay}
          onOpenMessage={onOpenMessage}
          onFindRelatedByInviteUid={onFindRelatedByInviteUid}
        />
      </div>
      <CalendarDropOverlay isDragOver={isDragOver} status={status} onResetStatus={resetStatus} />
    </div>
  );
}
