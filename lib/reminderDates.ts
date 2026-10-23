// Pure reminder date-list normalization. Kept free of `rrule` so client
// modules that only sanitize reminder payloads do not pull recurrence
// evaluation into the main route's first load. The recurrence evaluator in
// `reminderRecurrence.ts` re-exports this for its existing importers.
export function normalizeReminderDateList(values?: number[]) {
  if (!Array.isArray(values) || values.length === 0) return undefined;
  const next = Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.round(value))
    )
  ).sort((a, b) => a - b);
  return next.length > 0 ? next : undefined;
}
