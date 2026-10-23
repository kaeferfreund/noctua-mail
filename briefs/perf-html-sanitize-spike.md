# Spike: single-normalization dual-policy HTML sanitize + shared account-pref resource

Backlog rank 9 in `perf-backlog-rerank-r8.md`. Read-only spike on detached worktree `wt-spike-html-sanitize` at `0ac6cfa` (dev preview 8.9). **No product code changed, nothing committed.** Two temporary patches to `lib/html/sanitize.ts` (one to capture test inputs, one to count calls) were each reverted with `git checkout -- lib/html/sanitize.ts`. Final state: `git diff` is empty. Only `.env.local` and an empty `.tmp/` are left.

Artifacts are in `briefs/perf-html-sanitize/`:
- `gen-corpus.ts` and `corpus/`
- `captured-inputs.jsonl`: 175 sanitizer calls captured from the existing tests
- `proto/sanitizeProto.ts`: the prototype (lines 1–133 are a verbatim copy of `sanitize.ts`)
- `bench.ts`, `node-build/` (the same benchmark bundled for Node), `results-{bun,node}.json`, `bench-*.log`, `load-*.txt`, `summary.md`
- `fuzz.ts`, `fuzz-seed-*.json`
- `golden-0ac6cfa.json`: SHA-256 of today's output for every corpus item and test payload, in both modes
- `prefsCount.dom.test.tsx`: the counting test

## Verdict

| Part | Verdict |
|---|---|
| **Single normalization feeding both policies** (shared parse5 pass + per-call `privateCss` memo + skipping the allow pass when the block pass rewrote nothing) | **GO, scoped and deferred.** Start only after the owners' security re-check closes. It must be an internal refactor of `sanitize.ts` that leaves the options and the transform body byte-for-byte unchanged, gated by the differential test below. It saves **about 35–45 % of the sanitize cost on every mail**: **~12.8 ms per open at 54 KB, ~26–34 ms at 120 KB newsletters, ~85–95 ms at 300 KB**. On small mails it is only **~1–1.4 ms at 5 KB**, which nobody will notice. The value comes from newsletters and long Outlook threads, which are the opens that take 35–250 ms today. Break-even for "a few ms" is about 14 KB of HTML (saving ≈ 0.22 ms/KB). |
| **Shared account-pref resource** (beyond coalescing concurrent requests) | **NO-GO.** In steady state each open fetches `/prefs` exactly once, so there is little to deduplicate. A cache with a lifetime could keep a revoked sender "allowed", and no settings UI dispatches the change event today. In-flight coalescing would be safe but is worth almost nothing. |
| **New finding, outside the sanitizer:** on a cached thread open, all siblings render expanded in the first commit | **Look at this first.** A 4-message thread mounts 4 viewers before the collapse effect runs: **4 `/prefs` GETs and 4 × 2 sanitize passes**, of which 3 GETs and 6 passes are thrown away right after. For 4 × 54 KB Outlook mails that is **~100 ms of wasted sanitizing** per thread open, more than the whole rank-9 saving. The fix lives in the thread view state, not in the security perimeter. The mechanism is measured at the ThreadView level and confirmed by reading the code. It has not been checked in the live app. |

## 1. Pipeline map

### One message open (reader pane, `ThreadMessageCard` → `HtmlMessage`)

