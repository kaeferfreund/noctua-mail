Implemented and committed on `fix/html-viewport-units`.

Commit: `c3bacdbd1270a58b3e1e01a724464e2ba784fcd2` — `fix(html): decouple email viewport heights from iframe sizing`

Changed files:

- `app/components/HtmlMessage.tsx`: captures host height, freezes viewport CSS lengths, strips copied body height constraints, and enforces natural height on the preview root/body/content with ID specificity and `!important`; exports the builder for verification. The measurement strategy is unchanged.
- `lib/html/viewportUnits.ts`: pure CSS/HTML rewriting and body-height stripping; preserves strings, comments, URLs, identifiers, non-style attributes, visible text, and width units. Handles all requested units, signed/decimal values, uppercase, nested calc, encoded attributes and escaped identifiers.
- `lib/html/index.ts`: re-exports the new helpers.
- `lib/html/viewportUnits.test.ts`: 26 helper regression tests.
- `app/components/HtmlMessage.test.ts`: 9 builder output tests.

Validation:

- Focused unit tests: 35 passed, 0 failed; 43 assertions.
- `bunx eslint` on all five changed files: passed, zero warnings/errors.
- `bun run test:ci`: 1,741 primary tests across 200 files plus 69 DOM tests across 13 files; 1,810 passed, 0 failed.
- `bun run build`: passed, including Next.js compilation, its TypeScript phase, and static generation.
- `bun check`: FAILED with 356 existing diagnostics (205 TS2307, principally missing `bun:test` declarations, plus 151 other existing errors). A TypeScript compiler-host comparison loading the original tracked files from HEAD before committing, excluding the added files for baseline, confirmed identical baseline/current diagnostic lists: zero introduced errors. No unrelated type fixes were made.
- `git diff --check`: passed; worktree clean after commit.

Chromium verification used the real builder plus sanitizer, the unchanged ResizeObserver/rAF sizing formula, a 900 px host viewport, and only synthetic fixtures. Baseline builder was extracted from `team-inbox` without stash or checkout changes. Every measurement lasted 1.9 s; widening was followed by another 1.9 s. Update counts are cumulative.

| Fixture | Before height (px) | Before updates | After height (px) | After updates |
| --- | ---: | ---: | ---: | ---: |
| a. Auth0-like body height:100vh | 150 | 2 | 726 | 2 |
| b. Framed body min-height:100vh | 2550, still growing | 114 | 742 | 2 |
| c. Body .h-screen class, important | 150 | 2 | 726 | 2 |
| d. html/body height:100%, width 500 → 1000 | 2880 → 2880 | 2 → 3 | 2880 → 1392 | 2 → 4 |
| e. Control without viewport units | 726 | 2 | 726 | 2 |
| f. MailChimp body/#bodyTable important rules | 150 | 2 | 726 | 2 |
| g. Nested 50dvh / 2vmin card | 122 | 7 | 526 | 2 |

All fixed cases settled. For each, `.noctua-email-viewport.clientHeight === scrollHeight`; the Auth0-like case is 726/726 versus baseline 150/686. The widened fixed case also settled at 1392/1392. The baseline framed minimum-height case continued growing during the final 300 ms stability sample.

Verification script copied to `/home/monkey/code/noctua-mail/briefs/html-viewport-units-verify.mjs`; run with `bun /home/monkey/code/noctua-mail/briefs/html-viewport-units-verify.mjs`. It imports playwright-core by the required absolute path, imports the real TS builder with Bun, blocks network requests and asserts settlement, no clipping, shrinking and unchanged control height.

No design deviation. The host unit falls back to 8 px (800 px viewport) when unavailable and remains fixed until the preview document rebuilds. Height/orientation/aspect-ratio media queries remain out of scope and still evaluate against the iframe. The existing whole-repository `bun check` failures remain the only failing requested check.

No dependencies added, servers started, pushes, merges, PRs, deployments or credential changes. Only the authorized worktree and the requested verification-script copy were written under the project root.
