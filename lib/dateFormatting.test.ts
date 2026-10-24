import { describe, expect, test } from "bun:test";
import {
  formatAccountDateValue,
  formatAccountMediumDate,
  formatForwardedMessageDate,
  formatAccountMediumDateTime,
  formatAccountShortTime,
  formatAccountTimestampLabel,
  formatAccountUpcomingDateLabel,
  getMessageDateDisplay
} from "./dateFormatting";

// A stable timestamp (2026-04-15 15:45:00 local). We use getTime() from a
// locally-constructed Date so these assertions pass regardless of the CI
// machine's timezone.
const SAMPLE_MS = new Date(2026, 3, 15, 15, 45, 0).getTime();

function formatUpcomingDateLabelInSubprocess(timeZone: string) {
  const evalSource = `
    import { formatAccountUpcomingDateLabel } from "./lib/dateFormatting";
    const nowMs = new Date(2026, 2, 29, 9, 0, 0).getTime();
    const tomorrowMs = new Date(2026, 2, 30, 10, 0, 0).getTime();
    process.stdout.write(formatAccountUpcomingDateLabel(tomorrowMs, "ymd", nowMs) ?? "");
  `;
  const result = Bun.spawnSync({
    cmd: ["bun", "-e", evalSource],
    cwd: process.cwd(),
    env: { ...process.env, TZ: timeZone },
    stdout: "pipe",
    stderr: "pipe"
  });
  return {
    exitCode: result.exitCode,
    stdout: Buffer.from(result.stdout).toString("utf8").trim(),
    stderr: Buffer.from(result.stderr).toString("utf8").trim()
  };
}

