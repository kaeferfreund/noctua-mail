"use client";

import { useContext, useEffect, useLayoutEffect, useRef } from "react";

import { recordOverlayBackFallback } from "@/lib/ui/clientErrorReporter";

import { UrlHistoryContext } from "./UrlHistoryContext";

type Overlay = { id: number; close: () => void; pushed: boolean };
const overlays: Overlay[] = [];
const consumedPops = new WeakSet<Event>();
let nextId = 0;
let returning = false;
let listening = false;
let deferred: Array<() => void> = [];
let returnTimer: number | undefined;

/**
 * Safety net: if the browser never reports the Back we asked for (seen as a
 * frozen UI in the iOS home-screen app), stop waiting so navigation resumes.
 */
export const MOBILE_OVERLAY_BACK_TIMEOUT_MS = 600;

function finishReturn() {
  if (returnTimer !== undefined) { window.clearTimeout(returnTimer); returnTimer = undefined; }
  returning = false;
  // A close and another open can happen in one React commit (sidebar →
  // settings, or calendar → message). Finish Back before creating entries.
  const callbacks = deferred;
  deferred = [];
  callbacks.forEach((callback) => callback());
  overlays.filter((overlay) => !overlay.pushed).forEach(pushOverlay);
}

function beginReturn() {
  returning = true;
  if (returnTimer !== undefined) window.clearTimeout(returnTimer);
  returnTimer = window.setTimeout(() => { returnTimer = undefined; if (returning) { recordOverlayBackFallback(); finishReturn(); updateListener(); } }, MOBILE_OVERLAY_BACK_TIMEOUT_MS);
}

/** Classify from current state too: a window listener may run before onPop. */
export const isMobileOverlayPop = (event: PopStateEvent) => consumedPops.has(event) || returning ||
  (overlays.length > 0 && overlays.at(-1)!.id !== event.state?.noctuaMobileOverlay);

function pushOverlay(overlay: Overlay) {
  overlay.pushed = true;
  window.history.pushState({ ...window.history.state, noctuaMobileOverlay: overlay.id }, "");
}

function updateListener() {
  const needed = returning || overlays.length > 0;
  if (needed === listening) return;
  listening = needed;
  if (needed) window.addEventListener("popstate", onPop, true);
  else window.removeEventListener("popstate", onPop, true);
}

function onPop(event: PopStateEvent) {
  if (returning) {
    consumedPops.add(event);
    finishReturn();
  } else {
    const destination = event.state?.noctuaMobileOverlay;
    while (overlays.length && overlays.at(-1)!.id !== destination) {
      const overlay = overlays.pop()!;
      consumedPops.add(event);
      overlay.close();
    }
  }
  updateListener();
}

/** Selection changes wait for a programmatically dismissed Sheet's Back. */
export function afterMobileOverlayNavigation(callback: () => void) {
  let cancelled = false;
  const run = () => { if (!cancelled) callback(); };
  if (returning) deferred.push(run);
  else if (overlays.some((overlay) => overlay.pushed && overlay.id === window.history.state?.noctuaMobileOverlay)) {
    // A pick inside a Sheet (sidebar → mailbox) runs before the Sheet's cleanup. An
    // entry written now would sit on the Sheet's own entry and leave a duplicate
    // Forward entry once the Sheet steps back. Wait for the close, if there is one.
    const timer = window.setTimeout(() => { if (returning) deferred.push(run); else run(); }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  } else callback();
  return () => { cancelled = true; };
}

/** Every mobile Sheet gets a history entry, including nested Sheets. */
export function useMobileOverlayHistory(open: boolean, close: () => void) {
  const urlManaged = useContext(UrlHistoryContext);
  const closeRef = useRef(close);
  useLayoutEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    if (!open || urlManaged) return;
    const overlay: Overlay = { id: ++nextId, close: () => closeRef.current(), pushed: false };
    overlays.push(overlay);
    if (!returning) pushOverlay(overlay);
    updateListener();
    return () => {
      const index = overlays.indexOf(overlay);
      if (index < 0) return; // Already dismissed by browser Back.
      overlays.splice(index, 1);
      if (overlay.pushed && window.history.state?.noctuaMobileOverlay === overlay.id) {
        beginReturn();
        window.history.back();
      }
      updateListener();
    };
  }, [open, urlManaged]);
}
