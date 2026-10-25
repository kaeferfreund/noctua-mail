import { describe, expect, test } from "bun:test";
import rrulePlugin from "@fullcalendar/rrule";
import { DateEnv } from "@full-ui/headless-calendar";
import { parseIcsInvite } from "./calendar";
import { expandCalendarEventForRange } from "./calendarOccurrences";
import { collectCalendarInviteMutationGroups } from "./calendarInviteProcessing";
import { buildFullCalendarRecurringFields } from "./fullcalendarRecurrence";
import { deriveInviteDeckEventBounds } from "./inviteDeckEventBounds";
import {
  getEventOccurrenceInfo,
  listRecurrenceOccurrenceStartsInRange,
  resolveCurrentOrNextOccurrence,
  resolveNextReminderOccurrence
} from "./reminderRecurrence";
import type { CalendarEvent } from "./data";

type Fixture = {
  name: string;
  dtstart: string;
  rule: string;
  expected: string[];
};

// Synthetic weekly series reproducing the four reported missing dates.
const fixtures: Fixture[] = [
  {
    name: "2022-08-30",
    dtstart: ";TZID=Europe/Berlin:20220816T080000",
    rule: "FREQ=WEEKLY;UNTIL=20220830T060000Z",
    expected: ["2022-08-16T06:00Z", "2022-08-23T06:00Z", "2022-08-30T06:00Z"]
  },
  {
    name: "2022-10-25",
    dtstart: ";TZID=Europe/Berlin:20221011T080000",
    rule: "FREQ=WEEKLY;UNTIL=20221025T060000Z",
    expected: ["2022-10-11T06:00Z", "2022-10-18T06:00Z", "2022-10-25T06:00Z"]
  },
  {
    name: "2022-10-21",
    dtstart: ";TZID=Europe/Berlin:20221007T080000",
    rule: "FREQ=WEEKLY;UNTIL=20221021T060000Z",
    expected: ["2022-10-07T06:00Z", "2022-10-14T06:00Z", "2022-10-21T06:00Z"]
  },
  {
    name: "2023-04-30",
    dtstart: ";TZID=Europe/Berlin:20230416T080000",
    rule: "FREQ=WEEKLY;UNTIL=20230430T060000Z",
    expected: ["2023-04-16T06:00Z", "2023-04-23T06:00Z", "2023-04-30T06:00Z"]
  },
  {
    name: "March DST boundary",
    dtstart: ";TZID=Europe/Berlin:20230319T080000",
    rule: "FREQ=WEEKLY;UNTIL=20230402T060000Z",
    expected: ["2023-03-19T07:00Z", "2023-03-26T06:00Z", "2023-04-02T06:00Z"]
  },
  {
    name: "October DST boundary",
    dtstart: ";TZID=Europe/Berlin:20221023T080000",
    rule: "FREQ=WEEKLY;UNTIL=20221106T070000Z",
    expected: ["2022-10-23T06:00Z", "2022-10-30T07:00Z", "2022-11-06T07:00Z"]
  },
  {
    name: "inclusive all-day DATE UNTIL",
    dtstart: ";VALUE=DATE:20230325",
    rule: "FREQ=DAILY;UNTIL=20230327",
    expected: ["2023-03-25T00:00Z", "2023-03-26T00:00Z", "2023-03-27T00:00Z"]
  },
  {
    name: "all-day DATE with retained TZID",
    dtstart: ";VALUE=DATE;TZID=Europe/Berlin:20230325",
    rule: "FREQ=DAILY;UNTIL=20230327",
    expected: ["2023-03-25T00:00Z", "2023-03-26T00:00Z", "2023-03-27T00:00Z"]
  },
  {
    name: "UNTIL before DTSTART",
    dtstart: ";TZID=Europe/Berlin:20220816T080000",
    rule: "FREQ=WEEKLY;UNTIL=20220816T055959Z",
    expected: []
  },
  {
    name: "unchanged COUNT across DST",
    dtstart: ";TZID=Europe/Berlin:20230319T080000",
    rule: "FREQ=WEEKLY;COUNT=3",
    expected: ["2023-03-19T07:00Z", "2023-03-26T06:00Z", "2023-04-02T06:00Z"]
  },
  {
    name: "UNTIL one second before the last start",
    dtstart: ";TZID=Europe/Berlin:20230319T080000",
    rule: "FREQ=WEEKLY;UNTIL=20230402T055959Z",
    expected: ["2023-03-19T07:00Z", "2023-03-26T06:00Z"]
  },
  {
    name: "UTC UNTIL crosses the local date",
    dtstart: ";TZID=Europe/Berlin:20230319T003000",
    rule: "FREQ=WEEKLY;UNTIL=20230401T223000Z",
    expected: ["2023-03-18T23:30Z", "2023-03-25T23:30Z", "2023-04-01T22:30Z"]
  }
];

