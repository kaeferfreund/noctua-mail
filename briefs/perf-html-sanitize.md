# perf/html-sanitize-single-pass — report

Branch `perf/html-sanitize-single-pass` in `wt-perf-html-sanitize`, base `origin/integration/stage` @ `e70c30b` (round 9). **HEAD `f8189bbba30ee1b2186bce2939ebadfdf8e74349`**, 2 commits, clean tree, nothing pushed, merged or deployed. Spec: `perf-html-sanitize-task.md`. Design and spike evidence: `perf-html-sanitize-spike.md`, `perf-html-sanitize/`. Evidence for this branch is in `perf-html-sanitize/branch-f8189bb/`.

| Commit | What |
|---|---|
| `8614198` perf(html): sanitize both remote-content modes from one normalization | `sanitize.ts` refactor, `HtmlMessage` call site, memo-test seam, export, doc note |
| `f8189bb` test(html): differential proof of the sanitize pair against 0ac6cfa | `lib/html/sanitize.pair.test.ts` + test-only fixtures |

## 1. What changed

Scope is exactly as approved: normalize once, use a per-call CSS memo, skip the allow pass when the block pass rewrote nothing. There is no policy change.

**`lib/html/sanitize.ts`** (+63/−5). `SANITIZE_HTML_OPTIONS`, `BLANK_IMAGE`, `privateCss` and `localSrcset` (lines 1–133) are untouched. The old function body moved into an internal `sanitizeNormalized(normalized, mode, css, onRemoteRewrite?)`. Inside the transform, the only edits are:
- `privateCss(...)` → `css(...)` (inline styles and `<style>` blocks; the replace callback parameter was renamed from `css` to `cssText`);
- `onRemoteRewrite?.()` as the first statement of each of the two `block &&` rewrite branches (remote `src`, non-local `srcset`);
- a comment at that branch: the only mode-dependent code; any future mode-specific behavior must also call the hook.

New and changed functions:
- `memoizedPrivateCss()`: a `Map` per `inline` flag, keyed by the exact input string, created per call and never module-level.
- `sanitizeHtmlForDisplay(input, mode = "block")`: the public signature is unchanged. It is now `sanitizeNormalized(normalizeHtmlStructure(input), mode, memoizedPrivateCss())`, so the route and calendar callers get the per-call CSS memo for free.
- New `sanitizeHtmlForDisplayPair(input): { block, allow }` (+ `SanitizedHtmlPair` type). It normalizes once and shares one CSS memo between the passes. It counts rewrites in the block pass; with 0 rewrites, `allow = block` without a second pass.

**`app/components/HtmlMessage.tsx`**: the two `useMemo`s (block via the seam, allow direct) became one `useMemo(() => sanitizeHtmlPair(cleanedHtml), [cleanedHtml, sanitizeHtmlPair])`. `hasRemoteContent = blockedHtml !== allowedHtml` and `safeHtml` are unchanged. The test seam prop `sanitizeHtml` became `sanitizeHtmlPair` (default `sanitizeHtmlForDisplayPair`). No in-repo caller passes it except the memo test.

**`app/components/HtmlMessage.memo.dom.test.tsx`**: the seam returns `{ block, allow }`, with the same assertions (one call per html change; theme, zoom and font do not re-sanitize). It is now stronger than before: the old seam counted only the block pass.

Also changed: **`lib/html/index.ts`** exports the pair and its type. **`doc/HTML-MAIL-PRIVACY.md`** gets one paragraph on the single-call pair and the rewrite-hook invariant.

**Not touched:** `useRemoteContent.ts` (prefs resource NO-GO), the HTML route, the calendar callers, `remoteContent.ts`, the CSP, the allowlist, and the thread first-commit issue (separate task).

```
 app/components/HtmlMessage.memo.dom.test.tsx       |  11 +-
 app/components/HtmlMessage.tsx                     |  17 +-
 doc/HTML-MAIL-PRIVACY.md                           |   9 +
 lib/html/index.ts                                  |   5 +-
 lib/html/sanitize.pair.test.ts                     | 102 +++++
 lib/html/sanitize.ts                               |  68 ++-
 lib/testFixtures/htmlSanitize/sanitizeCorpus.ts    | 116 +++++
 .../htmlSanitize/sanitizeDifferentialInputs.ts     |  19 +
 lib/testFixtures/htmlSanitize/sanitizeFuzz.ts      |  57 +++
 .../htmlSanitize/sanitizeGolden0ac6cfa.json        | 510 +++++++++++++++++++++
 .../htmlSanitize/sanitizePayloads.json             |  57 +++
 .../htmlSanitize/sanitizeReference0ac6cfa.ts       | 176 +++++++
 12 files changed, 1128 insertions(+), 19 deletions(-)
```

