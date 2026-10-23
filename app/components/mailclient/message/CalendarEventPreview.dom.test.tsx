import { afterEach, expect, test } from "bun:test";
import { cleanup, waitFor } from "@testing-library/react";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import type { Attachment } from "@/lib/data";
import { parseIcsEvents } from "@/lib/calendar";
import { buildCalendarRecurrenceSummary } from "@/lib/calendarRecurrenceSummary";
import { resolveNextReminderOccurrence } from "@/lib/reminderRecurrence";
import CalendarEventPreview from "./CalendarEventPreview";

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

// The series starts long before "now", so the preview must jump to the
// next occurrence instead of rendering the series start. Recurrence
// evaluation is dynamic-imported (rrule stays out of first load); while
// it is in flight the preview must stay on its neutral loading state,
// and once loaded it must render byte-identical output to the eager
// computation below.
const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "METHOD:REQUEST",
  "BEGIN:VEVENT",
  "UID:recurring-1@example.test",
  "SUMMARY:Weekly sync",
  "DTSTART:20260107T100000Z",
  "DTEND:20260107T110000Z",
  "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE;UNTIL=20300102T100000Z",
  "ORGANIZER:mailto:organizer@example.test",
  "END:VEVENT",
  "END:VCALENDAR"
].join("\r\n");

test("recurring invite preview: neutral loading, then eager-identical summary", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({}), { status: 404 })) as unknown as typeof fetch;

  const parsed = parseIcsEvents(ICS)[0];
  expect(parsed).toBeTruthy();
  const nowMs = Date.now();
  // Eager reference computation, mirroring the component's inputs.
  const next = resolveNextReminderOccurrence(
    {
      eventStartAtMs: parsed.start!.getTime(),
      eventEndAtMs: parsed.end?.getTime(),
      leadMinutes: 0,
      recurrenceRule: parsed.recurrenceRule,
      recurrenceDates: undefined,
      excludedDates: undefined
    },
    nowMs
  );
  expect(next).toBeTruthy();
  expect(next!.eventStartAtMs).not.toBe(parsed.start!.getTime());
  const summaryEvent = {
    allDay: parsed.allDay,
    start: new Date(next!.eventStartAtMs),
    startTimezone: parsed.startTimezone,
    recurrenceRule: parsed.recurrenceRule,
    recurrenceDates: [] as Date[],
    excludedDates: [] as Date[]
  };
  const expectedSummary = buildCalendarRecurrenceSummary(summaryEvent, undefined);
  const seriesStartSummary = buildCalendarRecurrenceSummary(
    { ...summaryEvent, start: parsed.start },
    undefined
  );
  expect(expectedSummary).toBeTruthy();
  expect(seriesStartSummary).not.toBe(expectedSummary);

  const attachment: Attachment = {
    id: "att-1",
    filename: "invite.ics",
    contentType: "text/calendar",
    size: ICS.length,
    inline: false,
    dataUrl: `data:text/calendar;base64,${Buffer.from(ICS).toString("base64")}`
  };

  const view = render(
    <I18nTestProvider locale="en">
      <CalendarEventPreview
        attachments={[attachment]}
        accountId=""
        readErrorMessage={async () => ""}
        reportError={() => {}}
      />
    </I18nTestProvider>
  );

  // Neutral loading state: no event content yet, and in particular no
  // summary computed from the raw series start.
  expect(view.getByText("Loading event preview…")).toBeTruthy();
  expect(view.queryByText("Weekly sync")).toBeNull();
  expect(view.queryByText(seriesStartSummary!)).toBeNull();
  expect(view.queryByText(expectedSummary!)).toBeNull();

  // Lazy path converges to exactly the eager reference output.
  await waitFor(() => expect(view.getByText(expectedSummary!)).toBeTruthy());
  expect(view.getByText("Weekly sync")).toBeTruthy();
  expect(view.queryByText(seriesStartSummary!)).toBeNull();
  expect(view.queryByText("Loading event preview…")).toBeNull();
});
