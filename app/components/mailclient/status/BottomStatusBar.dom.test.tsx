import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { useEffect, useState, type ComponentProps } from "react";
import { Theme } from "@radix-ui/themes";
import { render, I18nTestProvider } from "@/lib/i18n/testRender";
import BottomStatusBar, { type BottomStatusPanel } from "./BottomStatusBar";
import { consumeCalendarOpenRequest } from "./statusIndicator";
import type { SyncJobProgress } from "../types";

const noop = () => {};
const originalWidth = window.innerWidth;
const dom = window as unknown as { happyDOM: { setURL: (url: string) => void } };
const originalUrl = window.location.href;
beforeEach(() => { window.innerWidth = 1280; dom.happyDOM.setURL("http://localhost/"); });
afterEach(() => { cleanup(); window.innerWidth = originalWidth; dom.happyDOM.setURL(originalUrl); });
const job: SyncJobProgress = {
  jobId: "private-job", accountId: "acc-private", folderId: "acc-private:INBOX", mailboxPath: "acc-private:INBOX",
  mode: "full", phase: "fetching", processed: 25, estimatedTotal: 100, percent: 25, updatedAt: 1,
  message: "raw acc-private:INBOX must not appear"
};
function props(): ComponentProps<typeof BottomStatusBar> {
  return {
    isSyncing: false, isRecomputingThreads: false, isRecomputingCategories: false,
    syncingFolders: new Set(), syncProgressItems: [], accountFolders: [{ id: "acc-private:INBOX", accountId: "acc-private", name: "Posteingang", count: 0 }],
    accounts: [{ id: "acc-private", name: "Familienbetrieb" }], onRetrySync: noop,
    mailCheckMode: "polling", mailCheckStatus: { running: false, lastCheckedAt: 1792627200000, nextCheckAt: 1792627500000 },
    activeAccountId: "", calendarSidebarOpen: false, pendingCalendarReminders: [], upcomingEvents: [],
    onRefreshPendingReminders: async () => {}, onOpenReminderMessage: noop, onReportError: noop,
    exceptionEntries: [], onClearExceptions: noop, openPanel: null, setOpenPanel: noop,
    formatRelativeTime: () => "just now", onOpenCalendarSidebar: noop, onToggleCalendarSidebar: noop
  };
}
function Harness({ initial = null, overrides = {}, pwa = false }: {
  initial?: BottomStatusPanel; overrides?: Partial<ComponentProps<typeof BottomStatusBar>>; pwa?: boolean
}) {
  const [openPanel, setOpenPanel] = useState<BottomStatusPanel>(initial);
  useEffect(() => {
    if (!pwa) return;
    const next = consumeCalendarOpenRequest(window.location.href);
    if (next !== null) {
      // Mirror the external PWA URL request consumed by MailClient on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenPanel("calendar"); window.history.replaceState({}, "", next);
    }
  }, [pwa]);
  return <I18nTestProvider locale="de"><Theme><BottomStatusBar {...props()} {...overrides} openPanel={openPanel} setOpenPanel={setOpenPanel} /></Theme></I18nTestProvider>;
}

