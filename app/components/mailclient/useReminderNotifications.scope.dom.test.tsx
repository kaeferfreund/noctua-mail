import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Account } from "@/lib/data";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { useReminderNotifications } from "./useReminderNotifications";
import { clearCalendarReminderStorage, setCalendarReminderStoragePrincipal } from "./utils/calendarReminders";

// Upcoming events and reminders in the status bar belong to the mailbox (and
// user) they were loaded for; late results of a previous scope are dropped.

type Held = { url: string; release: () => void };
let held: Held[] = [];
let holdFor: string | null = null;
const originalFetch = globalThis.fetch;

function eventFor(accountId: string) {
  const start = Date.now() + 3_600_000;
  return { id: `event-${accountId}`, accountId, uid: `uid-${accountId}`, summary: `Private ${accountId}`, startAtMs: start, endAtMs: start + 1_800_000 };
}

function reminderFor(accountId: string, userId: string) {
  const now = Date.now();
  return {
    id: `reminder-${accountId}-${userId}`, accountId, userId, eventTitle: `Private ${accountId} ${userId}`,
    eventStartAtMs: now + 3_600_000, nextEventStartAtMs: now + 3_600_000, leadMinutes: 15, leadLabel: "15 minutes",
    triggerAtMs: now + 2_700_000, createdAtMs: now, updatedAtMs: now
  };
}

let serverUser = "user-a";
async function respond(url: string) {
  const accountId = decodeURIComponent(url.split("/api/accounts/")[1]?.split("/")[0] ?? "");
  if (holdFor && accountId === holdFor) await new Promise<void>((release) => held.push({ url, release }));
  if (url.includes("/reminders")) return Response.json({ ok: true, items: [reminderFor(accountId, serverUser)] });
  if (url.includes("/calendar/events")) return Response.json({ items: [eventFor(accountId)] });
  return Response.json({});
}

beforeAll(() => {
  globalThis.fetch = (async (input: RequestInfo | URL) => respond(String(input))) as unknown as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });
afterEach(() => {
  cleanup();
  held.forEach((entry) => entry.release());
  held = []; holdFor = null; serverUser = "user-a";
  clearCalendarReminderStorage();
});

const accounts = [{ id: "acc-a" }, { id: "acc-b" }] as Account[];
const apiFetch = (input: RequestInfo | URL) => respond(String(input));

function mount(initialAccountId: string) {
  return renderHook(({ activeAccountId }: { activeAccountId: string }) => useReminderNotifications({
    activeAccountId, accounts, clientId: "client-1", buildVersionLabel: "", apiFetch
  }), { initialProps: { activeAccountId: initialAccountId }, wrapper: ({ children }) => <I18nTestProvider locale="en">{children}</I18nTestProvider> });
}

const titles = (items: Array<{ summary?: string; eventTitle?: string }>) => items.map((item) => item.summary ?? item.eventTitle);

describe("status bar calendar data per mailbox", () => {
  it("drops a late result of the previous mailbox after a switch", async () => {
    setCalendarReminderStoragePrincipal("user-a");
    holdFor = "acc-a";
    const { result, rerender } = mount("acc-a");
    await waitFor(() => expect(held.length).toBeGreaterThanOrEqual(2));
    holdFor = null;
    rerender({ activeAccountId: "acc-b" });
    await waitFor(() => expect(titles(result.current.upcomingCalendarEvents)).toEqual(["Private acc-b"]));
    await waitFor(() => expect(titles(result.current.pendingCalendarReminders)).toEqual(["Private acc-b user-a"]));
    await act(async () => { held.forEach((entry) => entry.release()); held = []; await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(titles(result.current.upcomingCalendarEvents)).toEqual(["Private acc-b"]);
    expect(titles(result.current.pendingCalendarReminders)).toEqual(["Private acc-b user-a"]);
  });

  it("never shows the previous mailbox's data while the new one loads", async () => {
    setCalendarReminderStoragePrincipal("user-a");
    const { result, rerender } = mount("acc-a");
    await waitFor(() => expect(titles(result.current.upcomingCalendarEvents)).toEqual(["Private acc-a"]));
    holdFor = "acc-b";
    rerender({ activeAccountId: "acc-b" });
    expect(result.current.upcomingCalendarEvents).toEqual([]);
    expect(result.current.pendingCalendarReminders).toEqual([]);
  });

  it("clears and reloads the same shared mailbox when another user signs in", async () => {
    setCalendarReminderStoragePrincipal("user-a");
    const { result } = mount("acc-a");
    await waitFor(() => expect(titles(result.current.pendingCalendarReminders)).toEqual(["Private acc-a user-a"]));
    serverUser = "user-b";
    holdFor = "acc-a";
    act(() => { setCalendarReminderStoragePrincipal("user-b"); });
    expect(result.current.pendingCalendarReminders).toEqual([]);
    expect(result.current.upcomingCalendarEvents).toEqual([]);
    holdFor = null;
    await act(async () => { held.forEach((entry) => entry.release()); held = []; });
    await waitFor(() => expect(titles(result.current.pendingCalendarReminders)).toEqual(["Private acc-a user-b"]));
  });
});
