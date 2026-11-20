// Runs under `bun test --config=bunfig.dom.toml` (happy-dom).
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import ComposeEditor from "./ComposeEditor";

const REMOTE = "https://tracker.example.test/pixel.gif";
const LOCAL = "data:image/png;base64,AAAA";
const HTML = `<p>Quote</p><p><img src="${REMOTE}" alt="tracker"><img src="${LOCAL}" alt="inline"><img src="/api/accounts/../prefs" alt="relative"></p>`;

const originalFetch = globalThis.fetch;
let allowedSenders: Record<string, boolean> = {};

beforeEach(() => {
  allowedSenders = {};
  globalThis.fetch = mock(async () => new Response(JSON.stringify({ ok: true, prefs: { remoteContent: { allowedSenders } } }), {
    headers: { "Content-Type": "application/json" }
  })) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

const editorImages = (container: HTMLElement) =>
  [...container.querySelectorAll("[contenteditable='true'] img")].map((image) => image.getAttribute("src"));

// A31 / DS-08: quoted originals and drafts of other members can carry remote
// images; the rich editor follows the reader's remote-content consent.
describe("ComposeEditor remote images", () => {
  it("shows placeholders until the user loads them and keeps the exported source", async () => {
    let latestHtml = "";
    const view = render(<ComposeEditor initialHtml={HTML} resetKey={1} onChange={(html) => { latestHtml = html; }} />);
    await waitFor(() => expect(view.getByText("Remote image: tracker")).toBeTruthy());
    expect(editorImages(view.container)).toEqual([LOCAL]);
    expect(view.getByText("Image not loaded: relative")).toBeTruthy();
    await waitFor(() => expect(latestHtml).toContain(`src="${REMOTE}"`));

    fireEvent.click(view.getByRole("button", { name: "Remote image: tracker" }));
    await waitFor(() => expect(editorImages(view.container)).toEqual([REMOTE, LOCAL]));
    expect(view.container.querySelector(`img[src="${REMOTE}"]`)?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(view.getByText("Image not loaded: relative")).toBeTruthy();
  });

  it("loads them when the source message's sender is allowed", async () => {
    allowedSenders = { "sender@example.test": true };
    const view = render(
      <ComposeEditor
        initialHtml={HTML}
        resetKey={2}
        remoteImageSource={{ accountId: "acct", id: "m1", senderKey: "sender@example.test" }}
        onChange={() => {}}
      />
    );
    await waitFor(() => expect(editorImages(view.container)).toEqual([REMOTE, LOCAL]));
  });
});
