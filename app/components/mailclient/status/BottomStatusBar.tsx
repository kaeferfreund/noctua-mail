"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Activity, Loader2, TriangleAlert } from "lucide-react";
import { Theme } from "@radix-ui/themes";
import { MobileStatusFocusContext, restoreStatusFocus } from "@/app/components/shell/MobileStatusFocus";
import mobileStyles from "@/app/components/shell/MobileFrames.module.css";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/app/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import calendarFrame from "@/app/components/calendar/CalendarPopover.module.css";
import styles from "./BottomStatusBar.module.css";
import CalendarEventBrowser from "@/app/components/calendar/CalendarEventBrowser";
import type { Account, AccountDateFormat, CalendarEvent, Folder } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/i18n/format";
import type { UiLocale } from "@/lib/i18n/config";
import type { BuildIdentity } from "@/lib/buildVersion";
import type { CalendarReminder } from "../utils/calendarReminders";
import type { ExceptionEntry, SyncJobProgress } from "../types";
import ProcessStatusPopover from "./ProcessStatusPopover";
import UpcomingStatusPopover from "./UpcomingStatusPopover";
import ExceptionStatusPopover from "./ExceptionStatusPopover";
import { resolveStatusIndicator } from "./statusIndicator";
import BuildInfo from "./BuildInfo";

export type BottomStatusPanel = "process" | "exception" | "reminder" | "calendar" | "mail-check" | "exceptions" | "reminders" | null;

type BottomStatusBarProps = {
  onClearMobileSelection?: () => void;
  onCheckNewMail?: () => void;
  accounts: Pick<Account, "id" | "name">[];
  onRetrySync: (job: SyncJobProgress) => void;
  mailCheckStatus: { running: boolean; lastCheckedAt: number | null; nextCheckAt: number | null };
  calendarSidebarOpen: boolean;
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
  onToggleCalendarSidebar: () => void;
  onOpenCalendarMessage?: (messageId: string) => void;
  onFindRelatedCalendarInviteUid?: (uid: string) => void;
  calendarFirstDay?: 0 | 1;
  accountDateFormat?: AccountDateFormat;
  buildInfo: BuildIdentity | null;
};

function normalizePanel(panel: BottomStatusPanel) {
  return panel === "exceptions" ? "exception" : panel === "reminders" ? "reminder" : panel;
}