The product-code diff is 3 files and about 90 lines. The rest is the test and its fixtures.

## 2. Differential proof (`lib/html/sanitize.pair.test.ts`, 7 tests, all green)

Fixtures live in `lib/testFixtures/htmlSanitize/`. **Deviation from the spec's example path** `lib/html/__fixtures__/`: the repo already keeps test-only fixture modules in `lib/testFixtures/`. Also, `app/globals.test.ts` ("app code names fonts only through the tokens") failed on the corpus's e-mail font names under `lib/html/__fixtures__/`, while it already exempts `lib/testFixtures/` ("Synthetic mail fixtures are e-mail HTML"). Moving the fixtures avoided widening that exemption list.

- **`sanitizeReference0ac6cfa.ts`**: the frozen copy of `git show 0ac6cfa:lib/html/sanitize.ts`, plus a header comment. Only the two relative import paths differ (`./remoteContent`, `./normalize` → `../../html/…`). Between `0ac6cfa` and `e70c30b`, `lib/html/`, `package.json` and `bun.lock` are unchanged (`git diff --stat` is empty), so the reference runs with the 0ac6cfa dependencies.
- **Corpus**: regenerated in-process, as the spec prefers. `sanitizeCorpus.ts` is the spike's `gen-corpus.ts` text unchanged, wrapped as `generateSanitizeCorpus()`, which resets the PRNG. All 8 items are **byte-identical to the spike's corpus files**, checked against both the files and their golden input hashes. That avoids checking in about 1 MB of HTML.
- **Payloads**: `sanitizePayloads.json` holds the 55 distinct payloads the sanitize tests passed in, from the spike's `captured-inputs.jsonl`. The 10 captured test files are unchanged between `0ac6cfa` and `e70c30b`, so the set is complete.
- **Golden**: `sanitizeGolden0ac6cfa.json` has 72 entries: 8 corpus raw, 8 corpus after `stripConditionalComments`, 55 payloads, and the empty string. Each holds the input SHA-256, the block and allow SHA-256, and `remoteContentBanner` (= block !== allow). **63 of the entries are cross-checked identical to the spike's `golden-0ac6cfa.json`**, which was computed in a real 0ac6cfa checkout. The 8 `:cleaned` entries and `edge:empty` come from the frozen reference. The generator is `perf-html-sanitize/branch-f8189bb/gen-golden.ts`; it aborts on any mismatch with the spike's golden. It is deliberately not in the repo, so nobody re-anchors the golden by accident.
- **Fuzz**: `sanitizeFuzz.ts` is the spike's generator text unchanged, wrapped as `createSanitizeFuzzDocuments(seed)`.

| Test | Result |
|---|---|
| Generated inputs = pinned input hashes (72) | pass |
| Frozen reference reproduces the golden hashes, both modes (72 × 2) | pass |
| `sanitizeHtmlForDisplay` (shipped, single mode) reproduces the golden, both modes | pass |
| `sanitizeHtmlForDisplayPair` reproduces the golden hashes **and banner decisions**; 30 with banner / 42 without (allow pass skipped) | pass |
| Fuzz seed **7**: 3,000 docs × raw/stripped = 6,000 inputs | **0 mismatches**; reference stream hash `e36817db…` = spike |
| Fuzz seed **1009**: 6,000 inputs | **0 mismatches**; `a565dc19…` = spike |
| Fuzz seed **424242**: 6,000 inputs | **0 mismatches**; `5b0885ec…` = spike |

Per fuzz input there are five checks against the reference: `pair.block`, `pair.allow`, the banner (`pair.block !== pair.allow` ⇔ `ref block !== ref allow`), and the single-mode `sanitizeHtmlForDisplay` in block and in allow. That is **18,000 inputs, 90,000 byte comparisons, 0 mismatches**. Matching the spike's stream hashes proves the generator and the reference produce the same stream the spike verified in a 0ac6cfa checkout.

Test hygiene: `parse-srcset` (inside sanitize-html) `console.log`s every invalid descriptor, thousands of lines for this fuzz. The fuzz block spies on `console.log` and restores it afterwards (`spyOn(...).mockImplementation`, as in `lib/db/schema.master.test.ts`). The production logging is unchanged.

Runtime: the file takes about **30–37 s** at load 10–12. The golden part takes a few seconds; each fuzz seed about 9 s, with a 120 s per-test timeout. Under `test:stress` (3 reruns) that adds about 90 s.

