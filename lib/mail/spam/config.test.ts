import { describe, expect, test } from "bun:test";
import { isSpamDetectionOn, parseSpamMailboxSettings, SpamSettingsError } from "./config";

describe("per-mailbox switch", () => {
  test("a mailbox is on unless switched off, and only while the global switch is on", () => {
    expect(isSpamDetectionOn({ enabled: true }, {})).toBe(true);
    expect(isSpamDetectionOn({ enabled: true }, null)).toBe(true);
    expect(isSpamDetectionOn({ enabled: true }, { enabled: true })).toBe(true);
    expect(isSpamDetectionOn({ enabled: true }, { enabled: false })).toBe(false);
    expect(isSpamDetectionOn({ enabled: false }, { enabled: true })).toBe(false);
  });

  test("the mailbox settings accept a boolean enabled flag only", () => {
    expect(parseSpamMailboxSettings({ enabled: false, autoMove: true })).toEqual({ enabled: false, autoMove: true });
    expect(() => parseSpamMailboxSettings({ enabled: "no" })).toThrow(SpamSettingsError);
  });
});
