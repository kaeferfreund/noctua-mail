# feat/sender-identities-2 — review round 4

Reviewed detached `d5ae17b1e8cee28bb15519f3a1f6f9faf873f5f3`, on `363683b` (merge of integration/stage `9424150`) on `781b4b2`. Reviewer: Codex. Verdict: **PIN+fix-r5** for integration round 8; **fix round 5 and merged validation are required before preview deployment**.

The new lock order and authorization boundary are correct in the audited production paths and repeated probes. P2-A is closed; the master-while-waiting-for-shard part of P2-B is closed. The remaining performance regression is measurable, and FTS-v3 alone does not close it. For two people, approximately twelve mailboxes, a watcher and occasional sync, continuous saves at 18–32 per second plus continuously looping sync and 20 auth writes per second substantially overstate normal load. At one combined save per second the observed 11.1–11.4 ms median guard suggests about 1.1% master occupancy from these saves alone; that is an inference, not a twelve-mailbox measurement. This supports integrating the correctness fix with a mandatory follow-up, rather than blocking integration. It does not support deploying on the claim that the FTS merge will automatically resolve contention.

## Findings

### P2-B remains — global master exclusion plus coarse contention backoff depress throughput

- `lib/outboundWrite.ts:22`, `:32–46`; `lib/db/messages/upsert.ts:710`; `lib/dbWriteRetry.ts:8–10`, `:78–91`.
- Across the two clean baseline samples, mean draft saves were **1862.5**. Head averaged **1167.5 (−37.3%)**. Exact head+FTS-v3 averaged **1279.5 (−31.3%)**.
- Auth timestamp BUSY failures averaged **166.5 baseline, 420.5 head (2.53×), 221.5 head+FTS (1.33×)**. These are synthetic auth timestamp write failures, not measured failed user logins.
- Head still holds the master during two approximately 5 ms FTS deletion scans per draft replacement (`upsert.ts:721`, `:648`, shared statement `:256`). Unchanged per-save hold time does not mean unchanged aggregate master exclusion versus the baseline, whose draft shard transaction has no such master writer guard.
- FTS-v3 removes those scans, but its faster sync work creates more opportunities for the draft's new master-writer handshake to collide. The generic 120 ms base delay then loses 27–29 seconds of the 60-second draft loop to scheduled upsert backoffs.
- No draft failures were observed in the six clean primary samples, but head had 10/4 retry exhaustions and sync failures; the implementer's separately reported draft failure remains relevant. Counts and protocol differ from the earlier implementer run and must not be pooled.

Required before preview: fix guarded-acquisition backoff and control-plane contention without relaxing authorization, then meet the original acceptance target on the actual round-8 merge: draft throughput at least approximately 90% of baseline, zero draft failures, auth BUSY no worse than baseline, and healthy worker progress. The scratch changes below are partial remedies, not a completed fix.

### P2-A closed — calendar series and occurrence local writes share the retrying guard

`lib/db/calendar/events.ts:135`, `:384` now use `withOutboundWrite`, including local-only RSVP. The focused route suite passed both scopes under master contention, including committed revocation during contention. The custom real-membership probe repeated draft/series/occurrence denial five times each.

## Correctness verification

