import { displayDayNumber } from "@/lib/i18n/format";
import { getTranslator } from "@/lib/i18n/translator";
import type { UiLocale } from "@/lib/i18n/config";
const DAY_MS = 24 * 60 * 60 * 1000;

type RelativeTimeGroupMeta = {
  key: string;
  label: string;
  order: number;
};

export type RelativeTimeGroup<T> = RelativeTimeGroupMeta & {
  items: T[];
};

function getWeekStart(dayNumber: number) {
  const dayOfWeek = new Date(dayNumber * DAY_MS).getUTCDay();
  return dayNumber - (dayOfWeek + 6) % 7;
}

function getRelativeTimeGroupMeta(timestampMs: number, nowMs: number, locale: UiLocale): RelativeTimeGroupMeta {
  const t = getTranslator(locale);
  if (!Number.isFinite(timestampMs)) {
    return {
      key: "no-date",
      label: t("List.relativeGroups.noDate"),
      order: 9_000
    };
  }

  const targetDay = displayDayNumber(timestampMs);
  const today = displayDayNumber(nowMs);
  const dayOffset = targetDay - today;
  if (dayOffset < 0) {
    return {
      key: "past",
      label: t("List.relativeGroups.past"),
      order: 0
    };
  }
  if (dayOffset === 0) {
    return {
      key: "today",
      label: t("List.relativeGroups.today"),
      order: 100
    };
  }
  if (dayOffset === 1) {
    return {
      key: "tomorrow",
      label: t("List.relativeGroups.tomorrow"),
      order: 200
    };
  }

  const thisWeekStart = getWeekStart(today);
  const nextWeekStart = thisWeekStart + 7;
  const weekAfterNextStart = nextWeekStart + 7;

  if (targetDay < nextWeekStart) {
    return {
      key: "this-week",
      label: t("List.relativeGroups.thisWeek"),
      order: 300
    };
  }
  if (targetDay < weekAfterNextStart) {
    return {
      key: "next-week",
      label: t("List.relativeGroups.nextWeek"),
      order: 400
    };
  }

  const weeks = Math.floor((targetDay - thisWeekStart) / 7);
  return {
    key: `in-${weeks}-weeks`,
    label: t("List.relativeGroups.inWeeks", { count: weeks }),
    order: 600 + weeks
  };
}

// Legacy callers outside this slice retain English until they pass their UI locale.
// The reader passes the resolved next-intl locale explicitly.
export function groupItemsByRelativeTime<T>(
  items: T[],
  getTimestampMs: (item: T) => number,
  nowMs = Date.now(),
  locale: UiLocale = "en"
): RelativeTimeGroup<T>[] {
  const sorted = items
    .map((item, index) => ({
      item,
      index,
      timestampMs: getTimestampMs(item)
    }))
    .sort((left, right) => {
      const leftTs = Number.isFinite(left.timestampMs) ? left.timestampMs : Number.POSITIVE_INFINITY;
      const rightTs = Number.isFinite(right.timestampMs) ? right.timestampMs : Number.POSITIVE_INFINITY;
      if (leftTs !== rightTs) return leftTs - rightTs;
      return left.index - right.index;
    });

  const groupedMap = new Map<string, RelativeTimeGroup<T>>();
  sorted.forEach(({ item, timestampMs }) => {
    const meta = getRelativeTimeGroupMeta(timestampMs, nowMs, locale);
    const existing = groupedMap.get(meta.key);
    if (existing) {
      existing.items.push(item);
      return;
    }
    groupedMap.set(meta.key, {
      ...meta,
      items: [item]
    });
  });

  return Array.from(groupedMap.values()).sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    return left.key.localeCompare(right.key);
  });
}
