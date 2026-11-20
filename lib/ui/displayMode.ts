"use client";

import { useSyncExternalStore } from "react";

const STANDALONE_QUERY = "(display-mode: standalone)";
const TOUCH_QUERY = "(pointer: coarse)";

function matches(query: string) {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

/** Installed app (home-screen app on iOS, installed PWA elsewhere) rather than a browser tab. */
export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || matches(STANDALONE_QUERY);
}

/**
 * A home-screen app on a phone or tablet shows one view without browser
 * chrome. A window it opens has no tab bar and no way back to the app (iOS),
 * so previews open inside the app there and "new window" actions are left
 * out. An installed desktop app keeps its separate windows.
 */
export function isSingleWindowApp() {
  if (!isStandaloneDisplay()) return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || matches(TOUCH_QUERY);
}

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const queries = [STANDALONE_QUERY, TOUCH_QUERY].map((query) => window.matchMedia(query));
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onChange));
}

const serverSnapshot = () => false;

export function useSingleWindowApp() {
  return useSyncExternalStore(subscribe, isSingleWindowApp, serverSnapshot);
}
