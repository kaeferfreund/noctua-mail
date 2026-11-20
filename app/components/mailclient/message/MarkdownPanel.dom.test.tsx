// Runs under `bun test --config=bunfig.dom.toml` (happy-dom).
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import MarkdownPanel from "./MarkdownPanel";
import { classifyImageSource } from "@/lib/html/remoteContent";
import { hasRemoteMarkdownImages } from "./markdownImages";

const REMOTE = "https://tracker.example.test/pixel.gif";
const LOCAL = "/api/accounts/acct/messages/m1/attachments/logo";
const BODY = `Hello\n\n![tracker](${REMOTE})\n\n![logo](${LOCAL})\n\n![ref][r]\n\n[r]: https://ref.example.test/r.png\n\n![rel](/api/accounts/../prefs)\n\n<img src="${REMOTE}" onerror="alert(1)"><iframe srcdoc="<script>alert(1)</script>"></iframe>`;

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

const imageSources = (container: HTMLElement) => [...container.querySelectorAll("img")].map((image) => image.getAttribute("src"));

describe("markdown image policy (DS-08, A23)", () => {
  it("classifies sources", () => {
    expect(classifyImageSource(REMOTE)).toBe("remote");
    expect(classifyImageSource(LOCAL)).toBe("local");
    expect(classifyImageSource("data:image/png;base64,AAAA")).toBe("local");
    expect(classifyImageSource("/api/accounts/../prefs")).toBe("inert");
    expect(classifyImageSource("//tracker.example.test/p")).toBe("inert");
    expect(classifyImageSource("javascript:alert(1)")).toBe("inert");
  });

  it("detects inline and reference remote images, not raw HTML", () => {
    expect(hasRemoteMarkdownImages(`![a](${REMOTE})`)).toBe(true);
    expect(hasRemoteMarkdownImages(`![a][x]\n\n[x]: ${REMOTE}`)).toBe(true);
    expect(hasRemoteMarkdownImages(`[link](${REMOTE}) ![a](${LOCAL})`)).toBe(false);
    expect(hasRemoteMarkdownImages(`<img src="${REMOTE}">`)).toBe(false);
  });
});

describe("MarkdownPanel", () => {
  it("blocks remote images of a message until consent and never renders raw HTML", async () => {
    const view = render(<MarkdownPanel body={BODY} message={{ accountId: "acct", id: "m1", senderKey: "sender@example.test" }} />);
    await act(async () => { await Promise.resolve(); });
    expect(imageSources(view.container)).toEqual([LOCAL]);
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(view.container.textContent).toContain("<iframe srcdoc=");
    expect(view.getByText("Remote content blocked")).toBeTruthy();
    expect(view.getByText("Remote image: tracker")).toBeTruthy();
    expect(view.getByText("Remote image: ref")).toBeTruthy();
    expect(view.getByText("Image not loaded: rel")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Load once" }));
    await waitFor(() => expect(imageSources(view.container)).toEqual([REMOTE, LOCAL, "https://ref.example.test/r.png"]));
    for (const image of view.container.querySelectorAll("img")) expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(view.queryByText("Remote content blocked")).toBeNull();
    expect(view.getByText("Image not loaded: rel")).toBeTruthy();
  });

  it("loads remote images for a sender the user always allows", async () => {
    allowedSenders = { "sender@example.test": true };
    const view = render(<MarkdownPanel body={`![tracker](${REMOTE})`} message={{ accountId: "acct", id: "m2", senderKey: "sender@example.test" }} />);
    await waitFor(() => expect(imageSources(view.container)).toEqual([REMOTE]));
  });

  it("notes: no banner, each blocked image can be loaded once", async () => {
    const view = render(<MarkdownPanel body={`Note ![tracker](${REMOTE})`} />);
    expect(view.queryByText("Remote content blocked")).toBeNull();
    expect(imageSources(view.container)).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Remote image: tracker" }));
    await waitFor(() => expect(imageSources(view.container)).toEqual([REMOTE]));
  });
});
