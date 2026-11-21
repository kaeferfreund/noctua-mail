import { describe, expect, test } from "bun:test";
import { buildPreviewDocument } from "./HtmlMessage";
import { extractBodyContent, type HtmlColorSchemeOverride } from "@/lib/html";
import { APP_FONT_STACK } from "@/lib/ui/fonts";

const build = (
  html: string,
  hostViewportHeight?: number,
  darkMode = false,
  colorSchemeOverride: HtmlColorSchemeOverride = "auto"
) => buildPreviewDocument({
  html, safeHtml: html, darkMode, colorSchemeOverride, fontScale: 1, zoom: 1,
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
  test("mails with dark text and no dark-mode styles get a light paper canvas in dark mode", () => {
    const output = build('<div style="color:#242424"><p>Invoice #1042</p><a href="https://example.test">Open</a></div>', undefined, true);
    expect(output).toContain('data-theme="light"');
    expect(output).toContain("color-scheme: light;");
    expect(bodyRule(output)).toContain("background: #ffffff;");
    expect(output).toContain("a { color: #1847d5; }");
  });
  test("dark-mode-aware mails with white inline body background override .noctua-email-content in dark mode", () => {
    const html = [
      "<html><head><style>",
      "@media (prefers-color-scheme: dark) {",
      "  html, body { background-color: #111111 !important; }",
      "  body, p, td { color: #ededed !important; }",
      "}",
      "</style></head>",
      '<body style="background-color:rgb(255,255,255);color:rgb(23,23,23)"><p>Usage summary</p></body></html>'
    ].join("\n");
    const dark = build(html, undefined, true);
    expect(dark).toContain('data-theme="dark"');
    expect(dark).toContain(
      'html[data-theme="dark"], html[data-theme="dark"] body, html[data-theme="dark"] .noctua-email-content { background-color: #111111 !important; }'
    );
    expect(dark).not.toContain('html[data-theme="dark"] html');

    const light = build(html, undefined, false);
    expect(light).toContain('data-theme="light"');
    expect(light).not.toContain("#111111");
  });
  test("minified prefers-color-scheme:dark without space is preserved in dark mode", () => {
    const html = '<style>@media (prefers-color-scheme:dark){body{background:#121212!important;color:#fff!important}}</style><body style="background:#fff;color:#111"><p>Hi</p></body>';
    const dark = build(html, undefined, true);
    expect(dark).toContain('data-theme="dark"');
    expect(dark).toContain('html[data-theme="dark"] .noctua-email-content');
    expect(dark).toContain("background:#121212!important");
  });
  test("preserves dark body bgcolor in light mode so light text stays readable", () => {
    const html = '<body bgcolor="#000000"><p style="color:#ffffff">Dark newsletter</p></body>';
    const light = build(html, undefined, false);
    expect(bodyRule(light)).toContain("background: #000000;");
  });
  test("honours per-message light and dark appearance overrides", () => {
    const html = [
      "<style>@media (prefers-color-scheme: dark) { body { background: #111 !important; color: #eee !important; } }</style>",
      '<body style="background:#fff;color:#111"><p>Summary</p></body>'
    ].join("");
    const forcedLightInDarkApp = build(html, undefined, true, "light");
    expect(forcedLightInDarkApp).toContain('data-theme="light"');
    expect(bodyRule(forcedLightInDarkApp)).toContain("background: #ffffff;");
    expect(forcedLightInDarkApp).not.toContain("background: #111");

    const forcedDarkInLightApp = build("<p>Plain</p>", undefined, false, "dark");
    expect(forcedDarkInLightApp).toContain('data-theme="dark"');
    expect(bodyRule(forcedDarkInLightApp)).toContain("background: #171717;");
    expect(bodyRule(forcedDarkInLightApp)).toContain("color: #eeeeee;");
  });
});

describe("HTML preview document font", () => {
  // The app font sits on <html>; the content div only inherits, so a body rule
  // in the mail's own <style> (emitted after the host styles) still wins.
  test("sets the app font on the root and lets mail styles override it", () => {
    const output = build("<html><head><style>body { font-family: Georgia, serif; }</style></head><body><p>Text</p></body></html>");
    expect(output.match(/\nhtml \{[^}]*\}/)?.[0]).toContain(`font-family: ${APP_FONT_STACK};`);
    expect(output.match(/\n\.noctua-email-content \{[^}]*\}/)?.[0]).not.toContain("font-family");
    expect(output.indexOf("body { font-family: Georgia")).toBeGreaterThan(output.indexOf(`font-family: ${APP_FONT_STACK}`));
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
