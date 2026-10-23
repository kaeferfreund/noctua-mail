import { afterEach, expect, spyOn, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { useTranslations } from "next-intl";
import { readFileSync } from "node:fs";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import ComposeActions from "./ComposeActions";

let now = 1_800_000_000_000;
let parentRenders = 0;
const timers = new Map<number, () => void>();
let nextTimer = 0;
let intervalSpy: ReturnType<typeof spyOn<typeof globalThis, "setInterval">>;
let clearSpy: ReturnType<typeof spyOn<typeof globalThis, "clearInterval">>;
let nowSpy: ReturnType<typeof spyOn<typeof Date, "now">>;

afterEach(() => {
  cleanup();
  intervalSpy.mockRestore();
  clearSpy.mockRestore();
  nowSpy.mockRestore();
  timers.clear();
});

function Composer({ savedAt, saving = false, error = null }: {
  savedAt: number | null; saving?: boolean; error?: string | null;
}) {
  parentRenders++;
  const t = useTranslations("Notifications");
  const format = (timestamp: number | null) => {
    const seconds = Math.max(1, Math.floor((Date.now() - (timestamp ?? Date.now())) / 1000));
    return seconds < 60 ? t("relativeSeconds", { count: seconds }) : t("relativeMinutes", { count: Math.floor(seconds / 60) });
  };
  return <Theme><ComposeActions composeDraftId="synthetic-draft" composeOpen canSaveDraft
    draftSaving={saving} draftSaveError={error} draftSavedAt={savedAt}
    sendingMail={false} discardingDraft={false} handleDiscardDraft={() => {}}
    handleSaveDraft={() => {}} handleCancel={() => {}} handleSendMail={() => {}}
    formatRelativeTime={format} /></Theme>;
}

function installClock() {
  intervalSpy = spyOn(globalThis, "setInterval");
  clearSpy = spyOn(globalThis, "clearInterval");
  nowSpy = spyOn(Date, "now");
  now = 1_800_000_000_000;
  nowSpy.mockImplementation(() => now);
  intervalSpy.mockImplementation(((callback: () => void, delay: number) => {
    expect(delay).toBe(1000);
    const id = ++nextTimer;
    timers.set(id, callback);
    return id;
  }) as typeof setInterval);
  clearSpy.mockImplementation((id) => { timers.delete(Number(id)); });
}

test("65 seconds update only the saved label; MailClient is disconnected from draft ticks", () => {
  installClock();
  parentRenders = 0;
  const savedAt = now;
  const view = render(<Composer savedAt={savedAt} />);
  expect(view.getByText("Draft saved 1s ago")).toBeTruthy();
  expect(timers.size).toBe(1);
  const initialRenders = parentRenders;
  for (let second = 1; second <= 65; second++) {
    act(() => { now = savedAt + second * 1000; for (const tick of timers.values()) tick(); });
    if (second === 59) expect(view.getByText("Draft saved 59s ago")).toBeTruthy();
  }
  expect(view.getByText("Draft saved 1m ago")).toBeTruthy();
  expect(parentRenders - initialRenders).toBe(0);
  view.unmount();
  expect(timers.size).toBe(0);
  // Pin the production wiring too: only the mounted label owns the draft clock.
  const root = readFileSync(new URL("../../MailClient.tsx", import.meta.url), "utf8");
  expect(root).not.toContain("setRelativeTimeCounter");
  expect(root).not.toContain("onDraftSavedAtChange");
});

test("locale, new saves, saving/error states and an empty draft stay current and clean up the timer", () => {
  installClock();
  const savedAt = now;
  const ui = (locale: "de" | "en", stamp: number | null, saving = false, error: string | null = null) =>
    <I18nTestProvider locale={locale}><Composer savedAt={stamp} saving={saving} error={error} /></I18nTestProvider>;
  const view = render(ui("en", savedAt));
  act(() => { now += 5000; for (const tick of timers.values()) tick(); });
  expect(view.getByText("Draft saved 5s ago")).toBeTruthy();
  view.rerender(ui("de", savedAt));
  expect(view.getByText("Entwurf vor 5 Sekunden gespeichert")).toBeTruthy();
  view.rerender(ui("de", now));
  expect(view.getByText("Entwurf vor 1 Sekunde gespeichert")).toBeTruthy();
  expect(timers.size).toBe(1);
  view.rerender(ui("de", now, true));
  expect(view.getByText("Entwurf wird gespeichert …")).toBeTruthy();
  expect(timers.size).toBe(0);
  view.rerender(ui("en", savedAt, false, "synthetic failure"));
  expect(view.getByText("Draft save failed")).toBeTruthy();
  expect(timers.size).toBe(0);
  view.rerender(ui("en", null));
  expect(view.getByText("Draft not saved yet")).toBeTruthy();
  expect(timers.size).toBe(0);
});