**Bench-script differential, an independent check** (spike `bench.ts`, 72 inputs, variants rebuiltSingle/A/B/C vs the sanitizer in the same tree): 0 mismatches, 0 banner mismatches, allow pass skipped for 42, in all 4 runs (2 on base, 2 on branch).

## 3. Privacy browser gate

`tests/browser/htmlPrivacy.test.ts` → **1 pass, 0 fail, 177 expect() calls**, 71.4 s, exit 0. The log is in `branch-f8189bb/privacy-gate.log`. The test covers no remote loads before opt-in, no Referer, and no remote CSS.

**Port adaptation in a disposable copy only.** The test hardcodes app 3798 and tracker 3799, and 3795–3799 belong to other tasks. I ran it from a `git archive HEAD` copy in `.tmp/privacy-run` (node_modules symlinked) in which only those 16 port literals were rewritten to **3915 (app) / 3916 (tracker)**. The in-repo test is unchanged. Command:
`TMPDIR=… NOCTUA_DATA_DIR=…/data/noctua-data-perf-html-sanitize PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 bun test --config=bunfig.browser.toml --timeout 120000 ./tests/browser/htmlPrivacy.test.ts`. Afterwards 3915/3916 were free, and the copy was deleted, because `bunfig.dom.toml` does not ignore `.tmp/`.

## 4. Benchmark before/after (spike `bench.ts`, Bun 1.4.4, median of 15 warm runs after 3 warmups)

Before = a `git archive e70c30b` copy, after = the branch. Both used the same bench script and the same corpus, run back to back in A-B-B-A order (base, branch, branch, base), `nice -n 10`. Load was 6.6–7.3 during runs 1–3 and 12–13 during run 4. "Pair" is what the reader runs per message: before, `sanitizeHtmlForDisplay` twice; after, `sanitizeHtmlForDisplayPair` once. "Same process" compares the frozen 0ac6cfa reference pair with the shipped pair in the same process, so the comparison is insensitive to load drift. "Open" adds 2 × stripCC, viewerFrame and `buildPreviewDocument`.

| Item | KB | Before: pair at e70c30b (run 1 / 2), ms | After: shipped pair (run 1 / 2), ms | **Saving (mean)** | Same process: 0ac6cfa ref → shipped | Open before → after, ms |
|---|---:|---:|---:|---:|---:|---|
| gmail-5k | 5 | 1.58 / 1.85 | 0.81 / 0.85 | **0.89 ms (52 %)** | 1.77 → 0.83 (53 %) | 1.89 → 1.01 |
| outlook-5k | 7 | 3.82 / 4.11 | 2.53 / 2.44 | **1.48 ms (37 %)** | 3.96 → 2.49 (37 %) | 4.45 → 2.96 |
| **outlook-54k** | 56 | 37.24 / 34.40 | 21.05 / 21.52 | **14.54 ms (41 %)** | 36.03 → 21.28 (41 %) | 39.26 → 24.68 |
| legacy-table-54k | 53 | 48.42 / 47.43 | 28.13 / 30.40 | **18.66 ms (39 %)** | 46.32 → 29.26 (37 %) | 52.11 → 33.45 |
| **newsletter-120k** | 120 | 91.90 / 91.18 | 51.54 / 55.92 | **37.81 ms (41 %)** | 91.84 → 53.73 (41 %) | 98.91 → 61.00 |
| newsletter-unique-120k | 134 | 101.97 / 99.09 | 73.69 / 84.76 | **21.31 ms (21 %)** | 99.30 → 79.22 (20 %) | 108.89 → 87.74 |
| **outlook-300k** | 302 | 206.06 / 198.17 | 119.91 / 119.81 | **82.26 ms (41 %)** | 201.36 → 119.86 (40 %) | 221.16 → 138.79 |
| **newsletter-300k** | 301 | 227.13 / 241.33 | 134.32 / 130.76 | **101.69 ms (43 %)** | 231.49 → 132.54 (43 %) | 251.79 → 149.45 |

