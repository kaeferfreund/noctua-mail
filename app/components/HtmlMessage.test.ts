import { describe, expect, test } from "bun:test";
import { buildPreviewDocument } from "./HtmlMessage";
import { extractBodyContent } from "@/lib/html";

const build = (html: string, hostViewportHeight?: number) => buildPreviewDocument({
  html, safeHtml: html, darkMode: false, fontScale: 1, zoom: 1,
  showViewerFrame: false, hostViewportHeight, token: "test-preview"
});

describe("HTML preview document heights", () => {
  test("strips body constraints but preserves its other styling and attributes", () => {
    const output = build('<body class="h-screen" id="bodyTable" style="height:100vh!important;min-height:100%;max-height:200px;padding:16px"><p>Message</p></body>');
    expect(output).toContain('class="noctua-email-content email-body h-screen" id="bodyTable" style="padding:16px"');
  });
  test("rewrites inline and stylesheet lengths, with a fixed host unit", () => {
    const output = build('<style>.card{padding:2vh}.h-screen{height:100vh !important}</style><body class="h-screen"><div style="min-height:50dvh">100vh</div></body>', 900);
    expect(output).toContain('--noctua-vh: 9px');
    expect(output).toContain('padding:calc(2 * var(--noctua-vh))');
    expect(output).toContain('height:calc(100 * var(--noctua-vh)) !important');
    expect(output).toContain('min-height:calc(50 * var(--noctua-vh))');
    expect(output).toContain('>100vh</div>');
  });
  test("enforces natural height for root, body and content after mail styles", () => {
    const output = build('<style>body,#bodyTable{height:100% !important}</style><body><p>Message</p></body>');
    const override = 'height: auto !important; min-height: 0 !important; max-height: none !important;';
    expect(output).toContain(override);
    expect(output.indexOf(override)).toBeGreaterThan(output.indexOf('body,#bodyTable'));
    expect(output).toContain('html#noctua-email-root');
    expect(output).toContain('html#noctua-email-root body');
    expect(output).toContain('html#noctua-email-root .noctua-email-content');
  });
  for (const value of [undefined, NaN, Infinity, 0, -100]) {
    test(`uses a finite fallback for ${value}`, () => {
      expect(build('<p>Message</p>', value)).toContain('--noctua-vh: 8px');
    });
  }
  test("keeps visible text and non-style attributes containing viewport strings", () => {
    const output = build('<body><p class="a100vh" title="100vh">100vh is a CSS length</p></body>');
    expect(extractBodyContent(output).body).toContain('<p class="a100vh" title="100vh">100vh is a CSS length</p>');
  });
});
