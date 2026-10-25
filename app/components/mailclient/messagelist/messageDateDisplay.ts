import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import type { UiLocale } from "@/lib/i18n/config";
import type { AccountDateFormat } from "@/lib/data";
import { getMessageDateDisplay, type RelativeDayLabels } from "@/lib/dateFormatting";
import { displayDayNumber, msUntilNextDisplayDay } from "@/lib/i18n/format";

type MessageDateDisplay = {
  text: string;
  tooltip: string;
};

// One shared timer for every mounted list row: it re-renders the rows when the
// display day changes, so "Heute" becomes "Gestern" at midnight without a sync.
const displayDayListeners = new Set<() => void>();
let displayDay = displayDayNumber(Date.now());
let displayDayTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDisplayDayChange() {
  displayDayTimer = setTimeout(() => {
    const day = displayDayNumber(Date.now());
    if (day !== displayDay) {
      displayDay = day;
      displayDayListeners.forEach((listener) => listener());
    }
    scheduleDisplayDayChange();
  }, Math.max(1, msUntilNextDisplayDay(Date.now())));
}

function subscribeDisplayDay(listener: () => void) {
  if (displayDayListeners.size === 0) {
    displayDay = displayDayNumber(Date.now());
    scheduleDisplayDayChange();
  }
  displayDayListeners.add(listener);
  return () => {
    displayDayListeners.delete(listener);
    if (displayDayListeners.size === 0 && displayDayTimer) {
      clearTimeout(displayDayTimer);
      displayDayTimer = null;
    }
  };
}

const getDisplayDay = () => displayDay;

/** "Heute" / "Gestern" for the list date cell, from the list's group catalog. */
export function useMessageListRelativeDayLabels(): RelativeDayLabels {
  const t = useTranslations("List.groups");
  useSyncExternalStore(subscribeDisplayDay, getDisplayDay, getDisplayDay);
  return { today: t("today"), yesterday: t("yesterday") };
}

export function getMessageListDateDisplay(
  dateValue: number,
  fallbackDate: string,
  dateFormat?: AccountDateFormat,
  locale: UiLocale = "de",
  relativeDayLabels?: RelativeDayLabels,
  nowMs?: number
): MessageDateDisplay {
  return getMessageDateDisplay(
    dateValue,
    fallbackDate,
    dateFormat,
    locale,
    relativeDayLabels ? { labels: relativeDayLabels, nowMs } : undefined
  );
}
