"use client";

import { useContext, useEffect, useLayoutEffect, useRef } from "react";

import { UrlHistoryContext } from "./UrlHistoryContext";

type Overlay = { id: number; close: () => void; pushed: boolean };
const overlays: Overlay[] = [];
const consumedPops = new WeakSet<Event>();
let nextId = 0;
let returning = false;
let listening = false;
let deferred: Array<() => void> = [];

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
    returning = false;
    // A close and another open can happen in one React commit (sidebar →
    // settings, or calendar → message). Finish Back before creating entries.
    const callbacks = deferred;
    deferred = [];
    callbacks.forEach((callback) => callback());
    overlays.filter((overlay) => !overlay.pushed).forEach(pushOverlay);
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
  if (returning) deferred.push(() => { if (!cancelled) callback(); });
  else callback();
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
        returning = true;
        window.history.back();
      }
      updateListener();
    };
  }, [open, urlManaged]);
}
