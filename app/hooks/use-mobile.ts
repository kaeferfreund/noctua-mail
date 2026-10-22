"use client";

import { useSyncExternalStore } from "react";

export const MOBILE_QUERY = "(max-width: 767px)";
const serverSnapshot = () => false;
const getSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// CSS owns initial pane visibility, including SSR/hydration. The media query
// snapshot also gives newly mounted dialogs the correct value immediately.
export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
}
