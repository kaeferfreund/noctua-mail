import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import CrashScreen from "./CrashScreen";
import { CLIENT_ERROR_DEDUPE_MS, installClientErrorReporting, reportClientError, resetClientErrorReporterForTests, setClientErrorBuild } from "@/lib/ui/clientErrorReporter";

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
const fetchMock = (respond: () => Promise<Response>) => Object.assign(respond, { preconnect: globalThis.fetch.preconnect });
beforeEach(() => {
  resetClientErrorReporterForTests();
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(fetchMock(async () => new Response(null, { status: 204 })));
});
afterEach(() => { cleanup(); fetchSpy.mockRestore(); });
const sent = () => fetchSpy.mock.calls.map(([url, init]) => ({ url, init, body: JSON.parse(String(init?.body)) }));

it("shows the German crash screen, reports once and offers reload and a start page link without the query", () => {
  window.history.replaceState(null, "", "/?a=~qa&m=~synthetic&q=private%20search");
  setClientErrorBuild("synthetic-build ");
  const error = new TypeError("Cannot read properties of undefined (reading 'folderId')");
  const page = render(<CrashScreen error={error} source="boundary" locale="de" />);
  expect(page.getByRole("alert").textContent).toContain("Die Oberfläche ist abgestürzt");
  expect(page.getByRole("link", { name: "Zur Startseite" }).getAttribute("href")).toBe("/");
  const reload = spyOn(window.location, "reload").mockImplementation(() => {});
  fireEvent.click(page.getByRole("button", { name: "Neu laden" }));
  expect(reload).toHaveBeenCalledTimes(1);
  reload.mockRestore();
  page.rerender(<CrashScreen error={error} source="boundary" locale="de" />);
  expect(sent()).toHaveLength(1);
  const [{ url, init, body }] = sent();
  expect(url).toBe("/api/client-errors");
  expect(init).toMatchObject({ method: "POST", credentials: "same-origin", keepalive: true });
  expect(body).toMatchObject({ source: "boundary", message: "TypeError: Cannot read properties of undefined (reading 'folderId')",
    path: "/", queryKeys: ["a", "m", "q"], build: "synthetic-build", standalone: false });
  expect(body.stack).toContain("TypeError");
  expect(JSON.stringify(body)).not.toContain("private search");
});

it("renders English texts for an English UI", () => {
  const page = render(<CrashScreen error={new Error("synthetic")} source="global" locale="en" />);
  expect(page.getByRole("button", { name: "Reload" })).toBeTruthy();
  expect(sent()[0].body.source).toBe("global");
});

it("dedupes the same message within a minute and reports it again afterwards", () => {
  reportClientError("error", new Error("same"), 1_000);
  reportClientError("unhandledrejection", new Error("same"), 1_000 + CLIENT_ERROR_DEDUPE_MS - 1);
  reportClientError("error", new Error("other"), 2_000);
  reportClientError("error", new Error("same"), 1_000 + CLIENT_ERROR_DEDUPE_MS);
  expect(sent().map(call => call.body.message)).toEqual(["Error: same", "Error: other", "Error: same"]);
});

it("never throws, even when the request fails", () => {
  fetchSpy.mockImplementation(fetchMock(async () => { throw new TypeError("offline"); }));
  expect(() => reportClientError("error", "plain text failure")).not.toThrow();
  expect(() => reportClientError("error", { circular: globalThis })).not.toThrow();
});

it("reports uncaught errors and unhandled rejections of the tab, but not aborted requests", () => {
  const uninstall = installClientErrorReporting();
  try {
    expect(installClientErrorReporting()).toBeInstanceOf(Function); // A second mount does not add listeners.
    window.dispatchEvent(new ErrorEvent("error", { error: new RangeError("uncaught render"), message: "uncaught render" }));
    const rejection = (reason: unknown) => {
      const event = new Event("unhandledrejection") as PromiseRejectionEvent;
      Object.defineProperty(event, "reason", { value: reason });
      window.dispatchEvent(event);
    };
    rejection(new DOMException("aborted", "AbortError"));
    rejection(new Error("lost promise"));
    expect(sent().map(call => [call.body.source, call.body.message])).toEqual([
      ["error", "RangeError: uncaught render"], ["unhandledrejection", "Error: lost promise"]]);
  } finally { uninstall(); }
});
