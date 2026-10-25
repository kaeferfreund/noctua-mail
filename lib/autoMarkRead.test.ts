import { describe, expect, it } from "bun:test";
import { accountPrefsPatchSchema, stripPersonalSettings } from "./accountPrefs";
import { AUTO_MARK_READ_MODES, autoMarkReadDelayMs, DEFAULT_AUTO_MARK_READ_MODE, resolveAutoMarkReadMode } from "./autoMarkRead";
import type { AccountSettings } from "./data";

describe("auto-read preference", () => {
  it("maps every mode to its dwell", () => {
    expect(AUTO_MARK_READ_MODES.map(autoMarkReadDelayMs)).toEqual([0, 1000, 3000, null]);
    expect(DEFAULT_AUTO_MARK_READ_MODE).toBe("after1s");
  });

  it("resolves default < mailbox setting < personal preference and ignores unknown values", () => {
    expect(resolveAutoMarkReadMode(undefined, undefined)).toBe("after1s");
    expect(resolveAutoMarkReadMode({ reading: { autoMarkRead: "after3s" } }, {})).toBe("after3s");
    expect(resolveAutoMarkReadMode({ reading: { autoMarkRead: "after3s" } }, { reading: { autoMarkRead: "never" } })).toBe("never");
    const stored = { reading: { autoMarkRead: "sometimes" } } as unknown as AccountSettings;
    expect(resolveAutoMarkReadMode(stored, stored)).toBe("after1s");
  });

  it("accepts the modes as a personal preference patch and rejects anything else", () => {
    for (const mode of AUTO_MARK_READ_MODES) {
      expect(accountPrefsPatchSchema.safeParse({ reading: { autoMarkRead: mode } }).success).toBe(true);
    }
    expect(accountPrefsPatchSchema.safeParse({ reading: { autoMarkRead: null } }).success).toBe(true);
    expect(accountPrefsPatchSchema.safeParse({ reading: null }).success).toBe(true);
    expect(accountPrefsPatchSchema.safeParse({ reading: { autoMarkRead: "after2s" } }).success).toBe(false);
    expect(accountPrefsPatchSchema.safeParse({ reading: { autoMarkRead: "never", extra: true } }).success).toBe(false);
  });

  it("is personal: mailbox settings keep it only as a team default", () => {
    const settings: AccountSettings = { reading: { autoMarkRead: "immediate" }, sync: { pollIntervalMs: 60_000 } };
    expect(stripPersonalSettings(settings, false)).toEqual({ sync: { pollIntervalMs: 60_000 } });
    expect(stripPersonalSettings(settings, true)).toEqual(settings);
  });
});
