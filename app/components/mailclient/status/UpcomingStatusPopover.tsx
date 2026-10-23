"use client";

import { useLocale, useTranslations } from "next-intl";
import type { UiLocale } from "@/lib/i18n/config";
import { useCallback, useMemo, useState } from "react";
import { Trash2, MapPin, Clock, Repeat, Loader2 } from "lucide-react";
import {
  Box,
  Card,
  Flex,
  Text
} from "@radix-ui/themes";
import {
  buildCalendarRecurrenceSummary,
  formatCalendarEventRange
} from "@/lib/calendar";
import { formatCalendarTimeZoneShortLabel } from "@/lib/calendarTimezones";
import type { AccountDateFormat, CalendarEvent } from "@/lib/data";
import {
  formatAccountShortTime,
  formatAccountUpcomingDateLabel
} from "@/lib/dateFormatting";
import {
  deleteCalendarReminder,
  type CalendarReminder
} from "../utils/calendarReminders";
import { groupItemsByRelativeTime } from "../utils/relativeTimeGroups";
import {
  BottomStatusTriggerButton,
  type BottomStatusTone
} from "./BottomStatusSection";
import { buildUpcomingEntries, type UpcomingEntry } from "./upcomingEntries";
import StatusPanelFrame from "@/app/components/shell/StatusPanelFrame";
import TooltipIconButton from "@/app/components/TooltipIconButton";

type UpcomingStatusPopoverProps = {
  embedded?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeAccountId: string;
  pendingCalendarReminders: CalendarReminder[];
  upcomingEvents: CalendarEvent[];
  onRefreshPendingReminders: () => Promise<void>;
  onOpenReminderMessage: (messageId: string) => void;
  onOpenCalendarSidebar: () => void;
  onReportError: (message: string) => void;
  accountDateFormat?: AccountDateFormat;
};

function formatEventTimeRange(
  startAtMs: number,
  endAtMs: number | undefined,
  timeZone?: string,
  dateFormat?: AccountDateFormat
) {
  if (!Number.isFinite(startAtMs)) return "";
  return formatCalendarEventRange(
    new Date(startAtMs),
    Number.isFinite(endAtMs ?? Number.NaN) && (endAtMs as number) > startAtMs
      ? new Date(endAtMs as number)
      : undefined,
    { startTimeZone: timeZone, dateFormat }
  );
}

