import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { createRef } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { CalendarRef } from "@fullcalendar/react";
import type { CalendarEvent } from "@/lib/data";
import CalendarView from "./CalendarView";

afterEach(() => {
  cleanup();
  mock.restore();
  localStorage.removeItem("noctua:calendarView");
  sessionStorage.removeItem("noctua:calendarDate");
});

for (const compact of [false, true]) {
  test(`calendar preserves event metadata and dialog creation after the v7 migration (compact=${compact})`, async () => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const event: CalendarEvent = {
      id: "synthetic-event",
      accountId: "synthetic-account",
      eventUid: "synthetic-event@example.test",
      summary: "Synthetic calendar event",
      startAtMs: start.getTime(),
      endAtMs: start.getTime() + 3600000,
      createdAtMs: start.getTime(),
      updatedAtMs: start.getTime(),
      allDay: false,
      sourceType: "local",
      myPartstat: "DECLINED"
    };
    spyOn(globalThis, "fetch").mockImplementation(Object.assign(
      async (input: RequestInfo | URL) => Response.json({
        items: String(input).includes("/calendar/events") ? [event] : []
      }),
      { preconnect: globalThis.fetch.preconnect }
    ));
    const errors = spyOn(console, "error").mockImplementation(() => {});
    const onCreateEvent = mock(() => {});
    const onEventClick = mock(() => {});
    const calendarRef = createRef<CalendarRef>();
    const view = render(<CalendarView accountId={event.accountId} compact={compact}
      calendarRef={calendarRef} onCreateEvent={onCreateEvent} onEventClick={onEventClick} />);
    await waitFor(() => expect(view.container.querySelectorAll(".fc-event").length).toBe(1));
    const element = view.container.querySelector<HTMLElement>(".fc-event")!;
    expect(element.classList.contains("fc-event-local")).toBe(true);
    expect(element.classList.contains("fc-event-partstat-declined")).toBe(true);
    expect(element.title).toContain(event.summary);
    expect(element.querySelector(".fc-event-title")?.textContent).toContain(event.summary);
    fireEvent.click(element);
    expect(onEventClick).toHaveBeenCalledWith(event, "event", event.startAtMs);
    if (!compact) {
      // v7 invokes a same-named CalendarApi method after custom button handlers
      // unless the handler cancels it. Opening our dialog must not add an event.
      fireEvent.click(view.getByRole("button", { name: "New event" }));
      expect(onCreateEvent).toHaveBeenCalledTimes(1);
      expect(calendarRef.current?.getApi().getEvents()).toHaveLength(1);
    }
    expect(errors).not.toHaveBeenCalled();
  });
}
