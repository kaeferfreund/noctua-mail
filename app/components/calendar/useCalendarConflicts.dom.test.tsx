import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useCalendarConflicts, type CalendarEventConflictItem } from "./useCalendarConflicts";
import { CALENDAR_EVENTS_UPDATED_EVENT, CALENDAR_SYNC_COMPLETED_EVENT } from "./calendarEventsClient";

afterEach(() => { cleanup(); mock.restore(); });
const conflict = (id: string): CalendarEventConflictItem => ({ eventId: id, eventUid: `${id}@example.test`, summary: "Synthetic conflict", timeZone: null, allDay: false, localChangedAtMs: null, remoteChangedAtMs: null, localDiff: null, remoteDiff: null });
function requests() {
  const pending: { url: string; resolve: (response: Response) => void; reject: (error: Error) => void }[] = [];
  spyOn(globalThis, "fetch").mockImplementation(url => new Promise<Response>((resolve, reject) => { pending.push({ url: String(url), resolve, reject }); }));
  const respond = async (index: number, id: string) => { await act(async () => { pending[index].resolve(Response.json({ ok: true, conflicts: [conflict(id)] })); }); };
  return { pending, respond };
}

test("conflicts load and refresh on both mutation and sync signals; latest request wins", async () => {
  const { pending, respond } = requests();
  const hook = renderHook(() => useCalendarConflicts("synthetic-a"));
  expect(hook.result.current.conflicts).toEqual([]);
  expect(pending[0].url).toBe("/api/accounts/synthetic-a/calendar/conflicts");
  await respond(0, "initial");
  expect(hook.result.current.conflicts).toEqual([conflict("initial")]);
  act(() => { window.dispatchEvent(new Event(CALENDAR_EVENTS_UPDATED_EVENT)); window.dispatchEvent(new Event(CALENDAR_SYNC_COMPLETED_EVENT)); });
  expect(pending).toHaveLength(3);
  await respond(2, "latest");
  await respond(1, "stale");
  expect(hook.result.current.conflicts).toEqual([conflict("latest")]);
  hook.unmount();
  window.dispatchEvent(new Event(CALENDAR_EVENTS_UPDATED_EVENT));
  window.dispatchEvent(new Event(CALENDAR_SYNC_COMPLETED_EVENT));
  expect(pending).toHaveLength(3);
});

test("account switches hide old conflicts, reject late responses, and do not resurrect old snapshots", async () => {
  const { pending, respond } = requests();
  const hook = renderHook(({ accountId }) => useCalendarConflicts(accountId), { initialProps: { accountId: "synthetic-a" } });
  await respond(0, "a");
  act(() => { window.dispatchEvent(new Event(CALENDAR_SYNC_COMPLETED_EVENT)); });
  hook.rerender({ accountId: "synthetic-b" });
  expect(hook.result.current.conflicts).toEqual([]);
  await respond(1, "late-a");
  expect(hook.result.current.conflicts).toEqual([]);
  hook.rerender({ accountId: "synthetic-a" });
  expect(hook.result.current.conflicts).toEqual([]);
  await respond(2, "late-b");
  expect(hook.result.current.conflicts).toEqual([]);
  await respond(3, "new-a");
  expect(hook.result.current.conflicts).toEqual([conflict("new-a")]);
  hook.rerender({ accountId: "" });
  expect(hook.result.current.conflicts).toEqual([]);
  expect(pending).toHaveLength(4);
});

test("failed refreshes retain the current snapshot and unmount invalidates pending work", async () => {
  const { pending, respond } = requests();
  const hook = renderHook(() => useCalendarConflicts("synthetic-a"));
  await respond(0, "existing");
  act(() => { void hook.result.current.refresh(); });
  await act(async () => { pending[1].resolve(new Response("", { status: 503 })); });
  expect(hook.result.current.conflicts).toEqual([conflict("existing")]);
  act(() => { void hook.result.current.refresh(); });
  await act(async () => { pending[2].reject(new Error("Synthetic offline")); });
  expect(hook.result.current.conflicts).toEqual([conflict("existing")]);
  act(() => { void hook.result.current.refresh(); });
  hook.unmount();
  await respond(3, "after-unmount");
  expect(hook.result.current.conflicts).toEqual([conflict("existing")]);
});