describe("dateFormatting helpers", () => {
  test("formatForwardedMessageDate spells out weekday, month and time zone", () => {
    const zone = /(?:GMT[+\-]\d{1,2}(?::\d{2})?|UTC|[A-Z]{2,5})$/;
    // ICU versions differ on the date/time joiner (", " or " at ").
    expect(formatForwardedMessageDate(SAMPLE_MS, "Wed, 15 Apr 2026", "mdy")).toMatch(
      /^Wed, Apr 15, 2026(?:,| at) 03:45 PM /
    );
    expect(formatForwardedMessageDate(SAMPLE_MS, "", "mdy")).toMatch(zone);
    expect(formatForwardedMessageDate(SAMPLE_MS, "", "dmy")).toMatch(
      /^Wed, 15 Apr 2026(?:,| at) 15:45 /
    );
    expect(formatForwardedMessageDate(SAMPLE_MS, "", "ymd")).toMatch(/^\w{2,3}\.?, 2026-04-15 15:45 /);
    expect(formatForwardedMessageDate(Number.NaN, "Wed, 15 Apr 2026", "mdy")).toBe("Wed, 15 Apr 2026");
  });

  test("formatAccountDateValue honors ymd preset", () => {
    expect(formatAccountDateValue(SAMPLE_MS, "ymd")).toBe("2026-04-15 15:45");
  });

  test("formatAccountDateValue uses US numeric ordering for mdy", () => {
    const output = formatAccountDateValue(SAMPLE_MS, "mdy");
    // en-US numeric format places month first.
    expect(output).toMatch(/^4\/15\/2026/);
  });

  test("formatAccountDateValue uses day-first ordering for dmy", () => {
    const output = formatAccountDateValue(SAMPLE_MS, "dmy");
    expect(output).toMatch(/^15\/04\/2026/);
  });

  test("formatAccountMediumDateTime switches output when the user changes preset", () => {
    // This is the core consolidation guarantee: routing a call site through
    // lib/dateFormatting must react to the account's stored preference.
    const ymd = formatAccountMediumDateTime(SAMPLE_MS, "ymd");
    const mdy = formatAccountMediumDateTime(SAMPLE_MS, "mdy");
    const dmy = formatAccountMediumDateTime(SAMPLE_MS, "dmy");

    // All three outputs must be non-null.
    expect(ymd).not.toBeNull();
    expect(mdy).not.toBeNull();
    expect(dmy).not.toBeNull();

    // ymd is the unambiguous canary: it MUST contain the ISO date shape.
    expect(ymd).toContain("2026-04-15");

    // mdy and dmy must differ from each other (US vs UK ordering) to prove
    // the preset actually flows through.
    expect(mdy).not.toBe(dmy);
    expect(mdy).toContain("2026");
    expect(dmy).toContain("2026");
  });

  test("formatAccountMediumDate honors ymd preset without adding time", () => {
    expect(formatAccountMediumDate(SAMPLE_MS, "ymd")).toBe("2026-04-15");
  });

  test("formatAccountUpcomingDateLabel uses relative labels for today and tomorrow", () => {
    const nowMs = new Date(2026, 3, 15, 9, 0, 0).getTime();
    const todayMs = new Date(2026, 3, 15, 15, 45, 0).getTime();
    const tomorrowMs = new Date(2026, 3, 16, 10, 0, 0).getTime();

    expect(formatAccountUpcomingDateLabel(todayMs, "ymd", nowMs)).toBe("Today");
    expect(formatAccountUpcomingDateLabel(tomorrowMs, "ymd", nowMs)).toBe("Tomorrow");
  });

  test("formatAccountUpcomingDateLabel handles tomorrow across DST boundaries", () => {
    const result = formatUpcomingDateLabelInSubprocess("Europe/Berlin");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("Tomorrow");
  });

  test("formatAccountUpcomingDateLabel falls back to account-formatted dates", () => {
    const nowMs = new Date(2026, 3, 15, 9, 0, 0).getTime();
    const laterMs = new Date(2026, 3, 20, 10, 0, 0).getTime();

    expect(formatAccountUpcomingDateLabel(laterMs, "ymd", nowMs)).toBe("2026-04-20");
  });

  describe("getMessageDateDisplay relative day labels", () => {
    // The UI path formats in the explicit display zone (Europe/Berlin), so the
    // instants are given in UTC: 2026-12-31 is CET (UTC+1), 2026-10-25 ends DST.
    const relativeDays = (nowMs: number) => ({ labels: { today: "Heute", yesterday: "Gestern" }, nowMs });
    const berlin = (year: number, month: number, day: number, hour: number, minute: number, offsetHours = 1) =>
      Date.UTC(year, month - 1, day, hour - offsetHours, minute);

    test("today and yesterday replace the date, older days keep it", () => {
      const nowMs = berlin(2026, 12, 31, 23, 59);
      const text = (ms: number) => getMessageDateDisplay(ms, "", "locale", "de", relativeDays(nowMs)).text;

      expect(text(berlin(2026, 12, 31, 0, 1))).toBe("Heute, 00:01");
      expect(text(berlin(2026, 12, 30, 23, 59))).toBe("Gestern, 23:59");
      expect(text(berlin(2026, 12, 30, 0, 0))).toBe("Gestern, 00:00");
      expect(text(berlin(2026, 12, 29, 23, 59))).toBe("29.12.2026, 23:59");
    });

    test("uses display-zone day boundaries across the year boundary", () => {
      // 00:01 Berlin on 1 January is still 31 December in UTC.
      const nowMs = berlin(2027, 1, 1, 0, 1);
      const text = (ms: number) => getMessageDateDisplay(ms, "", "locale", "de", relativeDays(nowMs)).text;

      expect(text(berlin(2027, 1, 1, 0, 0))).toBe("Heute, 00:00");
      expect(text(berlin(2026, 12, 31, 23, 59))).toBe("Gestern, 23:59");
      expect(text(berlin(2026, 12, 31, 0, 0))).toBe("Gestern, 00:00");
      expect(text(berlin(2026, 12, 30, 23, 59))).toBe("30.12.2026, 23:59");
    });

    test("counts calendar days across the end of daylight saving time", () => {
      const nowMs = berlin(2026, 10, 26, 0, 30);
      const text = getMessageDateDisplay(berlin(2026, 10, 25, 0, 30, 2), "", "locale", "de", relativeDays(nowMs)).text;

      expect(text).toBe("Gestern, 00:30");
    });

    test("tooltip keeps the full date and account presets keep their time style", () => {
      const nowMs = berlin(2026, 4, 15, 18, 0, 2);
      const messageMs = berlin(2026, 4, 15, 15, 45, 2);

      expect(getMessageDateDisplay(messageMs, "", "locale", "de", relativeDays(nowMs))).toEqual({
        text: "Heute, 15:45",
        tooltip: "15.04.2026, 15:45:00"
      });
      expect(getMessageDateDisplay(messageMs, "", "mdy", "en", relativeDays(nowMs)).text).toBe("Heute, 03:45 PM");
      expect(getMessageDateDisplay(messageMs, "", "ymd", "en", relativeDays(nowMs)).text).toBe("Heute, 15:45");
    });

    test("without relative labels and for future dates the absolute date stays", () => {
      const nowMs = berlin(2026, 4, 15, 18, 0, 2);

      expect(getMessageDateDisplay(berlin(2026, 4, 15, 15, 45, 2), "", "locale", "de").text).toBe("15.04.2026, 15:45");
      expect(getMessageDateDisplay(berlin(2026, 4, 16, 9, 0, 2), "", "locale", "de", relativeDays(nowMs)).text).toBe("16.04.2026, 09:00");
    });
  });

  test("formatAccountShortTime returns a non-empty label", () => {
    const output = formatAccountShortTime(SAMPLE_MS, "locale");
    expect(output).not.toBeNull();
    expect(output!.length).toBeGreaterThan(0);
  });

  test("formatAccountShortTime with ymd preset returns only a time label", () => {
    const output = formatAccountShortTime(SAMPLE_MS, "ymd");
    expect(output).not.toBeNull();
    expect(output).toMatch(/^\d{2}:\d{2}$/);
    expect(output).not.toContain("-");
  });

  test("formatAccountTimestampLabel returns the fallback for null/invalid input", () => {
    expect(formatAccountTimestampLabel(null)).toBe("Never");
    expect(formatAccountTimestampLabel(undefined)).toBe("Never");
    expect(formatAccountTimestampLabel(Number.NaN)).toBe("Never");
    expect(formatAccountTimestampLabel(null, "locale", "Unknown")).toBe("Unknown");
  });

  test("formatAccountTimestampLabel delegates formatting to the preset", () => {
    expect(formatAccountTimestampLabel(SAMPLE_MS, "ymd")).toContain("2026-04-15");
  });

  test("formatAccountMediumDateTime returns null for non-finite input", () => {
    expect(formatAccountMediumDateTime(Number.NaN)).toBeNull();
  });
});
