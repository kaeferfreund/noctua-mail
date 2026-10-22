# perf-settings-modal-lazy

## Summary

Commit: `ddf5406794441283e881361f1fe78bc84f7012b3` — `perf: lazy-load account settings modal`. Worktree verified clean after the single commit; no push or other branch operation.

Implemented the account-settings modal lazy boundary on `perf/settings-modal-lazy`, based on `435ba5d`, in `/home/monkey/code/noctua-mail/wt-perf-settings`. The main route saves **51,186 raw JS bytes / 9,590 gzip bytes**. Including CSS, the saving is **50,975 raw bytes / 9,030 gzip bytes**.

**Verification limitation:** the modal and eight settings tabs leave the eager graph, but the shared Account and Members tabs remain eager through the existing admin UI. Removing those remaining paths requires changes outside the allowed scope, so implementation stopped at the requested modal boundary. No protected files were changed.

## What changed

- Replaced the static `AccountSettingsModal` import in `MailClient.tsx` with `next/dynamic`, using `ssr: false`. `ManageTab` is imported with `import type`.
- Preserved the existing `{manageOpen && editingAccount && (...)}` mount and every prop exactly.
- Scheduled a speculative import with the existing `deferUntilIdle` helper. It uses `requestIdleCallback` with a 1,500 ms deadline, or the helper's 1,000 ms timer fallback, and cancels the scheduled callback on unmount. Import failures are caught for this speculative request; an actual open uses the normal dynamic loader.
- Added a text-free Radix spinner over a shaded full-screen overlay during a cold open. No empty dialog mounts while the chunk loads. The existing “Settings” wording is reused only as the status's accessible label.
- Added three focused DOM scenarios using the real `MailClient` and modal: cold opening, idle warming, and canceling warm-up on unmount. Each runs in a fresh Bun process because other settings tests statically import the modal. Tests replace only fetch/EventSource and idle scheduling, avoiding shared-module mocks or production exports added for testing.
- `AccountSettingsModal.tsx` needed no export adjustment and was not edited.

## Before/after bytes

Two successful production builds were run, exactly one before editing and one after. These are fresh measurements of this worktree, rather than the older branch measured in the original performance brief.

| Main route `/` | Before raw bytes | After raw bytes | Change raw bytes | Before gzip bytes | After gzip bytes | Change gzip bytes |
|---|---:|---:|---:|---:|---:|---:|
| JS | 2,314,843 | 2,263,657 | −51,186 | 694,060 | 684,470 | −9,590 |
| CSS | 909,784 | 909,995 | +211 | 120,228 | 120,788 | +560 |
| JS + CSS | 3,224,627 | 3,173,652 | −50,975 | 814,288 | 805,258 | −9,030 |

JS asset count changes from 25 to 27; CSS from 4 to 5. CSS is repartitioned and its separately compressed total rises slightly. No CSS saving is claimed.

Measurement follows `perf-client-bundle.md` methodology: deduplicate `/`'s `firstLoadChunkPaths` from `.next/diagnostics/route-bundle-stats.json`; deduplicate CSS paths from `entryCSSFiles` in `.next/server/app/page_client-reference-manifest.js`; read each asset and sum `bytes.length` and `zlib.gzipSync(bytes, { level: 6 }).length` independently. Fonts, polyfills, HTML/RSC and subsequent interaction/idle chunk requests are excluded. This measures the initial asset budget, not latency or total eventual downloads after warming.

Reproduction and evidence are retained in `/tmp/perf-settings/`:

- `measure.cjs`, `before.json`, `after.json`, `baseline-chunks/`.
- `verify-boundary.cjs`, `boundary.json`: TypeScript static-import traversal excluding type imports/dynamic imports, plus retained string literals from emitted chunks.
- Build logs: `/tmp/perf-settings-baseline-build.log` and `/tmp/perf-settings/final-build.log`.

### Boundary evidence and scope limit

