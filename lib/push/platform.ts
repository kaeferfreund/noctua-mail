// Browser capability checks for Web Push. Every function takes the global it
// inspects as an optional argument so tests can pass synthetic environments;
// on the server (no window) they all report false.

type PlatformNavigator = Pick<Navigator, "userAgent" | "maxTouchPoints"> & {
  platform?: string;
  standalone?: boolean;
};

type PlatformWindow = {
  navigator: PlatformNavigator & { serviceWorker?: unknown };
  matchMedia?: (query: string) => { matches: boolean };
  PushManager?: unknown;
  Notification?: unknown;
};

function currentWindow(): PlatformWindow | null {
  return typeof window === "undefined" ? null : (window as unknown as PlatformWindow);
}

/**
 * True on iPhone, iPod and iPad, whatever the browser: every iOS browser is
 * WebKit and only offers Web Push to a web app added to the home screen
 * (iOS 16.4+). iPadOS reports a Mac user agent; touch support tells them apart.
 */
export function isIosSafari(win: PlatformWindow | null = currentWindow()): boolean {
  if (!win) return false;
  const { userAgent, maxTouchPoints, platform } = win.navigator;
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return (platform === "MacIntel" || /Macintosh/.test(userAgent)) && maxTouchPoints > 1;
}

/** True when the app runs as an installed PWA rather than in a browser tab. */
export function isStandalone(win: PlatformWindow | null = currentWindow()): boolean {
  if (!win) return false;
  if (win.navigator.standalone === true) return true;
  const matches = (query: string) => win.matchMedia?.(query).matches === true;
  return matches("(display-mode: standalone)") || matches("(display-mode: fullscreen)");
}

/**
 * True when this context can subscribe to push now. iOS exposes PushManager
 * only inside the installed web app, so a false result on iOS in a tab means
 * "install first" (see isIosSafari / isStandalone), not "never".
 */
export function pushSupported(win: PlatformWindow | null = currentWindow()): boolean {
  if (!win) return false;
  return "serviceWorker" in win.navigator && "PushManager" in win && "Notification" in win;
}
