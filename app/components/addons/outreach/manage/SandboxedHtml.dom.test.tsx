// Runs under `bun test --config=bunfig.dom.toml` (happy-dom).
import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { SandboxedHtml, hasRemoteResources, previewCsp, withPreviewCsp } from "./HtmlContent";

afterEach(() => {
  cleanup();
});

const TEMPLATE =
  `<!doctype html><html><head><title>T</title></head>` +
  `<body><img src="https://tracker.example.test/open.gif"><img src="/t/m/abc.png"></body></html>`;

function frameCsp(container: HTMLElement) {
  const srcdoc = container.querySelector("iframe")?.getAttribute("srcdoc") ?? "";
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(srcdoc)?.[1] ?? "";
  return { srcdoc, csp };
}

// SD56: opening a stored template must not contact external hosts before the
// viewer decides to load external content.
describe("outreach template preview", () => {
  it("blocks external resources until the viewer loads them", () => {
    const view = render(<SandboxedHtml html={TEMPLATE} title="Preview" />);
    const before = frameCsp(view.container);
    expect(before.srcdoc.startsWith("<!doctype html><meta")).toBe(true);
    expect(before.csp).toContain("default-src 'none'");
    expect(before.csp).toContain(`img-src data: blob: ${window.location.origin}/t/m/;`);
    expect(before.csp).not.toMatch(/\bhttps?:(?!\/\/)/);
    expect(before.csp).toContain("form-action 'none'");

    fireEvent.click(view.getByRole("button", { name: "Load external content" }));
    const after = frameCsp(view.container);
    expect(after.csp).toContain("img-src data: blob: " + window.location.origin + "/t/m/ https: http:");
    expect(view.queryByRole("button", { name: "Load external content" })).toBeNull();
  });

  it("shows no prompt for templates without external resources", () => {
    const view = render(<SandboxedHtml html={`<p><a href="https://example.test/">Link</a><img src="/t/m/abc.png"></p>`} title="Preview" />);
    expect(view.queryByRole("button", { name: "Load external content" })).toBeNull();
  });

  it("detects external resources in attributes and CSS", () => {
    expect(hasRemoteResources(`<td background="//cdn.example.test/bg.png">`)).toBe(true);
    expect(hasRemoteResources(`<div style="background:url('https://cdn.example.test/x.png')">`)).toBe(true);
    expect(hasRemoteResources(`<style>@import "x.css";</style>`)).toBe(true);
    expect(hasRemoteResources(`<a href="https://example.test/">x</a>`)).toBe(false);
  });

  it("keeps the policy first and the attribute quoted", () => {
    expect(withPreviewCsp("<p>x</p>", previewCsp(null, false))).toBe(
      `<meta http-equiv="Content-Security-Policy" content="${previewCsp(null, false)}"><p>x</p>`
    );
    expect(previewCsp(null, false)).not.toContain("/t/m/");
  });
});
