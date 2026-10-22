// @ts-expect-error bun:test is provided by the runner and is absent from this tsconfig.
import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import HtmlMessage from "./HtmlMessage";
import { withRemoteContentDecision } from "@/lib/html/remoteContentSession";
import { legacyUnkeyedSenders, senderPermissionLookupCases } from "@/lib/testFixtures/senderPermissions";
import { accountPrefsPatchSchema } from "@/lib/accountPrefs";
import type { UserAccountPrefs } from "@/lib/data";

const originalFetch = globalThis.fetch;
const originalOpen = window.open;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; window.open = originalOpen; });
const html = '<img width="200" height="100" src="https://images.example.test/photo"><img src="cid:logo">';

for (const from of legacyUnkeyedSenders) {
  test(`reader treats unkeyed legacy sender as unknown and still allows Load once: ${from}`, async () => {
    let writes = 0;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "PUT") writes++;
      return Response.json({ prefs: { remoteContent: { allowedSenders: { "trusted@example.test": true } } } });
    }) as typeof fetch;
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<HtmlMessage html={html} darkMode={false} accountId={crypto.randomUUID()} senderKey={null} />); });
    const frame = view.getByTitle("HTML message") as HTMLIFrameElement;
    expect(frame.srcdoc).toContain("data-remote-src=");
    expect(view.getByRole("button", { name: "Always load from this sender" }).hasAttribute("disabled")).toBe(true);
    expect(view.getByText("Sender unknown until the original message is available or resynced.")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Load once" }));
    expect(frame.srcdoc).toContain('src="https://images.example.test/photo"');
    expect(writes).toBe(0);
  });
}

for (const { name, key } of senderPermissionLookupCases) {
  test(`reader rejects unrelated sender permissions and saves/reads the mailbox: ${name}`, async () => {
    let prefs: UserAccountPrefs = { remoteContent: { allowedSenders: { "trusted@example.test": true } } };
    let saved: unknown;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "PUT") {
        saved = JSON.parse(String(init.body));
        prefs = accountPrefsPatchSchema.parse(saved) as UserAccountPrefs;
      }
      return Response.json({ prefs });
    }) as typeof fetch;
    const props = { html, darkMode: false, accountId: crypto.randomUUID(), senderKey: key || null, messageId: "first" };
    // Flush the async preference read before the rejecting assertions; an
    // initial blocked render alone would miss a later unauthorized allow.
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<HtmlMessage {...props} />); });
    expect((view.getByTitle("HTML message") as HTMLIFrameElement).srcdoc).toContain("data-remote-src=");
    const always = view.queryByRole("button", { name: "Always load from this sender" });
    if (!key) { expect(always?.hasAttribute("disabled")).toBe(true); return; }
    await act(async () => { fireEvent.click(always!); });
    expect(saved).toEqual({ remoteContent: { allowedSenders: { [key]: true } } });
    expect((view.getByTitle("HTML message") as HTMLIFrameElement).srcdoc).toMatch(/\ssrc="https:\/\/images\.example\.test\/photo"/);
    view.unmount();
    await act(async () => { view = render(<HtmlMessage {...props} messageId="reopened" />); });
    expect((view.getByTitle("HTML message") as HTMLIFrameElement).srcdoc).toMatch(/\ssrc="https:\/\/images\.example\.test\/photo"/);
  });
}

test("notice, load once, message change and persisted sender choice", async () => {
  const requests: { url: string; body?: string }[] = [];
  let allowed = false;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), body: init?.body as string | undefined });
    if (init?.method === "PUT") allowed = true;
    return Response.json({ prefs: allowed ? { remoteContent: { allowedSenders: { "sender@example.test": true } } } : {} });
  }) as typeof fetch;
  const accountId = crypto.randomUUID();
  const props = { html, darkMode: false, accountId, senderKey: "sender@example.test", messageId: "newsletter" };
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
  const view = render(<HtmlMessage html={html} darkMode={false} accountId={crypto.randomUUID()} senderKey="sender@example.test" />);
  fireEvent.click(view.getByRole("button", { name: "Always load from this sender" }));
  await waitFor(() => expect(view.getByRole("alert").textContent).toContain("could not be saved"));
  expect(view.getByText("Remote content blocked")).toBeTruthy();
});

