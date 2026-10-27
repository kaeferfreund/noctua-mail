import { clientErrorSearch, type BlankScreenContext } from "@/lib/clientErrors";
import { reportClientError } from "@/lib/ui/clientErrorReporter";

/** How long the app root may stay empty after a load, a page-cache restore or a Back. */
export const BLANK_SCREEN_DELAY_MS = 3000;
export const BLANK_SCREEN_MESSAGE = "Blank screen";

/** The layout's <main> holds every page; empty means no text and no media in it. */
export function isAppRootEmpty(doc: Document = document) {
  const main = doc.querySelector("main");
  return !main || (!main.textContent?.trim() && !main.querySelector("img, svg, canvas, video, iframe, input"));
}

export function blankScreenContext(trigger: string): BlankScreenContext {
  const state: unknown = window.history.state;
  const navigation = typeof performance.getEntriesByType === "function"
    ? performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined : undefined;
  return {
    search: clientErrorSearch(window.location.search),
    historyStateKeys: state && typeof state === "object" ? Object.keys(state) : [],
    visibilityState: document.visibilityState,
    navigationType: navigation?.type ?? "",
    trigger
  };
}

/**
 * Leaves a `[client] blank` line in the server log when the app root stays empty, a case
 * that throws nothing and so never reaches the crash report. One report per minute and tab
 * (the reporter's dedupe); the route limits each session as well.
 */
export function installBlankScreenWatchdog() {
  let timer: number | undefined;
  const check = (trigger: string) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (isAppRootEmpty()) reportClientError("watchdog", BLANK_SCREEN_MESSAGE, Date.now(), { kind: "blank-screen", blank: blankScreenContext(trigger) });
    }, BLANK_SCREEN_DELAY_MS);
  };
  const onPageShow = (event: PageTransitionEvent) => check(event.persisted ? "pageshow" : "load");
  const onPopState = () => check("popstate");
  check("load");
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("popstate", onPopState);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("popstate", onPopState);
  };
}
