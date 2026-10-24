# Sender identities slice 2 — fix round 6

Worktree: `/home/monkey/code/noctua-mail/wt-sender-2`; branch `feat/sender-identities-2`.
Base `dfdf852cf0c7637da3bbf5648decdbfeec31c5ff`; fixed head `327f6d96b21651a34f5178330bb9fb473b4990f3`. No pushes.

## Changes and draft failure audit

- `94601bb` — recheck the 2160 ms handshake deadline immediately after workerPause, before another whole attempt. Log the existing exhausted event with the actual completed attempt count and rethrow the last caught BUSY object. Ordinary five-attempt DML/COMMIT policy and every timeout/retry constant are unchanged. Added fake-timer delayed-wake regression with error identity, attempts, exhaustion metadata and timer cleanup assertions.
- `51fd5af` — use createSharedShardFixture and production b.seed for the other account; retain the three original assertions. Compatibility qualification: the requested r5 patch imports a module absent from this FTS-v2 branch. Its fixture hunk was applied, then the validator import/call was gated on FTS v3 using dynamic import. This runs the real validateFtsIdentity on the merged tree without adding a production compatibility shim or copying stage code into the branch.
- `327f6d9` — move input-only sender parsing and MIME byte sizing before shard/master writer acquisition. Database-dependent identity/collision decisions, file installation, live assertion and shard COMMIT remain guarded. No broader restructuring or budget changes.

`saveDraftForAccount` already performs MIME construction, threading, sanitization and source/attachment staging outside the master hold. `withOutboundWrite` acquires shard first, does read-only FTS-v2 planning, then master; it asserts live authorization and performs effects synchronously through shard COMMIT. The small remaining input-only preparation above could move out safely; database reads that choose replacement/collision identity must retain the current writer snapshot, and filesystem publication must retain rollback semantics.

For exhaustion during guarded acquisition, DML or COMMIT (the r5 failure was a handshake exhaustion after six short retries), both SQL transactions roll back; staged files are restored and cleaned up. An existing local draft, source, attachments and FTS survive. The new IMAP draft was appended before the upsert, and old-IMAP deletion occurs only after successful local storage, so the exhausted path preserves the old copy and can leave an additional new IMAP copy for later sync. Generic BUSY currently propagates through the save route as a server error. useDraftManager retains editor contents, draft ID, saved hash and dirty state, reports the error with a save-failed fallback, and ComposeActions displays “Draft save failed”. A failure during later post-commit thread/signal maintenance can instead leave the new local draft committed while still reporting failure; the old IMAP copy is still not deleted. This is not a promise that unsaved editor changes survive closing/reloading the browser. The commit body records this behavior.

## Reviewer deadline contract

Copied r5 budget.test.ts into `sender-identities-slice2-regressions-r6/budget.test.ts`, changing only its import path. **1 pass / 0 fail / 2 assertions**: attempts 1, start times [0], elapsed 2201 ms, original BUSY rejected. Initial branch retry + outbound suites: **17 pass / 0 fail / 88 assertions**.

## Final integration resolution

Merge fixed head with `11dc3c5` (the requested origin/integration/stage commit) in the requested disposable worktree. The same three production conflict blocks remain; r6 preparation auto-merges.

1. Keep the stage prepareFtsIdentityWriter import, `const ftsWriter = prepareFtsIdentityWriter(db)` and `const deleteFts = ftsWriter.remove`. Keep indexed scope FTS deletes through message_fts_identity. Drop the complete v2 raw insert/delete statements, plannedFtsRows and prepareFtsDeletes.
2. Retain the auto-merged replacedRow computation, ftsWriter.lookup and deleteFts before insertMessage. Keep `ftsWriter.insert(accountId, rowId, ftsRowid, [`; remove the extra post-message deletion and raw insertion.
3. Close FTS insertion with `]);`; remove the planned-rowid update.
4. Remove the dangling prepareFtsDeletes argument to authorizedWrite. Retain final authorization assertion, shard/master lock order, rollback and master exclusion through shard COMMIT.
5. Keep the branch’s adapted shared-shard fixture and version-gated real v3 validator. No additional fixture merge edit is needed.
6. Retain r6 preparedMessages outside the writer callback, and its fromEmail/sourceSizeBytes use inside upsertBatch.

Concrete branch-to-merge production patch: `sender-identities-slice2-regressions-r6/integrator-resolution.patch`; resolved upsert snapshot: `merged-upsert.ts.txt` in the same directory. Stage ftsIdentity.ts, messages/delete.ts, schema.ts and shardFormat.ts were byte-compared to 11dc3c5 and are unchanged.

## Verification and measurements

All gate commands use `nice -n 15` (their nice-15 supervisor makes child niceness effectively 19). Preserved load protocol uses runner nice 10 and effective timed children nice 19, as in r5. No gates overlap accepted measurement windows.


Protocol admission load was 9.24/10.44/12.89; first actual timed admission was 11.11/10.67/12.86 (<14). Subsequent windows continue the admitted paired protocol. Control is **dfdf852**, not the older r5-review baseline 9424150. Sequence base → r6 → r6 → base; each accepted window is 60,000 ms, with 11,000 synthetic rows, production draft service, two direct sync subprocesses, mailbox watcher, one injection/second, separate auth writer every 50 ms with zero timeout, runner nice 10 and timed children effective nice 19. No gates overlapped. Fixture listeners used only 3834/3835.

