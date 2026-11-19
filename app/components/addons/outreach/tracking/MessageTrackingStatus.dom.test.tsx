import { afterEach, beforeEach, expect, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import { reviewReaderProps, syntheticReviewMessage } from "@/tests/helpers/i18nSlice2b";
import ThreadMessageCard from "@/app/components/mailclient/message/ThreadMessageCard";
import type { Folder, Message } from "@/lib/data";
import type { MessageTrackingSummary, TrackingEvent, TrackingEventsResponse } from "@/lib/addons/outreach/types";
import { resetOutreachStatusForTests, type OutreachStatus } from "../useOutreachStatus";

const ON: OutreachStatus = { loaded: true, available: true, sesConfigured: true, trackingConfigured: true,
  accounts: [{ accountId: "mailbox-a", enabled: true, trackMailDefault: false }] };
const OWN = "own@example.test";
const sentMessage: Message = { ...syntheticReviewMessage, id: "sent-1", accountId: "mailbox-a", folderId: "mailbox-a:Sent",
  from: `Synthetic Mailbox <${OWN}>`, to: "Recipient <recipient@example.test>", messageId: "<sent-1@example.test>", recent: false, priority: undefined };
const now = Date.now();

function event(patch: Partial<TrackingEvent>): TrackingEvent {
  return { id: 1, sendId: "send-1", contactId: null, type: "open", at: now - 60_000, ip: "198.51.100.23", ipTruncated: false,
    country: "DE", region: "Berlin", city: "Berlin", userAgent: null, clientName: "Apple Mail", clientOs: "iOS",
    clientType: "mail-client", machine: false, url: null, ...patch };
}
function summary(patch: Partial<MessageTrackingSummary> = {}): MessageTrackingSummary {
  return { sendId: "send-1", kind: "mail", messageId: sentMessage.messageId!, recipients: "recipient@example.test", subject: "Synthetic",
    sentAt: now - 3_600_000, trackOpens: true, trackClicks: true, opens: 2, machineOpens: 0, clicks: 1, firstOpenedAt: now - 1_800_000,
    lastOpenedAt: now - 60_000, lastClickedAt: now - 120_000, bounced: false, lastEvent: event({}), ...patch };
}

const originalFetch = globalThis.fetch;
let requests: string[] = [];
let tracking: MessageTrackingSummary | null = null;
let events: TrackingEventsResponse = { ok: true, events: [], nextBefore: null };
beforeEach(() => {
  requests = [];
  tracking = summary();
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("/tracking/events?")) return Response.json(events);
    if (url.includes("/tracking?")) return Response.json({ ok: true, tracking });
    return Response.json({ ok: false, message: "Not found" }, { status: 404 });
  }) as typeof fetch;
  resetOutreachStatusForTests(ON);
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  resetOutreachStatusForTests();
});

function card(message: Message, extra: { draft?: boolean; folder?: Folder; collapsed?: boolean } = {}) {
  const props = reviewReaderProps();
  return render(<Theme><ThreadMessageCard {...props} message={message} userEmail={[OWN]} isCollapsed={extra.collapsed ?? false}
    isDraftMessage={() => extra.draft ?? false} folderById={() => extra.folder} /></Theme>);
}
const statusLine = (page: ReturnType<typeof render>) => page.container.querySelector("[data-outreach-tracking-status] button");
const summaryUrl = "/api/addons/outreach/accounts/mailbox-a/tracking?messageId=%3Csent-1%40example.test%3E";

test("addon off: no line and no addon request for a sent message", async () => {
  resetOutreachStatusForTests({ ...ON, available: false, accounts: [] });
  const page = card(sentMessage);
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(statusLine(page)).toBeNull();
  expect(requests).toEqual([]);
});

test("received messages, drafts, collapsed cards and messages without Message-ID ask nothing", async () => {
  const pages = [
    card({ ...sentMessage, id: "in-1", from: "Someone <someone@example.test>", folderId: "mailbox-a:INBOX" }),
    card(sentMessage, { draft: true }),
    card(sentMessage, { collapsed: true }),
    card({ ...sentMessage, id: "no-id", messageId: undefined })
  ];
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(requests).toEqual([]);
  for (const page of pages) expect(statusLine(page)).toBeNull();
});

