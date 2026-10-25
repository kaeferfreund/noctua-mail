import { afterEach, expect, test } from "bun:test";
import { IOS_STANDALONE_ATTRIBUTE, IOS_STANDALONE_SCRIPT } from "./iosStandalone";

const IPHONE_IOS26_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const originalMatchMedia = window.matchMedia;
const stubbed = ["userAgent", "platform", "maxTouchPoints", "standalone"] as const;

afterEach(() => {
  document.documentElement.removeAttribute(IOS_STANDALONE_ATTRIBUTE);
  window.matchMedia = originalMatchMedia;
  for (const key of stubbed) delete (navigator as unknown as Record<string, unknown>)[key];
});

function runEarlyScript(env: { userAgent: string; platform: string; maxTouchPoints: number; standalone?: boolean; displayModeStandalone: boolean }) {
  for (const key of stubbed) Object.defineProperty(navigator, key, { configurable: true, value: env[key] });
  window.matchMedia = ((query: string) => ({ matches: query === "(display-mode: standalone)" && env.displayModeStandalone, media: query })) as unknown as typeof window.matchMedia;
  // The inlined source runs as the <head> script does.
  new Function(IOS_STANDALONE_SCRIPT)();
  return document.documentElement.hasAttribute(IOS_STANDALONE_ATTRIBUTE);
}

test("the inlined early script marks an iOS 26 home-screen app on <html>", () => {
  expect(runEarlyScript({ userAgent: IPHONE_IOS26_APP, platform: "iPhone", maxTouchPoints: 5, standalone: true, displayModeStandalone: true })).toBe(true);
});

test("the early script leaves a Safari tab and an installed Android app unmarked", () => {
  expect(runEarlyScript({ userAgent: IPHONE_IOS26_APP, platform: "iPhone", maxTouchPoints: 5, standalone: false, displayModeStandalone: false })).toBe(false);
  expect(runEarlyScript({ userAgent: ANDROID_CHROME, platform: "Linux armv8l", maxTouchPoints: 5, displayModeStandalone: true })).toBe(false);
});
