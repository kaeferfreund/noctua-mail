import { describe, expect, test } from "bun:test";
import { isIos26Standalone, type IosStandaloneEnv } from "./iosStandalone";

// Home-screen apps carry no Safari "Version/" token.
const IPHONE_IOS26_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const IPHONE_IOS26_0_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const IPHONE_IOS26_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const IPHONE_IOS18_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const IPHONE_IOS18_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_APP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const MACOS_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

const iphone = (userAgent: string, installed: boolean): IosStandaloneEnv =>
  ({ userAgent, platform: "iPhone", maxTouchPoints: 5, standalone: installed, displayModeStandalone: installed });

describe("iOS 26 home-screen app detection", () => {
  test("iOS 26 home-screen app (frozen OS token 18_6 / 18_7)", () => {
    expect(isIos26Standalone(iphone(IPHONE_IOS26_APP, true))).toBe(true);
    expect(isIos26Standalone(iphone(IPHONE_IOS26_0_APP, true))).toBe(true);
  });

  test("iOS 26 Safari: only when installed, by its Version/26 token", () => {
    expect(isIos26Standalone(iphone(IPHONE_IOS26_SAFARI, true))).toBe(true);
    expect(isIos26Standalone(iphone(IPHONE_IOS26_SAFARI, false))).toBe(false);
  });

  test("iOS 18 is left alone, installed or not", () => {
    expect(isIos26Standalone(iphone(IPHONE_IOS18_APP, true))).toBe(false);
    expect(isIos26Standalone(iphone(IPHONE_IOS18_SAFARI, true))).toBe(false);
  });

  test("iPadOS with the desktop user agent counts when installed", () => {
    expect(isIos26Standalone({ userAgent: IPAD_DESKTOP_APP, platform: "MacIntel", maxTouchPoints: 5, standalone: true, displayModeStandalone: true })).toBe(true);
  });

  test("Android Chrome as installed app and macOS Safari stay at 0", () => {
    expect(isIos26Standalone({ userAgent: ANDROID_CHROME, platform: "Linux armv8l", maxTouchPoints: 5, displayModeStandalone: true })).toBe(false);
    expect(isIos26Standalone({ userAgent: MACOS_SAFARI, platform: "MacIntel", maxTouchPoints: 0, displayModeStandalone: false })).toBe(false);
    expect(isIos26Standalone({ userAgent: MACOS_SAFARI, platform: "MacIntel", maxTouchPoints: 0, displayModeStandalone: true })).toBe(false);
  });
});
