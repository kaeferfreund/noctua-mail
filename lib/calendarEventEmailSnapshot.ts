import type {
  CalendarEvent,
  CalendarEventEmailSnapshotFields
} from "@/lib/data";

/**
 * The subset of CalendarEvent fields that snapshot the originating email
 * (Topic 2, Calendar-Improvements.md). Captured at event creation time and
 * persisted on the `calendar_events` row itself so it survives deletion of
 * the source message.
 */
export type CalendarEventEmailSnapshot = CalendarEventEmailSnapshotFields;

/**
 * Empty snapshot helper — useful when the caller knows there's no source
 * email (e.g. manual event creation) and wants to explicitly clear the
 * columns.
 */
export const EMPTY_CALENDAR_EVENT_EMAIL_SNAPSHOT: Readonly<CalendarEventEmailSnapshot> =
  Object.freeze({
    sourceSubject: undefined,
    sourceFromAddr: undefined,
    sourceToAddr: undefined,
    sourceCcAddr: undefined,
    sourceBccAddr: undefined,
    sourceDateMs: undefined,
    sourceBodyText: undefined,
    sourceBodyHtml: undefined
  });

/**
 * True when at least one snapshot column has a non-empty value. Used by the
 * UI to decide whether to render the snapshot card at all.
 *
 * Pure — no DB access, safe to import from client components.
 */
export function hasCalendarEventEmailSnapshot(
  event: Pick<
    CalendarEvent,
    | "sourceSubject"
    | "sourceFromAddr"
    | "sourceToAddr"
    | "sourceCcAddr"
    | "sourceBccAddr"
    | "sourceDateMs"
    | "sourceBodyText"
    | "sourceBodyHtml"
  >
): boolean {
  return Boolean(
    (event.sourceSubject && event.sourceSubject.trim()) ||
      (event.sourceFromAddr && event.sourceFromAddr.trim()) ||
      (event.sourceToAddr && event.sourceToAddr.trim()) ||
      (event.sourceCcAddr && event.sourceCcAddr.trim()) ||
      (event.sourceBccAddr && event.sourceBccAddr.trim()) ||
      typeof event.sourceDateMs === "number" ||
      (event.sourceBodyText && event.sourceBodyText.trim()) ||
      (event.sourceBodyHtml && event.sourceBodyHtml.trim())
  );
}

/**
 * Pull the series-level snapshot fields off a CalendarEvent. Used both for
 * rendering the default snapshot and as the fallback when an occurrence
 * has no dedicated snapshot.
 */
export function extractSeriesCalendarEventEmailSnapshot(
  event: Pick<
    CalendarEvent,
    | "sourceSubject"
    | "sourceFromAddr"
    | "sourceToAddr"
    | "sourceCcAddr"
    | "sourceBccAddr"
    | "sourceDateMs"
    | "sourceBodyText"
    | "sourceBodyHtml"
  >
): CalendarEventEmailSnapshot {
  return {
    sourceSubject: event.sourceSubject,
    sourceFromAddr: event.sourceFromAddr,
    sourceToAddr: event.sourceToAddr,
    sourceCcAddr: event.sourceCcAddr,
    sourceBccAddr: event.sourceBccAddr,
    sourceDateMs: event.sourceDateMs,
    sourceBodyText: event.sourceBodyText,
    sourceBodyHtml: event.sourceBodyHtml
  };
}

/**
 * Stored and wire form of `occurrenceSnapshots`. All occurrences changed by
 * one email share that email's snapshot, which includes its full body. The
 * snapshot is kept once; the other occurrences hold `{ sameAs: <key> }`
 * pointing at the entry that carries it. Rows written before this form only
 * hold full entries and read unchanged.
 */
export type CalendarOccurrenceSnapshotRef = { sameAs: string };
export type CompactOccurrenceSnapshots = Record<
  string,
  CalendarEventEmailSnapshotFields | CalendarOccurrenceSnapshotRef
>;

function isOccurrenceSnapshotRef(value: unknown): value is CalendarOccurrenceSnapshotRef {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { sameAs?: unknown }).sameAs === "string"
  );
}

function snapshotSignature(snapshot: CalendarEventEmailSnapshotFields) {
  return JSON.stringify([
    snapshot.sourceSubject,
    snapshot.sourceFromAddr,
    snapshot.sourceToAddr,
    snapshot.sourceCcAddr,
    snapshot.sourceBccAddr,
    snapshot.sourceDateMs,
    snapshot.sourceBodyText?.length,
    snapshot.sourceBodyHtml?.length
  ]);
}

function sameSnapshot(left: CalendarEventEmailSnapshotFields, right: CalendarEventEmailSnapshotFields) {
  return (
    left === right ||
    (snapshotSignature(left) === snapshotSignature(right) &&
      left.sourceBodyText === right.sourceBodyText &&
      left.sourceBodyHtml === right.sourceBodyHtml)
  );
}

