import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import ScheduleSendDialog from "./ScheduleSendDialog";

afterEach(cleanup);
const TZ = "Europe/Berlin";
const utc = (month: number, day: number, hour: number, minute = 0) => Date.UTC(2026, month - 1, day, hour, minute);

function open(clock: { now: number }, onSchedule: (sendAt: number) => Promise<boolean>) {
  const closed: boolean[] = [];
  const page = render(<I18nTestProvider locale="de"><Theme>
    <ScheduleSendDialog open onOpenChange={next => closed.push(next)} onSchedule={onSchedule} now={() => clock.now} timeZone={TZ} />
  </Theme></I18nTestProvider>);
  return { page, closed };
}

const optionText = (page: ReturnType<typeof render>, kind: string) =>
  page.baseElement.querySelector(`[data-schedule-option="${kind}"]`)?.textContent;

describe("ScheduleSendDialog", () => {
  it("shows the presets with de-DE times and plans the chosen one", async () => {
    const clock = { now: utc(10, 24, 5, 59) }; // Sat 07:59 CEST
    const planned: number[] = [];
    const { page, closed } = open(clock, async sendAt => { planned.push(sendAt); return true; });
    expect(page.getByRole("dialog", { name: "Senden planen" })).toBeTruthy();
    expect(optionText(page, "thisMorning")).toBe("Heute früh24. Okt., 08:00");
    expect(optionText(page, "thisAfternoon")).toBe("Diesen Nachmittag24. Okt., 13:00");
    expect(optionText(page, "mondayMorning")).toBe("Montag morgen26. Okt., 08:00");
    expect(page.queryByRole("button", { name: "Speichern" })).toBeNull();
    fireEvent.click(page.getByRole("radio", { name: /^Diesen Nachmittag/ }));
    fireEvent.click(page.getByRole("button", { name: "Planen" }));
    await waitFor(() => expect(planned).toEqual([utc(10, 24, 11)]));
    await waitFor(() => expect(closed).toEqual([false]));
  });

  it("after 08:00 and 13:00 the presets move to tomorrow", () => {
    const { page } = open({ now: utc(10, 24, 11) }, async () => true);
    expect(optionText(page, "tomorrowMorning")).toBe("Morgen früh25. Okt., 08:00");
    expect(optionText(page, "tomorrowAfternoon")).toBe("Morgen Nachmittag25. Okt., 13:00");
  });

  it("custom time: quarter hours from the next one, past rejected inline, DST day resolves correctly", async () => {
    const clock = { now: utc(10, 24, 0, 37) }; // 02:37 CEST
    const planned: number[] = [];
    const { page } = open(clock, async sendAt => { planned.push(sendAt); return true; });
    const time = page.getByLabelText("Uhrzeit") as HTMLSelectElement;
    const date = page.getByLabelText("Datum") as HTMLInputElement;
    expect(date.value).toBe("2026-10-24");
    expect(time.value).toBe("02:45");
    expect([...time.options].slice(0, 2).map(option => option.value)).toEqual(["02:45", "03:00"]);

    fireEvent.change(date, { target: { value: "2026-10-23" } });
    expect((page.getByLabelText("Benutzerdefinierte Zeit") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(page.getByRole("button", { name: "Planen" }));
    expect(page.getByRole("alert").textContent).toBe("Dieser Zeitpunkt liegt in der Vergangenheit.");
    expect(time.getAttribute("aria-invalid")).toBe("true");
    expect(planned).toEqual([]);

    // The fall-back night offers 02:30 once; it is the first (CEST) instant.
    fireEvent.change(date, { target: { value: "2026-10-25" } });
    expect([...time.options].filter(option => option.value === "02:30")).toHaveLength(1);
    fireEvent.change(time, { target: { value: "02:30" } });
    expect(page.queryByRole("alert")).toBeNull();
    fireEvent.click(page.getByRole("button", { name: "Planen" }));
    await waitFor(() => expect(planned).toEqual([utc(10, 25, 0, 30)]));
  });

  it("a preset that passed while the dialog was open is rejected", () => {
    const clock = { now: utc(10, 24, 5, 59) };
    const planned: number[] = [];
    const { page } = open(clock, async sendAt => { planned.push(sendAt); return true; });
    clock.now = utc(10, 24, 6, 1);
    fireEvent.click(page.getByRole("button", { name: "Planen" }));
    expect(page.getByRole("alert").textContent).toBe("Dieser Zeitpunkt liegt in der Vergangenheit.");
    expect(planned).toEqual([]);
  });

  it("stays open when planning fails", async () => {
    const { page, closed } = open({ now: utc(10, 24, 5, 59) }, async () => false);
    fireEvent.click(page.getByRole("button", { name: "Planen" }));
    await waitFor(() => expect((page.getByRole("button", { name: "Planen" }) as HTMLButtonElement).disabled).toBe(false));
    expect(closed).toEqual([]);
    fireEvent.click(page.getByRole("button", { name: "Abbrechen" }));
    expect(closed).toEqual([false]);
  });
});
