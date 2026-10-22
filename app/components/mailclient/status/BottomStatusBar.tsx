"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import mobileStyles from "@/app/components/shell/MobileFrames.module.css";
import { Activity } from "lucide-react";
import { Theme } from "@radix-ui/themes";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { Button } from "@/app/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/app/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import CalendarEventBrowser from "@/app/components/calendar/CalendarEventBrowser";
import type { AccountDateFormat, CalendarEvent, Folder } from "@/lib/data";
import { formatAccountMediumDateTime } from "@/lib/dateFormatting";
import type { CalendarReminder } from "../utils/calendarReminders";
import type { ExceptionEntry, SyncJobProgress } from "../types";
import {
  BottomStatusSection,
  type BottomStatusTone
} from "./BottomStatusSection";
import ProcessStatusPopover from "./ProcessStatusPopover";
import UpcomingStatusPopover from "./UpcomingStatusPopover";
import ExceptionStatusPopover from "./ExceptionStatusPopover";
import CalendarPopover from "@/app/components/calendar/CalendarPopover";

export type BottomStatusPanel = "process" | "exception" | "reminder" | "calendar" | "mail-check" | null;

type BottomStatusBarProps = {
  onCheckNewMail?: () => void;
  isSyncing: boolean;
  isRecomputingThreads: boolean;
  isRecomputingCategories: boolean;
  syncingFolders: Set<string>;
  syncProgressItems: SyncJobProgress[];
  accountFolders: Folder[];
  mailCheckMode: "idle" | "polling";
  activeAccountId: string;
  pendingCalendarReminders: CalendarReminder[];
  upcomingEvents: CalendarEvent[];
  onRefreshPendingReminders: () => Promise<void>;
  onOpenReminderMessage: (messageId: string) => void;
  onReportError: (message: string) => void;
  exceptionEntries: ExceptionEntry[];
  onClearExceptions: () => void;
  openPanel: BottomStatusPanel;
  setOpenPanel: Dispatch<SetStateAction<BottomStatusPanel>>;
  formatRelativeTime: (timestamp?: number | null) => string;
  onReloginAccount?: (entry: ExceptionEntry) => void;
  onOpenCalendarSidebar: () => void;
  onOpenCalendarMessage?: (messageId: string) => void;
  onFindRelatedCalendarInviteUid?: (uid: string) => void;
  calendarFirstDay?: 0 | 1;
  accountDateFormat?: AccountDateFormat;
};