| # | Where | Work | Policy | Cached? |
|---|---|---|---|---|
| 1 | `ThreadMessageCard.tsx:375-380` | `replaceInlineImageSources`, `stripRedundantInlineImageFallbacks`, `appendUnreferencedInlineImages`, `stripRemovedInlineImages` (regex/string passes) | – | No. Runs on every card render, but produces the same string value, so the memos downstream still hit |
| 2 | `HtmlMessage.tsx:475` | `stripConditionalComments(html)` | – | No, runs every render (0.01–1.2 ms) |
| 3 | `HtmlMessage.tsx:476` | `shouldShowHtmlViewerFrame` (regex on the first 8 KB) | – | No, runs every render (≤0.15 ms) |
| 4 | `HtmlMessage.tsx:477` → `useRemoteContent.ts:20-34` | `GET /api/accounts/:id/prefs` in an effect. Also fires on every `noctua:remote-content-prefs` event | – | No. One GET per mounted viewer, plus one per mounted viewer on each "Always allow" |
| 5 | `HtmlMessage.tsx:480` → `sanitize.ts:134-170` (block) | **(a)** `normalizeHtmlStructure` (`normalize.ts:19-20`): parse5 `parse`/`parseFragment` + `serialize`. **(b)** sanitize-html: htmlparser2 parse, allowlist, `transformTags["*"]` per tag (`sanitize.ts:139-163`), with **`privateCss` (postcss parse + walk + stringify) per `style=` attribute** (`:148`) and the block-mode image/srcset rewrite (`:150-161`). **(c)** regex over the output `<style>` blocks → `privateCss` per block (`:168-169`) | `SANITIZE_HTML_OPTIONS` + block transform | `useMemo([cleanedHtml, sanitizeHtml])`. Theme, zoom and font changes do not re-sanitize (already done by earlier perf work, proven by `HtmlMessage.memo.dom.test.tsx`) |
| 6 | `HtmlMessage.tsx:481` (allow) | Same three steps, again from scratch: **a second parse5 normalize of the same string, a second sanitize-html parse, and a second `privateCss` on every identical style** | Same options + allow transform (the only difference is that the `block &&` branch is skipped) | `useMemo([cleanedHtml])` |
| 7 | `HtmlMessage.tsx:482-483` | `hasRemoteContent = blockedHtml !== allowedHtml`, then pick `safeHtml` | – | – |
| 8 | Effect `HtmlMessage.tsx:494` → `buildPreviewDocument` (`:337-447`) | `stripConditionalComments(html)` **again** (`:362`, only feeds the `hasExplicitColor` regex), `rewriteHtmlViewportHeightUnits` (`:367`), `<style>` regex + `scaleFontSizes` + `extractPrefersColorScheme` (`:368-375`), `scaleFontSizes` over the whole document (`:376`), `extractBodyContent` (`:377`) | – | Re-runs whenever a dependency at `:734` changes (theme, font, zoom, `remoteContent`, `safeHtml`, …) |
| 9 | `HtmlMessage.tsx:718` | `iframe.srcdoc = …`: the browser does a native third HTML parse, then the load handlers walk links and images (`:553`, `:623`, `:649`) | CSP `messageHtmlCsp(mode)` in a meta tag | – |

**Toggling remote content.** "Load once" (`remoteContentSession.ts:22-25`, read through `useSyncExternalStore`) flips `allowed`. `safeHtml` switches to the already memoized `allowedHtml`, so there is **no sanitize pass and no fetch** (measured). Only step 8 and the iframe reload in step 9 repeat. "Always allow" sends 1 `PUT /prefs`, then dispatches the change event, and **every mounted viewer refetches `GET /prefs`** (measured: 1 PUT + 2 GETs with 2 viewers mounted). No re-sanitize.

**Server HTML route** (`app/api/accounts/[accountId]/messages/[messageId]/html/route.ts`), used by the detached window: `MailClient.tsx:5125`, `message/window/page.tsx:260`.
- `getUserAccountPrefs` (DB, `:101`) → mode → `postprocessHtml` (`:39-52`)
- `postprocessHtml` does: dataUrl→url replace, the same 4 inline-image passes, `stripConditionalComments`, **one** `sanitizeHtmlForDisplay` in the decided mode (normalize + sanitize-html + privateCss), `enforceSafeLinks`, then non-image `data:` → `about:blank`, `ensureHtmlDocumentTitle`
- No caching (`no-store`). Only one policy runs, so there is nothing to share. It would still pick up the within-call CSS memo for free.

**Other callers**, single block mode: `CalendarEventEmailSnapshot.tsx:74`, `EventDetailDescription.tsx:21`. They are unaffected apart from the free CSS memo.

