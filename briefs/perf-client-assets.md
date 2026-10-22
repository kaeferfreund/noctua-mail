# Client asset implementation: perf-client-assets

## Summary

Implemented ranks **1, 4, 6**, in that order, on `perf/client-assets` in
`/home/monkey/code/noctua-mail/wt-perf-assets`, based on `0beb9a6`.
Production measurements taken 2026-10-22 with Next.js 16.2.4 / Bun 1.4.4.
Exactly one `bun run build` was run. Worktree is clean; no push/merge/rebase.

Commits:

- Rank 1: `c2042a82e68403d3a322a21e65b5a0b037f7f1a5` — `perf(fonts): subset variable Inter by Unicode range`
- Rank 4: `4fc93bcbee3b4b38bc1b75b0c5ae4ca908ab16a0` — `perf(attachments): replace file icon package with Lucide`
- Rank 6: `7626324a0e9105cbe87881dd1c636928d4d2143d` — `perf(compose): defer Markdown editor wrapper and styles`

Main-route first-load assets, exact bytes (raw / separately gzip level 6):

- JS: **2,413,531 / 722,139 → 2,387,029 / 712,639**; savings **26,502 / 9,500**. Still 23 initial JS chunks.
- CSS: **935,362 / 125,387 → 903,255 / 119,264**; savings **32,107 / 6,123**. Seven initial CSS chunks become four.
- Latin font: **352,240 → 105,344 actual WOFF2 response-body bytes**, saving **246,896 bytes (70.1%)**. Independently gzip-compressed font estimates: **351,779 → 105,392**; the observed font response was served without further compression.
- JS + CSS + Latin font raw total: **3,701,133 → 3,395,628**, saving **305,505 bytes**. No HTML/RSC, API, icon or runtime-config bytes included.

The baseline is the supplied analysis on this exact source tree, with exact
numbers retained in `/tmp/perf-bundle/{measurements-summary,css}.json`. No
baseline rebuild or other worktree was used. These are asset budgets, not LCP
or CPU-time measurements. Net route deltas are combined results, not isolated
per-commit production builds.

## Per-rank

### Rank 1: complete variable-font subsets

Replaced the full upright Inter file with six committed subsets. Added
`build-scripts/subset-fonts.py`, pinning FontTools 4.67.0 / Brotli 1.2.1 in the
documented generation command and verifying the original source SHA-256.
The script generates WOFF2 assets, `lib/ui/fontSubsets.json`, global CSS faces,
and the font README with source/version/command/per-file SHA-256 checksums.
Timestamp rewriting is disabled; a second final generation reproduced all six
WOFF2 SHA-256 checksums exactly.

The app and HtmlMessage iframe both use family `Inter`, normal style, weight
100–900, `font-display: swap`, and the same disjoint Unicode ranges. The shared
iframe declarations are generated from the metadata. Existing globals tests
compare every compiled global face against the iframe declarations and verify
the vendored files. The full original file has no remaining consumer and was
removed. Docker/application builds use committed assets, without font download
or generation.

Programmatic coverage output from the final generation:

```text
latin: 284 code points; 105344 bytes; axes=[('opsz', 14.0, 14.0, 32.0), ('wght', 100.0, 400.0, 900.0)]
vietnamese: 107 code points; 16564 bytes; axes=[('opsz', 14.0, 14.0, 32.0), ('wght', 100.0, 400.0, 900.0)]
latin-ext: 792 code points; 151960 bytes; axes=[('opsz', 14.0, 14.0, 32.0), ('wght', 100.0, 400.0, 900.0)]
greek: 338 code points; 38900 bytes; axes=[('opsz', 14.0, 14.0, 32.0), ('wght', 100.0, 400.0, 900.0)]
cyrillic: 251 code points; 52156 bytes; axes=[('opsz', 14.0, 14.0, 32.0), ('wght', 100.0, 400.0, 900.0)]
remainder: 1080 code points; 149788 bytes; axes=[('opsz', 14.0, 14.0, 32.0), ('wght', 100.0, 400.0, 900.0)]
Coverage: 2852/2852 original code points; missing=0; duplicates=0; axes preserved in all 6 subsets
```

