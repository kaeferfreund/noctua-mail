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
    expect(sanitizeCssColorValue("hsl(120deg, 50%, 50%)")).toBe("hsl(120deg, 50%, 50%)");
  });

  test("rejects transparent, malformed and CSS-injection values", () => {
    expect(sanitizeCssColorValue("transparent")).toBeNull();
    expect(sanitizeCssColorValue("inherit")).toBeNull();
    expect(sanitizeCssColorValue("#00000000")).toBeNull();
    expect(sanitizeCssColorValue("#fff0")).toBeNull();
    expect(sanitizeCssColorValue("rgba(0, 0, 0, 0)")).toBeNull();
    expect(sanitizeCssColorValue("rgba(255, 255, 255, 0.08)")).toBeNull();
    expect(sanitizeCssColorValue("rgb(1,2,3//)")).toBeNull();
    expect(sanitizeCssColorValue("rgb(1.2.3, 4, 5)")).toBeNull();
    expect(sanitizeCssColorValue("hsl(120, 50, 50)")).toBeNull();
    expect(sanitizeCssColorValue("white; } body { color: red")).toBeNull();
    expect(sanitizeCssColorValue("url(https://tracker.example.test/x.png)")).toBeNull();
  });
});

describe("parseColorLuminance and isDarkColor", () => {
  test("classifies dark and light colours across formats and CSS angle units", () => {
    expect(parseColorLuminance("#000000")).toBe(0);
    expect(parseColorLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(parseColorLuminance("transparent")).toBeNull();
    expect(parseColorLuminance("#ffffff00")).toBeNull();
    expect(parseColorLuminance("rgb(0 0 0 / 0%)")).toBeNull();
    // 0.5turn == 180deg (cyan), luminance ~0.787 (not red ~0.213).
    expect(parseColorLuminance("hsl(0.5turn 100% 50%)")).toBeGreaterThan(0.7);
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

  test("maps html, :root and body selectors in-place with zero-specificity :where", () => {
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
    expect(dark.hasDarkRootBackgroundOverride).toBe(true);
    expect(dark.hasAnyLightMediaQuery).toBe(false);
    expect(dark.css).not.toContain("prefers-color-scheme");
    expect(dark.css).toContain(':root:where([data-theme="dark"]) { --surface: #111111; }');
    expect(dark.css).not.toContain('html[data-theme="dark"] html');
    expect(dark.css).not.toContain('html[data-theme="dark"] :root');
    expect(dark.css).toContain(
      'html:where([data-theme="dark"]), :where(html[data-theme="dark"]) body, :where(html[data-theme="dark"]) .noctua-email-content { background-color: #111111 !important; }'
    );
    expect(dark.css).toContain(
      ':where(html[data-theme="dark"]) body.mail-body, :where(html[data-theme="dark"]) .noctua-email-content.mail-body'
    );
    expect(dark.css).toContain(
      ':where(html[data-theme="dark"]) body > table, :where(html[data-theme="dark"]) .noctua-email-content > table'
    );
    expect(dark.css).toContain(':where(html[data-theme="dark"]) tbody td');
    expect(dark.css).not.toContain("t.noctua-email-content");

    const light = rewriteEmailStylesForTheme(css, "light", contentClass);
    expect(light.css).not.toContain("#111111");
  });

  test("handles minified prefers-color-scheme without whitespace", () => {
    const css = "@media (prefers-color-scheme:dark){.card{background:#121212;color:#f5f5f5}}";
    const dark = rewriteEmailStylesForTheme(css, "dark", contentClass);
    expect(dark.hasDarkSchemeRules).toBe(true);
    expect(dark.css).toContain(':where(html[data-theme="dark"]) .card');
    expect(dark.css).toContain("background:#121212");
  });

  test("preserves sibling media features and enclosing @media/@supports/@layer wrappers", () => {
    const combined = `
      @media screen and (prefers-color-scheme: dark) and (max-width: 600px) {
        .card { background: #181818; }
      }
    `;
    const darkCombined = rewriteEmailStylesForTheme(combined, "dark", contentClass);
    // Width-constrained dark rules do not count as unconditional desktop dark support.
    expect(darkCombined.hasDarkSchemeRules).toBe(false);
    expect(darkCombined.css).toMatch(/@media screen and \(max-width: 600px\)/);
    expect(darkCombined.css).toContain(':where(html[data-theme="dark"]) .card');

    const nested = `
      @media (max-width: 600px) {
        @media (prefers-color-scheme: dark) {
          .desktop { display: none; color: #fff; }
        }
      }
    `;
    const darkNested = rewriteEmailStylesForTheme(nested, "dark", contentClass);
    expect(darkNested.hasDarkSchemeRules).toBe(false);
    expect(darkNested.css).toMatch(/@media \(max-width: 600px\)[\s\S]*:where\(html\[data-theme="dark"\]\) \.desktop/);
    const lightNested = rewriteEmailStylesForTheme(nested, "light", contentClass);
    expect(lightNested.css.trim()).toBe("");
  });

  test("evaluates negated and Level 4 `or` media queries accurately", () => {
    const negated = "@media not all and (prefers-color-scheme: dark) { .light-only { color: #111; } }";
    const light = rewriteEmailStylesForTheme(negated, "light", contentClass);
    expect(light.css).not.toContain("not all");
    expect(light.css).toContain(':where(html[data-theme="light"]) .light-only');
    const dark = rewriteEmailStylesForTheme(negated, "dark", contentClass);
    expect(dark.hasDarkSchemeRules).toBe(false);
    expect(dark.hasAnyLightMediaQuery).toBe(true);
    expect(dark.css.trim()).toBe("");

    const orQuery = "@media (prefers-color-scheme: dark) or (max-width: 600px) { .m { color: #eee; } }";
    const orLight = rewriteEmailStylesForTheme(orQuery, "light", contentClass);
    expect(orLight.css).toContain("@media (max-width: 600px)");
    expect(orLight.css).toContain(':where(html[data-theme="light"]) .m');
    const orDark = rewriteEmailStylesForTheme(orQuery, "dark", contentClass);
    expect(orDark.css).not.toContain("@media");
    expect(orDark.css).toContain(':where(html[data-theme="dark"]) .m');
  });

  test("preserves cascade source order, blockless @layer semicolons and CSS nesting", () => {
    const cascade = `
      @media (prefers-color-scheme: dark) {
        @layer a, b;
        .notice { color: white; }
        .card { background: #111; & .title { color: #fff; } }
      }
      .notice { background: white; color: black; }
    `;
    const dark = rewriteEmailStylesForTheme(cascade, "dark", contentClass);
    expect(dark.css).toContain("@layer a, b;");
    expect(dark.css.indexOf(':where(html[data-theme="dark"]) .notice')).toBeLessThan(
      dark.css.indexOf(".notice { background: white; color: black; }")
    );
    expect(dark.css).toContain("& .title");
    expect(dark.css).not.toContain(':where(html[data-theme="dark"]) & .title');
  });

  test("ignores non-color/print/border-only dark blocks when flagging full dark support", () => {
    const empty = rewriteEmailStylesForTheme("@media (prefers-color-scheme: dark) {}", "dark", contentClass);
    expect(empty.hasDarkSchemeRules).toBe(false);

    const filterOnly = rewriteEmailStylesForTheme(
      "@media (prefers-color-scheme: dark) { img { filter: brightness(0.8); } .logo { border-color: #555; } }",
      "dark",
      contentClass
    );
    expect(filterOnly.hasDarkSchemeRules).toBe(false);

    const printDark = rewriteEmailStylesForTheme(
      "@media print and (prefers-color-scheme: dark) { body { background: #111; color: #fff; } }",
      "dark",
      contentClass
    );
    expect(printDark.hasDarkSchemeRules).toBe(false);
  });

  test("mirrors qualified body selectors in base stylesheets without altering plain body rules", () => {
    const css = "body { font-family: Georgia, serif; } body.dark-theme { background: #111; color: #fff; }";
    const out = rewriteEmailStylesForTheme(css, "light", contentClass);
    expect(out.css).toContain("body { font-family: Georgia, serif; }");
    expect(out.css).toContain("body.dark-theme, .noctua-email-content.dark-theme");
  });
});

describe("analyzeEmailColorScheme", () => {
  test("ignores prose, comments, data-* attributes, URL query params and @media print", () => {
    const clean = analyzeEmailColorScheme(
      [
        "<!-- <table bgcolor=\"#ffffff\"><tr><td style=\"color:#000\">hidden</td></tr></table> -->",
        "<style>@media print { * { color: #000 !important; background: #fff !important; } }</style>",
        '<div data-bgcolor="#ffffff" data-background="hero.png" style="background: var(--bg-white)">',
        '<p>Color: #000000 and Background: #ffffff. <a href="https://example.test/?background=1">Link</a></p>',
        "</div>"
      ].join("")
    );
    expect(clean.hasLightOwnBackground).toBe(false);
    expect(clean.hasDarkOwnBackground).toBe(false);
    expect(clean.hasDarkOwnText).toBe(false);
  });

  test("resolves base CSS custom properties and ignores descendant anchor-only rules", () => {
    const withVars = analyzeEmailColorScheme(
      "<style>:root { --paper: #ffffff; --ink: #111111; } .card { background: var(--paper); color: var(--ink); }</style><div class=\"card\">Invoice</div>"
    );
    expect(withVars.hasLightOwnBackground).toBe(true);
    expect(withVars.hasDarkOwnText).toBe(true);

    const linkOnly = analyzeEmailColorScheme(
      "<style>#wrap a, .footer > a:visited { color: #0066cc; }</style><p>Plain</p>"
    );
    expect(linkOnly.hasExplicitColor).toBe(true);
    expect(linkOnly.hasDarkOwnText).toBe(false);
  });

  test("scans malformed unclosed tags in linear time without catastrophic backtracking", () => {
    const malformed = '<div title="' + "a".repeat(2000) + "<div title=\"".repeat(100);
    const start = performance.now();
    analyzeEmailColorScheme(malformed);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