/** Kept at the old import path so all existing status routes share one owner. */
export default function BottomStatusBar(props: BottomStatusBarProps) {
  const { setOpenPanel, isSyncing, exceptionEntries } = props;
  const openPanel = normalizePanel(props.openPanel);
  const t = useTranslations("Shell.status");
  const locale = useLocale() as UiLocale;
  const isMobile = useIsMobile();
  const indicatorRef = useRef<HTMLButtonElement>(null);
  const { state, attentionCount } = resolveStatusIndicator(props.syncProgressItems, exceptionEntries.length,
    isSyncing || props.isRecomputingThreads || props.isRecomputingCategories || props.syncingFolders.size > 0);
  const label = state === "attention" ? t("attention", { count: attentionCount }) : state === "syncing" ? t("syncing") : t("label");
  const changePanel = (panel: BottomStatusPanel) => (open: boolean) => setOpenPanel(current => open ? panel : normalizePanel(current) === panel ? null : current);
  const close = () => setOpenPanel(null);
  const section = openPanel === "calendar" ? "reminder" : openPanel;
  const indicator = <Button ref={indicatorRef} variant="ghost" size={isMobile ? "icon" : state === "idle" ? "icon-sm" : "sm"}
    data-status-indicator={state} aria-label={label} title={label} className="shrink-0 gap-1.5">
    {state === "attention" ? <TriangleAlert className="text-amber-600 dark:text-amber-400" />
      : state === "syncing" ? <Loader2 className="motion-safe:animate-spin" /> : <Activity />}
    {state === "syncing" && !isMobile ? <span>{t("syncing")}</span> : null}
    {attentionCount > 0 ? <span className="rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-100">{attentionCount}</span> : null}
  </Button>;
  const checkMail = <Button variant="outline" size="sm" disabled={isSyncing || props.mailCheckStatus.running}
    onClick={() => { void props.onCheckNewMail?.(); }}>{t("checkMail")}</Button>;
  const timestamp = (value: number | null) => value === null ? t("unknown") : `${formatDate(value, locale)} ${formatTime(value, locale)}`;
  const mailCheck = <div className="space-y-2 text-sm">
    <p>{props.mailCheckStatus.running ? t("checking") : t("idle")}</p>
    <p>{t("lastCheck", { time: timestamp(props.mailCheckStatus.lastCheckedAt) })}</p>
    <p>{props.mailCheckMode === "idle" ? t("liveCheck") : t("nextCheck", { time: timestamp(props.mailCheckStatus.nextCheckAt) })}</p>
    {checkMail}
  </div>;
  const calendar = <div className={`${styles.calendar} ${openPanel === "calendar" ? styles.calendarOpen : ""} ${isMobile ? mobileStyles.calendarFrame : ""}`}>
    <div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { props.onToggleCalendarSidebar(); close(); }}>
      {props.calendarSidebarOpen ? t("hideCalendarSidebar") : t("showCalendarSidebar")}
    </Button>
    <Button variant="ghost" size="sm" onClick={() => setOpenPanel(openPanel === "calendar" ? "reminder" : "calendar")}>
      {openPanel === "calendar" ? t("reminder.title") : t("calendar")}
    </Button>
    </div>
    {openPanel === "calendar" ? <div data-calendar-frame={isMobile ? "phone" : "popover"} className={isMobile ? mobileStyles.calendarBody : calendarFrame.body}><CalendarEventBrowser accountId={props.activeAccountId} firstDay={props.calendarFirstDay}
      onOpenMessage={props.onOpenCalendarMessage ? id => { props.onOpenCalendarMessage?.(id); close(); } : undefined}
      onFindRelatedByInviteUid={props.onFindRelatedCalendarInviteUid ? uid => { props.onClearMobileSelection?.(); props.onFindRelatedCalendarInviteUid?.(uid); close(); } : undefined} /></div> : null}
  </div>;
  const process = <ProcessStatusPopover embedded={!isMobile} open={openPanel === "process"} onOpenChange={changePanel("process")}
    isSyncing={isSyncing} isRecomputingThreads={props.isRecomputingThreads} isRecomputingCategories={props.isRecomputingCategories}
    syncingFolders={props.syncingFolders} syncProgressItems={props.syncProgressItems} accountFolders={props.accountFolders}
    accounts={props.accounts} onRetrySync={props.onRetrySync} />;
  const exceptions = <ExceptionStatusPopover embedded={!isMobile} open={openPanel === "exception"} onOpenChange={changePanel("exception")}
    exceptionEntries={exceptionEntries} onClearExceptions={props.onClearExceptions} formatRelativeTime={props.formatRelativeTime} onRelogin={props.onReloginAccount} />;
  const upcoming = <UpcomingStatusPopover embedded={!isMobile} open={openPanel === "reminder"} onOpenChange={changePanel("reminder")}
    activeAccountId={props.activeAccountId} pendingCalendarReminders={props.pendingCalendarReminders} upcomingEvents={props.upcomingEvents}
    onRefreshPendingReminders={props.onRefreshPendingReminders} onOpenReminderMessage={props.onOpenReminderMessage}
    onOpenCalendarSidebar={props.onOpenCalendarSidebar} onReportError={props.onReportError} accountDateFormat={props.accountDateFormat} />;
  return <MobileStatusFocusContext.Provider value={indicatorRef}>
    {isMobile ? <div className={mobileStyles.indicators}>
      <DropdownMenu><DropdownMenuTrigger asChild>{indicator}</DropdownMenuTrigger><DropdownMenuContent align="end" className="w-max max-w-[calc(100vw-1rem)]">
        <DropdownMenuItem disabled={isSyncing} onSelect={() => { void props.onCheckNewMail?.(); }}>{t("checkMail")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenPanel("process")}>{t("process.title")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenPanel("mail-check")}>{t("mailCheck.title")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenPanel("reminder")}>{t("reminder.title")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenPanel("exception")}>{t("exception.title")} ({exceptionEntries.length})</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setOpenPanel("calendar")}>{t("calendar")}</DropdownMenuItem>
        {props.buildInfo ? <><DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground tabular-nums"><BuildInfo info={props.buildInfo} /></DropdownMenuLabel></> : null}
      </DropdownMenuContent></DropdownMenu>
      {process}{exceptions}{upcoming}
      <Sheet open={openPanel === "calendar" || openPanel === "mail-check"} onOpenChange={open => { if (!open) close(); }}>
        <SheetContent onCloseAutoFocus={event => restoreStatusFocus(event, indicatorRef.current)} aria-describedby={undefined}
          side={openPanel === "calendar" ? "right" : "bottom"} className={openPanel === "calendar" ? mobileStyles.fullscreenSheet : mobileStyles.statusSheet}>
          <SheetTitle className={openPanel === "calendar" ? "flex min-h-13 items-center pr-14 pl-4" : "px-4"}>{openPanel === "calendar" ? t("calendar") : t("mailCheck.title")}</SheetTitle>
          <Theme asChild><div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
            {openPanel === "calendar" ? calendar : <><p className="mb-3 text-sm text-muted-foreground">{t("mailCheck.description")}</p>{mailCheck}</>}
          </div></Theme>
        </SheetContent>
      </Sheet>
    </div> : <Popover open={openPanel !== null} onOpenChange={open => { if (!open) close(); else setOpenPanel(attentionCount > 0 ? (exceptionEntries.length ? "exception" : "process") : "process"); }}>
      <PopoverTrigger asChild>{indicator}</PopoverTrigger>
      <PopoverContent align="end" aria-label={t("label")} className={`${styles.surface} max-h-[calc(100dvh-5rem)] ${openPanel === "calendar" ? "w-[min(54rem,calc(100vw-2rem))]" : "w-[min(34rem,calc(100vw-2rem))]"} overflow-auto p-4`}>
        <Theme asChild><div className="space-y-3">
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium">{t("label")}</h2>{checkMail}</div>
          {(["process", "mail-check", "exception", "reminder"] as const).map(panel => {
            const key = panel === "mail-check" ? "mailCheck" : panel;
            const active = section === panel;
            return <section key={panel} data-status-section={panel} className="border-t border-border pt-3">
              <h3 className="m-0 text-sm font-medium"><Button variant="ghost" size="sm" className="h-auto w-full justify-start px-0 py-1 text-left font-medium" aria-expanded={active} aria-controls={`status-${panel}`} aria-describedby={`status-${panel}-description`} onClick={() => setOpenPanel(panel)}>
                {t(`${key}.title`)}{panel === "exception" && exceptionEntries.length ? ` (${exceptionEntries.length})` : ""}
              </Button></h3>
              <p id={`status-${panel}-description`} className="m-0 mt-0.5 text-xs text-muted-foreground">{t(`${key}.description`)}</p>
              {active ? <div id={`status-${panel}`} className="mt-3">
                {panel === "process" ? process : panel === "exception" ? exceptions : panel === "mail-check" ? mailCheck : <>{calendar}{openPanel !== "calendar" ? upcoming : null}</>}
              </div> : null}
            </section>;
          })}
          <BuildInfo info={props.buildInfo} className="block border-t border-border pt-3 text-xs text-muted-foreground tabular-nums" />
        </div></Theme>
      </PopoverContent>
    </Popover>}
  </MobileStatusFocusContext.Provider>;
}
