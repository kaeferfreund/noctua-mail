import type { UiLocale } from "@/lib/i18n/config";
import type { AccountDateFormat } from "@/lib/data";
import { getMessageDateDisplay } from "@/lib/dateFormatting";

type MessageDateDisplay = {
  text: string;
  tooltip: string;
};

export function getMessageListDateDisplay(
  dateValue: number,
  fallbackDate: string,
  dateFormat?: AccountDateFormat,
  locale: UiLocale = "de"
): MessageDateDisplay {
  return getMessageDateDisplay(dateValue, fallbackDate, dateFormat, locale);
}
