import { beforeEach, afterEach, expect, jest, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterMobileOverlayNavigation, MOBILE_OVERLAY_BACK_TIMEOUT_MS, useMobileOverlayHistory } from "./useMobileOverlayHistory";

import { resetClientErrorReporterForTests } from "@/lib/ui/clientErrorReporter";
const originalFetch = globalThis.fetch;
const reports: Record<string, unknown>[] = [];
beforeEach(() => {
  resetClientErrorReporterForTests(); reports.length = 0;
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => { reports.push(JSON.parse(String(init?.body))); return new Response(null, { status: 204 }); }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  resetClientErrorReporterForTests();
  cleanup();
  jest.useRealTimers();
});

test("navigation resumes when the browser never reports the Back of a closed Sheet", () => {
  jest.useFakeTimers();
  // An iOS home-screen app has been seen to swallow the popstate for history.back().
  const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
  const view = renderHook(({ open }: { open: boolean }) => useMobileOverlayHistory(open, () => {}), { initialProps: { open: true } });
  expect(window.history.state?.noctuaMobileOverlay).toBeGreaterThan(0);

  view.rerender({ open: false });
  expect(back).toHaveBeenCalledTimes(1);
  const ran: string[] = [];
  afterMobileOverlayNavigation(() => ran.push("select-mailbox"));
  expect(ran).toEqual([]); // waits for the Back

  act(() => { jest.advanceTimersByTime(MOBILE_OVERLAY_BACK_TIMEOUT_MS + 1); });
  expect(ran).toEqual(["select-mailbox"]);
  // Afterwards callbacks run right away again.
  afterMobileOverlayNavigation(() => ran.push("next"));
  expect(ran).toEqual(["select-mailbox", "next"]);
  // Aggregate until leaving the page; send once even if visibility/pagehide repeat.
  expect(reports).toHaveLength(0);
  const second = renderHook(({ open }) => useMobileOverlayHistory(open, () => {}), { initialProps: { open: true } });
  second.rerender({ open: false });
  act(() => { jest.advanceTimersByTime(MOBILE_OVERLAY_BACK_TIMEOUT_MS + 1); });
  window.dispatchEvent(new Event("pagehide"));
  window.dispatchEvent(new Event("pagehide"));
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ kind: "overlay-back-fallback", count: 2, stack: "" });
  second.unmount();
  back.mockRestore();
  view.unmount();
});