### Thread open (per-open multiplier, measured)
In `MailClient.tsx:2660`, selection sets `pendingSelectionCollapseMessageId` in the same batch as the new active message. The sibling collapse happens in a **parent `useEffect`** (`MessageViewOrchestrator.tsx:610-630`). Children render, and run their own effects, before that effect does. As long as the thread's messages are already in `activeThread` with bodies loaded (a cached or revisited thread), every sibling's `HtmlMessage` mounts in the first commit.

`prefsCount.dom.test.tsx` renders the real `ThreadView` → `ThreadMessageCard` → `HtmlMessage` stack, 4 HTML messages, collapse map empty, then applies the orchestrator's map:

| Step | iframes | `/prefs` GETs | sanitize block / allow |
|---|---:|---:|---:|
| First commit of the open | 4 | **4** | **4 / 4** |
| After the collapse map is applied | 1 | 4 | 4 / 4 |
| Re-render with unrelated props | 1 | 4 | 4 / 4 (memo holds) |
| Expand one sibling | 2 | 5 | 5 / 5 |
| "Load once" | 2 | 5 | 5 / 5 (no extra work) |
| "Always load from this sender" | 2 | 7 (+1 PUT) | 5 / 5 |

So the "duplicate" prefs fetches per open are **N − 1 for an N-message cached thread, plus 1 per mounted viewer on Always-allow**. A single-message open fetches exactly once.

## 2. Measurements

**Corpus** (`gen-corpus.ts`, deterministic):

| Item | Size | What it is |
|---|---|---|
| `gmail-5k` | 5 KB | div/br, no images |
| `outlook-5k` | 7 KB | Word-HTML, MsoNormal spans, remote signature logo |
| `outlook-54k` | 56 KB | |
| `outlook-300k` | 302 KB | long reply chain |
| `legacy-table-54k` | 53 KB | exact shape of the earlier 56.52 ms measurement |
| `newsletter-120k` | 120 KB | nested tables, 126 remote images with srcset, MSO conditionals, style block with `@import`, `@font-face`, `url()`, media queries, tracking pixel |
| `newsletter-300k` | 301 KB | same structure as `newsletter-120k`, larger |
| `newsletter-unique-120k` | 134 KB | every inline style unique, so the CSS memo gets no repeat hits within a pass |

Separately, the 175 captured sanitizer calls (56 distinct payloads) from the existing tests are used for the differential: `lib/html.test.ts`, `remoteContent.test.ts`, `html.safeLinks.test.ts`, the calendar snapshot/invite tests, `HtmlMessage.test.ts`, `globals.test.ts`, and the privacy/memo DOM tests.

**Method.** Single-threaded, `nice -n 10`. 3 warm-up runs, then the **median of 15 warm runs** per pass. The 1-minute load was waited down below 10 before starting; it was 8.6–11.2 during the Bun run. Node v24 (V8, closer to Chrome) runs the same benchmark bundled with `bun build --target=node`. Its load rose to 15–18 from other agents, so treat the Node 120 KB/300 KB newsletter rows as noisy: there block 122 ms vs allow 166 ms for the same work. **Bun is the primary series.** "Open" means the client CPU of one viewer: 2 × stripCC + viewerFrame + the sanitize pair + `buildPreviewDocument`, excluding the iframe's native parse and layout.

### Bun 1.4.4, median ms

