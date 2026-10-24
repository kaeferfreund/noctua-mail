import { afterEach, expect, test } from "bun:test";
import { cleanup } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import CalendarEventScheduleFields from "./CalendarEventScheduleFields";

afterEach(cleanup);

const noop = () => {};
const fields = (locale: "de" | "en") => render(
  <I18nTestProvider locale={locale}>
    <Theme>
      <CalendarEventScheduleFields
        startValue="2026-03-17T09:00" endValue="2026-03-17T10:00" allDay={false} recurrenceRule="FREQ=MONTHLY;BYDAY=3TU" location=""
        onStartValueChange={noop} onEndValueChange={noop} onAllDayChange={noop} onRecurrenceRuleChange={noop} onLocationChange={noop}
      />
    </Theme>
  </I18nTestProvider>
);

test("the invite schedule fields are German in the German UI (compose invite form)", () => {
  const page = fields("de");
  for (const label of ["Beginn", "Ende", "Ganztägig", "Wiederholung", "Ort"]) expect(page.getByText(label, { exact: true })).toBeTruthy();
  expect(page.getByLabelText("Uhrzeit Beginn")).toBeTruthy();
  expect(page.getByLabelText("Uhrzeit Ende")).toBeTruthy();
  expect(page.getByPlaceholderText("Ort (optional)")).toBeTruthy();
  expect(page.getAllByRole("button", { name: "Zeitauswahl öffnen" })).toHaveLength(2);
  expect(page.getByRole("combobox").textContent).toBe("Monatlich am dritten Dienstag");
  expect(page.container.textContent).not.toMatch(/All day|Repeat|Location|Does not repeat|Monthly/);
});

test("the English catalog keeps the English labels", () => {
  const page = fields("en");
  for (const label of ["Start", "End", "All day", "Repeat", "Location"]) expect(page.getByText(label, { exact: true })).toBeTruthy();
  expect(page.getAllByRole("button", { name: "Open time picker" })).toHaveLength(2);
  expect(page.getByRole("combobox").textContent).toBe("Monthly on the third Tuesday");
});
