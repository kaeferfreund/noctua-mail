import { describe, expect, it } from "bun:test";
import { parse } from "@formatjs/icu-messageformat-parser";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

function leaves(value: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof item === "string") return [[path, item]];
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Invalid catalog entry: ${path}`);
    return Object.entries(leaves(item as Record<string, unknown>, path));
  }));
}

describe("message catalogs", () => {
  it("has identical German and English message keys", () => {
    expect(Object.keys(leaves(de)).sort()).toEqual(Object.keys(leaves(en)).sort());
  });
  for (const [locale, messages] of Object.entries({de, en})) {
    it(`${locale} contains valid ICU messages`, () => {
      for (const [key, message] of Object.entries(leaves(messages))) {
        expect(() => parse(message), `${locale}.${key}`).not.toThrow();
      }
    });
  }
});