**Per size: 54 KB −14.5 to −18.7 ms; 120 KB −37.8 ms (newsletter) and −21.3 ms (all styles unique, the memo's worst case); 300 KB −82 to −102 ms.** That is about 40 % of the sanitize cost and in line with the spike's forecast (12.8 / 26–34 / 85–95 ms). The 120 KB newsletter came out somewhat better than forecast.

Side effect on the single-mode path (HTML route, calendar callers), `sanitizeHtmlForDisplay(block)`, before → after, from the per-call CSS memo:

| Item | Before, ms | After, ms |
|---|---:|---:|
| outlook-54k | 17.0 | 12.7 |
| newsletter-120k | 45.3 | 31.2 |
| outlook-300k | 100.1 | 74.4 |
| newsletter-300k | 113.0 | 78.6 |
| newsletter-unique-120k | 50.7 | 49.7 (no repeats) |

A first "before" run at 15:52, on the unedited worktree, is discarded: load climbed from 7.7 to 14.7 during it, and it is visibly inflated (outlook-54k pair 43.6 ms against 34–37 ms in base1/base2). It still reproduced the spike's differential (72 inputs, 0 mismatches, 42 skips). Raw JSON, logs and scripts are in `branch-f8189bb/`.

## 5. Gates

| Gate | Result | Baseline |
|---|---|---|
| `bun run typecheck` | **0 errors**, 1,248 files | 0 / 1,244 (+4 new files) |
| `bun run lint` | **0 errors / 181 warnings** | 0 / 181 |
| `bun run test:ci` | **2,922 pass / 0 fail** (316 files, 584.9 s) + **564 DOM pass / 0 fail** (73 files) | 2,915 + 564 (+7 = new pair test) |
| `bun run test:stress` | **8,766 pass / 0 fail** (= 2,922 × 3, seed 1337, 1,568.6 s) | – |
| `bun run build` | **exit 0**, compiled successfully | – |
| Privacy browser gate | **1 pass, 177 assertions** (ports 3915/3916, disposable copy) | 177 |
| Pair differential | 7/7; 72 golden inputs, 18,000 fuzz inputs, 0 mismatches | – |

Every heavy gate started at a 1-minute load below 12 and ran under `nice -n 10`, with `TMPDIR` inside the worktree. **Note for every test run in this repo:** `bun test` does not load `.env.local`, because NODE_ENV=test. Without an explicit `NOCTUA_DATA_DIR`, the suite (for example `calendarInviteProcessor.test.ts`) opened storage in the shared default `/home/monkey/code/noctua-mail/noctua-data`. That happened once in my first focused run, before I noticed. All gate runs then set `NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-html-sanitize`. This is pre-existing harness behavior and was not changed here; other task briefs may want the same env line.

## 6. Merge-tree against the current stage

`git fetch` showed `origin/integration/stage` has moved to **`a6e16d6`** (56 commits after e70c30b). `git merge-tree --write-tree origin/integration/stage HEAD` gives **exit 0, tree `d344e2f`, no conflicts**. The stage changes overlap none of this branch's files. They touch `app/globals.test.ts`, which keeps the `lib/testFixtures` font exemption, and `package.json` (new `test:parallel-probe` / `test:stress-parallel` scripts; the pair test is self-contained and safe for parallel runs). On a disposable archive of the merged tree `d344e2f`: `bun check` gave 0 errors / 1,267 files; the pair, html, remoteContent, globals and HtmlMessage tests passed 117/117; the memo and privacy DOM tests passed 36/36. The full gate suite was **not** re-run on the merged tree.

## 7. Risks and notes for the reviewers

1. **Skip-allow invariant (variant C).** It is correct only while all mode-dependent logic sits inside branches that call `onRemoteRewrite`. Mitigations: a comment at the branch, the doc paragraph, and the CI fuzz plus golden differential against the frozen reference. A future mode-specific tweak placed outside the hook would show up as allow/banner mismatches in `sanitize.pair.test.ts` on the fuzz corpus. The fallback, if the owners prefer it: drop the skip (A+B only). That costs about 1 ms on plain mails and little at ≥54 KB.
2. **Rewrite counter over-approximates** (it counts tags sanitize-html later drops). The allow pass then still runs, which is the safe direction, and the banner stays exactly `block !== allow`.
3. **Memo validity** depends on `privateCss` staying pure in `(input, inline)`. The memo is keyed on both, scoped per call, never module-level, and bounded by the size of one message.
4. **Golden coupling to dependencies.** An upgrade of sanitize-html, postcss, parse5 or htmlparser2 that changes output will fail the golden test even when old and new code still agree. That is intended: re-anchoring then becomes a deliberate step, using `gen-golden.ts` and a review of the output change. The old-vs-new fuzz comparison itself is independent of the golden.
5. **Test cost**: about 30–37 s per `test:ci` run, about 90 s under `test:stress`.
6. **Benchmark caveats**: Bun/JSC on a shared 6-core host (load 6.6–13), synthetic corpus. Run 4 (base2) ran at load 12–13; the same-process column is the load-robust comparison and agrees within about 1–2 points.
7. **Not done / out of scope:** prefs resource (NO-GO), thread first-commit collapse (separate task after round 10), no live-app check of the reader (unit, DOM and browser gates only).
