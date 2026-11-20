import { describe, expect, test } from "bun:test";
import { collectCalendarInviteMutationGroups } from "./calendarInviteProcessing";
import { getCalendarTimeZoneCacheSize, resolveCalendarTimeZoneId } from "./calendarTimezones";
import { deriveInviteDeckEventBounds } from "./inviteDeckEventBounds";
import {
  listRecurrenceOccurrenceStartsInRange,
  resolveCurrentOrNextOccurrence,
  resolveNextReminderOccurrence
} from "./reminderRecurrence";

// Generous bound: an unbounded expansion of these rules takes seconds to
// minutes; the limited one stays in the tens of milliseconds.
const FAST_MS = 1_000;
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

function timed<T>(fn: () => T): { value: T; ms: number } {
  const startedAt = performance.now();
  const value = fn();
  return { value, ms: performance.now() - startedAt };
}

function reminder(recurrenceRule: string, eventStartAtMs: number) {
  return {
    eventStartAtMs,
    eventEndAtMs: eventStartAtMs + 30 * 60 * 1000,
    leadMinutes: 15,
    recurrenceRule
  };
}

function inviteIcs(lines: string[]) {
  return ["BEGIN:VCALENDAR", "METHOD:REQUEST", "BEGIN:VEVENT", ...lines, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

describe("recurrence expansion work limits", () => {
  test("a secondly rule with a DTSTART decades ago does not block reminder resolution", () => {
    const { ms } = timed(() =>
      resolveNextReminderOccurrence(reminder("FREQ=SECONDLY", Date.UTC(1971, 0, 1)), NOW)
    );
    expect(ms).toBeLessThan(FAST_MS);
  });

  test("an hourly rule from decades ago stays bounded", () => {
    const { ms } = timed(() => {
      resolveNextReminderOccurrence(reminder("FREQ=HOURLY", Date.UTC(1990, 0, 1)), NOW);
      resolveCurrentOrNextOccurrence(reminder("FREQ=HOURLY", Date.UTC(1990, 0, 1)), NOW);
    });
    expect(ms).toBeLessThan(FAST_MS);
  });

  test("a rule that never produces an occurrence stays bounded", () => {
    // rrule walks every day up to year 9999 looking for 30 February.
    const { value, ms } = timed(() =>
      resolveCurrentOrNextOccurrence(
        reminder("FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30", Date.UTC(1971, 0, 1)),
        NOW
      )
    );
    expect(value).toBeNull();
    expect(ms).toBeLessThan(FAST_MS);
  });

  test("time-of-day lists that expand to thousands of occurrences per day are not expanded", () => {
    const minutes = Array.from({ length: 60 }, (_, index) => index).join(",");
    const hours = Array.from({ length: 24 }, (_, index) => index).join(",");
    const startAtMs = Date.UTC(2026, 10, 1);
    const { value, ms } = timed(() =>
      listRecurrenceOccurrenceStartsInRange(
        { eventStartAtMs: startAtMs, recurrenceRule: `FREQ=DAILY;BYHOUR=${hours};BYMINUTE=${minutes}` },
        startAtMs,
        startAtMs + 30 * 24 * 60 * 60 * 1000
      )
    );
    expect(value.length).toBeLessThanOrEqual(1);
    expect(ms).toBeLessThan(FAST_MS);
  });

  test("an invite with a huge COUNT reports an unknown end instead of expanding the series", () => {
    const groups = collectCalendarInviteMutationGroups(
      inviteIcs([
        "UID:huge-count@example.test",
        "DTSTART:20261101T090000Z",
        "DTEND:20261101T093000Z",
        "RRULE:FREQ=DAILY;COUNT=50000000",
        "SUMMARY:Synthetic"
      ])
    );
    const { value, ms } = timed(() => deriveInviteDeckEventBounds(groups[0]));
    expect(value.eventLastEndAtMs ?? null).toBeNull();
    expect(ms).toBeLessThan(FAST_MS);
  });

  test("ordinary series keep their occurrences", () => {
    const startAtMs = Date.UTC(2016, 0, 4, 9, 0, 0);
    expect(resolveCurrentOrNextOccurrence(reminder("FREQ=DAILY", startAtMs), NOW)).toEqual({
      eventStartAtMs: Date.UTC(2026, 10, 21, 9, 0, 0)
    });
    expect(
      listRecurrenceOccurrenceStartsInRange(
        { eventStartAtMs: startAtMs, recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,WE" },
        Date.UTC(2026, 10, 16),
        Date.UTC(2026, 10, 23)
      )
    ).toEqual([Date.UTC(2026, 10, 16, 9, 0, 0), Date.UTC(2026, 10, 18, 9, 0, 0)]);
    const groups = collectCalendarInviteMutationGroups(
      inviteIcs([
        "UID:short-count@example.test",
        "DTSTART:20261101T090000Z",
        "DTEND:20261101T093000Z",
        "RRULE:FREQ=WEEKLY;COUNT=3",
        "SUMMARY:Synthetic"
      ])
    );
    expect(deriveInviteDeckEventBounds(groups[0])).toEqual({
      eventFirstStartAtMs: Date.UTC(2026, 10, 1, 9, 0, 0),
      eventLastEndAtMs: Date.UTC(2026, 10, 15, 9, 30, 0)
    });
  });
});

describe("calendar timezone resolution limits", () => {
  test("untrusted TZIDs cannot grow the validity cache without bound", () => {
    for (let index = 0; index < 5_000; index += 1) {
      resolveCalendarTimeZoneId(`Synthetic/Zone_${index}/Part_${index}`);
    }
    expect(getCalendarTimeZoneCacheSize()).toBeLessThanOrEqual(1024);
    expect(resolveCalendarTimeZoneId("Europe/Berlin")).toBe("Europe/Berlin");
  });

  test("an oversized TZID is rejected before candidate generation", () => {
    const long = `${"a/".repeat(5_000)}Europe/Berlin`;
    expect(resolveCalendarTimeZoneId(long)).toBeUndefined();
    expect(resolveCalendarTimeZoneId("/softwarestudio.org/Olson_20011030_5/America/New_York")).toBe(
      "America/New_York"
    );
  });
});

describe("rules whose filters never match", () => {
  for (const rule of [
    "FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30",
    "FREQ=WEEKLY;BYMONTH=2;BYMONTHDAY=31",
    "FREQ=MONTHLY;BYMONTH=4;BYMONTHDAY=31",
    "FREQ=HOURLY;BYMONTH=2;BYMONTHDAY=30",
    "FREQ=DAILY;INTERVAL=7;BYDAY=MO"
  ]) {
    test(`${rule} is not walked to year 9999`, () => {
      // 1 January 2026 is a Thursday, so INTERVAL=7 never lands on a Monday.
      const startAtMs = Date.UTC(2026, 0, 1, 9, 0, 0);
      const { value, ms } = timed(() => ({
        next: resolveCurrentOrNextOccurrence(reminder(rule, startAtMs), NOW),
        range: listRecurrenceOccurrenceStartsInRange(
          { eventStartAtMs: startAtMs, recurrenceRule: rule },
          NOW,
          NOW + 30 * 24 * 60 * 60 * 1000
        )
      }));
      expect(value.next).toBeNull();
      expect(value.range).toEqual([]);
      expect(ms).toBeLessThan(FAST_MS);
    });
  }

  test("sparse but real patterns are still expanded", () => {
    // 29 February exists every four years.
    const startAtMs = Date.UTC(2024, 1, 29, 9, 0, 0);
    expect(
      resolveCurrentOrNextOccurrence(reminder("FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29", startAtMs), NOW)
    ).toEqual({ eventStartAtMs: Date.UTC(2028, 1, 29, 9, 0, 0) });
    // Every 7 days from a Thursday is every Thursday.
    const thursday = Date.UTC(2026, 0, 1, 9, 0, 0);
    expect(
      resolveCurrentOrNextOccurrence(reminder("FREQ=DAILY;INTERVAL=7;BYDAY=TH", thursday), NOW)
    ).toEqual({ eventStartAtMs: Date.UTC(2026, 10, 26, 9, 0, 0) });
  });
});
