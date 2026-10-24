# Package A / A1 — draft clock and virtual-list geometry

- Date: 2026-10-23 UTC.
- Worktree: `/home/monkey/code/noctua-mail/wt-ui-perf-a1`.
- Branch: `perf/ui-clock-geometry`.
- Base: `34dd18e5`.
- Commit: `16f54552f03a3a30ec80abf697fdbdce68d19e8b`.
- Status: implemented, self-checked and committed locally. No push, merge or deployment.

## Implementation

`DraftSavedLabel` owns the one-second timer. `ComposeActions` uses this leaf in the shared footer consumed by inline compose and compose windows. The text-only leaf adds no DOM wrapper and retains the existing formatter, translation keys, second/minute rounding and locale changes. Saving, error and unsaved states unmount the label and stop its timer.

`MailClient.tsx` loses only 16 lines: the saved-at mirror, root tick state, interval and callback subscription. Both existing formatter props remain in place. On this base the shell status surface displays absolute timestamps, not a second saved-draft label; its formatter interface and presentation remain unchanged. `ComposeOrchestrator.onDraftSavedAtChange` remains available because detached compose uses it to announce completed draft updates; only its obsolete clock comments changed.

`VirtualizedList` observes the scroll element with `ResizeObserver`, using the existing animation-frame scheduling for observer, scroll and window-resize events. Zero-height or non-rendered scroll elements never overwrite the last visible measurement. Reveal measures the actual pane height and relative scroll offset. Cleanup disconnects the observer and cancels any pending frame.

## Before / after

Production Chromium, real `MailClient`, synthetic 300-message inbox and an autosaved draft, with the same 65-second idle window in both runs:

| Measurement | Before | After |
| --- | ---: | ---: |
| MailClient function renders during 65 seconds | 134 | 4 |
| Additional parent renders in isolated 65-tick DOM test | — | 0 |
| Saved label after 65 seconds | Draft saved 1m ago | Draft saved 1m ago |
| Visible rows after mobile reader → resize → Back | 0 | 10 |
| Scroll offset after Back | 18,000 px | 18,000 px |

The full-fixture render reduction is 130 renders, approximately 97%. The remaining four renders are included in the result; this does not claim every other workspace update was eliminated.

Browser measurement used an uncommitted counter at the beginning of the actual `MailClient` function, incrementing `globalThis.__a1MailClientRenders`. The counter was removed before the final build and commit. Initial/final counts were 89/223 before and 90/94 after. DOM tests separately prove that every second updates the label without rendering its compose parent, and pin removal of the root clock subscription.

Mobile sequence: 390×844, scroll to 18,000 px, open a visible message, resize through 844×390 and 390×430, restore 390×844, then Back. The smaller viewport simulates keyboard space; no native mobile keyboard/device was used. After the change, before-opening and after-Back geometry is identical: pane height 796 px, ten visible rows, first visible row top 69 px, last bottom 843 px. A separate DOM test covers a changed reveal height larger than the 720 px fallback, hidden scrollTop=0 events, initially hidden mounting, subsequent container-only resizing and observer/frame cleanup.

## Gates

- `bun check`: PASS, zero type errors in 1,309 files.
- ESLint on all seven touched files: PASS, zero errors and zero new warnings. Existing warnings remain 73 in MailClient and 44 in ComposeOrchestrator, with unchanged per-rule counts; other touched files have zero warnings.
- Focused DOM run: PASS, **75 tests, 348 assertions, zero failures** across DraftSavedLabel, VirtualizedList, ComposeHeader, ComposeFields, MessageListOrchestrator and BottomStatusBar. Includes the 65-tick isolation test, language switch/new-save/state/cleanup checks and the geometry regressions.
- Production browser before/after scenario: PASS in both runs; before records the defect, after asserts preserved scroll position, visible-row count and exact row geometry.
- Final `bun run build`, without instrumentation: PASS, including its typecheck.
- `git diff --check`: PASS.

The existing `scripts/runQaShellBrowserTests.ts` workflow supplied isolated auth/storage and local synthetic IMAP/SMTP fixtures. Ports were explicitly 4010 (app), 4011 (IMAP), 4012 (fixture control), 4013 (SMTP). Both harnesses stopped their own processes and removed their storage. No live preview, ROOT/data, external mail server, existing credentials or existing services were accessed or changed.

## Evidence and reproduction

Artifacts: `/home/monkey/code/noctua-mail/briefs/t3-learnings/package-a-evidence/`.

- `a1-before-desktop.png`, `a1-after-desktop.png`: unchanged desktop compose layout; synthetic fixture timestamps differ by run time.
- `a1-before-390.png`, `a1-after-390.png`: blank-pane reproduction and corrected mobile list.
- `a1-before-metrics.json`, `a1-after-metrics.json`: raw browser counters and geometry.
- `a1-check.txt`, `a1-dom-tests.txt`, `a1-lint.json`, `a1-build.txt`: gate output/summary.
- `a1-browser.spec.ts.txt`, `a1-playwright.config.ts.txt`: exact measurement fixture/config, retained as evidence rather than application code.

For the browser reproduction, copy the two evidence text files back to the worktree's `.tmp/a1-browser.spec.ts` and `.tmp/a1-playwright.config.ts`. Add the temporary root counter only to the measured build, then run:

```sh
TMPDIR="$PWD/.tmp" NOCTUA_DATA_DIR="$PWD/.tmp/build-data" nice -n 15 bun run build
TMPDIR="$PWD/.tmp" A1_PHASE=after QA_SHELL_PORT=4010 QA_SHELL_USE_BUILD=1 \
  QA_ROUND2_FIXTURE=1 QA_SHELL_FIXTURE_IMAP_PORT=4011 \
  QA_SHELL_FIXTURE_CONTROL_PORT=4012 QA_SHELL_FIXTURE_SMTP_PORT=4013 \
  nice -n 15 bun scripts/runQaShellBrowserTests.ts --config=.tmp/a1-playwright.config.ts
```

Use `A1_PHASE=before` for the baseline (it records the blank-list defect without asserting corrected geometry). Remove the counter and rebuild afterwards. Temporary worktree scratch was removed after preserving the artifacts above. No additional review task or full CI run was launched, per the A1 fast-lane gates.