The check reopens every saved WOFF2, unions **all Unicode cmap tables**, checks
each subset against its assigned code points and all previous subsets, then
compares the union and both complete axis tuples against the original.
All layout features are retained during subsetting.

Focused test: `bun test app/globals.test.ts`: **13 pass, 0 fail**, 226 assertions.
Production Chromium check: Latin-only `/` sign-in page requested only
`InterVariable-latin.woff2`, **105,344 encoded/decoded body bytes** and 105,644
transfer bytes including response overhead. A same-origin srcdoc iframe with
matching face declarations and `Latin Hello Grüße` requested only Latin at
weights 400/900; body bytes 105,344, transfer 300 on cache revalidation. A mixed
fixture `Grüße Łódź Ελληνικά Привет Tiếng Việt ←` loaded all six appropriate
subsets and passed `document.fonts.check` at both weights.

### Rank 4: attachment icons

Replaced decorative react-file-icon SVGs/default-style tables with existing
Lucide `File`/`FileText` icons and a visible uppercase extension label. Filename
extensions take priority, including unknown extensions and `.7z`; extensionless
files retain MIME inference or show `FILE`. Long labels truncate visually with
the full extension available in a title. Icons/labels are decorative to assistive
technology; existing filename/action/loading labels remain.

Preview, inline-image hover/removal section, download/download-all, delete,
loading/error and retry behavior remain in the existing component. No message
or message-list callers were edited. `grep -rn react-file-icon app lib` returned
no matches before removing the dependency. Removed its unused ambient type
declarations and ran `bun install`; the lockfile drops react-file-icon and colord
without version updates to other packages.

Before: analysis isolated react-file-icon package bundle **27,174 raw / 10,091
gzip bytes**. After: no app/lib import or emitted server source-map path for
react-file-icon, colord, or prop-types; the icon package contribution is absent.
Lucide is already shared, so the old isolated package size is not a standalone
route saving. Combined measured main-route JS saving is **26,502 / 9,500 bytes**,
including font metadata, wrapper movement and chunk regrouping.

Focused verification:

- `bun test app/components/AttachmentsList.test.ts`: **14 pass, 0 fail**.
- `bun test --config=bunfig.dom.toml app/components/AttachmentsList.dom.test.tsx`: **5 pass, 0 fail**.
- DOM coverage includes filename/size/extension, unknown extension, inline image
  section and accessible removal labels, actual remove/retry callbacks, download
  URL/filename, and loading/error states.

### Rank 6: lazy Markdown wrapper and CSS

`ComposeMessageField` dynamically imports the wrapper only when its Markdown
branch mounts. The wrapper now statically imports MDEditor and its CSS inside
that boundary, avoiding a second nested lazy load. A status message covers the
first download. The Turbopack chunk loader resolves the JS/CSS group before the
editor is shown.

Before: UIW editor/preview rules were in eager CSS despite the vendor JS already
being lazy; the analysis estimated 5–6 KB gzip of eager vendor CSS. After:
**zero eager main-route CSS files contain `.w-md-editor` or `.wmde-markdown`**.
The lazy group is `10lv37.e6ibm0.js` (**875,701 / 305,567 bytes**) plus
`0x.ysqq8xg01y.css` (**69,531 / 10,486 bytes**). The latter is a bundled CSS group,
not a package-only attribution; the former Markdown async JS was already
**875,919 / 305,404 bytes**, and the former async CSS was **34,078 / 5,978 bytes**.
Do not claim the existing ~305 KB lazy JS as a new startup saving.

Net main-route CSS saving across all changes is **32,107 / 6,123 bytes**. Global
CSS grows **804,065 / 101,957 → 807,411 / 103,399 bytes**, including the six font
declarations and extension presentation; remaining stylesheet groups also
regroup, so this is not an isolated rank-6 gzip attribution.

