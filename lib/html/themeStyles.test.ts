import { describe, expect, test } from "bun:test";
import {
  analyzeEmailColorScheme,
  isDarkColor,
  parseColorLuminance,
  rewriteEmailStylesForTheme,
  sanitizeCssColorValue
} from "./themeStyles";

describe("sanitizeCssColorValue", () => {
  test("normalises valid hex, named and functional colours", () => {
    expect(sanitizeCssColorValue("#FFF")).toBe("#fff");
    expect(sanitizeCssColorValue("000000")).toBe("#000000");
    expect(sanitizeCssColorValue("  White  !important")).toBe("white");
    expect(sanitizeCssColorValue("rgb(17, 17, 17)")).toBe("rgb(17, 17, 17)");
    expect(sanitizeCssColorValue("rgba(255, 255, 255, 0.9)")).toBe("rgba(255, 255, 255, 0.9)");
  });

  test("rejects transparent keywords and CSS injection attempts", () => {
    expect(sanitizeCssColorValue("transparent")).toBeNull();
    expect(sanitizeCssColorValue("inherit")).toBeNull();
    expect(sanitizeCssColorValue("white; } body { color: red")).toBeNull();
    expect(sanitizeCssColorValue("url(https://tracker.example.test/x.png)")).toBeNull();
    expect(sanitizeCssColorValue("rgba(0, 0, 0, 0)")).toBeNull();
  });
});