| Item | normalize (parse5) | sanitize-html core / pass | privateCss / pass | block | allow | **today pair** | A shared normalize | B + CSS memo | **C + skip allow** | **saving** | open today → with C |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| gmail-5k | 0.51 | 0.34 | 0.02 | 0.96 | 1.04 | **1.82** | 1.27 | 1.35 | **0.86** | 0.96 (53 %) | 1.99 → 1.03 |
| outlook-5k | 0.64 | 0.78 | 0.53 | 2.00 | 2.01 | **4.01** | 3.57 | 2.67 | **2.61** | 1.40 (35 %) | 4.51 → 3.11 |
| outlook-54k | 4.55 | 7.71 | 4.27 | 17.75 | 17.28 | **33.94** | 30.88 | 20.69 | **21.17** | 12.78 (38 %) | 37.55 → 24.78 |
| legacy-table-54k | 5.43 | 12.66 | 5.41 | 27.51 | 24.63 | **48.65** | 43.89 | 31.78 | **30.45** | 18.20 (37 %) | 53.28 → 35.08 |
| newsletter-120k | 15.84 | 19.65 | 10.99 | 42.99 | 46.71 | **86.63** | 85.36 | 55.06 | **52.86** | 33.77 (39 %) | 95.07 → 61.30 |
| newsletter-unique-120k | 9.15 | 20.42 | 12.75 | 48.74 | 53.37 | **99.78** | 87.93 | 75.73 | **73.46** | 26.32 (26 %) | 108.36 → 82.05 |
| outlook-300k | 21.90 | 43.21 | 22.20 | 99.48 | 101.17 | **194.42** | 171.25 | 115.40 | **109.04** | 85.38 (44 %) | 213.17 → 127.79 |
| newsletter-300k | 22.65 | 50.53 | 28.80 | 120.47 | 123.21 | **230.25** | 203.72 | 133.74 | **135.75** | 94.50 (41 %) | 247.29 → 152.79 |

**Cross-check, Node v24 (V8).** "Today pair → C" in ms:

| Item | today pair → C | saving |
|---|---|---|
| gmail-5k | 1.66 → 0.84 | |
| outlook-5k | 3.83 → 2.66 | |
| outlook-54k | 32.39 → 20.08 | **12.3 ms** |
| legacy-table-54k | 46.60 → 30.76 | |
| newsletter-120k | 77.37 → 61.81 | |
| newsletter-unique-120k | 94.91 → 77.71 | |
| outlook-300k | 180.87 → 106.93 | **74 ms** |

Full per-pass rows with p25/p75/min/max are in `results-*.json`; the tables are in `summary.md`.

**Where the time goes (one pass, 54 KB Outlook):** normalize 4.6 ms (26 %), sanitize-html core 7.7 ms (43 %), privateCss 4.3 ms (24 %). `buildPreviewDocument` is 3.1 ms. Today the pair costs **2.0×** a single pass, because nothing is shared between the two policies.

**Where the saving comes from:**
- **A** (shared normalization alone) only saves about one parse5 pass, 3–25 ms. That is the smallest part.
- **B** (the CSS memo) is the bigger part. It drops the duplicate `privateCss` in the allow pass, and real mails also repeat the same `style=` string hundreds of times within a pass: 271 attributes but 6 unique at 54 KB.
- **C** removes the whole allow pass when the block pass rewrote no remote URL. That is the case for 42 of 72 differential inputs and for plain mails like `gmail-5k`.
- The second sanitize-html parse stays in every variant. It cannot be shared without changing what the library emits.

The earlier 56.52 ms pair figure reproduces as 48.65 ms (Bun) and 46.60 ms (Node) on the same shape.

## 3. Design: single normalization feeding both policies

The allowlist (`SANITIZE_HTML_OPTIONS`), `BLANK_IMAGE`, `privateCss`, `localSrcset` and the transform body stay **byte-for-byte unchanged**. Only the function boundary moves. The prototype is `proto/sanitizeProto.ts`.