- `lib/outboundWrite.ts:22–24` prepares a new actor on every retry. Guarded writes reject caller-owned shard or master transactions at `:29–30`; they do not join, reorder or release an outer transaction.
- `:32` acquires shard `BEGIN IMMEDIATE`; `:34` acquires master `BEGIN IMMEDIATE`; `:36` asserts current authorization synchronously; `:37` begins the DML/file-publication callback; `:38` commits the shard; `:43` releases master. There is no await between final assertion and the first guarded effect or shard commit.
- Master acquisition failure enters the outer finally, rolls back the shard and leaves both locks released during backoff. The next attempt re-prepares authorization. The master busy timeout is zero, so this is an application retry wait, not a long SQLite master wait while holding the shard.
- Audited every production `BEGIN IMMEDIATE`/transaction-helper occurrence under `lib/**` and followed both-DB paths. No inverse **nested** master→shard writer acquisition remains. Sequential master then shard operations still exist and are valid. Master-only mutations include identity/preferences, membership/lifecycle, auth/security, account control plane and sync/scheduler leases. Shard-only mutations include collab/remap/reply attribution, message/FTS/files, calendar, folders and thread summaries. `connection.ts:357–363` finishes its master path-resolution transaction before opening/initializing a shard. `membershipCleanup.ts:20–37` finishes the shard transaction before lifecycle updates at `:53/:56`; membership revoke commits master before cleanup. `mailboxSummary.ts:47–60` finishes shard reads before its final master snapshot. `folders.ts` transactions are shard-only. Schema/account-key migration callbacks use only their supplied handle. Deferred auth snapshot callbacks do not start shard writes. Full grep inventory is preserved in `lock-audit.txt`.
- All three local call sites consume the shared helper once: message replacement at `upsert.ts:710`, calendar series and participation override. Draft save passes `beforeWrite` and `replaceDraftId` at `drafts.ts:460`. Sanitization is now memory-only (`mail/syncMessageSanitizer.ts:45`); temporary byte staging is outside locks and public file installation is inside the guarded transaction.
- Send paths retain synchronous live assertions immediately before `sendMail` (`mail/smtp.ts:114/:151`), APPEND after pool acquisition (`mail/imap/mutations.ts:53`), and IMAP deletion after mailbox acquisition (`:161`). The outbound boundary suite passed direct send, save/send draft, calendar, MCP create-draft/preferences/identity mutations, including queued microtask revocations.
- Stock helper tests: **25/25**, five repetitions using `--rerun-each=5`; they verify lock order through COMMIT, outer-transaction rejection, INSERT/assertion rollback, old draft/attachment/FTS/source restoration and integrity checks.
- Custom probes: **20/20**, four cases × five repetitions. For draft/series/occurrence, a separate master connection holds the writer, then commits an actual `user_accounts` deletion during retry backoff. Exactly two authorization preparations, one failed master BEGIN, one shard rollback, no guarded DML, final **403**, and unchanged SQL/FTS/source/attachment snapshots. The fourth case injects BUSY at shard COMMIT **after file publication**, revokes before retry, and verifies the overwritten source/attachment and SQL/FTS rows were restored before the fresh authorization returns 403.
- On the fast-retry scratch variant, the flexible-attempt revocation probe passed **15/15**, and stock helper tests passed **25/25**. Timing-policy changes did not weaken the boundary.

No new correctness finding was reproduced. These tests do not prove filesystem rollback after a process/power crash or guarantee that every possible post-commit retry is at-most-once.

## Paired load protocol and results

Independent reconstruction of the supplied protocol; the implementer's original harness was not present in the allowed evidence. Every primary variant used the same probe source, parameters and instrumentation:

- Exact archived trees: baseline `9424150`; head `d5ae17b`; conflict-free `git merge-tree --write-tree d5ae17b 36be023`, tree **`01736f265388e865bcb8c97e9cd30bb2cd27483c`**. No ad hoc merge resolution.
- 60-second common measurement window, isolated scratch data, 11,000 synthetic local messages on draft account A's Archive shard, actual synthetic IMAP server on ephemeral loopback ports. Account B mirrors the same fixture without a second 11k seed.
- Real `saveDraftForAccount` service calls, MFA cookie/live HTTP authorization, MIME processing, APPEND/delete and shard/file publication; direct service invocation rather than requests through a Next HTTP server.
- Two persistent subprocesses using production recent-INBOX sync and queue/reserve/release APIs, capacity two and 30 ms between jobs. Production watcher in the parent with normal worker subprocesses; one synthetic message injected each second. A separate SQLite handle updates the synthetic auth_session timestamp every 50 ms, busy_timeout=0.
- Low priority: commands launched with `nice -n 10`; timed subprocesses had effective niceness 19 because the runner was already nice 10. No reviewer gate tests ran during the accepted timed windows. Host load was shared and uncontrolled.
- Initial `base-1` overlapped the tail of the DOM gate and is excluded. Its raw 1876/0 saves/failures and 166 auth BUSY are preserved only as diagnostic evidence. Clean baselines are `base-2` and replacement `base-3`; these were run later than head/FTS to avoid gate contamination. Sample order and host load limit precision.