function formatEventDuration(startAtMs: number, endAtMs: number | undefined) {
  if (
    !Number.isFinite(startAtMs) ||
    !Number.isFinite(endAtMs ?? Number.NaN) ||
    (endAtMs as number) <= startAtMs
  ) {
    return "";
  }
  const totalMinutes = Math.round(((endAtMs as number) - startAtMs) / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function formatEventUid(uid: string) {
  const MAX_UID_DISPLAY_LENGTH = 40;
  const normalized = uid.trim();
  if (normalized.length <= MAX_UID_DISPLAY_LENGTH) return normalized;
  return `${normalized.slice(0, 24)}...${normalized.slice(-13)}`;
}

function formatEntryTimeZoneLabel(startAtMs: number, timeZone?: string) {
  if (!Number.isFinite(startAtMs)) return "";
  return formatCalendarTimeZoneShortLabel(timeZone, new Date(startAtMs));
}

function buildEntryRecurrenceSummary(entry: UpcomingEntry, dateFormat?: AccountDateFormat) {
  const event = entry.event;
  if (event?.recurrenceRule?.trim()) {
    return buildCalendarRecurrenceSummary({
      allDay: event.allDay,
      start: new Date(event.startAtMs),
      end:
        typeof event.endAtMs === "number" && Number.isFinite(event.endAtMs)
          ? new Date(event.endAtMs)
          : undefined,
      startTimezone: event.startTimezone,
      endTimezone: event.endTimezone,
      recurrenceRule: event.recurrenceRule,
      recurrenceDates: event.recurrenceDates?.map((value) => new Date(value)),
      excludedDates: event.excludedDates?.map((value) => new Date(value))
    }, dateFormat);
  }
  const reminder = entry.reminder;
  if (reminder?.recurrenceRule?.trim()) {
    if (!Number.isFinite(entry.startAtMs)) return null;
    return buildCalendarRecurrenceSummary({
      allDay: false,
      start: new Date(entry.startAtMs),
      startTimezone: reminder.startTimezone,
      recurrenceRule: reminder.recurrenceRule,
      recurrenceDates: reminder.recurrenceDates?.map((value) => new Date(value)),
      excludedDates: reminder.excludedDates?.map((value) => new Date(value))
    }, dateFormat);
  }
  return null;
}

function getEntryDisplayUid(entry: UpcomingEntry) {
  const eventUid = entry.event?.eventUid?.trim();
  if (eventUid) return eventUid;
  const reminderEventUid = entry.reminder?.eventUid?.trim();
  return reminderEventUid || "";
}

function formatUpcomingStatusDateTime(
  startAtMs: number,
  accountDateFormat?: AccountDateFormat
) {
  const date = formatAccountUpcomingDateLabel(startAtMs, accountDateFormat) ?? "";
  const time = formatAccountShortTime(startAtMs, accountDateFormat) ?? "";
  if (date && time) return `${date} ${time}`;
  return date || time;
}

export default function UpcomingStatusPopover({
  embedded,
  open,
  onOpenChange,
  activeAccountId,
  pendingCalendarReminders,
  upcomingEvents,
  onRefreshPendingReminders,
  onOpenReminderMessage,
  onOpenCalendarSidebar,
  onReportError,
  accountDateFormat
}: UpcomingStatusPopoverProps) {
  const t = useTranslations("Shell.status");
  const locale = useLocale() as UiLocale;
  const { entries: upcomingEntries, mergedCount } = useMemo(
    () => buildUpcomingEntries(upcomingEvents, pendingCalendarReminders),
    [upcomingEvents, pendingCalendarReminders]
  );
  const nextEntry = upcomingEntries[0] ?? null;
  const upcomingStatusValue = (() => {
    if (!nextEntry) return t("none");
    const dateTime = formatUpcomingStatusDateTime(
      nextEntry.startAtMs,
      accountDateFormat
    );
    return `${mergedCount} · ${nextEntry.title} @ ${dateTime}`;
  })();
  const upcomingStatusTone: BottomStatusTone = mergedCount > 0 ? "normal" : "muted";
  const groupedEntries = useMemo(
    () => groupItemsByRelativeTime(upcomingEntries, (entry) => entry.startAtMs, undefined, locale),
    [upcomingEntries, locale]
  );
  const [deletingReminderIds, setDeletingReminderIds] = useState<Set<string>>(new Set());

  const handleDeleteReminder = useCallback(
    async (reminderId: string) => {
      if (!activeAccountId.trim()) return;
      let shouldDelete = false;
      setDeletingReminderIds((prev) => {
        if (prev.has(reminderId)) return prev;
        shouldDelete = true;
        return new Set([...prev, reminderId]);
      });
      if (!shouldDelete) return;
      try {
        await deleteCalendarReminder(activeAccountId, reminderId);
        await onRefreshPendingReminders();
      } catch {
        onReportError(t("deleteReminderError"));
      } finally {
        setDeletingReminderIds((prev) => {
          const next = new Set(prev);
          next.delete(reminderId);
          return next;
        });
      }
    },
    [activeAccountId, onRefreshPendingReminders, onReportError, t]
  );

  const handleEntryOpen = useCallback(
    (entry: UpcomingEntry) => {
      if (entry.messageId) {
        onOpenReminderMessage(entry.messageId);
        onOpenChange(false);
        return;
      }
      onOpenCalendarSidebar();
      onOpenChange(false);
    },
    [onOpenChange, onOpenCalendarSidebar, onOpenReminderMessage]
  );

  return (
    <StatusPanelFrame embedded={embedded} description={t("reminder.description")} open={open} onOpenChange={onOpenChange} title={t("reminder.title")}
      count={mergedCount}
      trigger={<BottomStatusTriggerButton
          label={t("reminder.title")}
          value={upcomingStatusValue}
          tone={upcomingStatusTone}
          alignRight
          wide
        />}
      contentProps={{ className: "bottom-popover bottom-popover-reminders",
        side: "top",
        align: "end",
        sideOffset: 8, }}
    >
        <Box className="popover-body">
          {upcomingEntries.length > 0 ? (
            <div className="reminder-groups">
              {groupedEntries.map((group) => (
                <section key={group.key} className="reminder-group">
                  <div className="reminder-group-header">
                    <Text size="1" weight="medium" className="reminder-group-label">
                      {group.label}
                    </Text>
                  </div>
                  <div className="reminder-list">
                    {group.items.map((entry) => {
                      const reminder = entry.reminder;
                      const isDeletingReminder = reminder
                        ? deletingReminderIds.has(reminder.id)
                        : false;
                      const startAtMs = entry.startAtMs;
                      const endAtMs = entry.endAtMs;
                      const timeZoneLabel = formatEntryTimeZoneLabel(
                        startAtMs,
                        entry.timeZone
                      );
                      const eventDurationLabel =
                        typeof endAtMs === "number" &&
                        Number.isFinite(endAtMs) &&
                        endAtMs > startAtMs
                          ? formatEventDuration(startAtMs, endAtMs)
                          : "";
                      const eventTimeLabel = formatEventTimeRange(
                        startAtMs,
                        endAtMs,
                        entry.timeZone,
                        accountDateFormat
                      );
                      const recurrenceSummary = buildEntryRecurrenceSummary(
                        entry,
                        accountDateFormat
                      );
                      const displayUid = getEntryDisplayUid(entry);
                      return (
                        <Card
                          key={entry.key}
                          size="1"
                          className={`reminder-item-card ${isDeletingReminder ? "is-deleting" : ""}`}
                        >
                          <Flex align="start" justify="between" gap="3">
                            <button
                              type="button"
                              className="reminder-open-button interactive"
                              disabled={isDeletingReminder}
                              onClick={() => {
                                handleEntryOpen(entry);
                              }}
                              title={
                                entry.messageId
                                  ? t("openSourceMail")
                                  : t("calendar")
                              }
                              aria-label={
                                entry.messageId
                                  ? t("openSourceMail")
                                  : t("calendar")
                              }
                            >
                              <Flex direction="column" gap="1" className="reminder-item-main">
                                <Text
                                  as="div"
                                  size="2"
                                  weight="medium"
                                  className="reminder-item-title"
                                >
                                  {entry.event?.summary || entry.reminder?.eventTitle || t("calendarEvent")}
                                </Text>
                                {displayUid ? (
                                  <Text
                                    as="div"
                                    size="1"
                                    color="gray"
                                    className="reminder-uid-label"
                                    title={`UID: ${displayUid}`}
                                  >
                                    UID: {formatEventUid(displayUid)}
                                  </Text>
                                ) : null}
                                <Flex
                                  align="center"
                                  gap="1"
                                  className="reminder-meta-row"
                                  wrap="wrap"
                                >
                                  <Clock size={12} className="reminder-icon" />
                                  <Text size="1" weight="bold" color="gray" highContrast>
                                    {eventTimeLabel}
                                  </Text>
                                  {timeZoneLabel ? (
                                    <Text
                                      size="1"
                                      color="gray"
                                      className="reminder-timezone-label"
                                    >
                                      {timeZoneLabel}
                                    </Text>
                                  ) : null}
                                  {eventDurationLabel ? (
                                    <Text size="1" color="gray">
                                      {t("duration", { value: eventDurationLabel })}
                                    </Text>
                                  ) : null}
                                </Flex>
                                {reminder ? (
                                  <Flex align="center" gap="1" className="reminder-meta-row">
                                    <Text size="1" color="gray">
                                      {t("reminderLead", { minutes: reminder.leadMinutes })}
                                    </Text>
                                  </Flex>
                                ) : null}
                                {entry.location ? (
                                  <Flex align="center" gap="1" className="reminder-meta-row">
                                    <MapPin size={12} className="reminder-icon" />
                                    <Text size="1" color="gray">
                                      {entry.location}
                                    </Text>
                                  </Flex>
                                ) : null}
                                {recurrenceSummary ? (
                                  <Flex align="center" gap="1" className="reminder-meta-row">
                                    <Repeat size={12} className="reminder-icon" />
                                    <Text size="1" color="gray">
                                      {t("repeats", { value: recurrenceSummary })}
                                    </Text>
                                  </Flex>
                                ) : null}
                              </Flex>
                            </button>
                            {reminder ? (
                              <TooltipIconButton
                                variant="ghost"
                                color="gray"
                                size="1"
                                tooltip={t("deleteReminder")}
                                className="reminder-delete-btn"
                                disabled={isDeletingReminder}
                                onClick={() => {
                                  void handleDeleteReminder(reminder.id);
                                }}
                              >
                                {isDeletingReminder ? (
                                  <Loader2 size={14} className="reminder-delete-spinner" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </TooltipIconButton>
                            ) : null}
                          </Flex>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <Flex align="center" justify="center" p="4" className="empty-state">
              <Text size="2" color="gray">
                {t("reminder.empty")}
              </Text>
            </Flex>
          )}
        </Box>
    </StatusPanelFrame>
  );
}
