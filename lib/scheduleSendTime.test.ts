import { describe, expect, test } from "bun:test";
import {
  computeSchedulePresets, customTimeOptions, formatScheduledSendTime, parseLocalDate, resolveCustomTime, zonedTimeToEpoch
} from "./scheduleSendTime";

const TZ = "Europe/Berlin";
const utc = (month: number, day: number, hour: number, minute = 0, year = 2026) => Date.UTC(year, month - 1, day, hour, minute);
const presets = (now: number) => Object.fromEntries(computeSchedulePresets(now, TZ).map(preset => [preset.kind, preset.sendAt]));

describe("schedule presets (Europe/Berlin)", () => {
  test("around 08:00 and 13:00 on Saturday 2026-10-24 (CEST)", () => {
    // 07:59 CEST = 05:59Z
    expect(presets(utc(10, 24, 5, 59))).toEqual({ thisMorning: utc(10, 24, 6), thisAfternoon: utc(10, 24, 11), mondayMorning: utc(10, 26, 7) });
    // 08:00 sharp is no longer ahead: tomorrow 08:00 is already CET (UTC+1) after the switch.
    expect(presets(utc(10, 24, 6))).toEqual({ tomorrowMorning: utc(10, 25, 7), thisAfternoon: utc(10, 24, 11), mondayMorning: utc(10, 26, 7) });
    expect(presets(utc(10, 24, 10, 59))).toMatchObject({ thisAfternoon: utc(10, 24, 11) });
    expect(presets(utc(10, 24, 11))).toEqual({ tomorrowMorning: utc(10, 25, 7), tomorrowAfternoon: utc(10, 25, 12), mondayMorning: utc(10, 26, 7) });
  });

  test("Sunday and Monday: Monday before 08:00 means today, at 08:00 the next week", () => {
    // Sunday 25 Oct 01:30 CEST (before the switch) = 24 Oct 23:30Z
    expect(presets(utc(10, 24, 23, 30))).toEqual({ thisMorning: utc(10, 25, 7), thisAfternoon: utc(10, 25, 12), mondayMorning: utc(10, 26, 7) });
    // Monday 26 Oct 07:59 CET = 06:59Z
    expect(presets(utc(10, 26, 6, 59))).toEqual({ thisMorning: utc(10, 26, 7), thisAfternoon: utc(10, 26, 12), mondayMorning: utc(10, 26, 7) });
    expect(presets(utc(10, 26, 7))).toMatchObject({ tomorrowMorning: utc(10, 27, 7), mondayMorning: utc(11, 2, 7) });
  });

  test("de-DE label is „25. Okt., 08:00“, not „Okt 25“", () => {
    expect(formatScheduledSendTime(utc(10, 25, 7), "de-DE", TZ)).toBe("25. Okt., 08:00");
    expect(formatScheduledSendTime(utc(11, 2, 7), "de-DE", TZ)).toBe("2. Nov., 08:00");
    expect(formatScheduledSendTime(utc(10, 25, 7), "en-US", TZ)).toBe("Oct 25, 08:00");
  });
});

describe("custom time (15-minute steps)", () => {
  test("today starts at the next quarter hour; the past is rejected", () => {
    const now = utc(10, 24, 0, 37); // 02:37 CEST
    const options = customTimeOptions({ year: 2026, month: 10, day: 24 }, now, TZ);
    expect(options[0]).toEqual({ value: "02:45", sendAt: utc(10, 24, 0, 45) });
    expect(options.at(-1)?.value).toBe("23:45");
    expect(resolveCustomTime("2026-10-24", "02:30", now, TZ)).toEqual({ ok: false, reason: "past" });
    expect(resolveCustomTime("2026-10-23", "12:00", now, TZ)).toEqual({ ok: false, reason: "past" });
    expect(resolveCustomTime("2026-10-24", "02:45", now, TZ)).toEqual({ ok: true, sendAt: utc(10, 24, 0, 45) });
    for (const [date, time] of [["2026-10-24", "02:50"], ["2026-02-30", "08:00"], ["24.10.2026", "08:00"], ["2026-10-24", "24:00"]]) {
      expect(resolveCustomTime(date, time, now, TZ)).toEqual({ ok: false, reason: "invalid" });
    }
    expect(parseLocalDate("2026-02-29")).toBeNull();
  });

  test("fall back 2026-10-25 03:00→02:00: each wall time once, the repeated hour at its first instant", () => {
    const options = customTimeOptions({ year: 2026, month: 10, day: 25 }, utc(10, 24, 10), TZ);
    expect(options).toHaveLength(96);
    expect(new Set(options.map(option => option.value)).size).toBe(96);
    expect(options.find(option => option.value === "02:30")?.sendAt).toBe(utc(10, 25, 0, 30));
    expect(options.find(option => option.value === "03:00")?.sendAt).toBe(utc(10, 25, 2));
    // Planned on Saturday 22:00 CEST for Sunday 09:00 CET: 11 wall-clock hours are 12 real hours.
    const planned = resolveCustomTime("2026-10-25", "09:00", utc(10, 24, 20), TZ);
    expect(planned).toEqual({ ok: true, sendAt: utc(10, 25, 8) });
    if (planned.ok) expect(planned.sendAt - utc(10, 24, 20)).toBe(12 * 3_600_000);
  });

  test("spring forward 2027-03-28 02:00→03:00: the missing hour is neither offered nor accepted", () => {
    const date = { year: 2027, month: 3, day: 28 };
    const options = customTimeOptions(date, utc(3, 27, 12, 0, 2027), TZ);
    expect(options).toHaveLength(92);
    expect(options.map(option => option.value)).not.toContain("02:30");
    expect(options.find(option => option.value === "03:00")?.sendAt).toBe(utc(3, 28, 1, 0, 2027));
    expect(zonedTimeToEpoch(date, 2, 30, TZ)).toBeNull();
    expect(resolveCustomTime("2027-03-28", "02:30", utc(3, 27, 12, 0, 2027), TZ)).toEqual({ ok: false, reason: "nonexistent" });
  });
});

test("the minimum lead time is one minute, including quarter-hour and preset boundaries", () => {
  const atEight = Date.UTC(2026, 9, 26, 8);
  expect(resolveCustomTime("2026-10-26", "08:00", atEight - 60_000, "UTC")).toEqual({ ok: true, sendAt: atEight });
  expect(resolveCustomTime("2026-10-26", "08:00", atEight - 59_999, "UTC")).toEqual({ ok: false, reason: "tooSoon" });
  expect(customTimeOptions({ year: 2026, month: 10, day: 26 }, atEight - 59_999, "UTC")[0].value).toBe("08:15");
  expect(computeSchedulePresets(atEight - 59_999, "UTC")[0].kind).toBe("tomorrowMorning");
});