describe("parseColorLuminance and isDarkColor", () => {
  test("classifies dark and light colours across formats", () => {
    expect(parseColorLuminance("#000000")).toBe(0);
    expect(parseColorLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(parseColorLuminance("transparent")).toBeNull();
    expect(parseColorLuminance("#ffffff00")).toBeNull();
    expect(parseColorLuminance("rgb(0 0 0 / 0%)")).toBeNull();
    expect(isDarkColor("#111111")).toBe(true);
    expect(isDarkColor("#333")).toBe(true);
    expect(isDarkColor("rgb(23, 23, 23)")).toBe(true);
    expect(isDarkColor("hsl(220, 50%, 15%)")).toBe(true);
    expect(isDarkColor("navy")).toBe(true);
    expect(isDarkColor("#ffffff")).toBe(false);
    expect(isDarkColor("whitesmoke")).toBe(false);
    expect(isDarkColor("rgb(250, 250, 250)")).toBe(false);
  });
});

describe("rewriteEmailStylesForTheme", () => {
  const contentClass = "noctua-email-content";

  test("maps html, :root and body selectors cleanly inside prefers-color-scheme", () => {
    const css = `
      @media (prefers-color-scheme: dark) {
        /* Base */
        :root { --surface: #111111; }
        html, body { background-color: #111111 !important; }
        body, p, td { color: #ededed !important; }
        body.mail-body { background-color: #0d0d0d !important; }
        body > table { background-color: #111111 !important; }
        tbody td { border-color: #333333 !important; }
      }
    `;
    const dark = rewriteEmailStylesForTheme(css, "dark", contentClass);
    expect(dark.hasDarkSchemeRules).toBe(true);
    expect(dark.hasLightSchemeRules).toBe(false);
    expect(dark.baseCss).not.toContain("prefers-color-scheme");
    expect(dark.themeCss).toContain('html[data-theme="dark"] { --surface: #111111; }');
    expect(dark.themeCss).not.toContain('html[data-theme="dark"] html');
    expect(dark.themeCss).not.toContain('html[data-theme="dark"] :root');
    expect(dark.themeCss).toContain(
      'html[data-theme="dark"], html[data-theme="dark"] body, html[data-theme="dark"] .noctua-email-content { background-color: #111111 !important; }'
    );
    expect(dark.themeCss).toContain(
      'html[data-theme="dark"] body.mail-body, html[data-theme="dark"] .noctua-email-content.mail-body'
    );
    expect(dark.themeCss).toContain(
      'html[data-theme="dark"] body > table, html[data-theme="dark"] .noctua-email-content > table'
    );
    // `tbody` must not be mistaken for `body`.
    expect(dark.themeCss).toContain('html[data-theme="dark"] tbody td');
    expect(dark.themeCss).not.toContain("t.noctua-email-content");

    const light = rewriteEmailStylesForTheme(css, "light", contentClass);
    expect(light.hasDarkSchemeRules).toBe(true);
    expect(light.themeCss).toBe("");
    expect(light.baseCss).not.toContain("#111111");
  });

  test("handles minified prefers-color-scheme without whitespace", () => {
    const css = "@media (prefers-color-scheme:dark){.card{background:#121212;color:#f5f5f5}}";
    const dark = rewriteEmailStylesForTheme(css, "dark", contentClass);
    expect(dark.hasDarkSchemeRules).toBe(true);
    expect(dark.themeCss).toContain('html[data-theme="dark"] .card');
    expect(dark.themeCss).toContain("background:#121212");
  });

  test("preserves sibling media features in combined prefers-color-scheme queries", () => {
    const css = `
      @media screen and (prefers-color-scheme: dark) and (max-width: 600px) {
        .card { background: #181818; }
      }
    `;
    const dark = rewriteEmailStylesForTheme(css, "dark", contentClass);
    expect(dark.hasDarkSchemeRules).toBe(true);
    expect(dark.themeCss).toMatch(/@media screen and \(max-width: 600px\)/);
    expect(dark.themeCss).toContain('html[data-theme="dark"] .card');

    const light = rewriteEmailStylesForTheme(css, "light", contentClass);
    expect(light.themeCss).toBe("");
    expect(light.baseCss).not.toContain("#181818");
  });

  test("ignores empty or non-visual prefers-color-scheme blocks when flagging dark support", () => {
    const empty = rewriteEmailStylesForTheme("@media (prefers-color-scheme: dark) {}", "dark", contentClass);
    expect(empty.hasDarkSchemeRules).toBe(false);

    const layoutOnly = rewriteEmailStylesForTheme(
      "@media (prefers-color-scheme: dark) { .only-dark { display: block; } }",
      "dark",
      contentClass
    );
    expect(layoutOnly.hasDarkSchemeRules).toBe(false);
    expect(layoutOnly.themeCss).toContain('html[data-theme="dark"] .only-dark');
  });

  test("mirrors qualified body selectors in base stylesheets without altering plain body rules", () => {
    const css = "body { font-family: Georgia, serif; } body.dark-theme { background: #111; color: #fff; }";
    const out = rewriteEmailStylesForTheme(css, "light", contentClass);
    expect(out.baseCss).toContain("body { font-family: Georgia, serif; }");
    expect(out.baseCss).toContain("body.dark-theme, .noctua-email-content.dark-theme");
  });
});

describe("analyzeEmailColorScheme", () => {
  test("ignores prose and prefers-color-scheme blocks while detecting base colours", () => {
    const proseOnly = analyzeEmailColorScheme(
      "<p>Color: #000000 and Background: #ffffff in prose text.</p>"
    );
    expect(proseOnly).toEqual({
      hasExplicitColor: false,
      hasLightOwnBackground: false,
      hasDarkOwnBackground: false,
      hasDarkOwnText: false
    });

    const darkTextNoBg = analyzeEmailColorScheme(
      '<div style="color: #242424">Invoice body</div>'
    );
    expect(darkTextNoBg.hasExplicitColor).toBe(true);
    expect(darkTextNoBg.hasDarkOwnText).toBe(true);
    expect(darkTextNoBg.hasLightOwnBackground).toBe(false);
    expect(darkTextNoBg.hasDarkOwnBackground).toBe(false);

    // A single coloured link does not flag the body as dark-text-only.
    const linkOnly = analyzeEmailColorScheme(
      '<p>Hello <a href="https://example.test" style="color:#0066cc">link</a></p>'
    );
    expect(linkOnly.hasExplicitColor).toBe(true);
    expect(linkOnly.hasDarkOwnText).toBe(false);
  });
});