Focused conversion test: `bun test app/components/mailclient/composition/composeTabSwitch.test.ts`:
**28 pass, 0 fail**. Production browser: before Markdown selection, no editor JS
or CSS request and no vendor style rules; on first open, the first animation
frame containing the editor had its stylesheet loaded, editor `position:
relative`, toolbar `display: flex`, toolbar height **29 px**. No unstyled editor
frame was observed. Typed a synthetic heading and two lines: preview rendered
the heading and one line-break element. Switching Text → Markdown retained the
content and produced no additional editor asset requests. Screenshot inspection
confirmed styled toolbar/editor/preview; console had no errors.

## Skipped and why

No requested rank was skipped. Ranks 2/3/5/7 and unrelated baseline lint/type
issues were outside this implementation scope. No file from the no-touch list
changed. No dev server was used; one production server ran temporarily on port
3794 and was stopped by its verified exact PID.

## Verification

All repository commands used cwd `/home/monkey/code/noctua-mail/wt-perf-assets`.
Long commands used `nice -n 10`. Scratch output is under `/tmp/perf-assets`.
Application tests/build/start were explicitly directed to the authorized data
directory; browser API fixtures were synthetic, in-memory responses, never
saved accounts or remote IMAP/SMTP connections.

Exact principal commands:

```sh
cat AGENTS.md
cat /home/monkey/code/noctua-mail/briefs/perf-client-bundle.md
git branch --show-current
git log -1 --oneline
git status --short

# Original font copied to scratch before removing the full vendored asset.
cp public/fonts/InterVariable.woff2 /tmp/perf-assets/InterVariable.woff2
nice -n 10 uv run --cache-dir /tmp/perf-bundle/uv-cache \
  --with fonttools==4.67.0 --with brotli==1.2.1 \
  python build-scripts/subset-fonts.py /tmp/perf-assets/InterVariable.woff2 \
  > /tmp/perf-assets/font-coverage.txt
sha256sum public/fonts/*.woff2 > /tmp/perf-assets/fonts-before.sha256
# Re-run the same generation command, then:
sha256sum -c /tmp/perf-assets/fonts-before.sha256
# All six OK.

nice -n 10 bun test app/globals.test.ts
nice -n 10 bun test app/components/AttachmentsList.test.ts
nice -n 10 bun test --config=bunfig.dom.toml app/components/AttachmentsList.dom.test.tsx
grep -rn react-file-icon app lib
nice -n 10 bun install
nice -n 10 bun test app/components/mailclient/composition/composeTabSwitch.test.ts

NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-assets \
  nice -n 10 bun run test:ci > /tmp/perf-assets/test-ci.log 2>&1
NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-assets \
  nice -n 10 bunx tsc --noEmit > /tmp/perf-assets/tsc.log 2>&1
grep -c 'error TS' /tmp/perf-assets/tsc.log
NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-assets \
  nice -n 10 bun run lint > /tmp/perf-assets/lint.log 2>&1
NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-assets \
  nice -n 10 bun run build > /tmp/perf-assets/build.log 2>&1
nice -n 10 bun /tmp/perf-assets/measure.cjs > /tmp/perf-assets/measurements.log
NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-assets \
  nice -n 10 bun run start --port 3794 > /tmp/perf-assets/server.log 2>&1

rg -l 'react-file-icon|node_modules/colord|node_modules/prop-types' \
  .next/server/chunks --glob '*.map' > /tmp/perf-assets/removed-modules.txt
wc -l /tmp/perf-assets/removed-modules.txt
git diff --check 0beb9a6
git status --porcelain=v1
```

Results:

- Full `test:ci`, run once: **1,705 unit + 55 DOM pass**, **0 failures** (baseline
  1,705 + 53; two attachment DOM tests added).
- Explicit `tsc --noEmit`, run once: exit 2, **356 `error TS` lines**, unchanged
  from the supplied baseline. Existing bun:test declaration noise remains.
- Lint, run once: exit 1, **1 error + 27 warnings**, unchanged. Error remains
  `useCalendarConflicts.ts` / `react-hooks/set-state-in-effect`.
