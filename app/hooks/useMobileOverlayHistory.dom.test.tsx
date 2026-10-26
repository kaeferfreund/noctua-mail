import { afterEach, expect, jest, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterMobileOverlayNavigation, MOBILE_OVERLAY_BACK_TIMEOUT_MS, useMobileOverlayHistory } from "./useMobileOverlayHistory";

afterEach(() => {
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
  back.mockRestore();
  view.unmount();
});
