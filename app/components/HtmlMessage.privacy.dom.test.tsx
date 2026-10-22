// @ts-expect-error bun:test is provided by the runner and is absent from this tsconfig.
import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import HtmlMessage from "./HtmlMessage";
import { withRemoteContentDecision } from "@/lib/html/remoteContentSession";

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const html = '<img width="200" height="100" src="https://images.example.test/photo"><img src="cid:logo">';

test("notice, load once, message change and persisted sender choice", async () => {
  const requests: { url: string; body?: string }[] = [];
  let allowed = false;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), body: init?.body as string | undefined });
    if (init?.method === "PUT") allowed = true;
    return Response.json({ prefs: allowed ? { remoteContent: { allowedSenders: { "sender@example.test": true } } } : {} });
  }) as typeof fetch;
  const accountId = crypto.randomUUID();
  const props = { html, darkMode: false, accountId, sender: "Synthetic <SENDER@EXAMPLE.TEST>", messageId: "newsletter" };
  const view = render(<HtmlMessage {...props} />);
  const frame = view.getByTitle("HTML message") as HTMLIFrameElement;
  expect(frame.getAttribute("sandbox")).toBe("allow-same-origin");
  expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(view.getByText("Remote content blocked")).toBeTruthy();
  expect(frame.srcdoc).toContain("data-remote-src=");
  expect(frame.srcdoc).toContain('src="cid:logo"');
  fireEvent.click(view.getByRole("button", { name: "Load once" }));
  expect(view.queryByText("Remote content blocked")).toBeNull();
  expect(frame.srcdoc).toContain('src="https://images.example.test/photo"');
  expect(requests.filter(r => r.body)).toHaveLength(0);
  expect(withRemoteContentDecision("/html", accountId, "newsletter")).toBe("/html?remoteContent=allow");
  view.rerender(<HtmlMessage {...props} messageId="other" />);
  expect(withRemoteContentDecision("/html", accountId, "newsletter")).toBe("/html");
  expect(view.getByText("Remote content blocked")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Always load from this sender" }));
  await waitFor(() => expect(view.queryByText("Remote content blocked")).toBeNull());
  expect(JSON.parse(requests.find(r => r.body)!.body!)).toEqual({ remoteContent: { allowedSenders: { "sender@example.test": true } } });
  view.unmount();
  const reopened = render(<HtmlMessage {...props} messageId="third" />);
  await waitFor(() => expect(reopened.queryByText("Remote content blocked")).toBeNull());
}, 20_000);

test("a failed preference save stays blocked and exposes a retry message", async () => {
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => init?.method === "PUT" ? new Response("", { status: 500 }) : Response.json({ prefs: {} })) as typeof fetch;
  const view = render(<HtmlMessage html={html} darkMode={false} accountId={crypto.randomUUID()} sender="sender@example.test" />);
  fireEvent.click(view.getByRole("button", { name: "Always load from this sender" }));
  await waitFor(() => expect(view.getByRole("alert").textContent).toContain("could not be saved"));
  expect(view.getByText("Remote content blocked")).toBeTruthy();
});