- Production build, run exactly once: **passed**; compilation 11.2 s,
  build TypeScript 20.2 s, static generation 21/21. No build/font network input
  was added.
- Removed-module source-map search: **0 files**.
- No-touch diff-path check: **0 matches**. `git diff --check`: clean.
- Final `git status --porcelain=v1`: empty.

Size methodology matches the analysis: unique `firstLoadChunkPaths` from
`.next/diagnostics/route-bundle-stats.json` for JS; unique `entryCSSFiles` paths
from each route's `page_client-reference-manifest.js` for CSS. Each HTTP asset
is read independently and gzip-compressed at level 6, then summed. Polyfills
listed separately from modern first-load JS are excluded. Measurement script
and output: `/tmp/perf-assets/{measure.cjs,measurements.json,measurements.log}`.

Browser tools used: T3 `preview_status`, `preview_open` (incognito),
`preview_navigate`, `preview_snapshot`, `preview_evaluate`, `preview_wait_for`,
`preview_click`, `preview_type`, and `t3_preview_close`. For compose, navigated
to `/compose/window?handoff=perf-assets-fixture`, installed an in-memory fetch
fixture for `/api/accounts` and `/api/accounts/perf-assets/folders`, then supplied
a synthetic ready handoff in localStorage. Only those two API reads occurred
during initial fixture setup. No send was attempted. A requestAnimationFrame
probe installed before the Markdown click captured first-render stylesheet
state; ResourceTiming captured font and lazy asset response-body bytes.
Evidence: `/tmp/perf-assets/browser-checks.json`. Both browser tabs were closed;
the server's port-3794 socket PID was checked against this worktree and its
Next command line before SIGTERM. Its launch session exited 143 as expected.

## Risks

- Mixed-script content may request several subsets; downloading all six costs
  **514,712 bytes**, versus 352,240 for the full font. Combining marks and
  cross-range shaping/kerning can span subset boundaries; coverage and both
  variable axes are verified, but this is not an exhaustive typographic audit.
- Font URLs changed. Existing tabs with cached old CSS can temporarily request
  the retired full-font URL across a deployment; reload refreshes the CSS.
- Markdown's first use still downloads the existing large editor group, now
  with its deferred CSS and loading status. This pass does not defer Markdown
  conversion/viewer code (rank 2).
- Turbopack regrouped CSS across detached routes. Exact before → after bytes
  (raw / gzip), measured by the same manifest method:
  - Compose JS: **1,613,824 / 491,056 → 1,589,024 / 482,065**;
    CSS **902,615 / 120,373 → 903,255 / 119,264**.
  - Message JS: **1,552,941 / 469,008 → 1,528,765 / 460,153**;
    CSS **892,967 / 118,001 → 903,255 / 119,264**.
  - Calendar JS: **1,201,402 / 360,614 → 1,200,880 / 360,477**;
    CSS **880,808 / 115,334 → 903,255 / 119,264**.
  Message/calendar CSS therefore increases by **1,263 / 3,930 gzip bytes**
  respectively, despite main-route savings. No bundler/config changes were
  made to override this grouping.
- Baseline lint/type errors remain; no claim of a globally clean type/lint run.

## Files touched

- `build-scripts/subset-fonts.py` (new).
- `public/fonts/InterVariable-{latin,latin-ext,greek,cyrillic,vietnamese,remainder}.woff2` (six new files).
- `public/fonts/InterVariable.woff2` (removed), `public/fonts/README.md`.
- `lib/ui/fontSubsets.json` (new), `lib/ui/fonts.ts`.
- `app/globals.css`, `app/globals.test.ts`.
- `app/components/AttachmentsList.tsx`, `AttachmentsList.test.ts`, `AttachmentsList.dom.test.tsx`.
- `types/react-file-icon.d.ts` (removed), `package.json`, `bun.lock`.
- `app/components/ComposeMarkdownEditor.tsx`.
- `app/components/mailclient/composition/ComposeMessageField.tsx`.
- This requested external brief: `/home/monkey/code/noctua-mail/briefs/perf-client-assets.md`.
