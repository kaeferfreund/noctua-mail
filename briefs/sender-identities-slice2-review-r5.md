PIN+fix

Merge in round 9 with the validated resolution **and fixture adaptation** below. Preview requires the retry-deadline fix and closure of the measured zero-failure gap. No new authorization bypass was reproduced.

Reviewed `d5ae17b..dfdf852`; source checkout remained clean at `dfdf852`. Baseline: `9424150`. Scratch merge: `dfdf852` plus stage `11dc3c5`, including FTS-v3 `36be023`. Resolved tree with the required fixture adaptation: `4632dd589817fb4f3ea213221bcfda5232fdefe3`. Execution used scratch-only fixture port adaptations.

**Independent load results — two-run means**

| Metric | Baseline | R5 | Requested target |
|---|---:|---:|---|
| Draft saves | 561.5 | 928.5 | 165.36% of baseline; ≥90% met |
| Draft failures | 0 | 0.5 | **Zero missed: one failure** |
| Retry exhaustions | 14.5 | 2.5 | ≤baseline met |
| Auth BUSY | 274.5 | 202 | ≤baseline met, 73.59% |
| Sync A completed | 23.5 | 84.5 | 359.57%; ≥90% met |
| Sync B completed | 66.5 | 80.5 | 121.05%; ≥90% met |
| Watcher active workers | 25.5 | 69.5 | 272.55%; ≥90% met |
| Sync failures | 8.5 | 1 | Two R5 operations failed |

| Sample | Saves/failed | Retries/exhausted | Auth attempts/BUSY | Sync A done/failed | Sync B done/failed | Watcher active/cycles |
|---|---:|---:|---:|---:|---:|---:|
| base-1 | 770/0 | 574/4 | 1040/243 | 46/2 | 95/1 | 40/16 |
| r5-1 | 1157/0 | 476/0 | 1056/161 | 108/0 | 97/0 | 81/48 |
| r5-2 | 700/1 | 650/5 | 941/243 | 61/2 | 64/0 | 58/28 |
| base-2 | 353/0 | 545/25 | 855/306 | 1/8 | 38/6 | 11/5 |

Auth pairs are **161 versus 243**, then **243 versus 306**. All results above are this review's measurements; implementer samples were not pooled.

Same preserved protocol: four clean 60-second windows; 11,000 synthetic rows; production draft service, two sync subprocesses, watcher, loopback IMAP, one injection/second and a separate 50 ms zero-timeout auth writer. Runner nice 10, timed children effective nice 19. No verification gates overlapped accepted windows. Sequence: base-1 → r5-1 → r5-2 → base-2; windows ran 09:16–09:30 UTC. Shared-host load limits attribution and absolute capacity estimates.

| Sample | Start load 1/5/15 | End load 1/5/15 |
|---|---|---|
| base-1 | 13.30/7.37/6.97 | 19.53/10.21/7.97 |
| r5-1 | 20.27/12.25/8.82 | 21.79/14.15/9.70 |
| r5-2 | 35.61/29.47/18.31 | 30.18/29.09/18.89 |
| base-2 | 38.49/32.98/21.88 | 34.45/32.92/22.61 |

R5 guarded master hold p50: **1.051/1.146 ms**; p99: **8.997/59.579 ms**. Explicit master occupancy: **7.573/11.724 s**, versus baseline **11.282/14.366 s** per minute. These sums exclude autocommit auth writes. Overall review load: start **4.47/4.74/6.25**, end **11.23/12.88/14.56**.

**Findings**

- **P2 — zero-failure acceptance remains open.** `lib/outboundWrite.ts:24`, `lib/dbWriteRetry.ts:82`, `lib/drafts.ts:460`. In r5-2, `upsertMessages` exhausted after **7 attempts / 6 short retries / 2486 ms**, returning `SQLiteError: database is locked` from one real draft save. Two direct sync operations also failed. Reproduce with the preserved `measure.py`/`resume-load.py` protocol and inspect `load/measure-r5-2-results/main.json` and `load.log`. Before preview, repeat the paired protocol at comparable host load after fixing the deadline admission issue. If failures persist, reduce measured preparation/admission work within the existing guard and budgets; retain every failed sample. Current evidence does not close the zero-failure criterion.
- **P2 — the three-hunk production resolution also needs a fixture adaptation.** `lib/outboundWrite.test.ts:147–148`. Its raw orphan FTS insertion consumes the next v3 rowid; the subsequent production insertion fails `SQLITE_CONSTRAINT_PRIMARYKEY` at `lib/db/ftsIdentity.ts:88`. The unadapted merged test reproduced **0 pass / 1 fail**. Fixed only in the scratch merge: use `createSharedShardFixture`, seed the other account through its production API, retain all three assertions, and add `validateFtsIdentity`. Targeted retest and all merged gates below pass. Carry `logs/merged-required-fixture.diff` into integration.
- **P3 — retry admission can exceed the advertised wall deadline.** `lib/dbWriteRetry.ts:63`, `:82`, `:108`. After a first master BUSY and scheduled 1 ms wait, move wall time past the deadline before waking: both head and merge start attempt two at **2201 ms** and return success. `budget.test.ts` and `merged-budget.test.ts` reproduce **two failing contract tests**. Recheck the handshake deadline immediately after `workerPause`, before invoking another whole attempt; preserve the BUSY error and ordinary five-attempt DML/COMMIT policy. Add the delayed-wake regression. This is independent of the measured save failure; fresh authorization still runs.

**Correctness and adversarial probes**

Head **95/95** permanent guard/revocation/lease executions, 820 assertions; merge **95/95**, 820 assertions. R3 route/microtask and same-continuation probes passed in all focused head runs and merged validation. New adversarial probes: **40/40 on head and 40/40 on merge** (eight cases × five), 235 assertions per tree:

- Actual committed revocation exactly between completed upsert planning and master BEGIN rejects a cached actor with 403 and unchanged SQL/FTS. Revocation on short handshake failure 16 yields 403 before any guarded effect, with 17 preparations and zero final authorization assertions.
- Concurrent same-thread writers, both same-process and independent-process, preserve every message and FTS row. COMMIT BUSY followed by rollback and intervening rowid reuse preserves the innocent message. SIGKILL immediately before/after shard COMMIT preserves complete SQL/FTS identity. Crash probes make no filesystem power-loss durability claim.
- Already-expired owner, worker PID and scheduler leases renew durably; deduplication does not skip a due renewal. Existing post-publication COMMIT BUSY probes restore SQL, source and attachments before fresh authorization denies retry.

Source trace remains shard BEGIN → read-only planning → master BEGIN → live assertion → effects → shard COMMIT → master release, with no await from final assertion through COMMIT. Both locks roll back before retry; each attempt obtains fresh authorization. Timeout settings remain master/auth **0 ms**, shard **15000 ms**. The separate P3 deadline-admission defect above remains open.

**Round-9 integration notes**

The production resolution is correct. Completion also requires the fixture change above. `integrator-resolution.patch` and the retained `merged/` checkout contain the concrete result.

1. Conflict hunk 1, original merged line 256: keep stage's `prepareFtsIdentityWriter` import, writer and `deleteFts = ftsWriter.remove`, plus indexed scope deletes. Remove the complete v2 raw insertion/deletion and `plannedFtsRows`/`prepareFtsDeletes` block.
2. Hunk 2, original line 694: retain auto-merged `replacedRow`, identity lookup and removal **before** `insertMessage`; keep `ftsWriter.insert(accountId, rowId, ftsRowid, [`. Drop the second deletion and raw insert.
3. Hunk 3, original line 709: keep `]);`; omit the planned-rowid update.
4. Remove the auto-merged dangling `prepareFtsDeletes` callback argument. Retain `authorizedWrite`, final assertion, rollback and master exclusion through shard COMMIT.
5. Adapt the collision fixture to valid v3 ownership as described above.

Verified: mapping allocation precedes each production FTS insertion; FTS deletion precedes message deletion, including draft replacement and scope replacement; collision IDs and provenance (`senderKey`, `sourceSha256`, `deliveredTo`, `originalTo`, `senderIdentityId`) survive. All **81 guards** remain. Stage's `ftsIdentity.ts`, `messages/delete.ts`, `schema.ts`, and `shardFormat.ts` are byte-identical in the merge. Validator tests passed allocation rollback, collision identity separation, migration SIGKILL points and legacy-writer rejection. No unresolved conflict or dangling callback remains.

**Gates rerun**

| Gate | Head dfdf852 | Resolved merge |
|---|---|---|
| Typecheck | 0 errors / 1177 files; repeated after reinstall | 0 errors / 1198 files |
| Focused | 292 ×3 / 39 files, zero failed | 352 / 44 files, zero failed; includes FTS validators |
| Permanent probes | 95/0 | 95/0 |
| New adversarial probes | 40/0 | 40/0 |
| `nice -n 10 timeout 1800 bun run test:ci` | 2777 server + 433 DOM, zero failed; 648.69 s | 2827 server + 462 DOM, zero failed; 626.72 s |
| Lint | exit 1: baseline 1 error / 25 warnings | Not requested |
| Build | exit 0; 61.23 s | Not requested |
| New deadline contract | **fails: attempt admitted at 2201 ms** | **same failure** |

Lint's unchanged error is `app/components/calendar/useCalendarConflicts.ts:58`. Frozen installs succeeded; lockfiles are unchanged. No existing application/test assertion, timeout or retry constant was relaxed during verification. Stress and fixture-send were not independently rerun.

**Execution qualifications and evidence**

Only the permitted report and scratch paths were written; synthetic data, ports 3891–3894, owned-PID/process-group cleanup, no commits/pushes or other-worktree edits. Scratch port adaptations preserve test assertions. Two pre-window setup failures were excluded: a synthetic-login mismatch and a 240 s setup timeout; the latter was rerun with a 600 s outer setup allowance, retaining the 60 s measurement and production/test limits.

Initial CI retained **2775/2** for scratch SWC cache/port setup failures. A later rerun aborted during my runaway Volta diagnostic and is invalidated; its verified process group was terminated. Final gates used direct Node 24.22.1 and the verified materialized SWC native image in scratch dependencies. SWC documents that materialized bytes equal the original addon and supports trusted cache materialization; normal gates used no cache-check opt-out. [SWC carrier documentation](https://github.com/swc-project/swc/blob/main/docs/native-addon-carriers.md)

Evidence: `/home/monkey/code/noctua-mail/briefs/sender-identities-slice2-regressions-r5/` — `load/measurement.json`, raw per-window logs/timings, `source-audit.json`, `gates.json`, `final-gates.json`, native-repair hashes, probe sources, `logs/budget.log`, and `integrator-resolution.patch`. No required verification remains running when this report is issued.

[Saved report](/home/monkey/code/noctua-mail/briefs/sender-identities-slice2-review-r5.md) · [Load measurements](/home/monkey/code/noctua-mail/briefs/sender-identities-slice2-regressions-r5/load/measurement.json) · [Final gates](/home/monkey/code/noctua-mail/briefs/sender-identities-slice2-regressions-r5/final-gates.json) · [Integration patch](/home/monkey/code/noctua-mail/briefs/sender-identities-slice2-regressions-r5/integrator-resolution.patch)
