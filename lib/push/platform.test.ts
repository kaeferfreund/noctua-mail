import { describe, expect, it } from "bun:test";
import { isIosSafari, isStandalone, pushSupported } from "./platform";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

function env(options: { userAgent: string; maxTouchPoints?: number; platform?: string; standalone?: boolean;
  displayMode?: string; push?: boolean }) {
  const navigator: Record<string, unknown> = {
    userAgent: options.userAgent, maxTouchPoints: options.maxTouchPoints ?? 0, platform: options.platform, standalone: options.standalone
  };
  const win: Record<string, unknown> = {
    navigator,
    matchMedia: (query: string) => ({ matches: query === `(display-mode: ${options.displayMode})` })
  };
  if (options.push) {
    navigator.serviceWorker = {};
    Object.assign(win, { PushManager: class {}, Notification: class {} });
  }
  return win as unknown as Parameters<typeof isIosSafari>[0];
}

describe("push platform detection", () => {
  it("recognises iPhone and iPadOS in every WebKit browser, but not a Mac or Android", () => {
    expect(isIosSafari(env({ userAgent: IPHONE, maxTouchPoints: 5 }))).toBe(true);
    expect(isIosSafari(env({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 }))).toBe(true);
    expect(isIosSafari(env({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 5 }))).toBe(true);
    expect(isIosSafari(env({ userAgent: MAC, platform: "MacIntel" }))).toBe(false);
    expect(isIosSafari(env({ userAgent: ANDROID, maxTouchPoints: 5 }))).toBe(false);
  });

  it("detects the installed app through navigator.standalone or the display mode", () => {
    expect(isStandalone(env({ userAgent: IPHONE, standalone: true }))).toBe(true);
    expect(isStandalone(env({ userAgent: ANDROID, displayMode: "standalone" }))).toBe(true);
    expect(isStandalone(env({ userAgent: ANDROID, displayMode: "fullscreen" }))).toBe(true);
    expect(isStandalone(env({ userAgent: IPHONE, standalone: false, displayMode: "browser" }))).toBe(false);
  });

  it("requires service worker, PushManager and Notification", () => {
    expect(pushSupported(env({ userAgent: ANDROID, push: true }))).toBe(true);
    // iOS Safari in a tab exposes no PushManager.
    expect(pushSupported(env({ userAgent: IPHONE }))).toBe(false);
  });

  it("reports nothing on the server", () => {
    expect(typeof window).toBe("undefined");
    expect([isIosSafari(), isStandalone(), pushSupported()]).toEqual([false, false, false]);
  });
});