```ts
// sanitize.ts (internal)
function sanitizeNormalized(normalized, mode, css /* memoized privateCss */, onRemoteRewrite?) {
  // existing lines 137-169 verbatim, except:
  //   privateCss(...)  -> css(...)
  //   call onRemoteRewrite() inside both `block &&` rewrite branches
}
export function sanitizeHtmlForDisplay(input, mode = "block") {           // signature unchanged
  if (!input) return input;
  return sanitizeNormalized(normalizeHtmlStructure(input), mode, memoPrivateCss());
}
export function sanitizeHtmlForDisplayPair(input): { block: string; allow: string } {
  if (!input) return { block: input, allow: input };
  const normalized = normalizeHtmlStructure(input);  // once
  const css = memoPrivateCss();                      // per call, keyed by (inline, exact string)
  let rewrites = 0;
  const block = sanitizeNormalized(normalized, "block", css, () => { rewrites++; });
  const allow = rewrites ? sanitizeNormalized(normalized, "allow", css) : block;
  return { block, allow };
}
// HtmlMessage.tsx:480-483
const { block: blockedHtml, allow: allowedHtml } = useMemo(() => sanitizePair(cleanedHtml), [cleanedHtml, sanitizePair]);
```

**Why the output is byte-identical by construction**, not just by test:
1. `normalizeHtmlStructure` is a pure function of its input. Calling it once and feeding the same string to both passes is exactly what happens today, twice.
2. `privateCss` is pure: postcss parse, walk and stringify have no global state, and the error path returns `""` deterministically. A memo keyed by `(inline, exact input)` and scoped to one call returns identical strings. It is per call, not module-level, so memory is bounded and nothing is shared across messages.
3. The mode is read **only** inside the `block && (img|source)` branch. If that branch changed no attribute anywhere in the block pass, every `transformTags` call returned the same `{tagName, attribs}` the allow pass would return. Everything else in the options is identical, so `allow === block`.

   The rewrite counter over-approximates: it also counts tags that sanitize-html later discards, for example an `<img>` inside a dropped element. In that case the allow pass still runs, which is the safe direction. `hasRemoteContent` therefore stays exactly `block !== allow`, and the banner semantics do not change.
4. No allowlist change and no CSP change. The route and the calendar callers keep calling `sanitizeHtmlForDisplay(input, mode)` unchanged.

**Differential test** (`lib/html/sanitize.pair.test.ts`, old vs new on the same inputs):
1. **Golden anchor to today's code.** Check in the reference output hashes from `0ac6cfa` (`golden-0ac6cfa.json`: SHA-256 for both modes). The inputs are the 8 corpus items, raw and after `stripConditionalComments`, plus every payload the existing sanitize tests pass in. Assert that the new `sanitizeHtmlForDisplay(x, mode)` **and** `sanitizeHtmlForDisplayPair(x)` reproduce each hash. Alternatively, store the full outputs to make failures readable.
2. **Frozen reference implementation.** Vendor `git show 0ac6cfa:lib/html/sanitize.ts` as a test-only fixture module, e.g. `lib/html/__fixtures__/sanitizeReference0ac6cfa.ts`. Run a seeded generator against it, as in `fuzz.ts`: random nesting of img/source/picture/noscript/template/svg/math/style/script/iframe/meta/base, with remote, cid, data, `javascript:`, entity-obfuscated and attachment-path URLs, mixed srcsets, sender-supplied `data-remote-src`, `http-equiv`/referrer meta, and inline/sheet CSS with `url()`, `image-set`, escapes, `@import` and `</style>` breakouts, in raw and comment-stripped form. Assert `pair(x) == {ref(x, "block"), ref(x, "allow")}` and `(pair.block !== pair.allow) == (ref block !== ref allow)` for at least 3,000 cases per seed and a few fixed seeds.
3. **Existing gates stay green unmodified:** `lib/html.test.ts`, `remoteContent.test.ts`, `HtmlMessage.privacy.dom.test.tsx` (blocked before opt-in, load-once, persisted sender), and the browser `htmlPrivacy` test. `HtmlMessage.memo.dom.test.tsx` changes only its seam: the prop becomes a pair function, and it still asserts one call per html change.

**Spike evidence:**
- Corpus and test payloads: 72 inputs, both modes, Bun and Node. **0 output mismatches and 0 `hasRemoteContent` mismatches** for variants A, B and C, plus the "rebuilt single" variant. The allow pass was skipped on 42 inputs.
- Fuzz: seeds 7, 1009 and 424242, each 3,000 docs × raw/comment-stripped. That is **18,000 old-vs-new comparisons per variant with 0 mismatches**; about 83 % of the cases had remote content.

