import { afterEach, beforeEach, describe, expect, spyOn, test, type Mock } from "bun:test";
import { createHash } from "node:crypto";
import { sanitizeHtmlForDisplay, sanitizeHtmlForDisplayPair } from "./sanitize";
import { sanitizeHtmlForDisplay as referenceSanitize } from "@/lib/testFixtures/htmlSanitize/sanitizeReference0ac6cfa";
import { sanitizeDifferentialInputs } from "@/lib/testFixtures/htmlSanitize/sanitizeDifferentialInputs";
import { SANITIZE_FUZZ_CASES, SANITIZE_FUZZ_SEEDS, sanitizeFuzzInputs } from "@/lib/testFixtures/htmlSanitize/sanitizeFuzz";
import golden from "@/lib/testFixtures/htmlSanitize/sanitizeGolden0ac6cfa.json";

// Differential proof for the single-normalization pair: the shipped sanitizer
// must stay byte-identical to the sanitizer at 0ac6cfa, in both remote-content
// modes, including the "remote content blocked" banner decision.
//
// The golden hashes and FUZZ_STREAM_HASHES pin the output of the frozen reference
// on the installed sanitize-html, postcss and parse5. A dependency upgrade that
// changes sanitizer output fails the pins even when shipped and reference code
// still agree. To re-anchor after such an upgrade:
//   1. Run this file. The fuzz tests must report no mismatches (an empty list);
//      only the pinned hashes may differ. Any mismatch is a real divergence.
//   2. Review the output change (it comes from the dependency, not from Noctua).
//   3. Run `bun lib/testFixtures/htmlSanitize/genGolden.ts`: it rewrites
//      sanitizeGolden0ac6cfa.json and prints new FUZZ_STREAM_HASHES to paste below.
//   4. Commit both with the dependency bump and name the upgrade in the message.

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

// Hashes of the reference output stream: sha256 over `block \0 allow \0` for the
// raw and comment-stripped form of every generated document. The first 1,000
// documents per seed of the 3,000-document stream the spike recorded in a 0ac6cfa
// checkout (whose full-stream hashes the frozen reference reproduced when the
// stream was shortened).
const FUZZ_STREAM_HASHES: Record<(typeof SANITIZE_FUZZ_SEEDS)[number], string> = {
  7: "8e45d71eeee4e647801ea2368b308957b5802669092eb1550ec96207489cba8d",
  1009: "c2fe5f19d6aafb6e851119679fd69522544ad6b598df73e6339684fb73ea43a0",
  424242: "ad06fb831231875a046391c57584ba31a92394473a40dfa70c8696db8a72be9a"
};

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

  for (const seed of SANITIZE_FUZZ_SEEDS) {
    test(`seed ${seed}: ${SANITIZE_FUZZ_CASES} documents, raw and comment-stripped, byte for byte`, () => {
      const referenceStream = createHash("sha256");
      const mismatches: { input: string; field: string }[] = [];
      let compared = 0;
      for (const input of sanitizeFuzzInputs(seed)) {
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
      expect(mismatches.slice(0, 5)).toEqual([]);
      expect(compared).toBe(2 * SANITIZE_FUZZ_CASES);
      expect(referenceStream.digest("hex")).toBe(FUZZ_STREAM_HASHES[seed]);
    }, 120_000);
  }
});