describe("compact header status", () => {
  for (const [name, overrides, state, count] of [
    ["idle", {}, "idle", 0],
    ["busy", { isSyncing: true }, "syncing", 0],
    ["progress", { syncProgressItems: [job] }, "syncing", 0],
    ["retry two", { syncProgressItems: [{ ...job, phase: "retrying", retryAttempt: 2 }] }, "syncing", 0],
    ["retry three", { syncProgressItems: [{ ...job, phase: "retrying", retryAttempt: 3 }] }, "attention", 1],
    ["failed", { syncProgressItems: [{ ...job, phase: "failed" }] }, "attention", 1],
    ["exceptions win over busy", { isSyncing: true, exceptionEntries: [{ id: "e", message: "Synthetic error", timestamp: 1 }] }, "attention", 1],
    ["combined", { syncProgressItems: [{ ...job, phase: "failed" }], exceptionEntries: [{ id: "e", message: "Synthetic error", timestamp: 1 }] }, "attention", 2],
    ["completed", { syncProgressItems: [{ ...job, phase: "done" }] }, "idle", 0],
    ["recomputing", { isRecomputingThreads: true }, "syncing", 0]
  ] as const) it(`maps ${name} without opening a panel`, () => {
    const view = render(<Harness overrides={overrides as Partial<ComponentProps<typeof BottomStatusBar>>} />);
    const button = view.getByRole("button");
    expect(button.getAttribute("data-status-indicator")).toBe(state);
    expect(button.textContent).toBe(count ? String(count) : state === "syncing" ? "Synchronisiert …" : "");
    expect(view.queryByRole("dialog")).toBeNull();
    expect(view.container.querySelector(".bottom-bar, .bottom-center-time")).toBeNull();
  });
  it("opens all four explained section headings and routes between their contents", async () => {
    const view = render(<Harness />);
    const indicator = view.getByRole("button", { name: "Aktivität und Kalender" });
    fireEvent.click(indicator);
    const popover = await view.findByRole("dialog");
    for (const title of ["Hintergrundaufgaben", "Posteingangsprüfung", "Fehler", "Demnächst"]) expect(within(popover).getByRole("heading", { name: title })).toBeTruthy();
    expect(popover.querySelectorAll("[data-status-section] button[aria-expanded]").length).toBe(4);
    expect(within(popover).getByText("Keine laufenden Hintergrundaufgaben.")).toBeTruthy();
    fireEvent.click(within(popover).getByRole("button", { name: /^Posteingangsprüfung/ }));
    expect(within(popover).getByText(/^Letzte Prüfung:/).textContent).toContain("22.10.2026");
    expect(within(popover).getByText(/^Nächste Prüfung:/)).toBeTruthy();
    fireEvent.click(within(popover).getByRole("button", { name: /^Demnächst/ }));
    expect(within(popover).getByText("Keine anstehenden Termine oder Erinnerungen.")).toBeTruthy();
    fireEvent.keyDown(popover, { key: "Escape" });
    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(indicator));
  });
  for (const panel of ["process", "exception", "reminder", "mail-check", "calendar", "exceptions", "reminders"] as const) it(`routes external openPanel=${panel}`, async () => {
    const view = render(<Harness initial={panel} />);
    const popover = await view.findByRole("dialog");
    const section = panel === "calendar" || panel === "reminders" ? "reminder" : panel === "exceptions" ? "exception" : panel;
    expect(popover.querySelector(`[data-status-section="${section}"] button`)?.getAttribute("aria-expanded")).toBe("true");
    if (panel === "calendar") expect(within(popover).getByRole("button", { name: "Kalender-Seitenleiste einblenden" })).toBeTruthy();
  });
  it("opens the PWA calendar route and consumes only its flag", async () => {
    window.history.replaceState({}, "", "/?other=keep&openCalendar=1#anchor");
    const view = render(<Harness pwa />);
    expect(await view.findByRole("dialog")).toBeTruthy();
    expect(view.getByRole("button", { name: "Kalender-Seitenleiste einblenden" })).toBeTruthy();
    expect(window.location.search + window.location.hash).toBe("?other=keep#anchor");
    expect(consumeCalendarOpenRequest("http://localhost/?openCalendar=0")).toBeNull();
  });
  it("resolves private identifiers to names and invokes retry; Details are readable", async () => {
    let retried: SyncJobProgress | undefined;
    const failed = { ...job, phase: "retrying" as const, retryAttempt: 3, maxRetries: 10 };
    const view = render(<Harness initial="process" overrides={{ syncProgressItems: [failed], onRetrySync: value => { retried = value; } }} />);
    const popover = await view.findByRole("dialog");
    expect(within(popover).getByText("Familienbetrieb / Posteingang")).toBeTruthy();
    expect(popover.textContent).not.toContain("acc-private");
    expect(popover.textContent).not.toContain("private-job");
    fireEvent.click(within(popover).getByRole("button", { name: "Erneut versuchen" }));
    expect(retried).toEqual(failed);
    expect(within(popover).getByText("Details").tagName).toBe("SUMMARY");
    expect(within(popover).getByText("Wiederholungen: 3 von 10")).toBeTruthy();
  });
  it("uses a translated fallback for unresolved folders, never mailboxPath", async () => {
    const view = render(<Harness initial="process" overrides={{ accountFolders: [], accounts: [], syncProgressItems: [job] }} />);
    const popover = await view.findByRole("dialog");
    expect(within(popover).getByText("Postfach / Ordner")).toBeTruthy();
    expect(popover.textContent).not.toContain("acc-private");
  });
  it("clears exceptions and displays an absolute timestamp", async () => {
    let cleared = 0;
    const view = render(<Harness initial="exception" overrides={{ exceptionEntries: [{ id: "e", message: "Synthetic error", timestamp: 1792627200000 }], onClearExceptions: () => { cleared++; } }} />);
    const popover = await view.findByRole("dialog");
    expect(within(popover).getAllByText(/22.10.2026/).length).toBeGreaterThan(0);
    fireEvent.click(within(popover).getByRole("button", { name: "Alle Fehler löschen" }));
    expect(cleared).toBe(1);
  });
  it("toggles the calendar sidebar through the shared action and closes", async () => {
    let toggles = 0;
    const view = render(<Harness initial="reminder" overrides={{ calendarSidebarOpen: true, onToggleCalendarSidebar: () => { toggles++; } }} />);
    fireEvent.click(await view.findByRole("button", { name: "Kalender-Seitenleiste ausblenden" }));
    expect(toggles).toBe(1);
    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
  });
  it("keeps the mobile dropdown → Sheet route and restores focus", async () => {
    window.innerWidth = 390;
    const view = render(<Harness />);
    const indicator = view.getByRole("button", { name: "Aktivität und Kalender" });
    fireEvent.keyDown(indicator, { key: "Enter" });
    fireEvent.click(await view.findByRole("menuitem", { name: "Hintergrundaufgaben" }));
    const sheet = await view.findByRole("dialog", { name: "Hintergrundaufgaben" });
    expect(sheet.getAttribute("data-slot")).toBe("sheet-content");
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(indicator));
  });
  it("keeps a selected section when crossing the mobile breakpoint", async () => {
    const view = render(<Harness initial="exception" />);
    await act(async () => { window.innerWidth = 390; window.dispatchEvent(new Event("resize")); });
    const sheet = await view.findByRole("dialog", { name: "Fehler" });
    expect(sheet.getAttribute("data-slot")).toBe("sheet-content");
  });
});
