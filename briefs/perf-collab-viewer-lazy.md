# perf-collab-viewer-lazy

## Summary

Implementation on `perf/collab-viewer-lazy`, based on `435ba5d1885d5b016d15dbad5b269f84e6497ce3`, exclusively in `/home/monkey/code/noctua-mail/wt-perf-collab-viewer`. All verification and the single production build passed, apart from the unchanged baseline lint findings. Main-route first-load JavaScript is **49,271 gzip bytes smaller (7.1%)**. The parser factories are absent from eager assets by content fingerprint. Delivered as the single commit `fc8883aeefe23d16d8678d23b7bcd13061a8c49a` (`perf(collab): reuse lazy Markdown viewer for notes`). Final worktree status and `git diff --check` are clean. No push, merge, rebase, stash, branch change or deployment was performed.

## What changed

`ThreadActivityPanel` was the only static importer of the Markdown viewer under `app/components/collab/**`. It now imports the exact existing `next/dynamic` wrapper from `RenderHelpers.tsx`, which is exported for reuse. No new wrapper was created. The shared loading placeholder is an empty, aria-hidden `min-h-6` div instead of the previous `Loading Markdown…` status. Empty timelines and deleted notes never mount the viewer.

The actual `message/MarkdownPanel.tsx` is unchanged, including ReactMarkdown, remarkGfm, remarkBreaks, options, normalization, sanitization, and link-preview context handling. Note deletion, errors and role logic are unchanged. Existing message rendering, including the detached message route, retains the same shared wrapper and viewer component.

## Before/after bytes

Baseline is supplied from the same-method build of `435ba5d`, not rebuilt here:

- `/` first-load JS: **2,314,843 → 2,147,685 raw bytes**; **694,060 → 644,789 gzip bytes**. Savings: **167,158 raw / 49,271 gzip bytes (7.1% gzip)**. Eager JS asset count: **25 → 24**.
- `/` CSS: **909,784 → 909,829 raw bytes**; **120,228 → 120,231 gzip bytes**. The silent placeholder utility adds **45 raw / 3 gzip bytes**.
- `/message/window` JS: **1,379,580 raw / 420,372 gzip bytes**, unchanged from baseline; CSS **909,829 raw / 120,231 gzip bytes**.
- `/compose/window` JS: **1,293,478 raw / 396,370 gzip bytes**, unchanged from baseline; CSS **870,640 raw / 114,687 gzip bytes**.

Retained-literal content fingerprints were checked against installed vendor source and then matched within emitted Acorn-parsed factory bodies. **All five groups have `eagerChunks: []`**, with no matches on any route's eager asset list:

- micromark/CommonMark: `definitionTitleMarker`, `definitionTitleString`; factory IDs `98189, 69489, 109334, 431369, 35198`.
- mdast/from-markdown: `Cannot close document, a token (`; factory `713059`.
- unified: `Expected usable value, not ` and `Expected a list of plugins, not ` (including their opening backticks); factories `175765, 541991`.
- GFM/footnotes: `gfmFootnoteDefinitionIndent`, `gfmFootnoteCallLabelMarker`; factory `285347`.
- react-markdown/HAST runtime: `Cannot parse` style-attribute diagnostic; factory `918789`.

The original **153,723 raw / 44,107 gzip-byte** parser asset `1695z--pnke7..js` remains emitted for deferred use, but is absent from `/` first-load assets. Its content fingerprints, not its name or IDs alone, establish parser identity. Evidence: `/tmp/perf-collab-viewer/{measurements.json,measurements-summary.json,boundaries.json,boundaries.cjs,measure.cjs}`.

Measurement uses unique diagnostic `firstLoadChunkPaths`, gzip level 6 per asset then sum; CSS is the deduplicated `entryCSSFiles` union in each route client-reference manifest. HTML/RSC, fonts, polyfills excluded by diagnostics, and future interaction chunks are excluded. Scratch scripts and evidence: `/tmp/perf-collab-viewer/`.

## Tests

- New `lazyThreadActivityPanel.dom.test.tsx` launches a fresh Bun process, matching the lazy account-settings test pattern, without module mocks. It checks the actual module cache before importing the activity panel, after rendering an empty timeline, and after rendering deleted notes. All remain cold. Visible notes then load the real viewer.
- The same note text includes a Markdown link, list, inline code, emphasis, GFM strikethrough and unsafe HTML. Its `.markdown-view.outerHTML` must be exactly equal through the original eager component and the new lazy collaboration path. The eager import happens only after cold-boundary checks. Additional checks cover link target/rel, hover/focus preview context, cleanup, script exclusion, pending deletion, delete failure and error clearing after success.
- Exact existing-test change, explicitly authorized by the owner: in `Collaboration.dom.test.tsx`, the existing `expect(view.container.querySelectorAll("strong").length).toBe(3)` assertion is wrapped in `await waitFor(() => ...)`. No assertion was removed, skipped or weakened; no other test in that file was changed. The initial focused run exposed this synchronous assumption (18 passed, 1 failed); the final run awaits the viewer.
- Final focused DOM run: **20 pass, 0 fail** across both collaboration files, including the updated exact-HTML-parity test. Log: `/tmp/perf-collab-viewer-focused-final.log`.
- `nice -n 10 bun run test:ci`, run once: **2,503 unit pass, 0 fail** across 274 files; **367 DOM pass, 0 fail** across 41 files (baseline 2,503 + 366). No identities-route SQLITE_BUSY failure occurred and no rerun was needed. Log: `/tmp/perf-collab-viewer-test-ci.log`.
- `nice -n 10 bun run typecheck`: **0 errors** in 1,092 files. Log: `/tmp/perf-collab-viewer-typecheck.log`.
- `nice -n 10 bun run lint`: unchanged **1 existing error / 25 warnings**. The existing error is `app/components/calendar/useCalendarConflicts.ts:58` (`react-hooks/set-state-in-effect`). A final focused lint pass over all four touched files is clean. Logs: `/tmp/perf-collab-viewer-lint.log`, `/tmp/perf-collab-viewer-lint-focused.log`.
- Exactly **one** `nice -n 10 bun run build`: **exit 0**, Next.js 16.2.4 / Turbopack; compilation 17.4 s; TypeScript 31.1 s; 30/30 static pages generated. No baseline rebuild or second production build. Log: `/tmp/perf-collab-viewer-build.log`.
- `git diff --check`: clean. All long commands used `nice -n 10`. No server was started.

## New strings

None. No user-visible or accessible string was added. The existing shared `Loading Markdown…` string and status role were removed in favor of a silent placeholder. Synthetic strings added in tests are fixtures/assertions only.

## Risks

The first visible note can briefly show the silent one-line placeholder while the existing chunk loads. The viewer output and plugins are unchanged and exact HTML parity is tested. Asset budgets do not establish browser transfer timings, hydration CPU or LCP. No dev/start server, real mailbox data, remote mailbox operation, dependency change or protected production-file edit was needed.

## Files touched

- `app/components/collab/ThreadActivityPanel.tsx`: viewer import only.
- `app/components/mailclient/RenderHelpers.tsx`: export the existing dynamic wrapper; silent placeholder.
- `app/components/collab/lazyThreadActivityPanel.dom.test.tsx`: new cold-import, exact-HTML-parity, context and deletion regression test.
- `app/components/collab/Collaboration.dom.test.tsx`: only wrap the existing strong-element count assertion in `await waitFor`; this narrow existing-test edit was separately authorized.
- `/home/monkey/code/noctua-mail/briefs/perf-collab-viewer-lazy.md`: requested delivery brief outside the worktree.
