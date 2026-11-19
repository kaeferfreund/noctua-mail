import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Radix Themes paints a Select list above dialogs only as popper content (`.rt-PopperContent`, see
 * the layer rules in app/globals.css). The default item-aligned list opens behind a dialog and the
 * dropdown looks dead. Selects move between dialogs and pages, so every one uses the popper position.
 */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

test("every Radix Themes Select list is popper content", () => {
  const offenders = sources(join(import.meta.dir)).flatMap(file =>
    [...readFileSync(file, "utf8").matchAll(/<Select\.Content\b[^>]*>/g)]
      .filter(match => !/\bposition="popper"/.test(match[0]))
      .map(match => `${file.slice(import.meta.dir.length + 1)}: ${match[0]}`));
  expect(offenders).toEqual([]);
});