## 4. Estimated saving per open (Bun, primary)

| Mail | Today pair | With C | Saving |
|---|---:|---:|---:|
| 5 KB plain | 1.8 ms | 0.9 ms | **~1 ms** |
| 5–7 KB Outlook | 4.0 ms | 2.6 ms | **~1.4 ms** |
| 54 KB Outlook | 34 ms | 21 ms | **~12.8 ms** (Node 12.3) |
| 54 KB table-heavy | 49 ms | 30 ms | **~18 ms** |
| 120 KB newsletter | 87–100 ms | 53–73 ms | **~26–34 ms** |
| 300 KB thread / newsletter | 194–230 ms | 109–136 ms | **~85–95 ms** |

These numbers are per mounted viewer. Today a cached N-message thread pays the pair N times in its first commit (see §1). Fixing that first, i.e. deriving the collapse state during render, removes (N − 1) whole pairs and (N − 1) GETs. That is bigger than this optimization and needs no change to the sanitizer.

Verdict: **GO for the sanitize part** (scoped, after the security re-check, rank it below the thread first-commit fix). **NO-GO for the shared account-pref resource.**

## 5. Risks

1. **Timing and ownership.** This is the most security-sensitive file, and it is under an active re-check. Do not open a parallel change. Sequence it after the re-check, and keep the diff to "extract body + thread a CSS function + rewrite counter" so the re-review is a mechanical diff.
2. **The skip-allow invariant is implicit.** Variant C is only correct while all mode-dependent logic sits inside branches that call `onRemoteRewrite`. If a future mode-specific tweak lands outside them (for example mode-specific CSS), C silently breaks. Mitigations:
   - a comment at the branch;
   - the frozen-reference fuzz in CI;
   - fallback: ship only A+B, which saves about the same at ≥54 KB and loses only the ~1 ms plain-mail gain.
3. **Memo assumptions.** It is valid only while `privateCss` stays a pure function of `(input, inline)`. Key it on both, scope it per call, and never module-global.
4. **Test seam.** The `sanitizeHtml` prop on `HtmlMessage` is used only by the memo test. Changing it to a pair function changes the component API: there are 3 in-repo call sites (`ThreadMessageCard`, `ComposeMessageField`, `QuotedMessageNode`), none of which pass the prop.
5. **Measurement caveats.** The numbers are from Bun/JSC and Node/V8, not Chrome; slow devices scale the costs up, but the ratios hold. The shared host was at load 8.6–18. The corpus is synthetic. Repeated styles inflate the memo gain; `newsletter-unique-120k` bounds the worst case at 26 %.
6. **Prefs caching (rejected).** Any cache with a lifetime, or a module-level shared resource, could keep a revoked sender allowed, a privacy regression. In-flight coalescing is safe but low value.

## Files an implementation would touch

- `lib/html/sanitize.ts`: internal `sanitizeNormalized`, per-call `memoPrivateCss`, new `sanitizeHtmlForDisplayPair`; the public `sanitizeHtmlForDisplay` signature is unchanged.
- `lib/html/index.ts`: export the pair.
- `app/components/HtmlMessage.tsx` (`:456-483`): one `useMemo` over the pair; the seam prop becomes a pair function.
- `app/components/HtmlMessage.memo.dom.test.tsx`: seam update.
- New: `lib/html/sanitize.pair.test.ts`, plus fixtures (`lib/html/__fixtures__/sanitizeReference0ac6cfa.ts`, golden outputs/hashes, corpus files).
- **Not touched:** `useRemoteContent.ts` (NO-GO), the HTML route, the calendar callers, `remoteContent.ts`, the CSP.
- Separate follow-up item for the first-commit finding: `MessageViewOrchestrator.tsx` (`:605-630`), `ThreadView.tsx` / `ThreadMessageCard.tsx` (collapse derivation).
