import { describe, expect, test } from "bun:test";
import { acceptLanguageLocale, resolveLocale } from "./resolveLocale";

describe("locale resolution", () => {
  test("prefers a validated personal preference over device and header", () => {
    expect(resolveLocale({ uiLocale: "de", cookie: "en", acceptLanguage: "en" })).toBe("de");
    expect(resolveLocale({ uiLocale: "en", cookie: "de", acceptLanguage: "de" })).toBe("en");
  });
  test("automatic/null uses device, then Accept-Language, then German", () => {
    expect(resolveLocale({ uiLocale: null, cookie: "en", acceptLanguage: "de" })).toBe("en");
    expect(resolveLocale({ uiLocale: null, acceptLanguage: "en-US" })).toBe("en");
    expect(resolveLocale({})).toBe("de");
  });
  test("invalid preferences/cookies cannot become locale names or import paths", () => {
    for (const cookie of ["fr", "EN", "en-US", "../en", "", {}, null]) {
      expect(resolveLocale({ uiLocale: "invalid", cookie, acceptLanguage: "en" })).toBe("en");
    }
  });
  test.each([
    ["de-AT", "de"], ["en-US", "en"], ["fr, en-GB;q=0.8, de;q=0.2", "en"],
    ["de;q=0.2,en;q=0.9", "en"], ["en;q=0.2,de;q=0.9", "de"],
    ["en;q=0,de;q=0.1", "de"], ["de;q=0,en;q=0.5", "en"],
    ["en;q=0.8,de;q=0.8", "en"], ["de;q=0.8,en;q=0.8", "de"],
    ["DE-at;q=0.7,EN-us;q=0.9", "en"], ["*,fr", "de"],
    ["en;q=garbage,de;q=0.8", "de"], ["en;q=1.2", "de"],
    ["en;q=-1", "de"], ["en;q=0.000", "de"], ["en-;q=1", "de"],
    ["en ; q=1.0, de;q=0.5", "en"],
    ["en\t;\tq=1.0, de;q=0.5", "en"],
    [" \tEN-us \t; \tq \t= \t0.9 \t, de;q=0.5", "en"],
    ["* ; q=1.0, en ; q=0.8, de;q=0.5", "en"],
    ["*\t;\tQ = 1.0", "de"],
    ["en ; Q = 1.0, de;q=0.5", "en"],
    ["en ; q = nope, de;q=0.5", "de"],
    ["en ; q = 0.1234, de;q=0.1", "de"],
    ["en ; q=1=bad, de;q=0.5", "de"],
    ["en ; q=1;q=0.5, de;q=0.5", "de"],
    ["en ; invalid, de;q=0.5", "de"],
    ["en ; q=1;, de;q=0.5", "de"]
  ] as const)("parses %s as %s", (header, expected) => {
    expect(acceptLanguageLocale(header)).toBe(expected);
  });
});
