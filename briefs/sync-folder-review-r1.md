**PIN+fix — retain `20d93cf` for round 9, with the two small fixes below before integration.** The incident is fixed; no P1 ownership-guard false positive reproduced. The new empty-folder repair cancellation loses legitimate repairs, and new cancellation notices are not localized.

Reviewed `9bc7e6c` + `20d93cf` against round 8 `11dc3c5`: 37 files, +789/−219. Checkout `/home/monkey/code/noctua-mail/wt-review-auth` remained detached and clean. Execution used a disposable tracked-source archive under `briefs/sync-folder-regressions-r1/source`; installed dependencies were copied, no `.env.local` was read or copied. Logs and synthetic probes are under `briefs/sync-folder-regressions-r1/`.

**Findings**

- **P2 — Current-account repairs are permanently cancelled by ordinary folder refreshes.** `app/components/mailclient/useEmptyFolderRepair.ts:29`, `:41`, `:50`–`:52`. The effect marks the folder attempted before its GET completes. Replacing `accountFolders` with an equivalent array runs cleanup, cancels that GET's continuation, then the next effect exits because the attempt marker remains. Folder count/SSE updates and `refreshFolders()` replace this array (`MailClient.tsx:591`, `:803`; `useSyncController.ts:1227`, `:1307`). Repro: `bun test --config=bunfig.dom.toml ../probes/review-repair.dom.test.tsx` from the disposable `source/`. Stable-array controls repair correctly; same-account, same-folder array replacement produces **zero syncs for total=0 and zero recomputes for total=2**: 2 pass / 2 fail. Fix: scope cancellation to selection/eligibility, and remove or defer the attempted marker when cleanup cancels a check before a repair actually starts. Preserve the once-only marker after launching repair to avoid a sync loop. Add positive tests for both totals with a folder refresh during the pending response; retain the old-account cancellation tests.

- **P2 — New selection-cancellation notices bypass de/en catalogs.** `app/components/mailclient/useSyncController.ts:383`, `:398`, `:440`–`:444`. Switching accounts while full-sync confirmation is pending produces the visible notice `Full sync cancelled before start. Reason: Mailbox selection changed before sync started.` The description comes from the newly added English literals; neither catalog contains the new reasons. `probes/review-notice.dom.test.tsx` confirms the notice is emitted (1 pass). The HTTP `folder_account_mismatch` code also has no specific client translation: `MailClient.tsx:494`–`:554` falls back to `Request failed (400)` plus path. Fix: map structured cancellation/mismatch reasons to de/en messages at the UI boundary; keep the machine error code stable. Test both locales.

**Ownership and false-positive probes**

`assertAccountFolder` checks the literal `${accountId}:` prefix with a nonempty mailbox path, then `SELECT 1 FROM folders WHERE accountId = ? AND id = ?` in that account's shard. Colons inside mailbox paths are preserved. Optional undefined/null scopes bypass validation; an explicit empty string is invalid. **39/39 additional guard/route probes passed** in `probes/review-guards.test.ts`.

| Case | Observed result |
| --- | --- |
| Own existing INBOX, nested path, path containing `:` | Accepted |
| Foreign existing ID, prefix collision, empty suffix, wrong type | Rejected |
| Own prefix but missing row; same-shard row owned by another account | Rejected |
| Folder not persisted yet | Explicit folder scope rejected; no-folder full bootstrap accepted |
| Watcher before first folder list | Derives undefined folder, launches full account sync; actual watcher bootstrap/ingestion passes in the full suite |
| Newly discovered IMAP folder | No speculative ID is queued by watcher; its planner consumes persisted folders. Full bootstrap and folder refresh persist discoveries before targeted requests |
| Virtual views | Real badge/all-folder requests accepted; `virtual:focused` as a physical folder ID correctly rejected |
| All folders / omitted or null sync scope | Accepted; candidate planning with omitted/empty list retains account-wide behavior |
| Cross-account copy A → B | B's destination accepted; A's destination rejected; thread source validated against A |
| Create root/subfolder | New child need not exist; only optional existing parent validated |
| Rename / delete | Existing source accepted; absent rename destination not validated as an existing folder |
| Threads with folder filter | Own existing folder accepted |
| Messages/threads with exclusions | Existing own exclusions accepted; foreign/missing exclusions rejected |

**Client and worker evidence**

The committed server suites passed 42/42 and the committed DOM suites 17/17 on each of three runs. This includes the 26 new route cases, five new library/queue cases, and seven new DOM cases. Sidebar switch and server-persisted create→self-grant→select clear both folder selections; retained old callbacks and confirmation continuations cannot sync the new account with an old folder.

The requested browser spec passed on app port **3886**, synthetic IMAP **3888**, SMTP **3889**. Account B's first request was `{ accountId: B, fullSync: true, mode: "full" }`, with no `folderId`; mismatched sync/candidates/poll each returned 400 with `{ ok: false, code: "folder_account_mismatch" }`. Four additional browser flows passed: `?messageId=`, `?openCalendar=1`, cross-account service-worker notification, and mobile sidebar switch. The initial four-flow batch hit the existing sign-in 429 limit on mobile; that case passed on its isolated rerun. Stable-selection empty-folder repair works; concurrent folder refresh is finding 1.

`probes/review-worker.test.ts`: **2 pass**. A payload made mismatched after queue admission reached the real Bun worker, exited 1 after one attempt, logged `FolderAccountMismatchError: folder_account_mismatch`, published status/phase `failed`, and emitted no retry phase. The next job on the same account completed; durable queue and lease counts returned to zero. Parent exit monitoring releases the lease after confirmed exit (`lib/syncJobs.ts:590`–`:603`, `lib/db/processLeases.ts:113`); immediate worker `process.exit(1)` does not strand it. A genuine connection failure still emitted retry attempt 1 / maxRetries 10.

