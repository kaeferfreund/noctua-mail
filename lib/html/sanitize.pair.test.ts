import { afterEach, beforeEach, describe, expect, spyOn, test, type Mock } from "bun:test";
import { createHash } from "node:crypto";
import { sanitizeHtmlForDisplay, sanitizeHtmlForDisplayPair } from "./sanitize";
import { stripConditionalComments } from "./strip";
import { sanitizeHtmlForDisplay as referenceSanitize } from "@/lib/testFixtures/htmlSanitize/sanitizeReference0ac6cfa";
import { sanitizeDifferentialInputs } from "@/lib/testFixtures/htmlSanitize/sanitizeDifferentialInputs";
import { createSanitizeFuzzDocuments } from "@/lib/testFixtures/htmlSanitize/sanitizeFuzz";
import golden from "@/lib/testFixtures/htmlSanitize/sanitizeGolden0ac6cfa.json";

// Differential proof for the single-normalization pair: the shipped sanitizer
// must stay byte-identical to the sanitizer at 0ac6cfa, in both remote-content
// modes, including the "remote content blocked" banner decision.

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("sanitize differential against 0ac6cfa: golden inputs", () => {
  const inputs = sanitizeDifferentialInputs();

  test("the generated inputs are exactly the pinned ones", () => {
    expect(inputs.map(({ name, html }) => ({ name, input: sha256(html) })))
      .toEqual(golden.entries.map(({ name, input }) => ({ name, input })));
  });

  test("the frozen reference still reproduces the golden hashes", () => {
    const actual = inputs.map(({ name, html }) => ({
      name,
      block: sha256(referenceSanitize(html)),
      allow: sha256(referenceSanitize(html, "allow"))
    }));
    expect(actual).toEqual(golden.entries.map(({ name, block, allow }) => ({ name, block, allow })));
  });

  test("sanitizeHtmlForDisplay reproduces the golden hashes in both modes", () => {
    const actual = inputs.map(({ name, html }) => ({
      name,
      block: sha256(sanitizeHtmlForDisplay(html)),
      allow: sha256(sanitizeHtmlForDisplay(html, "allow"))
    }));
    expect(actual).toEqual(golden.entries.map(({ name, block, allow }) => ({ name, block, allow })));
  });

  test("sanitizeHtmlForDisplayPair reproduces the golden hashes and banner decisions", () => {
    const actual = inputs.map(({ name, html }) => {
      const pair = sanitizeHtmlForDisplayPair(html);
      return { name, block: sha256(pair.block), allow: sha256(pair.allow), remoteContentBanner: pair.block !== pair.allow };
    });
    expect(actual).toEqual(golden.entries.map(({ name, block, allow, remoteContentBanner }) =>
      ({ name, block, allow, remoteContentBanner })));
    // Both branches of the pair are exercised: with and without an allow pass.
    expect(actual.filter((entry) => entry.remoteContentBanner).length).toBe(30);
    expect(actual.filter((entry) => !entry.remoteContentBanner).length).toBe(42);
  });
});

// Hashes of the reference output stream recorded by the spike in a 0ac6cfa
// checkout: sha256 over `block \0 allow \0` for the raw and comment-stripped
// form of every generated document.
const FUZZ_SEEDS = [
  { seed: 7, streamHash: "e36817dbc919ac9428eaaf47c4c5487939821ba8cba8aeaa7ceb341316ae5a53" },
  { seed: 1009, streamHash: "a565dc19b1c032c49805cb55d0eb68d663acd38b026b758798754bf30ef7dd1d" },
  { seed: 424242, streamHash: "5b0885ec15dd98b4a5da4072609a481911803f3447cae162e155d78491a27932" }
];
const FUZZ_CASES = 3000;

describe("sanitize differential against 0ac6cfa: seeded fuzz", () => {
  // parse-srcset (inside sanitize-html) logs every invalid descriptor it sees,
  // and the fuzz corpus produces thousands of them.
  let log: Mock<typeof console.log>;
  beforeEach(() => {
    log = spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    log.mockRestore();
  });

  for (const { seed, streamHash } of FUZZ_SEEDS) {
    test(`seed ${seed}: ${FUZZ_CASES} documents, raw and comment-stripped, byte for byte`, () => {
      const nextDocument = createSanitizeFuzzDocuments(seed);
      const referenceStream = createHash("sha256");
      const mismatches: { input: string; field: string }[] = [];
      let compared = 0;
      for (let index = 0; index < FUZZ_CASES; index += 1) {
        const raw = nextDocument();
        for (const input of [raw, stripConditionalComments(raw)]) {
          const block = referenceSanitize(input);
          const allow = referenceSanitize(input, "allow");
          referenceStream.update(block).update("\0").update(allow).update("\0");
          const pair = sanitizeHtmlForDisplayPair(input);
          if (pair.block !== block) mismatches.push({ input, field: "pair.block" });
          if (pair.allow !== allow) mismatches.push({ input, field: "pair.allow" });
          if ((pair.block !== pair.allow) !== (block !== allow)) mismatches.push({ input, field: "banner" });
          if (sanitizeHtmlForDisplay(input) !== block) mismatches.push({ input, field: "single.block" });
          if (sanitizeHtmlForDisplay(input, "allow") !== allow) mismatches.push({ input, field: "single.allow" });
          compared += 1;
        }
      }
      expect(mismatches.slice(0, 5)).toEqual([]);
      expect(compared).toBe(2 * FUZZ_CASES);
      expect(referenceStream.digest("hex")).toBe(streamHash);
    }, 120_000);
  }
});
