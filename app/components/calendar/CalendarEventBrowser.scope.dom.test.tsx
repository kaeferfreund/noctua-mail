import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { CalendarEvent } from "@/lib/data";
import CalendarSidebarPanel from "./CalendarSidebarPanel";

// An event opened in one mailbox (with its stored invitation mail) and that
// mailbox's calendar entries must not stay visible after switching mailboxes.

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

function eventOf(accountId: string): CalendarEvent {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  return {
    id: "event-1", accountId, eventUid: `uid-${accountId}@example.test`, summary: `Private event of ${accountId}`,
    startAtMs: start.getTime(), endAtMs: start.getTime() + 3_600_000, createdAtMs: 1, updatedAtMs: 1,
    allDay: false, sourceType: "local"
  };
}

function mockCalendarApi() {
  return spyOn(globalThis, "fetch").mockImplementation(Object.assign(
    async (input: RequestInfo | URL) => {
      const url = String(input);
      const accountId = decodeURIComponent(url.split("/api/accounts/")[1]?.split("/")[0] ?? "");
      if (url.includes("/calendar/events/")) return Response.json({ ok: true, event: eventOf(accountId) });
      if (url.includes("/calendar/events")) return Response.json({ items: [eventOf(accountId)] });
      return Response.json({ items: [], conflicts: [] });
    },
    { preconnect: globalThis.fetch.preconnect }
  ));
}

const ui = (accountId: string) => <I18nTestProvider locale="en"><Theme>
  <CalendarSidebarPanel accountId={accountId} onClose={() => {}} />
</Theme></I18nTestProvider>;

describe("calendar browser across a mailbox switch", () => {
  it("replaces the previous mailbox's entries in the calendar grid", async () => {
    const network = mockCalendarApi();
    try {
      const view = render(ui("mailbox-a"));
      await waitFor(() => expect(view.container.textContent).toContain("Private event of mailbox-a"));
      view.rerender(ui("mailbox-b"));
      expect(view.container.textContent).not.toContain("Private event of mailbox-a");
      await waitFor(() => expect(view.container.textContent).toContain("Private event of mailbox-b"));
    } finally { cleanup(); network.mockRestore(); }
  });

  it("closes the open event and replaces the previous mailbox's entries", async () => {
    const network = mockCalendarApi();
    try {
      const view = render(ui("mailbox-a"));
      await waitFor(() => expect(view.container.querySelectorAll(".fc-event").length).toBe(1));
      fireEvent.click(view.container.querySelector<HTMLElement>(".fc-event")!);
      await waitFor(() => expect(view.container.querySelector(".fc-event")).toBeNull());
      expect(view.container.textContent).toContain("Private event of mailbox-a");

      view.rerender(ui("mailbox-b"));
      expect(view.container.textContent).not.toContain("Private event of mailbox-a");
      await waitFor(() => expect(view.container.textContent).toContain("Private event of mailbox-b"));
      expect(view.container.textContent).not.toContain("Private event of mailbox-a");
    } finally { cleanup(); network.mockRestore(); }
  });
});