Status-bar qualification: the job is failed, never retrying. This branch's existing `waitForSyncJob` finally clears completed/failed progress (`useSyncController.ts:333`); a persistent failed status entry depends on the compact-status branch's `retainSyncFailure`. Do not claim this branch alone retains the failed entry.

**Scope and API**

Changes in `scripts/verifyMailboxWatcher.ts` and `scripts/verifyProcessLeases.ts` only await the now-async `startSyncJob` in verification harnesses (2 and 4 call sites respectively); no fixture behavior or assertions changed. Internal `startSyncJob` now returns `Promise<SyncJob>`; all callers were audited. HTTP success/request shapes remain unchanged. Invalid or unknown physical scopes now return the specified 400, including cases that previously yielded 404 or were silently ignored. The production build included both new guard modules in standalone worker output. No schema, credential, or deployment changes.

**Gates**

| Gate | Result |
| --- | --- |
| `bun run typecheck` | Exit 0; no type errors in 1,205 files |
| New affected suites ×3 | Each run: 42 server + 17 DOM pass, 0 fail |
| Additional probes | 39 guard/route + 2 worker + 1 notice pass; repair repro 2 pass / 2 intentional fail |
| `nice -n 15 timeout 1800 bun run test:ci` | Exit 0; 2,835/0 server (306 files, 504.39 s) + 469/0 DOM (60 files, 70.07 s) |
| `nice -n 15 timeout 2400 bun run test:stress` | 8,505 pass / 0 fail; 306 files, 46,026 assertions, seed 1337, 1,542.45 s |
| `timeout 600 bun run lint` | Exit 1, baseline 1 error / 23 warnings; no additions |
| `nice -n 15 timeout 1200 bun run build` | Exit 0; compile 23.4 s, TypeScript 35.0 s, 31 static pages |
| Browser spec on 3886 | 1 pass; four additional selection flows pass across batch + isolated mobile rerun |

Round-8 lint was **1 error / 25 warnings**. Extracting startup sync removes the missing `syncAccountRef` warning; extracting repair removes the missing repair-ref dependencies warning. The remaining error is unchanged `app/components/calendar/useCalendarConflicts.ts:58` (`react-hooks/set-state-in-effect`); head is **1/23**, not a new lint regression.

Stress's first launch was reviewer-terminated for port-scope clarification (exit 143, no native crash); after the user explicitly permitted test-internal ephemeral loopback listeners, the full unmodified stress command was restarted. The completed attempt passed all 8,505 tests without SIGABRT or another native crash; no separate native-crash finding.

**Round-9/10 merge notes**

`git fetch origin` succeeded. Pairwise `git merge-tree --write-tree <ref> 20d93cf` results:

| Ref / reviewed head | Result |
| --- | --- |
| `origin/integration/stage` / `11dc3c5` | Clean, exit 0 |
| `origin/feat/sender-identities-2` / `dfdf852` | Exit 1; three conflict blocks in `lib/db/messages/upsert.ts` |
| `origin/feat/sender-identities-3` / `26d82d8` | Exit 1; five files, ten conflict blocks |
| `origin/fix/i18n-views` / `992b220` | Clean, exit 0 |
| `origin/feat/status-bar-compact` / `7a96887` | Clean, exit 0 |

- **Sender identities 2, upsert blocks 1–3:** keep round-8 `prepareFtsIdentityWriter`, `deleteFts = ftsWriter.remove`, `ftsWriter.insert(..., ftsRowid, [...])`, and matching closing syntax. Drop the older inline FTS insert/delete planner and its `plannedFtsRows` update; preserve the sender-identity SQL columns, binds, and exact-copy metadata fallback. All three conflicts already occur against round 8 without these two commits. No current `lib/syncOperation.ts` conflict at these heads; retain its new assertion and prefix slicing.
- **Sender identities 3, MailClient blocks 1–2:** union the `useSenderMessages` import with all four new sync/folder imports. Keep its `noctua:sender-settings-changed` refresh effect, then use the extracted guarded `useStartupSync` call instead of restoring the old inline startup effect. These are this branch's two newly introduced conflict blocks.
- **Sender identities 3, Preferences blocks 1–2:** retain `ReactNode` plus locale/translation imports; retain the `!senderPreferences` condition around the localized signature control and the sender preferences content.
- **Sender identities 3, resync-test blocks 1–2:** retain one subprocess-isolation scheme and both test assertions; use round-8 `runIsolated`/`NOCTUA_RESYNC_TEST_CHILD` consistently and remove the alternative wrapper/imports. Do not nest or duplicate both wrappers.
- **Sender identities 3, de/en blocks 1–2 in each file:** merge JSON objects by key. Retain sender identities/Compose sender/signature keys AND round-8 Admin members/preferences/roles plus Shell/Search/Views/Notifications keys. Preserve matching locale key sets. These Preferences, resync-test, and catalog conflicts already exist against round 8.
- **i18n-views:** clean textual merge preserves both extracted sync hooks and the folder ownership checks; it does not supply the missing new cancellation translations.
- **Compact status:** clean textual merge preserves ownership checks, disposal/cancellation guards, requested-folder progress, failure retention, and poll schedule state. Re-run selection-cancellation, failed-status retention, and repair probes on the integrated result; clean pairwise merges are not a full stacked build.

Load averages (1/5/15 min): **start 10.88 / 12.75 / 14.50; end 15.61 / 16.45 / 14.23**. Review-owned app/fixture processes stopped; reviewed checkout clean. Copied dependencies/build output removed; probes, source archive and logs retained.