| sample | draft saves / failed | BUSY retries / exhausted | auth attempts / BUSY | sync A done / failed | sync B done / failed | watcher workers / completed cycles |
|---|---:|---:|---:|---:|---:|---:|
| base-2 | 1818 / 0 | 561 / 0 | 1115 / 183 | 175 / 0 | 213 / 0 | 108 / 70 |
| base-3 | 1907 / 0 | 557 / 1 | 1130 / 150 | 154 / 0 | 237 / 0 | 105 / 61 |
| head-1 | 1249 / 0 | 697 / 10 | 1139 / 409 | 65 / 6 | 65 / 4 | 68 / 35 |
| head-2 | 1086 / 0 | 710 / 4 | 1130 / 432 | 80 / 3 | 66 / 0 | 62 / 31 |
| fts-1 | 1303 / 0 | 807 / 1 | 1112 / 206 | 155 / 0 | 139 / 1 | 84 / 44 |
| fts-2 | 1256 / 0 | 762 / 1 | 1119 / 237 | 191 / 1 | 147 / 0 | 94 / 49 |

BUSY retries/exhaustions include all instrumented production subprocesses during the window, including their initialization and scheduler/admission work. A sync loop's failed count is an operation/admission failure; its separate `errors` array also records cleanup failures. Watcher workers means ordinary watcher subprocesses with DB activity in the window, including a job already running at the start; completed cycles are a separate measure. Raw `watcherJobs` is the cycle count, not the number of folder jobs.

| sample | start load average (1 / 5 / 15 min) | end load average (1 / 5 / 15 min) |
|---|---|---|
| base-2 | 5.37 / 5.55 / 5.76 | 5.03 / 5.48 / 5.73 |
| base-3 | 4.64 / 5.28 / 5.64 | 4.43 / 5.17 / 5.58 |
| head-1 | 3.53 / 4.26 / 5.58 | 4.02 / 4.32 / 5.52 |
| head-2 | 6.07 / 5.37 / 5.72 | 7.95 / 5.94 / 5.89 |
| fts-1 | 3.82 / 4.25 / 5.47 | 6.55 / 4.96 / 5.64 |
| fts-2 | 6.35 / 5.00 / 5.64 | 6.48 / 5.35 / 5.73 |

FTS-v3 therefore **does not meet** the approximately 10% throughput-gap or auth-BUSY acceptance targets in either repeat. It does remove the expected expensive FTS identity deletion scans. Treating these two claims separately matters.

## Loaded timing and hypotheses

| sample | guarded master p50 / p99 / max, ms | guarded master aggregate, s | all observed explicit master holds, s | FTS DELETE p50, ms |
|---|---:|---:|---:|---:|
| base-2 | — | — | 8.353 | 5.0353 |
| base-3 | — | — | 7.623 | 5.0606 |
| head-1 | 11.147 / 20.374 / 55.384 | 14.444 | 22.236 | 5.0077 |
| head-2 | 11.354 / 25.366 / 116.044 | 13.163 | 20.770 | 5.0622 |
| fts-1 | 1.227 / 5.083 / 45.137 | 1.890 | 10.783 | 0.0349 |
| fts-2 | 1.236 / 4.475 / 28.954 | 1.802 | 10.482 | 0.0350 |

Timing sums cover outer explicit immediate/manual transactions on instrumented application handles. They exclude autocommit writers such as the timestamp updater and are a lower bound on complete writer occupancy; nested deferred assertions are not counted twice. Samples are taken only inside the 60-second window. A single operation can straddle the cutoff, producing a ±1 mismatch between completed saves, DML attempts and commits.