test("sender permission reads and writes the real mailbox rather than quoted display-name text", async () => {
  let saved: unknown;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    if (init?.method === "PUT") saved = JSON.parse(String(init.body));
    return Response.json({ prefs: { remoteContent: { allowedSenders: { "trusted@example.test": true } } } });
  }) as typeof fetch;
  const view = render(<HtmlMessage html={html} darkMode={false} accountId={crypto.randomUUID()} senderKey="actual@example.test" />);
  await waitFor(() => expect(view.getByText("Remote content blocked")).toBeTruthy());
  fireEvent.click(view.getByRole("button", { name: "Always load from this sender" }));
  await waitFor(() => expect(saved).toEqual({ remoteContent: { allowedSenders: { "actual@example.test": true } } }));
});

test("opt-in never reinserts sender stylesheets or remote CSS", () => {
  const view = render(<HtmlMessage darkMode={false} html={'<link rel="stylesheet" href="https://styles.example.test/sender.css"><style>@import url("https://fonts.googleapis.com/css2?family=Test");p{background:url("https://styles.example.test/bg")}</style>' + html} />);
  fireEvent.click(view.getByRole("button", { name: "Load once" }));
  const frame = view.getByTitle("HTML message") as HTMLIFrameElement;
  expect(frame.srcdoc).not.toContain("styles.example.test");
  expect(frame.srcdoc).not.toContain("fonts.googleapis.com");
  expect(frame.srcdoc).not.toContain('<link rel="stylesheet"');
  expect(frame.srcdoc).toContain('referrerpolicy="no-referrer"');
});

test("links open on primary click and middle auxclick, never right auxclick or contextmenu", () => {
  const opened: unknown[][] = [];
  window.open = ((...args: unknown[]) => { opened.push(args); return null; }) as typeof window.open;
  const view = render(<HtmlMessage html={'<a href="https://links.example.test/destination"><span>Destination</span></a>'} darkMode={false} />);
  const frame = view.getByTitle("HTML message") as HTMLIFrameElement;
  // happy-dom does not navigate srcdoc. Supply the generated document and fire
  // load so the production listener binding runs against the matching token.
  const doc = new DOMParser().parseFromString(frame.srcdoc, "text/html");
  Object.defineProperty(doc, "readyState", { value: "complete" });
  Object.defineProperty(frame, "contentDocument", { value: doc });
  fireEvent.load(frame);
  const target = doc.querySelector("a")!;
  fireEvent.click(target, { button: 0 });
  fireEvent(target, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
  expect(opened).toEqual(Array.from({ length: 2 }, () => ["https://links.example.test/destination", "_blank", "noopener,noreferrer"]));
  fireEvent(target, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 2 }));
  fireEvent.contextMenu(target, { button: 2 });
  expect(opened).toHaveLength(2);
});

test("fragment links scroll inside the mail document and missing targets never navigate", () => {
  const opened: unknown[][] = [];
  window.open = ((...args: unknown[]) => { opened.push(args); return null; }) as typeof window.open;
  const view = render(<HtmlMessage darkMode={false} html={'<a href="#end" target="_blank"><span>End</span></a><a href="#section%20two">Encoded</a><a href="#legacy">Named</a><a href="#missing">Missing</a><a href="#bad%ZZ">Malformed</a><p id="end">End target</p><p id="section two">Second target</p><a name="legacy">Legacy target</a>'} />);
  const frame = view.getByTitle("HTML message") as HTMLIFrameElement;
  const doc = new DOMParser().parseFromString(frame.srcdoc, "text/html");
  Object.defineProperty(doc, "readyState", { value: "complete" });
  Object.defineProperty(frame, "contentDocument", { value: doc });
  const scrolled: string[] = [];
  for (const element of doc.querySelectorAll('[id], a[name="legacy"]')) {
    element.scrollIntoView = () => scrolled.push(element.id || element.getAttribute("name")!);
  }
  fireEvent.load(frame);
  for (const anchor of doc.querySelectorAll("a[href]")) {
    expect(anchor.hasAttribute("target")).toBe(false);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    fireEvent(anchor.querySelector("span") ?? anchor, click);
    expect(click.defaultPrevented).toBe(true);
  }
  const middle = new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 });
  fireEvent(doc.querySelector('a[href="#end"]')!, middle);
  expect(middle.defaultPrevented).toBe(true);
  expect(scrolled).toEqual(["end", "section two", "legacy", "end"]);
  expect(opened).toEqual([]);
  expect(frame.contentDocument).toBe(doc);
});