`AccountSettingsModal` and Signatures, Preferences, Categorization, Calendar, Topics, Recipient Aliases, MCP and Translation tabs are absent from the main route's static local import graph. Their retained literals move from the baseline eager `02wh2zzh50btc.js` to async `04jktg8kny2rk.js`, with no matches in the final route's eager chunks. The modal's loadable manifest entry `768578` references `0~cxtt7h7hq6t.js`, `04jktg8kny2rk.js`, and `014.nmnvxkjbs.css`; both JS files are outside the main route's first-load list. The linked CSS remains in the eager CSS set.

The full “all tab modules absent” verification cannot pass within this task's file restrictions:

- `MailClient → AdminPanel → AdminMailboxes → AccountTabContent / MembersTabContent` remains static.
- An additional path is `MailClient → AppShell → ShellSidebar → ShellUserMenu → AdminPanel → AdminMailboxes → those same tabs`. `shell/**` is explicitly protected. Changing only the imports in `MailClient` cannot eliminate this path.
- Final eager `0ad4mj45zbp36.js` retains Account's “Manage IMAP/SMTP credentials for syncing and sending.” and Members' “Access was revoked; server cleanup is pending.” literals. These modules are reused independently of the settings modal.

No admin/shell imports or components were changed. This retained sharing and actual chunk allocation mean the measured gzip saving is below the original 15–20 KB estimate.

## Tests

- Targeted DOM run: **21 passed, 0 failed**, covering the three new scenarios and all 18 existing `CollabSettings.dom.test.tsx` scenarios.
- `bun run typecheck`: **0 errors**, 1,093 files checked.
- `bun run lint`: **1 existing error + 25 existing warnings**, unchanged from the supplied baseline. The existing error is `react-hooks/set-state-in-effect` in `app/components/calendar/useCalendarConflicts.ts:58`; this task adds no lint findings.
- Both `bun run build` runs succeeded.
- `bun run test:ci` was invoked exactly once: **2,502 unit tests passed, 1 failed** in 288.74 s. The failure was `identities REST > viewer personal prefs are sparse, owner-only and validate mailbox/enabled identities; stale choices warn` in `app/api/accounts/[accountId]/identities/route.test.ts`. Its auth-fixture insert raised `SQLITE_BUSY: database is locked` in the Better Auth SQLite adapter. This unit test does not import the changed client/DOM test. CI therefore stopped before its DOM phase; a fully green single CI run is not claimed.
- Targeted retry of that identities test file: **3 passed, 0 failed**, including the failing case, in 3.11 s. No auth/database code was modified to address the transient contention.
- Ran `bun run test:dom` separately after CI stopped: **369 passed, 0 failed** in 42.45 s (baseline 366 plus the three new cases). Logs: `/tmp/perf-settings/test-ci.log`, `identities-retry.log`, and `test-dom.log`.
- `git diff --check`: passed.

The new DOM coverage confirms that importing/rendering the client does not load the modal before opening/idle, cold opening shows a text-free busy state and then the requested Account tab, tab changes propagate to Signatures, closing works, idle import does not mount the dialog or fetch preferences, and unmount cancels pending idle tasks. No browser server, visual timing measurement or mailbox data access was needed.

## Risks

- A cold open can show the spinner until JS and associated styles are ready; an idle warm-up moves that download out of the eager route budget. No first-open latency measurement is claimed.
- Account and Members remain eager because of independent admin imports, as detailed above. A broader admin boundary would need a separately authorized scope.
- The existing bootstrap renders `MailboxGate`/`CreateMailbox` when there are no accounts. That behavior is unchanged. The modal's loader does not depend on warm-up completing; the existing modal mount and props are unchanged, but no separate no-account browser flow was exercised.
- DOM tests validate loading/mount behavior; they do not measure styling or narrow-viewport rendering in a real browser.

## Files touched

Committed project changes only:

- `app/components/MailClient.tsx`
- New `app/components/mailclient/lazyAccountSettings.dom.test.tsx`

Requested external brief: `/home/monkey/code/noctua-mail/briefs/perf-settings-modal-lazy.md` (outside the worktree). No dependency, config, API, shell, hook, settings implementation, or data files were edited.
