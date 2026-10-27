import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { BLANK_SCREEN_DELAY_MS, blankScreenContext, installBlankScreenWatchdog, isAppRootEmpty } from "./blankScreenWatchdog";
import { resetClientErrorReporterForTests } from "./clientErrorReporter";

const originalFetch = globalThis.fetch;
const reports: Record<string, unknown>[] = [];
let stop = () => {};
beforeEach(() => {
  resetClientErrorReporterForTests(); reports.length = 0;
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => { reports.push(JSON.parse(String(init?.body))); return new Response(null, { status: 204 }); }) as typeof fetch;
  document.body.innerHTML = "<main></main>";
});
afterEach(() => {
  stop();
  globalThis.fetch = originalFetch;
  resetClientErrorReporterForTests();
  document.body.innerHTML = "";
  jest.useRealTimers();
});

test("an app root is empty without text or media", () => {
  expect(isAppRootEmpty()).toBe(true);
  document.querySelector("main")!.innerHTML = "<div><div>  </div></div>";
  expect(isAppRootEmpty()).toBe(true);
  document.querySelector("main")!.innerHTML = "<div>Posteingang</div>";
  expect(isAppRootEmpty()).toBe(false);
  document.querySelector("main")!.innerHTML = "<div><svg></svg></div>";
  expect(isAppRootEmpty()).toBe(false);
  document.body.innerHTML = "";
  expect(isAppRootEmpty()).toBe(true);
});

test("the payload carries the search without a search text, state keys, visibility and the navigation type, never the fragment", () => {
  window.history.replaceState({ __NA: true, noctuaRootTrap: true, noctuaEntry: "private-entry" }, "", "/?a=~qa-shared&m=~imap-1&q=private%20words#invite=code");
  const context = blankScreenContext("popstate");
  expect(context).toMatchObject({ search: "?a=%7Eqa-shared&m=%7Eimap-1&q=", historyStateKeys: ["__NA", "noctuaRootTrap", "noctuaEntry"],
    visibilityState: document.visibilityState, trigger: "popstate" });
  expect(typeof context.navigationType).toBe("string");
  expect(JSON.stringify(context)).not.toContain("private");
  expect(JSON.stringify(context)).not.toContain("invite");
});

test("an app root that stays empty 3 s after load, pageshow or Back is reported once per minute", () => {
  jest.useFakeTimers();
  stop = installBlankScreenWatchdog();
  jest.advanceTimersByTime(BLANK_SCREEN_DELAY_MS - 1);
  expect(reports).toHaveLength(0);
  jest.advanceTimersByTime(1);
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ source: "watchdog", kind: "blank-screen", message: "Blank screen", stack: "", path: "/",
    blank: { trigger: "load" } });
  // The same blank screen after Back: within the minute, nothing new is sent.
  window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  jest.advanceTimersByTime(BLANK_SCREEN_DELAY_MS);
  expect(reports).toHaveLength(1);
});

test("content that appears within 3 s is not reported, and a later empty restore is", () => {
  jest.useFakeTimers();
  stop = installBlankScreenWatchdog();
  jest.advanceTimersByTime(1000);
  document.querySelector("main")!.innerHTML = "<div>Posteingang</div>";
  jest.advanceTimersByTime(BLANK_SCREEN_DELAY_MS);
  expect(reports).toHaveLength(0);
  document.querySelector("main")!.innerHTML = "";
  const restore = new Event("pageshow") as PageTransitionEvent;
  Object.defineProperty(restore, "persisted", { value: true });
  window.dispatchEvent(restore);
  jest.advanceTimersByTime(BLANK_SCREEN_DELAY_MS);
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ kind: "blank-screen", blank: { trigger: "pageshow" } });
});