**(a) Aggregate master hold: confirmed.** Observed explicit master holds total **7.62–8.35 s baseline**, **20.77–22.24 s head**, **10.48–10.78 s FTS** per 60 s. The new guard alone contributes **13.16–14.44 s** on head, despite a median per-unit duration close to the earlier isolated 11.5 ms. FTS reduces its guard contribution to **1.80–1.89 s**, but aggregate contention still exceeds baseline.

**(b) Shard held during master wait/assertion: true, but refuted as the dominant remaining cost.** Successful head master acquisition has p50 **0.0116 ms**; failed acquisitions have p50 **0.027–0.029 ms** and aggregate only **3.6/4.3 ms**. Fresh synchronous assertions have p50 **0.308/0.331 ms**, aggregate approximately **0.412 s** each run. No backoff occurs while a shard transaction is held. Shard acquisition p99 is **18.43/18.51 ms** on head versus **9.01/8.82 ms** baseline, so other writers can still wait; the old master-held 15-second shard wait is gone. FTS shard acquisition p99 drops to **1.18/1.69 ms**.

**(c) Retry storms: confirmed as scheduling/preparation amplification, not observed repeated committed DML.** Head has **122/136** failed guarded master acquisitions; FTS has **192/194**. Main-log upsert delay budgets are **16.671/18.785 s head**, **27.104/29.103 s FTS** (the second FTS log includes one retry outside the timed window). FTS records exactly **1303/1303** and **1256/1256** guarded DML attempts/commits, matching completed saves. Head has only a cutoff-straddling extra attempt/commit. Thus these acquisition retries happen before DML, while repeating actor preparation, statement setup and staging. The generic wrapper also encloses post-commit derived work, so DML repetition is possible in other failure scenarios; it was not the mechanism measured here.

**(d) Timeout settings: confirmed.** Production master **0 ms**, separate auth handle **0 ms**, shard **15000 ms** (`connection.ts:119`, `:300`, `:105` default). Runtime main/master and shard pragmas match; the timestamp process explicitly uses zero, matching getAuthDb. A brief cross-process master collision becomes an approximately **96–144 ms first retry delay**, rather than a proportional wait. Changing master to a long busy_timeout while holding the shard would reintroduce a different stall and is not recommended.

## Concrete follow-up and scratch experiments

Keep shard→master ordering, final live authorization in the same synchronous continuation as the first effect, and master exclusion through public file installation and shard COMMIT. Do not replace this with a short authorization transaction followed by unguarded writes, a stale DEFERRED/WAL snapshot, or a generation read without a revocation/commit serialization mechanism.

The first concrete change to validate in fix round 5 is a **bounded short retry policy for the guarded handshake**: the scratch helper passes `maxAttempts:40, baseDelayMs:5, maxDelayMs:50` to the existing single `withDbWriteRetry`. Its nominal scheduled backoff budget is approximately 1.825 s (±20% jitter), comparable to today's approximately 1.8 s, with fresh authorization and full rollback on every attempt. Production should use an explicit wall-clock budget and telemetry rather than treating these exploratory constants as final. Preserve slower handling where an actual long shard writer is the source of contention.

The second is to reduce no-op master writer polling in `reserveWorker`: use a read-only eligibility hint to return false while capacity is full or another live queue head owns admission. Only skip while the owner's renewal margin is healthy; enter the original immediate transaction for renewal, possible dead/expired-owner recovery or an actual reservation. All successful admissions and fairness/recovery decisions still recheck under that writer lock. The preserved prototype renews at least five seconds before expiry and retains the original authority path. Production must retain DurableSyncWorkerSemaphore's retryable release/cancel cleanup; the direct-loop harness is not a replacement for that cleanup protocol.

Both were tested on top of the exact FTS merge:

| sample | draft saves / failed | BUSY retries / exhausted | auth attempts / BUSY | sync A done / failed | sync B done / failed | watcher workers / completed cycles |
|---|---:|---:|---:|---:|---:|---:|
| fts-retry-1 | 2604 / 0 | 928 / 1 | 1126 / 217 | 186 / 0 | 10 / 0 | 106 / 60 |
| fts-retry-2 | 2789 / 0 | 947 / 1 | 1134 / 241 | 149 / 0 | 159 / 1 | 99 / 57 |
| fts-hint-1 | 2788 / 0 | 766 / 1 | 1134 / 224 | 236 / 1 | 228 / 0 | 118 / 67 |

| sample | start load average (1 / 5 / 15 min) | end load average (1 / 5 / 15 min) |
|---|---|---|
| fts-retry-1 | 4.10 / 5.04 / 5.53 | 4.39 / 4.96 / 5.47 |
| fts-retry-2 | 3.63 / 4.76 / 5.40 | 4.21 / 4.72 / 5.34 |
| fts-hint-1 | 2.46 / 3.79 / 4.90 | 2.85 / 3.64 / 4.77 |

Fast retry reduces the main upsert scheduled delay budget from approximately **27–29 s to 2.024/2.085 s**, while draft saves increase to **2604/2789**, with zero draft failures. However auth BUSY is **217/241**, still above **183/150** baseline, and each run has a cleanup/admission exhaustion. In fast run 1 a failed lease release stalls direct sync loop B after ten completions; this is a harness direct-API limitation, not a demonstrated production durable-cleanup bug.

The hint reduces reserve-worker retries from **409/312** in fast-only samples to **58**, with **236/228** completed sync operations. Yet it still has **224 auth BUSY**, one queue-admission exhaustion and a sync failure. Host load is lower for this one extra sample; no stable capacity claim follows. Its existing production lease integration suite passes **4/4** (independent graphs, restart recovery, starvation bound, confirmed exits, scheduler takeover and durable cleanup cases).

These experiments validate the backoff mechanism and a safe direction for reducing control-plane contention. **They do not close every acceptance criterion.** Fix round 5 must finish writer-admission/fairness tuning and repeat the full target, including auth BUSY and workers, on round 8 before preview. If that cannot close auth contention, a larger authorization-generation design must make revocation participate in the same shard exclusion/generation protocol and fail closed on recovery; merely copying membership or checking a generation once is insufficient.

## Gates on d5ae17b

| gate | result |
|---|---|
| `bun run typecheck` | 0 errors, 1175 files, 608.45 ms |
| outbound/calendar/identity focused suites | 89 tests / 14 files + 179 tests / 21 additional files = **268 passed**, 0 failed |
| stock `lib/outboundWrite.test.ts --rerun-each=5` | **25 passed**, 0 failed, 185 assertions |
| custom master-wait/revoke and post-publication commit-failure probes, five repetitions | **20 passed**, 0 failed, 210 assertions |
| `nice -n 10 timeout 1800 bun run test:ci` | exit 0: **2759 server + 433 DOM**, 0 failed; 407.33 s + 62.66 s |
| tracked diff / whitespace | clean; `git diff --check` exit 0 |

Stress/build/31-case fixture-send figures supplied by the implementer were not independently rerun in this review and are not counted as new gates.

## Preserved evidence and cleanup

Report: `/home/monkey/code/noctua-mail/briefs/sender-identities-slice2-review-r4.md`.

Probes, exact instrumentation, two experimental diffs, raw per-process timing samples, load/gate logs and reproduction instructions: `/home/monkey/code/noctua-mail/briefs/sender-identities-slice2-regressions-r4/`.

No tracked file was edited, committed or deleted. No other worktree was touched; other revisions were read through the permitted repository's git show/archive/merge-tree operations. No app was deployed, no Next server was started, and fixture children were stopped by owned PID. Scratch copies and synthetic databases under the review checkout `.tmp` were removed after evidence preservation. Final HEAD remains d5ae17b and tracked status is clean.
