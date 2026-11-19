import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import { resetOutreachStatusForTests, type OutreachStatus } from "../useOutreachStatus";
import { ComposeTrackingSwitch, useComposeTracking } from "./ComposeTracking";

const originalFetch = globalThis.fetch;
let requests: string[] = [];
beforeEach(() => {
  requests = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return Response.json({ ok: true, available: false, accounts: [], sesConfigured: false, trackingConfigured: false });
  }) as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  resetOutreachStatusForTests();
});

const ON: OutreachStatus = {
  loaded: true, available: true, sesConfigured: true, trackingConfigured: true,
  accounts: [{ accountId: "mailbox-a", enabled: true, trackMailDefault: true }, { accountId: "mailbox-b", enabled: true, trackMailDefault: false },
    { accountId: "mailbox-c", enabled: false, trackMailDefault: true }]
};

type Format = "text" | "html" | "markdown";
/** The send field the orchestrator would add, rendered so the test can read it. */
function Harness({ accountId, format, sessionKey = "session-1" }: { accountId: string; format: Format; sessionKey?: string }) {
  const tracking = useComposeTracking({ accountId, format, sessionKey });
  return <Theme><ComposeTrackingSwitch tracking={tracking} /><output data-send-field="">{JSON.stringify(tracking.sendField(format))}</output></Theme>;
}
const label = "Track opens and clicks";
const field = (page: { container: HTMLElement }) => JSON.parse(page.container.querySelector("[data-send-field]")?.textContent ?? "null");

test("addon off: no switch, an empty send field and no addon request", () => {
  resetOutreachStatusForTests({ ...ON, available: false, accounts: [] });
  const page = render(<Harness accountId="mailbox-a" format="html" />);
  expect(page.queryByRole("switch")).toBeNull();
  expect(field(page)).toEqual({});
  expect(requests).toEqual([]);
});

test("status not loaded yet: asks only the status route and shows nothing while the flag is off", async () => {
  const page = render(<Harness accountId="mailbox-a" format="html" />);
  await waitFor(() => expect(requests).toEqual(["/api/addons/outreach/status"]));
  expect(page.queryByRole("switch")).toBeNull();
  expect(field(page)).toEqual({});
});

test("preselected from trackMailDefault and toggled into the send field", () => {
  resetOutreachStatusForTests(ON);
  const page = render(<Harness accountId="mailbox-a" format="html" />);
  const toggle = page.getByRole("switch", { name: label });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(field(page)).toEqual({ tracking: true });
  expect(page.getByText("Applies when sending now. Scheduled mails are not tracked.")).toBeTruthy();
  fireEvent.click(toggle);
  expect(page.getByRole("switch", { name: label }).getAttribute("aria-checked")).toBe("false");
  expect(field(page)).toEqual({ tracking: false });
  expect(requests).toEqual([]);
});

test("default off for the mailbox; Markdown is offered; a new compose session starts from the default again", () => {
  resetOutreachStatusForTests(ON);
  const page = render(<Harness accountId="mailbox-b" format="markdown" />);
  const toggle = page.getByRole("switch", { name: label });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  expect(field(page)).toEqual({ tracking: false });
  fireEvent.click(toggle);
  expect(field(page)).toEqual({ tracking: true });
  page.rerender(<Harness accountId="mailbox-b" format="markdown" sessionKey="session-2" />);
  expect(page.getByRole("switch", { name: label }).getAttribute("aria-checked")).toBe("false");
  expect(field(page)).toEqual({ tracking: false });
});

test("plain text, a mailbox without activation and a server without tracking address get no control and no field", () => {
  resetOutreachStatusForTests(ON);
  const page = render(<Harness accountId="mailbox-a" format="text" />);
  expect(page.queryByRole("switch")).toBeNull();
  expect(field(page)).toEqual({});
  page.rerender(<Harness accountId="mailbox-c" format="html" />);
  expect(page.queryByRole("switch")).toBeNull();
  expect(field(page)).toEqual({});
  act(() => resetOutreachStatusForTests({ ...ON, trackingConfigured: false }));
  page.rerender(<Harness accountId="mailbox-a" format="html" />);
  expect(page.queryByRole("switch")).toBeNull();
  expect(field(page)).toEqual({});
});
