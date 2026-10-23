import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { useEventReminderState, type UseEventReminderStateInput } from "./useEventReminderState";

const start = Date.UTC(2030, 0, 1, 12);
const input: UseEventReminderStateInput = { accountId: "", title: "Synthetic event", canonicalStartMs: start, onNotice() {} };
afterEach(() => { cleanup(); mock.restore(); window.localStorage.clear(); });

function clock(initial: number) {
  let now = initial;
  let id = 0;
  const timeouts = new Map<number, () => void>();
  const intervals = new Map<number, () => void>();
  spyOn(Date, "now").mockImplementation(() => now);
  spyOn(window, "setTimeout").mockImplementation(((callback: () => void) => { timeouts.set(++id, callback); return id; }) as typeof window.setTimeout);
  spyOn(window, "setInterval").mockImplementation(((callback: () => void) => { intervals.set(++id, callback); return id; }) as typeof window.setInterval);
  spyOn(window, "clearTimeout").mockImplementation(((key: number) => { timeouts.delete(key); }) as typeof window.clearTimeout);
  spyOn(window, "clearInterval").mockImplementation(((key: number) => { intervals.delete(key); }) as typeof window.clearInterval);
  return {
    set(value: number) { now = value; },
    tick(value: number) { now = value; act(() => { for (const [key, callback] of timeouts) { timeouts.delete(key); callback(); } for (const callback of intervals.values()) callback(); }); },
    pending: () => [timeouts.size, intervals.size]
  };
}

// perf/rrule-lazy: the recurrence resolver is dynamic-imported so `rrule`
// stays out of the first load. Flush that import (as the browser does once
// the chunk arrives) before asserting on recurring events.
async function flushRecurrenceImport() {
  await act(async () => {
    await import("@/lib/reminderRecurrence");
    await Promise.resolve();
  });
}

test("reminder eligibility advances across event start without a parent render", () => {
  const time = clock(start - 1000);
  const hook = renderHook(() => useEventReminderState(input));
  expect(hook.result.current.canScheduleReminder).toBe(false);
  time.tick(start - 1000);
  expect(hook.result.current.canScheduleReminder).toBe(true);
  time.tick(start);
  expect(hook.result.current.canScheduleReminder).toBe(false);
  time.tick(start + 1000);
  expect(hook.result.current.canScheduleReminder).toBe(false);
  hook.unmount();
  expect(time.pending()).toEqual([0, 0]);
});

test("recurring reminders retain the next occurrence and disable after the last one", async () => {
  const day = 86400000;
  const time = clock(start - 1000);
  const hook = renderHook(() => useEventReminderState({ ...input, recurrenceRule: "FREQ=DAILY;COUNT=2" }));
  time.tick(start - 1000);
  // Until the resolver has loaded, a recurring event reports "cannot
  // schedule yet" instead of guessing from the series start.
  expect(hook.result.current.canScheduleReminder).toBe(false);
  await flushRecurrenceImport();
  expect(hook.result.current.canScheduleReminder).toBe(true);
  time.tick(start + 1000);
  expect(hook.result.current.canScheduleReminder).toBe(true);
  time.tick(start + day - 1000);
  expect(hook.result.current.canScheduleReminder).toBe(true);
  time.tick(start + day + 1000);
  expect(hook.result.current.canScheduleReminder).toBe(false);
});

test("SSR and initial hydration agree across the clock boundary; StrictMode cleans up timers", async () => {
  const time = clock(start - 1000);
  const rendered: boolean[] = [];
  function Button() {
    const { canScheduleReminder } = useEventReminderState(input);
    rendered.push(canScheduleReminder);
    return <button disabled={!canScheduleReminder}>Schedule</button>;
  }
  const html = renderToString(<StrictMode><Button /></StrictMode>);
  expect(html).toContain('disabled=""');
  time.set(start + 1000);
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const errors: unknown[] = [];
  let root!: ReturnType<typeof hydrateRoot>;
  await act(async () => { root = hydrateRoot(container, <StrictMode><Button /></StrictMode>, { onRecoverableError: error => { errors.push(error); } }); });
  expect(rendered.every(value => !value)).toBe(true);
  expect(errors).toEqual([]);
  expect(time.pending()).toEqual([1, 1]);
  time.tick(start + 1000);
  expect(container.querySelector("button")!.disabled).toBe(true);
  act(() => root.unmount());
  expect(time.pending()).toEqual([0, 0]);
  container.remove();
});

test("scheduling resolves the occurrence from the click time between clock ticks", async () => {
  const time = clock(start - 1000);
  let scheduled: { nextEventStartAtMs: number; triggerAtMs: number }[] = [];
  spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      const key = Object.keys(window.localStorage).find(key => key.startsWith("noctua:calendar-reminder-cache"))!;
      scheduled = JSON.parse(window.localStorage.getItem(key)!);
    }
    return Response.json({ items: [] });
  }, { preconnect: globalThis.fetch.preconnect }));
  const notices: string[] = [];
  function Button() {
    const reminder = useEventReminderState({ ...input, accountId: "synthetic-reminder-clock", recurrenceRule: "FREQ=DAILY;COUNT=2", onNotice: notice => { notices.push(notice); } });
    return <button disabled={!reminder.canScheduleReminder} onClick={() => void reminder.handleScheduleReminder()}>Schedule</button>;
  }
  const page = render(<Button />);
  time.tick(start - 1000);
  await flushRecurrenceImport();
  expect((page.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  // No UI tick: persistence must use the actual time of the action.
  time.set(start + 1000);
  await act(async () => { page.getByRole("button").click(); });
  expect(scheduled).toHaveLength(1);
  expect(scheduled[0].nextEventStartAtMs).toBe(start + 86400000);
  expect(scheduled[0].triggerAtMs).toBe(start + 86400000 - 15 * 60000);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toContain("Reminder scheduled");
  const posts = (globalThis.fetch as unknown as { mock: { calls: [unknown, RequestInit?][] } }).mock.calls.filter(([, init]) => init?.method === "POST");
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0][1]!.body as string).eventStartAtMs).toBe(start);
});
