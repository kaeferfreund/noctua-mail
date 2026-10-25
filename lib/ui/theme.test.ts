import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { APP_BAR_COLORS, APP_BAR_TOKEN, cssColorToHex } from "./theme";

const globals = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
/** The first declaration of `token` in the first block opened by `selector`. */
function tokenIn(selector: string, token: string) {
  const block = globals.slice(globals.indexOf(`${selector} {`));
  return new RegExp(`${token}:\\s*([^;]+);`).exec(block.slice(0, block.indexOf("}")))?.[1].trim();
}

describe("theme-color", () => {
  test("the static fallbacks are the top bar token of each theme, as hex", () => {
    expect(cssColorToHex(tokenIn(":root", APP_BAR_TOKEN)!)).toBe(APP_BAR_COLORS.light);
    expect(cssColorToHex(tokenIn(".dark", APP_BAR_TOKEN)!)).toBe(APP_BAR_COLORS.dark);
  });

  test("converts the colour forms of the tokens to hex", () => {
    expect(cssColorToHex("#fff")).toBe("#ffffff");
    expect(cssColorToHex(" #F9F9F9 ")).toBe("#f9f9f9");
    expect(cssColorToHex("rgb(25, 25, 25)")).toBe("#191919");
    expect(cssColorToHex("oklch(0.145 0 0)")).toBe("#0a0a0a");
    expect(cssColorToHex("oklch(0.205 0 0)")).toBe("#171717");
    expect(cssColorToHex("oklch(100% 0 0)")).toBe("#ffffff");
    // Chromatic: CSS red is oklch(62.8% 0.2577 29.23).
    expect(cssColorToHex("oklch(62.8% 0.2577 29.23)")).toBe("#ff0000");
    expect(cssColorToHex("var(--gray-2)")).toBeNull();
  });
});
