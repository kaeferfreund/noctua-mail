import { describe, expect, it } from "bun:test";
import { RRule } from "rrule";
import { buildFullCalendarRecurringFields } from "./fullcalendarRecurrence";

describe("buildFullCalendarRecurringFields", () => {
  it("builds valid FullCalendar rrule object fields from stored recurrence data", () => {
    const recurring = buildFullCalendarRecurringFields({
      startAtMs: Date.UTC(2026, 2, 3, 9, 30, 0),
      endAtMs: Date.UTC(2026, 2, 3, 10, 15, 0),
      recurrenceRule: "FREQ=WEEKLY;BYDAY=TU,TH",
      excludedDates: [Date.UTC(2026, 2, 10, 9, 30, 0)]
    });

    expect(recurring).not.toBeNull();
    expect(recurring?.rrule.dtstart).toEqual(new Date("2026-03-03T09:30:00.000Z"));
    expect("rrule" in (recurring?.rrule ?? {})).toBe(false);
    expect(recurring?.duration).toEqual({ milliseconds: 45 * 60 * 1000 });
    expect(recurring?.exdate).toEqual([new Date("2026-03-10T09:30:00.000Z")]);

    expect(() => new RRule(recurring!.rrule)).not.toThrow();
  });

  it("returns null when no recurrence rule exists", () => {
    expect(
      buildFullCalendarRecurringFields({
        startAtMs: Date.UTC(2026, 2, 3, 9, 30, 0),
        endAtMs: undefined,
        recurrenceRule: undefined,
        excludedDates: undefined
      })
    ).toBeNull();
  });
});

describe("buildFullCalendarRecurringFields for old series", () => {
  it("a daily series from 1998 reaches today in the calendar view", () => {
    const recurring = buildFullCalendarRecurringFields({
      startAtMs: Date.UTC(1998, 0, 1, 8, 30, 0),
      endAtMs: Date.UTC(1998, 0, 1, 9, 0, 0),
      recurrenceRule: "FREQ=DAILY"
    });
    expect(recurring).not.toBeNull();
    const now = Date.now();
    const rule = new RRule({ ...recurring!.rrule, tzid: undefined });
    const next = rule.after(new Date(now), true);
    expect(next).not.toBeNull();
    expect(next!.getTime() - now).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(next!.getUTCHours()).toBe(8);
    expect(next!.getUTCMinutes()).toBe(30);
  });
});
