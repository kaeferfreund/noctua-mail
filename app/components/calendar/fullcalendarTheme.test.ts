import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import postcss from "postcss";

// FullCalendar's classic palette switches to dark values only under its own
// [data-color-scheme=dark] (the colorScheme option), which the app does not
// set. Noctua follows .dark instead, so every variable that block changes has
// to be mapped in .fc onto a token that flips with the app theme.
const require = createRequire(import.meta.url);
const palette = postcss.parse(readFileSync(require.resolve("@fullcalendar/react/themes/classic/palette.css"), "utf8"));
const theme = postcss.parse(readFileSync(new URL("./fullcalendar-theme.css", import.meta.url), "utf8"));

function declarations(root: postcss.Root, selector: string) {
  const found = new Map<string, string>();
  root.walkRules(rule => {
    if (rule.selectors.includes(selector)) rule.walkDecls(/^--/, decl => { found.set(decl.prop, decl.value); });
  });
  return found;
}

describe("FullCalendar dark mode mapping", () => {
  it("maps every variable the classic palette darkens onto a theme token", () => {
    const darkened = [...declarations(palette, "[data-color-scheme=dark]").keys()];
    expect(darkened).toContain("--fc-classic-strong");
    const mapped = declarations(theme, ".fc");
    const darkOverrides = declarations(theme, ".dark .fc");
    const unmapped = darkened.filter(name => !mapped.get(name)?.includes("var(--") && !darkOverrides.has(name));
    expect(unmapped).toEqual([]);
  });

  it("keeps button hover, pressed and outline colours on theme tokens", () => {
    const mapped = declarations(theme, ".fc");
    for (const name of ["--fc-classic-button-strong", "--fc-classic-button-strong-border", "--fc-classic-button-outline"]) {
      expect(mapped.get(name), name).toStartWith("var(--");
    }
  });
});
