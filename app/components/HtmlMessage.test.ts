import { describe, expect, test } from "bun:test";
import { buildPreviewDocument } from "./HtmlMessage";
import { extractBodyContent } from "@/lib/html";

const build = (html: string, hostViewportHeight?: number, darkMode = false) => buildPreviewDocument({
  html, safeHtml: html, darkMode, fontScale: 1, zoom: 1,
  showViewerFrame: false, hostViewportHeight, remoteContent: "block", token: "test-preview"
});

describe("HTML preview document text colour", () => {
  // The srcdoc frame does not inherit the app's custom properties, so the host
  // colour must be a literal: a var() fell back to dark text in dark mode.
  const bodyRule = (output: string) => output.match(/\nbody \{[^}]*\}/)?.[0] ?? "";
  test("plain mails get the theme's text colour as a literal", () => {
    expect(bodyRule(build("<p>Plain</p>", undefined, true))).toContain("color: #eeeeee;");
    expect(bodyRule(build("<p>Plain</p>", undefined, false))).toContain("color: #1a1a1a;");
    expect(build("<p>Plain</p>", undefined, true)).not.toContain("var(--mail-view-fg");
  });
  test("mails with their own light background keep dark text in dark mode", () => {
    for (const html of [
      '<table bgcolor="#ffffff"><tr><td>Text</td></tr></table>',
      "<table bgcolor=white><tr><td>Text</td></tr></table>",
      '<div style="background-color:#fff">Text</div>',
      '<div style="background: #f4f4f4 url(x.png)">Text</div>',
      "<style>.wrap{background-color:rgb(250, 250, 250)}</style><div class=\"wrap\">Text</div>",
      '<td background="paper.png">Text</td>'
    ]) {
      expect(bodyRule(build(html, undefined, true))).toContain("color: #1a1a1a;");
    }
  });
  test("transparent or dark own backgrounds still get the dark theme's text colour", () => {
    for (const html of [
      '<div style="background-color: transparent">Text</div>',
      '<div style="background:none">Text</div>',
      '<table bgcolor="#111111"><tr><td>Text</td></tr></table>',
      '<div style="background-color: rgb(20, 20, 30)">Text</div>',
      "<p>Background: we met at the background-color: #fff workshop.</p>"
    ]) {
      expect(bodyRule(build(html, undefined, true))).toContain("color: #eeeeee;");
    }
  });
  test("mails with their own colours keep them in both themes", () => {
    for (const dark of [true, false]) {
      expect(bodyRule(build('<p style="color:#123456">Own</p>', undefined, dark))).not.toContain("color:");
    }
  });
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

test("the preview document styles alt text that replaces a failed image", () => {
  const doc = buildPreviewDocument({ html: "<img alt=\"Logo\" src=\"https://images.example.test/logo.png\">", safeHtml: "<img alt=\"Logo\" src=\"https://images.example.test/logo.png\">", darkMode: false, fontScale: 1, zoom: 1, showViewerFrame: false, token: "t", remoteContent: "allow" });
  expect(doc).toContain(".noctua-image-alt { opacity: 0.7; }");
});
