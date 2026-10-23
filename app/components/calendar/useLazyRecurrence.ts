import { useEffect, useState } from "react";
import type { buildCalendarRecurrenceSummary } from "@/lib/calendarRecurrenceSummary";
import type { resolveNextReminderOccurrence } from "@/lib/reminderRecurrence";

export type RecurrenceSummaryBuilder = typeof buildCalendarRecurrenceSummary;
export type NextReminderOccurrenceResolver = typeof resolveNextReminderOccurrence;

// Recurrence evaluation needs `rrule`, which must stay out of the main
// route's first load. These hooks dynamic-import the recurrence modules
// only when `enabled` (an event actually repeats) and expose the loaded
// functions for synchronous use during render. Until the import resolves
// they return `null`, and callers render their neutral/loading state
// rather than a guessed value. A failed chunk load resolves to the same
// "no recurrence result" outcome the callers already handle for
// unparseable rules (`null`), so nothing stays stuck loading.

export function useRecurrenceSummaryBuilder(
  enabled: boolean
): RecurrenceSummaryBuilder | null {
  const [builder, setBuilder] = useState<RecurrenceSummaryBuilder | null>(null);
  useEffect(() => {
    if (!enabled || builder) return;
    let active = true;
    void import("@/lib/calendarRecurrenceSummary")
      .then((mod) => {
        if (active) setBuilder(() => mod.buildCalendarRecurrenceSummary);
      })
      .catch(() => {
        if (active) setBuilder(() => () => null);
      });
    return () => {
      active = false;
    };
  }, [enabled, builder]);
  return builder;
}

export function useNextReminderOccurrenceResolver(
  enabled: boolean
): NextReminderOccurrenceResolver | null {
  const [resolver, setResolver] = useState<NextReminderOccurrenceResolver | null>(null);
  useEffect(() => {
    if (!enabled || resolver) return;
    let active = true;
    void import("@/lib/reminderRecurrence")
      .then((mod) => {
        if (active) setResolver(() => mod.resolveNextReminderOccurrence);
      })
      .catch(() => {
        if (active) setResolver(() => () => null);
      });
    return () => {
      active = false;
    };
  }, [enabled, resolver]);
  return resolver;
}
