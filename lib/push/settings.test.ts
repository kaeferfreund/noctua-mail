import { describe, expect, test } from "bun:test";
import { isWithinQuietHours, parsePushDeviceSettings, pushSettingsIncludeAccount } from "./settings";
import { DEFAULT_PUSH_DEVICE_SETTINGS } from "./types";

describe("parsePushDeviceSettings", () => {
  test("accepts the default and complete valid objects", () => {
    expect(parsePushDeviceSettings(DEFAULT_PUSH_DEVICE_SETTINGS)).toEqual(DEFAULT_PUSH_DEVICE_SETTINGS);
    expect(parsePushDeviceSettings({
      accountIds: ["acc-a", "acc-b", "acc-a"], includeSubject: false, badge: false,
      quietHours: { from: "22:00", to: "07:00", timeZone: "Europe/Berlin" }
    })).toEqual({ accountIds: ["acc-a", "acc-b"], includeSubject: false, badge: false, quietHours: { from: "22:00", to: "07:00", timeZone: "Europe/Berlin" } });
  });

  test("rejects missing, extra and malformed fields", () => {
    const base = DEFAULT_PUSH_DEVICE_SETTINGS;
    for (const value of [
      null, [], "all", {}, { ...base, extra: 1 },
      { accountIds: "all", includeSubject: true, badge: true },
      { ...base, accountIds: "some" }, { ...base, accountIds: [""] }, { ...base, accountIds: [1] },
      { ...base, accountIds: Array.from({ length: 201 }, (_, i) => `acc-${i}`) },
      { ...base, includeSubject: "yes" }, { ...base, badge: 1 },
      { ...base, quietHours: {} }, { ...base, quietHours: { from: "24:00", to: "07:00", timeZone: "UTC" } },
      { ...base, quietHours: { from: "7:00", to: "08:00", timeZone: "UTC" } },
      { ...base, quietHours: { from: "08:00", to: "08:00", timeZone: "UTC" } },
      { ...base, quietHours: { from: "22:00", to: "07:00", timeZone: "Mars/Olympus" } },
      { ...base, quietHours: { from: "22:00", to: "07:00", timeZone: "UTC", extra: true } }
    ]) expect(parsePushDeviceSettings(value)).toBeNull();
  });

  test("account selection", () => {
    expect(pushSettingsIncludeAccount(DEFAULT_PUSH_DEVICE_SETTINGS, "any")).toBe(true);
    expect(pushSettingsIncludeAccount({ ...DEFAULT_PUSH_DEVICE_SETTINGS, accountIds: ["a"] }, "a")).toBe(true);
    expect(pushSettingsIncludeAccount({ ...DEFAULT_PUSH_DEVICE_SETTINGS, accountIds: ["a"] }, "b")).toBe(false);
    expect(pushSettingsIncludeAccount({ ...DEFAULT_PUSH_DEVICE_SETTINGS, accountIds: [] }, "a")).toBe(false);
  });
});

describe("isWithinQuietHours", () => {
  const overnight = { from: "22:00", to: "07:00", timeZone: "Europe/Berlin" };
  test("windows across midnight in the device's time zone", () => {
    // January: Berlin is UTC+1.
    expect(isWithinQuietHours(overnight, Date.parse("2026-01-15T21:00:00Z"))).toBe(true); // 22:00 inclusive
    expect(isWithinQuietHours(overnight, Date.parse("2026-01-15T05:59:00Z"))).toBe(true); // 06:59
    expect(isWithinQuietHours(overnight, Date.parse("2026-01-15T06:00:00Z"))).toBe(false); // 07:00 exclusive
    expect(isWithinQuietHours(overnight, Date.parse("2026-01-15T12:00:00Z"))).toBe(false);
    // July: UTC+2, the same instant is an hour later locally.
    expect(isWithinQuietHours(overnight, Date.parse("2026-07-15T05:30:00Z"))).toBe(false); // 07:30
  });

  test("same-day windows and no window", () => {
    const lunch = { from: "12:00", to: "13:30", timeZone: "UTC" };
    expect(isWithinQuietHours(lunch, Date.parse("2026-03-01T12:00:00Z"))).toBe(true);
    expect(isWithinQuietHours(lunch, Date.parse("2026-03-01T13:30:00Z"))).toBe(false);
    expect(isWithinQuietHours(lunch, Date.parse("2026-03-01T11:59:00Z"))).toBe(false);
    expect(isWithinQuietHours(null, Date.now())).toBe(false);
  });
});
