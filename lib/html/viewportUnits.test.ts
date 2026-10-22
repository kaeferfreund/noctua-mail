// @ts-expect-error bun:test is provided by the runner and is absent from this tsconfig.
import { describe, expect, test } from "bun:test";
import { rewriteHtmlViewportHeightUnits, rewriteViewportHeightUnits, stripBodyHeightStyles } from "./viewportUnits";

describe("viewport height CSS lengths", () => {
  for (const unit of ["vh", "svh", "lvh", "dvh", "vb", "svb", "lvb", "dvb"]) {
    test(`freezes ${unit}`, () => {
      expect(rewriteViewportHeightUnits(`height:100${unit}!important`))
        .toBe("height:calc(100 * var(--noctua-vh))!important");
    });
  }
  for (const prefix of ["", "s", "l", "d"]) {
    for (const axis of ["min", "max"]) {
      test(`freezes ${prefix}v${axis}`, () => {
        expect(rewriteViewportHeightUnits(`padding:2${prefix}v${axis}`))
          .toBe(`padding:calc(2 * ${axis}(var(--noctua-vh), 1vw))`);
      });
    }
  }
  test("handles signed decimals, uppercase, exponents and nested calc", () => {
    expect(rewriteViewportHeightUnits("margin:calc(-.5VH + 12.25dVh + +2vb + 1e2vh)"))
      .toBe("margin:calc(calc(-.5 * var(--noctua-vh)) + calc(12.25 * var(--noctua-vh)) + calc(+2 * var(--noctua-vh)) + calc(1e2 * var(--noctua-vh)))");
  });
  test("preserves width units, identifiers, URLs, strings, comments and other units", () => {
    const css = `.h-100vh,#a100vh{--a100vh:100vw;width:50vi;size:10svw;content:"100vh";other:'2vh';background:url(a100vh.png);mask:URL("100vh.svg");padding:100vhx;/* 100vh */}`;
    expect(rewriteViewportHeightUnits(css)).toBe(css);
  });
  test("preserves escaped identifiers and hash names", () => {
    const css = String.raw`.\31 00vh,#100vh{--\31 00vh:1px;height:100vh;custom:100vh\78}`;
    expect(rewriteViewportHeightUnits(css)).toBe(css.replace("height:100vh", "height:calc(100 * var(--noctua-vh))"));
  });
  test("keeps escaped strings and URLs intact", () => {
    const css = String.raw`content:"a\"100vh";background:url(a\)100vh.png);height:2vh`;
    expect(rewriteViewportHeightUnits(css)).toBe(css.replace("height:2vh", "height:calc(2 * var(--noctua-vh))"));
  });
});

describe("HTML CSS boundaries", () => {
  test("rewrites style blocks and style attributes only", () => {
    const html = `<style>.h-100vh{height:100vh}</style><div class="h-100vh" data-style='style="100vh"' title="100vh" style="padding:.5VH" data-height="100vh">100vh <a href="100vh.html">text</a></div><!-- <p style="height:100vh"> -->`;
    expect(rewriteHtmlViewportHeightUnits(html)).toBe(html
      .replace("height:100vh}", "height:calc(100 * var(--noctua-vh))}")
      .replace("padding:.5VH", "padding:calc(.5 * var(--noctua-vh))"));
  });
  test("respects HTML-encoded CSS strings while rewriting adjacent lengths", () => {
    expect(rewriteHtmlViewportHeightUnits('<p style="content:&quot;100vh&quot;;height:2vh">100vh</p>'))
      .toBe('<p style="content:&quot;100vh&quot;;height:calc(2 * var(--noctua-vh))">100vh</p>');
  });
  test("handles single quotes, unquoted attributes, spacing and > inside an attribute", () => {
    expect(rewriteHtmlViewportHeightUnits(`<div title=">" STYLE = 'height:2vh' /><p style=height:3vh>100vh</p>`))
      .toBe(`<div title=">" STYLE = 'height:calc(2 * var(--noctua-vh))' /><p style="height:calc(3 * var(--noctua-vh))">100vh</p>`);
  });
});

describe("body height declarations", () => {
  test("removes all three height constraints, including important and duplicates", () => {
    expect(stripBodyHeightStyles("HEIGHT:100vh!important;min-height:90%;max-height:40px !important;height:20px;padding:8px;color:red"))
      .toBe("padding:8px;color:red");
  });
  test("handles nested functions without losing adjacent declarations", () => {
    expect(stripBodyHeightStyles('height:calc(100vh + var(--extra, calc(2px + 1px)));padding:calc(1px + var(--x, calc(2px)));'))
      .toBe('padding:calc(1px + var(--x, calc(2px)));');
  });
  test("preserves other properties, custom properties and semicolons in values", () => {
    const css = `line-height:2;--height:100px;background:url('height:2;min-height:3');content:"height:4;";`;
    expect(stripBodyHeightStyles(`${css}/*mail*/ max-height:1px`)).toBe(css);
  });
});
