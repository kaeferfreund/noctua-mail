"use client";

import { isIosSafari, isStandalone } from "@/lib/push/platform";

/**
 * An iOS home-screen app opened by a notification tap (`clients.openWindow`) starts with an
 * empty history entry before the app. The edge swipe is Back: it shows that empty entry, a
 * reload keeps it, and only a force-quit discards the window. So the app's first entry gets a
 * root marker and a copy on top (the trap); Back onto the root pushes the copy again, and the
 * app stays the entry on screen. URL entries and Sheets sit on top of the trap as before.
 * iOS only: on Android, Back at the root closes the app, as users expect.
 */
const ROOT = "noctuaRoot";
const TRAP = "noctuaRootTrap";

type Entry = { href: string; state: Record<string, unknown> | null };
/** The entry on screen while the trap is installed; restored by a Back onto the root. */
let shown: Entry | null = null;

const current = (): Entry => ({ href: window.location.href, state: window.history.state });

function trapState(state: Record<string, unknown> | null) {
  // A Sheet's entry is gone once Back reached the root.
  const { [ROOT]: _root, noctuaMobileOverlay: _overlay, ...rest } = state ?? {};
  return { ...rest, [TRAP]: true };
}

/** Back onto the root entry: the trap has already restored the entry on screen. */
export const isStandaloneRootPop = (event: PopStateEvent) => event.state?.[ROOT] === true;

/** The URL owner calls this after each write, so the root restores exactly that URL and state. */
export function rememberStandaloneEntry() {
  if (shown) shown = current();
}

function onPop(event: PopStateEvent) {
  if (!shown) return;
  if (!isStandaloneRootPop(event)) {
    shown = current();
    return;
  }
  // Synchronously, before the router's own popstate listener reads the location.
  window.history.pushState(trapState(shown.state), "", shown.href);
}

export function installStandaloneRootTrap() {
  if (shown || !isIosSafari() || !isStandalone()) return () => {};
  const state = window.history.state;
  // A reload or a restored app keeps its entries: install once per history.
  if (!state?.[TRAP]) {
    if (!state?.[ROOT]) window.history.replaceState({ ...state, [ROOT]: true }, "");
    window.history.pushState(trapState(window.history.state), "");
  }
  shown = current();
  window.addEventListener("popstate", onPop, true);
  return () => {
    shown = null;
    window.removeEventListener("popstate", onPop, true);
  };
}