describe("shared inclusive recurrence bounds", () => {
  for (const fixture of fixtures) {
    test(`${fixture.name}: calendar, reminders, occurrence info, FullCalendar and invite bounds agree`, () => {
      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        "UID:until-fixture@example.test",
        "SUMMARY:Synthetic recurring event",
        `DTSTART${fixture.dtstart}`,
        `RRULE:${fixture.rule}`,
        "END:VEVENT",
        "END:VCALENDAR"
      ].join("\r\n");
      const [parsed] = parseIcsInvite(ics).events;
      const startAtMs = parsed.start!.getTime();
      const expected = fixture.expected.map((date) => Date.parse(date));
      const rangeEnd = (expected.at(-1) ?? startAtMs) + 14 * 86400000;
      const reminder = {
        eventStartAtMs: startAtMs,
        recurrenceRule: parsed.recurrenceRule,
        startTimezone: parsed.startTimezone
      };
      expect(listRecurrenceOccurrenceStartsInRange(reminder, startAtMs, rangeEnd)).toEqual(expected);

      const event: CalendarEvent = {
        id: "until-fixture",
        accountId: "synthetic-account",
        eventUid: parsed.uid!,
        summary: parsed.summary!,
        startAtMs,
        allDay: parsed.allDay,
        startTimezone: parsed.startTimezone,
        recurrenceRule: parsed.recurrenceRule,
        sourceType: "email",
        createdAtMs: 1,
        updatedAtMs: 1
      };
      expect(expandCalendarEventForRange(event, startAtMs, rangeEnd)
        .map((occurrence) => occurrence.displayStartAtMs)).toEqual(expected);

      const recurring = buildFullCalendarRecurringFields(event)!;
      // Exercise the actual adapter: rrule's TZID output uses process-local
      // date markers, which FullCalendar converts through its DateEnv.
      const dateEnv = new DateEnv({
        timeZone: "local",
        calendarSystem: "gregory",
        locale: {
          codeArg: "en",
          codes: ["en"],
          week: { dow: 1, doy: 4 },
          simpleNumberFormat: new Intl.NumberFormat("en"),
          options: {}
        }
      });
      const adapter = rrulePlugin.recurringTypes[0];
      const data = adapter.parse(recurring, dateEnv);
      const expanded = adapter.expand(data.typeData, {
        start: dateEnv.createMarker(startAtMs - 86400000),
        end: dateEnv.createMarker(rangeEnd)
      }, dateEnv);
      expect(expanded.map((date) => parsed.allDay ? date.getTime() : dateEnv.toDate(date).getTime()))
        .toEqual(expected);

      const [group] = collectCalendarInviteMutationGroups(ics);
      const bounds = deriveInviteDeckEventBounds(group);
      if (expected.length === 0) {
        expect(bounds).toEqual({});
        expect(resolveCurrentOrNextOccurrence(reminder, startAtMs)).toBeNull();
        expect(resolveNextReminderOccurrence({ ...reminder, leadMinutes: 0 }, startAtMs)).toBeNull();
      } else {
        const last = expected.at(-1)!;
        expect(bounds).toEqual({ eventFirstStartAtMs: expected[0], eventLastEndAtMs: last });
        expect(resolveNextReminderOccurrence({ ...reminder, leadMinutes: 0 }, last))
          .toEqual({ eventStartAtMs: last, triggerAtMs: last });
        expect(resolveCurrentOrNextOccurrence(reminder, last)).toEqual({ eventStartAtMs: last });
        expect(resolveCurrentOrNextOccurrence(reminder, last + 1000)).toBeNull();
        expect(getEventOccurrenceInfo(reminder, last)?.startAtMs).toBe(last);
        expect(getEventOccurrenceInfo(reminder, rangeEnd))
          .toMatchObject({ isFuture: false, startAtMs: last });
      }
    });
  }
});
