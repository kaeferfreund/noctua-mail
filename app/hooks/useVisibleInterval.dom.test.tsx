import { afterEach, expect, it, jest } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useVisibleInterval } from "./useVisibleInterval";

const visibility = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
};
afterEach(() => { cleanup(); jest.useRealTimers(); visibility(false); });

it("skips background refreshes, resumes on visibility and removes its listeners on unmount", async () => {
  jest.useFakeTimers();
  let calls = 0;
  const refresh = async () => { calls++; };
  const { unmount } = renderHook(() => useVisibleInterval(refresh, 1000));
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(calls).toBe(1);
  visibility(true);
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(calls).toBe(1);
  visibility(false);
  await act(async () => {});
  expect(calls).toBe(2);
  unmount();
  visibility(true); visibility(false);
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(calls).toBe(2);
});

it("does not start a second refresh while a visible request is pending", async () => {
  jest.useFakeTimers();
  let calls = 0;
  let finish = () => {};
  const refresh = () => { calls++; return new Promise<void>(resolve => { finish = resolve; }); };
  renderHook(() => useVisibleInterval(refresh, 1000));
  await act(async () => { jest.advanceTimersByTime(1000); });
  visibility(true); visibility(false);
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(calls).toBe(1);
  await act(async () => { finish(); });
});
