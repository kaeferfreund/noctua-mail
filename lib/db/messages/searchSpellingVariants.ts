/**
 * German spelling variants for one free-text search token (QA-208).
 *
 * `message_fts_v3` uses FTS5's default `unicode61` tokenizer: case and
 * diacritics are folded (ü → u, ë → e), but ß is kept as ß and the ASCII
 * transliterations ae/oe/ue are indexed as written. So "strasse" misses
 * "Straße", and "uebermass" misses "Übermaß". Instead of changing the shard
 * format, each token is expanded into the spellings the index can hold and
 * the variants are ORed inside that token's group (tokens stay ANDed).
 *
 * Sites, scanned left to right without overlap on the NFC lower-case token:
 * - `ß` ⇄ `ss` (each `ss` pair once, so "schlossstrasse" has two sites);
 * - `ä`/`ö`/`ü` → `ae`/`oe`/`ue` (finds transliterated text; the umlaut
 *   itself already matches a/o/u via the index fold);
 * - `ae`/`oe`/`ue` → `ä`/`ö`/`ü` (finds umlaut text through the fold, and
 *   umlauts in attachment names, which `LIKE` does not fold) — only when a
 *   letter follows and no vowel (or, for `ue`, a `q`) precedes. That keeps
 *   the diphthongs ("neue", "Bauer", "Steuer"), "qu" ("Quelle") and
 *   word-final digraphs ("Joe", "Sue", "blue") from widening into a much
 *   broader prefix ("neuen" → "neun*", "joe" → "jo*").
 * A plain a/o/u is never expanded to ae/oe/ue: "ubermass" finds "Übermaß"
 * and "Übermass" but not text written "Uebermass".
 *
 * Bound: at most `MAX_SEARCH_SPELLING_VARIANTS` spellings per token,
 * including the token itself. Up to three sites (covers single words and
 * common compounds such as "Größenänderung") every per-site combination is
 * kept, so mixed spellings like "Schlossstraße" are found. Beyond that only
 * the consistent spellings are kept: all sharp-s sites as ß or as ss, times
 * all umlaut sites as umlaut or as digraph, plus the token as typed (≤ 5).
 */
export const MAX_SEARCH_SPELLING_VARIANTS = 8;

const UMLAUT_TO_DIGRAPH: Record<string, string> = { "ä": "ae", "ö": "oe", "ü": "ue" };
const DIGRAPH_TO_UMLAUT: Record<string, string> = { ae: "ä", oe: "ö", ue: "ü" };
const VOWELS = new Set(["a", "e", "i", "o", "u", "y", "ä", "ö", "ü"]);

type SpellingSite = {
  start: number;
  length: number;
  kind: "sharp" | "umlaut";
  /** `forms[0]` is the text as typed, `forms[1]` the alternative. */
  forms: [string, string];
};

function isLetter(char: string | undefined) {
  return char !== undefined && /\p{L}/u.test(char);
}

function findSpellingSites(text: string): SpellingSite[] {
  const sites: SpellingSite[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const pair = text.slice(index, index + 2);
    if (char === "ß") {
      sites.push({ start: index, length: 1, kind: "sharp", forms: ["ß", "ss"] });
      index += 1;
    } else if (pair === "ss") {
      sites.push({ start: index, length: 2, kind: "sharp", forms: ["ss", "ß"] });
      index += 2;
    } else if (UMLAUT_TO_DIGRAPH[char]) {
      sites.push({ start: index, length: 1, kind: "umlaut", forms: [char, UMLAUT_TO_DIGRAPH[char]] });
      index += 1;
    } else if (DIGRAPH_TO_UMLAUT[pair] && isTransliteratedDigraph(text, index)) {
      sites.push({ start: index, length: 2, kind: "umlaut", forms: [pair, DIGRAPH_TO_UMLAUT[pair]] });
      index += 2;
    } else {
      index += 1;
    }
  }
  return sites;
}

function isTransliteratedDigraph(text: string, index: number) {
  if (!isLetter(text[index + 2])) return false;
  const previous = index > 0 ? text[index - 1] : undefined;
  if (previous === undefined) return true;
  if (VOWELS.has(previous)) return false;
  return !(text[index] === "u" && previous === "q");
}

function spell(text: string, sites: SpellingSite[], pick: (site: SpellingSite, siteIndex: number) => string) {
  let result = "";
  let cursor = 0;
  sites.forEach((site, siteIndex) => {
    result += text.slice(cursor, site.start) + pick(site, siteIndex);
    cursor = site.start + site.length;
  });
  return result + text.slice(cursor);
}

/**
 * Spelling variants of `token`, not including the token itself (lower-case,
 * NFC). Empty when the token has no ß/ss/umlaut/digraph site, so other
 * tokens keep their exact previous query text.
 */
export function germanSpellingVariants(token: string): string[] {
  const text = token.normalize("NFC").toLowerCase();
  const sites = findSpellingSites(text);
  if (sites.length === 0) return [];
  const spellings: string[] = [];
  if (2 ** sites.length <= MAX_SEARCH_SPELLING_VARIANTS) {
    for (let mask = 1; mask < 2 ** sites.length; mask += 1) {
      spellings.push(spell(text, sites, (site, siteIndex) => site.forms[(mask >> siteIndex) & 1]));
    }
  } else {
    const sharpForms = ["ß", "ss"];
    const umlautForms = [0, 1];
    for (const sharp of sharpForms) {
      for (const umlautForm of umlautForms) {
        spellings.push(spell(text, sites, (site) => {
          if (site.kind === "sharp") return sharp;
          const umlaut = site.forms[0].length === 1 ? site.forms[0] : site.forms[1];
          return umlautForm === 0 ? umlaut : UMLAUT_TO_DIGRAPH[umlaut];
        }));
      }
    }
  }
  const typed = token.toLowerCase();
  return Array.from(new Set(spellings)).filter((spelling) => spelling !== typed && spelling !== text);
}

/** The token as typed first, then its spelling variants. */
export function searchTokenSpellings(token: string): string[] {
  return [token, ...germanSpellingVariants(token)];
}
