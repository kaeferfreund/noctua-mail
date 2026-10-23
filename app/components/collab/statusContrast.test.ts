import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { STATUS_STYLES } from "./types";

function luminance(hex: string) {
  const linear = [1, 3, 5].map(index => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
// Read the actual installed Radix Themes sRGB tokens rather than duplicating
// palette values here. This also catches palette changes on dependency upgrades.
function resolveToken(value: string, dark: boolean) {
  const [, palette, shade] = value.match(/^var\(--([a-z]+)-(\d+)\)$/)!;
  const source = readFileSync(new URL(`../../../node_modules/@radix-ui/themes/tokens/colors/${palette}.css`, import.meta.url), "utf8");
  const css = dark ? source.slice(source.indexOf(".dark, .dark-theme {")) : source;
  const hex = css.match(new RegExp(`--${palette}-${shade}:\\s*(#[0-9a-f]{6});`))?.[1];
  if (!hex) throw new Error(`Missing Radix token: ${value}`);
  return luminance(hex);
}
describe("QA-010 status text contrast", () => {
  for (const dark of [false, true]) for (const [status, style] of Object.entries(STATUS_STYLES)) {
    it(`${status} meets 4.5:1 in ${dark ? 'dark' : 'light'}`, () => {
      const fg = resolveToken(style.color, dark), bg = resolveToken(style.background, dark);
      expect((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
