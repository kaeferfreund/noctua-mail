# Review r1: perf/html-sanitize-single-pass @ f8189bb

Lens: security (privacy / XSS) and correctness of the shared and skipped sanitize path. Reviewed read-only in `wt-perf-html-sanitize`, base `e70c30b`. Severity per AGENTS.md rule 2.

## Verdict: **MERGE+P3**

No P0–P2. The new path is equivalent to two independent `sanitizeHtmlForDisplay` calls at 0ac6cfa by construction, and every differential run agrees byte for byte.

## Why the skip is sound

- `sanitizeNormalized` reads `mode` in exactly one place: the `block && (img|source)` branch (`lib/html/sanitize.ts:179–192`). The sanitize-html options, the `<style>` post-pass and `privateCss` do not depend on mode. Both passes get the same `normalized` string, and sanitize-html is deterministic and keeps no state between calls.
- That branch makes only two rewrites, and each calls `onRemoteRewrite` before it runs (`:181`, `:188`). If the block pass makes no rewrite, every `transformTags` call returns the same attribs in both modes, so the outputs are identical. `allow = block` is therefore exact, not an approximation.
- The opposite direction is also safe. The counter over-approximates: it counts tags that the allowlist later drops. The allow pass then still runs, and the banner stays `block !== allow`, the same as before.
- The iframe fallback re-sanitize in sanitize-html 2.18.1 (`node_modules/sanitize-html/index.js:715–728`) passes the same `options` object, and with it the same `transformTags` closure. Remote images inside a discarded `<iframe>` therefore still fire the hook. This was checked with the `iframeFallback` case below.
- Memo: `privateCss` is pure in `(input, inline)`. Its regexes are literals inside the function and are not `/g` at module level, and `isLocalMailResource` is stateless. The memo has separate `Map`s per `inline` flag, so an inline string can never return a stylesheet result or the reverse. This was checked explicitly with `style="x{color:red}"` next to `<style>x{color:red}</style>`. The memo lives only for one call, and its size is bounded by one message.
- `normalizeHtmlStructure` is a pure parse5 parse→serialize with no module state, so normalizing once is equivalent to normalizing twice.
- The frozen reference `lib/testFixtures/htmlSanitize/sanitizeReference0ac6cfa.ts` differs from `git show 0ac6cfa:lib/html/sanitize.ts` only in its header comment and the two import paths. `lib/html/sanitize.ts` is identical between 0ac6cfa and e70c30b.
- `HtmlMessage.tsx`: `hasRemoteContent` and `safeHtml` are unchanged, and the CSP choice is untouched. The other callers (the HTML route and the two calendar views) keep the single-mode API and only gain the per-call memo.

## Findings

**P3-1 — The skip invariant depends on a comment** (`lib/html/sanitize.ts:176–178`). If someone later adds mode-dependent behaviour outside the hooked branch (for example a CSS rule that is relaxed only in allow mode), the allow pass would be skipped silently. Mail with no `<img>`/`<source>` rewrite would then show the block output after opt-in. That direction would block too much, not leak. The pair fuzz would catch it only if the corpus exercises the new branch. Optional hardening: route every `block`-dependent rewrite through one helper that calls the hook, or assert in the pair test that `sanitizeNormalized` reads `mode` only there. Backlog.

**P3-2 — Test cost.** `sanitize.pair.test.ts` takes about 30 s per `test:ci` run (here: 28.7 s together with the other `lib/html` tests), about 90 s under `test:stress`. The three seeds × 3,000 documents could be cut to about 1,000 each with little loss in coverage, because the golden and the stream hashes stay pinned. Backlog.

**P3-3 — Golden coupled to dependencies** (already noted in the implementation report). An upgrade of sanitize-html, postcss or parse5 that changes output will fail the golden test even when old and new code still agree. Deps branches need to know that `gen-golden.ts` (in `briefs/perf-html-sanitize/branch-f8189bb/`, not in the repo) is the re-anchoring step. Backlog, documentation only.

Seen and **not** counted as findings, because they are pre-existing and the old and new code give identical output:
- `srcset="cid:a,https://…"` without whitespace stays in block mode. Per the HTML srcset algorithm this is a single candidate URL starting with `cid:`, so it causes no remote fetch, and the block CSP has no `https:` either.
- `data:image/svg+xml` images containing `<image href=remote>` are kept. SVG used as an image does not load sub-resources.
- Sender-supplied `data-remote-src` / `data-remote-srcset` pass through in both modes. Nothing in `app/` or `lib/` reads them back.

## Gates (this review)

| Gate | Result |
|---|---|
| `lib/html/sanitize.pair.test.ts` + `lib/html/*` tests | 81 pass / 0 fail, 208 expects, 28.7 s |
| `HtmlMessage.memo.dom` + `HtmlMessage.privacy.dom` (bunfig.dom.toml) | 36 pass / 0 fail, 144 expects |
| `tests/browser/htmlPrivacy.test.ts` (ports 3798/3799, scratch data dir) | **1 pass, 177 expects**, 62 s, exit 0; ports free afterwards |
| Own adversarial set (`.tmp`, not committed): 70 hand-written cases (img/IMG, cid/data/blob/javascript/protocol-relative/relative/entity-obfuscated/whitespace/newline src, mixed and data-comma srcsets, picture/source/video/audio, SVG image/use/feImage, input type=image, table/body background, inline url()/escape/image-set, @import/@font-face sheets, inline vs sheet with identical text, link/meta refresh/referrer, sender data-remote-*, iframe fallback incl. >8 nesting, noscript/template/textarea/script/math, conditional comments, duplicate src), raw + `stripConditionalComments`, plus all 70×70 concatenations | 4,899 inputs, **0 mismatches** against the 0ac6cfa reference (pair block, pair allow, banner, single-mode block and allow); 2,400 took the skip path |
| Own fuzz: seeds 1, 2, 31337, 99991, 123456789 × 2,000 inputs, each made of 3 concatenated documents, raw + stripped | 20,000 inputs, **0 mismatches**, 4,022 skip-path hits |
| `bun check` | 0 errors (1,249 files; the count includes this review's `.tmp` scripts) |
| `eslint` on the 9 touched `.ts`/`.tsx` files | exit 0, no output |
| `git merge-tree` against current `origin/integration/stage` `45060d0` | exit 0, no conflicts; stage does not touch `lib/html/` or the sanitizer dependencies |

All test runs used `NOCTUA_DATA_DIR=wt-perf-html-sanitize/.tmp/review/data` and `TMPDIR` inside the worktree. No tracked files were changed and nothing was committed. The `.tmp/review` scratch files are removed at the end of this review.