| Window | Saves/failed | Exhaustions | Auth attempts/BUSY | Sync A done/failed | Sync B done/failed | Watcher active/cycles | Start load 1/5/15 | End load 1/5/15 |
|---|---:|---:|---:|---:|---:|---:|---|---|
| base-1 | 1532/0 | 0 | 1065/209 | 144/0 | 150/0 | 95/55 | 11.11/10.67/12.86 | 15.49/11.76/13.08 |
| r6-1 | 1405/0 | 0 | 1060/186 | 134/0 | 134/0 | 91/52 | 15.43/12.36/13.22 | 16.51/13.42/13.54 |
| r6-2 | 1858/0 | 0 | 1103/170 | 144/0 | 154/0 | 112/65 | 13.38/13.07/13.42 | 13.40/13.01/13.37 |
| base-2 | 1250/0 | 1 | 1028/194 | 94/0 | 114/0 | 87/45 | 18.86/14.63/13.90 | 21.61/16.12/14.46 |

Both r6 windows had zero draft failures, zero retry exhaustions and zero direct sync failures, closing the requested P2 zero-failure measurement criterion for this run. Mean draft saves: control 1391, r6 1631.5 (117.29%); auth BUSY: 201.5 → 178 (88.34%); sync A: 119 → 139 (116.81%); sync B: 132 → 144 (109.09%); watcher active: 91 → 101.5 (111.54%); retry exhaustions 0.5 → 0. No failing r6 operation required attempts/elapsed reporting. Shared-host load varied substantially, so these windows are evidence for the stated criteria, not a controlled capacity claim.

Raw results and instrumentation: `sender-identities-slice2-regressions-r6/load/measurement.json`, each measure-*-results/main.json, child-*.json, metrics/*.json and logs. All four per-window child commands succeeded and summaries were flushed. The tool session later reported wrapper exit 143 despite the final base-2 completion line and complete four-window results; results are retained without rerunning or discarding any sample. Both fixture ports were confirmed closed before gates began.

All requested gates are complete. Full CI ran on the branch; merged validation ran the requested focused and probe suites (no merged full-CI/build/lint was requested).

| Branch gate | Result | Seconds |
|---|---|---:|
| Typecheck | 0 errors / 1,178 files | 1.57 |
| Focused ×3 | 342/0 per run / 49 files / 1,220 assertions per run | 62.97 / 53.93 / 53.51 |
| Additional identity migration suite ×3 | 4/0 per repetition; 12/0 total / 36 assertions | 4.11 |
| Full CI | 2,778 server + 433 DOM; zero failed | 510.66 |
| Lint | exit 1, unchanged 1 error / 25 warnings; no changed-file findings | 58.91 |
| Production build | exit 0 | 100.79 |
| git diff dfdf852 --check | exit 0; repeated after cleanup | 0.01 |

The focused selection covers all outboundWrite/dbWriteRetry/drafts tests, sender identity and authorization suites, calendar guard callers, and the message upsert suites (messagesCore, sameFolderMessageCopies, sharedShard, collisionVariantInlineImages, attachmentUrls, messageSizes, aiFlags). The separate four-case identity migration suite was also repeated three times. Full CI includes all of these together. Lint’s existing error remains `app/components/calendar/useCalendarConflicts.ts:58`; no timeout, retry constant, assertion or budget was relaxed.

| Merged-tree gate | Result |
|---|---|
| Frozen install | exit 0; lockfile unchanged |
| Typecheck | 0 errors / 1,198 files |
| Focused incl. FTS identity / shard / identity / upsert | 396/0 / 54 files / 1,746 assertions |
| Permanent guard/revocation/lease probes ×5 | 95/0 / 820 assertions |
| Reviewer adversarial probes ×5 | 40/0 / 235 assertions |
| Reviewer deadline contract | 1/0 / 2 assertions; one attempt, original BUSY |
| Whitespace / unresolved conflicts | exit 0 / none |

The reviewer adversarial source and crash worker were copied from r5 into the merged tree, used without assertion or budget changes (synthetic request URL port only changed to 3834), then removed. Final integration audit confirms no plannedFtsRows/prepareFtsDeletes or conflict markers, no guard-file changes, exact saved/tested upsert snapshot, and byte-identical stage FTS identity/delete/schema/shard-format modules.

Scratch worktree `ROOT/wt-sender-2-merge-scratch` was removed after validation. Branch is clean, HEAD remains `327f6d96b21651a34f5178330bb9fb473b4990f3`; three commits, 4 files changed, 55 insertions / 6 deletions; each commit has the requested Co-Authored-By trailer. No push, PR or deploy. No r5 evidence was modified.

Machine-readable gate commands, timings and per-gate start/end loads: `sender-identities-slice2-regressions-r6/verification-summary.json`, with raw logs in `logs/`. Overall start load: **8.53/10.94/13.44**. Overall end load: **15.24/16.22/14.23**. Gate scripts ran sequentially; no required validation remains running.

