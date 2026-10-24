import { useTranslations } from "next-intl";
import type { UiLocale } from "@/lib/i18n/config";
import type { AccountDateFormat } from "@/lib/data";
import { getMessageDateDisplay, type RelativeDayLabels } from "@/lib/dateFormatting";

type MessageDateDisplay = {
  text: string;
  tooltip: string;
};

/** "Heute" / "Gestern" for the list date cell, from the list's group catalog. */
export function useMessageListRelativeDayLabels(): RelativeDayLabels {
  const t = useTranslations("List.groups");
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
