import { describe, expect, test } from "bun:test";
import { germanSpellingVariants, MAX_SEARCH_SPELLING_VARIANTS, searchTokenSpellings } from "./searchSpellingVariants";

describe("germanSpellingVariants", () => {
  test("ß ⇄ ss", () => {
    expect(germanSpellingVariants("strasse")).toEqual(["straße"]);
    expect(germanSpellingVariants("Straße")).toEqual(["strasse"]);
    expect(germanSpellingVariants("STRASSE")).toEqual(["straße"]);
    expect(germanSpellingVariants("Fuß")).toEqual(["fuss"]);
    expect(germanSpellingVariants("ẞ")).toEqual(["ss"]);
    // Non-overlapping pairs, left to right: both pairs of "Schlossstrasse".
    expect(germanSpellingVariants("Schlossstrasse")).toEqual(["schloßstrasse", "schlossstraße", "schloßstraße"]);
  });

  test("umlaut ⇄ ae/oe/ue", () => {
    expect(germanSpellingVariants("Köln")).toEqual(["koeln"]);
    expect(germanSpellingVariants("koeln")).toEqual(["köln"]);
    expect(germanSpellingVariants("Grüße")).toEqual(["grueße", "grüsse", "gruesse"]);
    expect(germanSpellingVariants("gruesse")).toEqual(["grüsse", "grueße", "grüße"]);
    expect(germanSpellingVariants("uebermass")).toEqual(["übermass", "uebermaß", "übermaß"]);
    expect(germanSpellingVariants("müller@example.test")).toEqual(["mueller@example.test"]);
  });

  test("a plain vowel is never read as a transliteration", () => {
    expect(germanSpellingVariants("grusse")).toEqual(["gruße"]);
    expect(germanSpellingVariants("ubermass")).toEqual(["ubermaß"]);
  });

  test("diphthongs, qu and word-final digraphs are not expanded", () => {
    for (const token of ["neue", "neuen", "Bauer", "Steuer", "Quelle", "Frequenz", "Joe", "Sue", "blue", "Menue"]) {
      expect(germanSpellingVariants(token)).toEqual([]);
    }
  });

  test("tokens without a site, ë and FTS5 keywords keep no variants", () => {
    for (const token of ["needle", "NOT", "AND", "budget-2026", "Noël", "stra", "123", "中文"]) {
      expect(germanSpellingVariants(token)).toEqual([]);
      expect(searchTokenSpellings(token)).toEqual([token]);
    }
  });

  test("NFD input is normalized", () => {
    expect(germanSpellingVariants("Köln")).toEqual(["koeln"]);
  });

  test("token as typed comes first and is never repeated", () => {
    expect(searchTokenSpellings("STRASSE")).toEqual(["STRASSE", "straße"]);
    expect(searchTokenSpellings("straße")).toEqual(["straße", "strasse"]);
  });

  test("up to three sites keep every combination", () => {
    const variants = germanSpellingVariants("Größenänderung");
    expect(variants).toHaveLength(MAX_SEARCH_SPELLING_VARIANTS - 1);
    expect(variants).toContain("groessenaenderung");
    expect(variants).toContain("grössenänderung");
  });

  test("more than three sites keep only the consistent spellings", () => {
    expect(germanSpellingVariants("Fußgängerübergänge")).toEqual([
      "fußgaengeruebergaenge",
      "fussgängerübergänge",
      "fussgaengeruebergaenge"
    ]);
    expect(germanSpellingVariants("fussgaengeruebergaenge")).toEqual([
      "fußgängerübergänge",
      "fußgaengeruebergaenge",
      "fussgängerübergänge"
    ]);
  });

  test("never more than the cap, also for long site-heavy tokens", () => {
    for (const token of ["ßßßßßßßß", "äöüäöüäöü", "Schlossstraßenübergängeßüß", "aeoeueaeoeue-x", "ssssssssssss"]) {
      expect(searchTokenSpellings(token).length).toBeLessThanOrEqual(MAX_SEARCH_SPELLING_VARIANTS);
    }
  });
});