/** Keep each distinct snapshot once; repeated ones become `{ sameAs }` references. */
export function compactOccurrenceSnapshots(
  snapshots: Record<string, CalendarEventEmailSnapshotFields> | undefined
): CompactOccurrenceSnapshots | undefined {
  if (!snapshots) return undefined;
  const compact: CompactOccurrenceSnapshots = {};
  const firstKeyByObject = new Map<CalendarEventEmailSnapshotFields, string>();
  const firstKeysBySignature = new Map<string, string[]>();
  for (const [key, snapshot] of Object.entries(snapshots)) {
    if (!snapshot || typeof snapshot !== "object") continue;
    let sameAs = firstKeyByObject.get(snapshot);
    const signature = sameAs === undefined ? snapshotSignature(snapshot) : "";
    if (sameAs === undefined) {
      sameAs = firstKeysBySignature
        .get(signature)
        ?.find((candidate) => sameSnapshot(snapshots[candidate], snapshot));
    }
    if (sameAs !== undefined) {
      compact[key] = { sameAs };
      continue;
    }
    compact[key] = snapshot;
    firstKeyByObject.set(snapshot, key);
    firstKeysBySignature.set(signature, [...(firstKeysBySignature.get(signature) ?? []), key]);
  }
  return Object.keys(compact).length > 0 ? compact : undefined;
}

/** Resolve `{ sameAs }` references; entries without a stored snapshot are dropped. */
export function expandOccurrenceSnapshots(
  snapshots: Record<string, unknown> | undefined | null
): Record<string, CalendarEventEmailSnapshotFields> | undefined {
  if (!snapshots || typeof snapshots !== "object") return undefined;
  const expanded: Record<string, CalendarEventEmailSnapshotFields> = {};
  for (const key of Object.keys(snapshots)) {
    const snapshot = resolveOccurrenceSnapshotEntry(snapshots, key);
    if (snapshot) expanded[key] = snapshot;
  }
  return Object.keys(expanded).length > 0 ? expanded : undefined;
}

function resolveOccurrenceSnapshotEntry(
  snapshots: Record<string, unknown>,
  key: string
): CalendarEventEmailSnapshotFields | undefined {
  const value = snapshots[key];
  if (!value || typeof value !== "object") return undefined;
  if (!isOccurrenceSnapshotRef(value)) return value as CalendarEventEmailSnapshotFields;
  const target = snapshots[value.sameAs];
  // One level only: a reference never points at another reference.
  if (!target || typeof target !== "object" || isOccurrenceSnapshotRef(target)) return undefined;
  return target as CalendarEventEmailSnapshotFields;
}

/**
 * Response form of an event: `occurrenceSnapshots` in compact form, so a
 * series with many changed occurrences does not repeat one email body per
 * occurrence. `selectCalendarEventEmailSnapshot` reads both forms.
 */
export function toCalendarEventResponse<T extends Pick<CalendarEvent, "occurrenceSnapshots">>(event: T) {
  if (!event.occurrenceSnapshots) return event;
  return { ...event, occurrenceSnapshots: compactOccurrenceSnapshots(event.occurrenceSnapshots) };
}

/**
 * Pick the effective snapshot for the currently viewed occurrence:
 *
 * - If `occurrenceStartAtMs` is set AND the event has a matching entry in
 *   `occurrenceSnapshots`, use that per-occurrence snapshot.
 * - Otherwise fall back to the series-level snapshot on the event row.
 *
 * Mirrors how `occurrenceMessageIds` is consulted for the "Open occurrence
 * email" button, so the visible snapshot matches the same source mail.
 *
 * Pure — no DB access, safe to import from client components.
 */
export function selectCalendarEventEmailSnapshot(
  event: Pick<
    CalendarEvent,
    | "sourceSubject"
    | "sourceFromAddr"
    | "sourceToAddr"
    | "sourceCcAddr"
    | "sourceBccAddr"
    | "sourceDateMs"
    | "sourceBodyText"
    | "sourceBodyHtml"
    | "occurrenceSnapshots"
  >,
  occurrenceStartAtMs?: number
): CalendarEventEmailSnapshot {
  if (
    typeof occurrenceStartAtMs === "number" &&
    Number.isFinite(occurrenceStartAtMs) &&
    event.occurrenceSnapshots
  ) {
    const perOccurrence = resolveOccurrenceSnapshotEntry(
      event.occurrenceSnapshots as Record<string, unknown>,
      String(occurrenceStartAtMs)
    );
    if (perOccurrence && hasCalendarEventEmailSnapshot(perOccurrence)) {
      return perOccurrence;
    }
  }
  return extractSeriesCalendarEventEmailSnapshot(event);
}