export default function BottomStatusBar({
  onCheckNewMail,
  isSyncing,
  isRecomputingThreads,
  isRecomputingCategories,
  syncingFolders,
  syncProgressItems,
  accountFolders,
  mailCheckMode,
  activeAccountId,
  pendingCalendarReminders,
  upcomingEvents,
  onRefreshPendingReminders,
  onOpenReminderMessage,
  onReportError,
  exceptionEntries,
  onClearExceptions,
  openPanel,
  setOpenPanel,
  formatRelativeTime,
  onReloginAccount,
  onOpenCalendarSidebar,
  onOpenCalendarMessage,
  onFindRelatedCalendarInviteUid,
  calendarFirstDay,
  accountDateFormat
}: BottomStatusBarProps) {
  const isMobile = useIsMobile();
  const [currentTimeMs, setCurrentTimeMs] = useState<number | null>(null);
  const processPanelOpen = openPanel === "process";
  const exceptionPanelOpen = openPanel === "exception";
  const reminderPanelOpen = openPanel === "reminder";
  const calendarPanelOpen = openPanel === "calendar";

  const currentDateTimeLabel = useMemo(
    () => (currentTimeMs === null ? "" : formatAccountMediumDateTime(currentTimeMs, accountDateFormat) ?? ""),
    [currentTimeMs, accountDateFormat]
  );

  useEffect(() => {
    let intervalId: number | null = null;
    const tick = () => {
      setCurrentTimeMs(Date.now());
    };
    tick();
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const handleProcessPanelOpenChange = (open: boolean) => {
    setOpenPanel((current) => (open ? "process" : current === "process" ? null : current));
  };

  const handleReminderPanelOpenChange = (open: boolean) => {
    setOpenPanel((current) => (open ? "reminder" : current === "reminder" ? null : current));
  };

  const handleExceptionPanelOpenChange = (open: boolean) => {
    setOpenPanel((current) => (open ? "exception" : current === "exception" ? null : current));
  };

  const handleCalendarPanelOpenChange = (open: boolean) => {
    setOpenPanel((current) => (open ? "calendar" : current === "calendar" ? null : current));
  };

  const mailCheckStatusValue = mailCheckMode === "idle" ? "Idle" : "Polling";
  const mailCheckStatusTone: BottomStatusTone = mailCheckMode === "idle" ? "muted" : "normal";

  return (
    <div className={isMobile ? mobileStyles.indicators : `bottom-bar ${mobileStyles.desktopStatusBar}`}>
      {isMobile ? <DropdownMenu><DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Activity and calendar" aria-busy={isSyncing}><Activity />{exceptionEntries.length > 0 ? <span className={mobileStyles.activityDot} /> : null}</Button>
      </DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem disabled={isSyncing} onSelect={() => { void onCheckNewMail?.(); }}>Check for new mail</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenPanel("process")}>Processes</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenPanel("mail-check")}>Mail check: {mailCheckStatusValue}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenPanel("reminder")}>Reminders</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenPanel("exception")}>Exceptions ({exceptionEntries.length})</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenPanel("calendar")}>Calendar</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu> : null}
      <ProcessStatusPopover
        open={processPanelOpen}
        onOpenChange={handleProcessPanelOpenChange}
        isSyncing={isSyncing}
        isRecomputingThreads={isRecomputingThreads}
        isRecomputingCategories={isRecomputingCategories}
        syncingFolders={syncingFolders}
        syncProgressItems={syncProgressItems}
        accountFolders={accountFolders}
      />
      {!isMobile && <BottomStatusSection
        label="Mail check"
        value={mailCheckStatusValue}
        tone={mailCheckStatusTone}
      />}
      {!isMobile && <CalendarPopover
        open={calendarPanelOpen}
        accountId={activeAccountId}
        firstDay={calendarFirstDay}
        onOpenChange={handleCalendarPanelOpenChange}
        onOpenSidebar={onOpenCalendarSidebar}
        triggerLabel={currentDateTimeLabel}
        onOpenMessage={onOpenCalendarMessage}
        onFindRelatedByInviteUid={onFindRelatedCalendarInviteUid}
      />}
      <ExceptionStatusPopover
        open={exceptionPanelOpen}
        onOpenChange={handleExceptionPanelOpenChange}
        exceptionEntries={exceptionEntries}
        onClearExceptions={onClearExceptions}
        formatRelativeTime={formatRelativeTime}
        onRelogin={onReloginAccount}
      />
      <UpcomingStatusPopover
        open={reminderPanelOpen}
        onOpenChange={handleReminderPanelOpenChange}
        activeAccountId={activeAccountId}
        pendingCalendarReminders={pendingCalendarReminders}
        upcomingEvents={upcomingEvents}
        onRefreshPendingReminders={onRefreshPendingReminders}
        onOpenReminderMessage={onOpenReminderMessage}
        onOpenCalendarSidebar={onOpenCalendarSidebar}
        onReportError={onReportError}
        accountDateFormat={accountDateFormat}
      />
      {isMobile ? <>
        <Sheet open={calendarPanelOpen} onOpenChange={handleCalendarPanelOpenChange}>
          <SheetContent aria-describedby={undefined} className={mobileStyles.fullscreenSheet}>
            <SheetTitle className="m-0 p-4">Calendar</SheetTitle>
            <Theme asChild><div className="flex min-h-0 flex-1 flex-col overflow-auto p-2">
              <CalendarEventBrowser accountId={activeAccountId} firstDay={calendarFirstDay}
                onOpenMessage={onOpenCalendarMessage ? (id) => { onOpenCalendarMessage(id); setOpenPanel(null); } : undefined}
                onFindRelatedByInviteUid={onFindRelatedCalendarInviteUid ? (uid) => { onFindRelatedCalendarInviteUid(uid); setOpenPanel(null); } : undefined} />
            </div></Theme>
          </SheetContent>
        </Sheet>
        <Sheet open={openPanel === "mail-check"} onOpenChange={(open) => { if (!open) setOpenPanel(null); }}>
          <SheetContent side="bottom" aria-describedby={undefined}>
            <SheetTitle className="px-4">Mail check</SheetTitle>
            <p className="px-4">{mailCheckStatusValue}</p>
          </SheetContent>
        </Sheet>
      </> : null}
    </div>
  );
}
