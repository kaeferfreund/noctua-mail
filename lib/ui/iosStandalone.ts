/**
 * iOS/iPadOS home-screen app detection for the small top spacer
 * (--top-spacer in app/globals.css): iOS 26 dims the top edge of a home-screen
 * app's content, so the first header line moves a quarter line down there.
 */
export type IosStandaloneEnv = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** navigator.standalone (iOS only). */
  standalone?: boolean;
  /** matchMedia("(display-mode: standalone)").matches */
  displayModeStandalone: boolean;
};

/**
 * Whether this is an iOS/iPadOS home-screen app on iOS 26 or later, as far as
 * the user agent tells:
 * - Safari's `Version/NN` token is the iOS major (absent in home-screen apps).
 * - Since iOS 26 the OS token is frozen at 18_6, 18_6_2 or 18_7, so 18.6 and
 *   later count as 26; an older OS token is a real pre-26 system.
 * - iPadOS with the desktop user agent ("Macintosh", platform MacIntel and
 *   touch points) reports no iOS version at all and counts as 26.
 *
 * Self-contained (no imports, no closures): IOS_STANDALONE_SCRIPT inlines its
 * source to run before the first paint.
 */
export function isIos26Standalone(env: IosStandaloneEnv): boolean {
  const ua = env.userAgent;
  const iPadDesktop = env.platform === "MacIntel" && env.maxTouchPoints > 1;
  if (!/\b(iPhone|iPad|iPod)\b/.test(ua) && !iPadDesktop) return false;
  if (env.standalone !== true && !env.displayModeStandalone) return false;
  const safari = /\bVersion\/(\d+)/.exec(ua);
  if (safari) return Number(safari[1]) >= 26;
  const os = /\bOS (\d+)_(\d+)/.exec(ua);
  if (!os) return true;
  const major = Number(os[1]);
  return major >= 26 || (major === 18 && Number(os[2]) >= 6);
}

/** Attribute on <html> that turns on --top-spacer. */
export const IOS_STANDALONE_ATTRIBUTE = "data-ios-standalone";

/** Runs in <head> before the first paint (app/layout.tsx). */
export const IOS_STANDALONE_SCRIPT = `(function(){try{var n=navigator;if((${isIos26Standalone.toString()})({userAgent:n.userAgent||"",platform:n.platform||"",maxTouchPoints:n.maxTouchPoints||0,standalone:n.standalone,displayModeStandalone:!!(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)}))document.documentElement.setAttribute("${IOS_STANDALONE_ATTRIBUTE}","")}catch(e){}})()`;
