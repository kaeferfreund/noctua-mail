import { expect, test } from "bun:test";
import type { TrackingClientType, TrackingEventType } from "../types";
import { classifyTrackingClient } from "./classify";

const sentAt = 100_000;
const cases: Array<[string, string | null, TrackingEventType, number, string, string | null, string | null, TrackingClientType, boolean]> = [
  ["MPP bare UA", "Mozilla/5.0", "open", 80_000, "GET", "Apple Mail Privacy Protection", null, "proxy", true],
  ["MPP named UA", "AppleMailPrivacyProtection", "open", 80_000, "GET", "Apple Mail Privacy Protection", null, "proxy", true],
  ["Gmail proxy after send", "Mozilla/5.0 (Linux) GoogleImageProxy", "open", 100, "GET", "Gmail Image Proxy", "Linux", "proxy", false],
  ["Yahoo proxy after send", "YahooMailProxy", "open", 100, "GET", "Yahoo Mail Image Proxy", null, "proxy", false],
  ["proxy HEAD", "GoogleImageProxy", "open", 12_000, "HEAD", "Gmail Image Proxy", null, "proxy", true],
  ["Safe Links", "Microsoft SafeLinks", "click", 12_000, "GET", "Microsoft Safe Links", null, "bot", true],
  ["gateway", "Proofpoint URLDefense", "click", 12_000, "GET", "Proofpoint", null, "bot", true],
  ["early click", "Chrome/120.0", "click", 5_000, "GET", "Chrome", null, "browser", true],
  ["early open", "Outlook/16 Windows", "open", 100, "GET", "Outlook", "Windows", "mail-client", true],
  ["later click", "Chrome/120.0 Linux", "click", 5_001, "GET", "Chrome", "Linux", "browser", false],
  ["mobile Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", "click", 60_000, "GET", "Safari", "iOS", "mobile", false],
  ["missing UA", null, "open", 60_000, "GET", null, null, "unknown", false],
  ["SDK delivery", "Proofpoint", "delivered", 100, "GET", "Proofpoint", null, "bot", false]
];

for (const [label, ua, type, delay, method, clientName, clientOs, clientType, machine] of cases) {
  test(label, () => {
    expect(classifyTrackingClient(ua, type, sentAt + delay, sentAt, method)).toEqual({ clientName, clientOs, clientType, machine });
  });
}