test("no tracked send for the message: one request, nothing rendered", async () => {
  tracking = null;
  const page = card(sentMessage);
  await waitFor(() => expect(requests).toEqual([summaryUrl]));
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(statusLine(page)).toBeNull();
});

test("opened and clicked: one quiet line with count, time, place and mail program", async () => {
  const page = card(sentMessage);
  await waitFor(() => expect(statusLine(page)).not.toBeNull());
  const text = statusLine(page)!.textContent ?? "";
  expect(text).toStartWith("Opened 2× · 1 click · last ");
  expect(text).toEndWith(" · Berlin · Apple Mail");
  expect(requests).toEqual([summaryUrl]);
});

test("a message in the Sent folder counts as sent even from another address", async () => {
  const page = card({ ...sentMessage, from: "Alias <alias@example.test>" }, { folder: { id: "mailbox-a:Sent", name: "Sent", specialUse: "\\Sent" } as Folder });
  await waitFor(() => expect(statusLine(page)).not.toBeNull());
  expect(requests).toEqual([summaryUrl]);
});

test("status variants: not opened, machine fetches only, several recipients, bounce", async () => {
  const cases: Array<[Partial<MessageTrackingSummary>, string]> = [
    [{ opens: 0, clicks: 0, lastEvent: null, lastOpenedAt: null, lastClickedAt: null }, "Not opened yet"],
    [{ opens: 0, clicks: 0, machineOpens: 3, lastEvent: null, lastOpenedAt: null, lastClickedAt: null }, "Not opened yet (automatic fetches only)"],
    [{ opens: 1, clicks: 0, recipients: "a@example.test, b@example.test" }, "Opened 1× by at least one recipient · last "],
    [{ opens: 0, clicks: 2, recipients: "a@example.test, b@example.test", lastOpenedAt: null }, "2 clicks by at least one recipient · last "],
    [{ bounced: true }, "Undeliverable"]
  ];
  for (const [patch, expected] of cases) {
    tracking = summary(patch);
    const page = card(sentMessage);
    await waitFor(() => expect(statusLine(page)).not.toBeNull());
    const text = statusLine(page)!.textContent ?? "";
    if (expected.endsWith(" ")) expect(text).toStartWith(expected);
    else expect(text).toBe(expected);
    cleanup();
  }
});

test("opening the line lists the events with machine badge, truncated IP, link and the estimate note", async () => {
  events = { ok: true, nextBefore: null, events: [
    event({ id: 3, type: "click", url: "https://www.example.test/offer" }),
    event({ id: 2, at: now - 90_000, ip: "198.51.100.0", ipTruncated: true }),
    event({ id: 1, at: now - 300_000, machine: true, clientType: "proxy", clientName: "Image proxy", clientOs: null, city: null, region: null, country: "US", ip: null })
  ] };
  const page = card(sentMessage);
  await waitFor(() => expect(statusLine(page)).not.toBeNull());
  const toggle = statusLine(page) as HTMLButtonElement;
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  const panel = await page.findByRole("region", { name: "Tracking events" });
  await waitFor(() => expect(panel.querySelectorAll("[data-tracking-event]").length).toBe(3));
  expect(requests).toEqual([summaryUrl, "/api/addons/outreach/accounts/mailbox-a/tracking/events?sendId=send-1&includeMachine=1&limit=50"]);
  const text = panel.textContent ?? "";
  expect(text).toContain("Opens are an estimate: many mail programs load images through their own servers");
  expect(text).toContain("Link: https://www.example.test/offer");
  expect(text).toContain("Berlin, Germany · Apple Mail / iOS · IP 198.51.100.23");
  expect(text).toContain("IP 198.51.100.0 (truncated)");
  expect(text).toContain("United States · Image proxy");
  const items = [...panel.querySelectorAll("[data-tracking-event]")];
  expect(items.map(item => item.getAttribute("data-tracking-event"))).toEqual(["click", "open", "open"]);
  expect(items[2].textContent).toContain("Automatic");
  expect(items[1].textContent).not.toContain("Automatic");
});
