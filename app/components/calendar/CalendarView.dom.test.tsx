import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { createRef } from "react";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render, I18nTestProvider } from "@/lib/i18n/testRender";
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

// FullCalendar ships English texts and hint templates; the toolbar takes both
// from the catalog, with hints inflected per view unit.
test("calendar toolbar reads its labels and hints from the active catalog", async () => {
  spyOn(globalThis, "fetch").mockImplementation(Object.assign(
    async () => Response.json({ items: [] }),
    { preconnect: globalThis.fetch.preconnect }
  ));
  const expected = {
    de: { add: ["＋ Termin", "Neuer Termin"], today: "Heute", views: ["Monat", "Woche", "Tag"],
      hints: { dayGridMonth: ["Dieser Monat", "Vorheriger Monat", "Nächster Monat"],
        timeGridWeek: ["Diese Woche", "Vorherige Woche", "Nächste Woche"],
        timeGridDay: ["Heute", "Vorheriger Tag", "Nächster Tag"] },
      viewHints: ["Monatsansicht", "Wochenansicht", "Tagesansicht"], change: "Ansicht wechseln" },
    en: { add: ["＋ Event", "New event"], today: "Today", views: ["Month", "Week", "Day"],
      hints: { dayGridMonth: ["This month", "Previous month", "Next month"],
        timeGridWeek: ["This week", "Previous week", "Next week"],
        timeGridDay: ["Today", "Previous day", "Next day"] },
      viewHints: ["Month view", "Week view", "Day view"], change: "Change view" }
  } as const;
  for (const locale of ["de", "en"] as const) {
    for (const viewType of ["dayGridMonth", "timeGridWeek", "timeGridDay"] as const) {
      const copy = expected[locale];
      localStorage.setItem("noctua:calendarView", viewType);
      const view = render(<CalendarView accountId="synthetic-account" onCreateEvent={() => {}} />,
        { wrapper: ({ children }) => <I18nTestProvider locale={locale}>{children}</I18nTestProvider> });
      const toolbar = await waitFor(() => {
        const element = view.container.querySelector<HTMLElement>(".fc-header-toolbar");
        if (!element) throw new Error("toolbar not rendered");
        return element;
      });
      const label = (selector: string) => toolbar.querySelector(selector)?.getAttribute("aria-label");
      expect(toolbar.querySelector(".fc-addEvent-button")?.textContent).toBe(copy.add[0]);
      expect(label(".fc-addEvent-button")).toBe(copy.add[1]);
      expect(toolbar.querySelector(".fc-today-button")?.textContent).toBe(copy.today);
      const [todayHint, prevHint, nextHint] = copy.hints[viewType];
      expect([label(".fc-today-button"), label(".fc-prev-button"), label(".fc-next-button")])
        .toEqual([todayHint, prevHint, nextHint]);
      const tabs = within(toolbar).getAllByRole("tab");
      expect(tabs.map(tab => tab.textContent)).toEqual([...copy.views]);
      expect(tabs.map(tab => tab.getAttribute("aria-label"))).toEqual([...copy.viewHints]);
      expect(within(toolbar).getByRole("tablist").getAttribute("aria-label")).toBe(copy.change);
      view.unmount();
    }
  }
});
