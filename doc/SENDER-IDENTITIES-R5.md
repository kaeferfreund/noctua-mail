# Sender identities — fix round 5

Production changes are based on `d5ae17b` on `feat/sender-identities-2`. The final candidate meets all requested performance targets on the two-run means used by the round-4 review. Individual samples and host load remain visible below; the first paired auth sample is 193 versus 188 BUSY events. This is a shared-host measurement, not a statistical guarantee for every run.

## Inherited work and final design

- Kept the inherited shard-first guard, read-only planning callback, FTS rowid deletion plan, compiled live-authorization statements, reservation eligibility hint, and bounded handshake retry policy. These preserve master exclusion from the final synchronous assertion through shard COMMIT. The FTS plan uses the same shard snapshot as DML and tracks newly inserted rowids for repeated IDs; it requires no FTS schema migration.
- Extended the admission hint to repeated queue calls and unchanged promotions. Healthy child PID binding and scheduler renewal still take the authoritative writer lock, but omit redundant UPDATEs until the existing five-second renewal margin. Lease duration remains 15000 ms.
- Preserved coarse control-plane pacing. A failed master acquisition can use at most 16 short recovery waits immediately before exhaustion, within the same 2160 ms wall budget. Guarded shard-to-master acquisition uses the short waits first. Shard/DML/COMMIT failures retain the original five attempts and nominal 120/240/480/960 ms waits. Master/auth busy_timeout stays 0 ms; shard stays 15000 ms.
- Kept every inherited production optimization. Fixed missing Bun SQLite runtime-property typings in inherited tests. Replaced the revocation probe's timer race with revocation scheduled from the observed failed master BEGIN, retaining its denial, assertion-count, rollback-count and unchanged-data assertions. Strengthened COMMIT failure coverage to observe replacement files before the failure and restored files before reauthorization. Added collision/account isolation, coarse shard retry, control-plane recovery and redundant-renewal tests.
- Rejected aggressive short retries for every normal lease acquisition: they increased sync throughput but also auth contention. Exploratory variants and inherited diagnostic samples are retained in `sender-identities-r5/measurements.json`; they are not pooled with the final candidate.

Key implementation locations: `lib/outboundWrite.ts:8`, `:23`, `:37`, `:41`, `:43`; `lib/db/messages/upsert.ts:256`, `:265`, `:681`, `:782`; `lib/dbWriteRetry.ts:15`, `:62`, `:80`; `lib/db/processLeases.ts:22`, `:47`, `:52`, `:75`, `:169`, `:179`, `:199`. The timing contract is in `doc/SENDER-IDENTITIES.md`.

## Paired load protocol

The preserved r4 harness runs a common 60-second window with 11000 synthetic local rows, actual synthetic IMAP on ephemeral loopback ports, two persistent sync subprocesses using production admission APIs, the production watcher and its normal subprocesses, one injected message per second, continuous real saveDraftForAccount calls, and a separate auth timestamp writer at 50 ms with busy_timeout=0. No Next HTTP server is used. All runs have isolated synthetic data. Python is nice 10; timed processes are nice 19, matching r4. TMPDIR for final controls and candidate is this worktree's `.tmp`. No verification gates ran during these windows.

Final comparison uses baseline `9424150` samples base-7/base-8, exact r4 `d5ae17b` samples r4-3/r4-4, and final candidate samples r5-11/r5-12. The unchanged r4 controls were collected earlier, before the final baseline/candidate sequence. Final sequence: base-7 → r5-11 → r5-12 → base-8. R4 and earlier candidate evidence is retained rather than silently replaced.

| Sample | Saves / failed | BUSY retries / exhausted | Auth attempts / BUSY | Sync A done / failed | Sync B done / failed | Watcher active / cycles |
|---|---:|---:|---:|---:|---:|---:|
| base-7 | 1822 / 0 | 548 / 0 | 1115 / 188 | 166 / 0 | 221 / 0 | 109 / 62 |
| base-8 | 1713 / 0 | 547 / 2 | 1113 / 198 | 167 / 0 | 134 / 0 | 87 / 51 |
| r4-3 | 1444 / 0 | 613 / 11 | 1152 / 504 | 12 / 1 | 25 / 9 | 23 / 13 |
| r4-4 | 1410 / 0 | 670 / 8 | 1155 / 440 | 71 / 3 | 77 / 5 | 54 / 30 |
| r5-11 | 2239 / 0 | 650 / 0 | 1110 / 193 | 223 / 0 | 224 / 0 | 119 / 73 |
| r5-12 | 2381 / 0 | 639 / 0 | 1121 / 182 | 231 / 0 | 257 / 0 | 121 / 76 |

Watcher activity counts ordinary watcher workers with DB activity inside the window; cycles are separate. Retry/exhaustion totals include all instrumented processes and worker initialization. Sync failure counts are operation/admission failures; cleanup errors are preserved separately: baseline base-8 includes one direct-loop cleanup error, while final r5 has none.

| Sample | Start load average (1 / 5 / 15 min) | End load average (1 / 5 / 15 min) |
|---|---|---|
| base-7 | 4.47 / 4.92 / 4.67 | 7.41 / 5.60 / 4.92 |
| base-8 | 5.37 / 5.39 / 4.98 | 7.79 / 6.17 / 5.28 |
| r4-3 | 3.94 / 4.30 / 5.06 | 3.81 / 4.17 / 4.97 |
| r4-4 | 3.51 / 3.87 / 4.66 | 2.59 / 3.56 / 4.50 |
| r5-11 | 5.26 / 5.28 / 4.84 | 6.05 / 5.53 / 4.95 |
| r5-12 | 4.99 / 5.34 / 4.92 | 5.50 / 5.50 / 5.00 |

## Loaded hold distribution

| Sample | Guard p50 / p95 / p99 / max, ms | Guard aggregate, s | All explicit master aggregate, s | All master p99 / max, ms |
|---|---:|---:|---:|---:|
| base-7 | — | — | 8.440 | 8.3176 / 101.0273 |
| base-8 | — | — | 8.344 | 8.5878 / 117.9200 |
| r4-3 | 11.0259 / 11.7125 / 18.1385 / 238.7562 | 16.617 | 25.152 | 11.7669 / 238.7562 |
| r4-4 | 11.0084 / 11.9778 / 14.6086 / 49.4458 | 15.860 | 22.509 | 11.8702 / 49.4457 |
| r5-11 | 0.8949 / 1.2166 / 4.4202 / 16.6013 | 2.267 | 8.838 | 7.8243 / 76.5745 |
| r5-12 | 0.8564 / 1.1137 / 3.5221 / 32.9490 | 2.274 | 8.336 | 6.1149 / 62.8739 |

Hold sums count observed outer explicit immediate/manual transactions and exclude autocommit writers such as the auth timestamp updater. They are a lower bound on all writer occupancy. A transaction crossing the cutoff can produce a one-operation count difference. The final guard p99 is a few milliseconds; rare shared-host outliers remain visible. Aggregate explicit master holds are near baseline, rather than the r4 increase to 22.5–25.2 seconds per minute.

The main-process upsert logs schedule 11,108 / 15,699 ms of retry waits on r4,
versus 461 / 377 ms on r5. The corresponding wait-event counts are 84 / 116
and 348 / 329: brief collisions now use short waits instead of losing a coarse
120 ms interval. These totals cover complete load logs and can include boundary
operations; they are separate from timed-window writer occupancy.

## Target decision (two-run means)

| Metric | Baseline | R4 | R5 | Target met |
|---|---:|---:|---:|---|
| Draft saves | 1767.5 | 1427 | 2310 | yes: 130.69% of baseline, ≥90% |
| Draft failures | 0 | 0 | 0 | yes |
| Retry exhaustions | 1 | 9.5 | 0 | yes |
| Auth BUSY | 193 | 472 | 187.5 | yes: 97.15% of baseline |
| Sync A completed | 166.5 | 41.5 | 227 | yes: 136.34%, ≥90% |
| Sync B completed | 177.5 | 51 | 240.5 | yes: 135.49%, ≥90% |
| Sync failures (A+B) | 0 | 9 | 0 | yes |
| Watcher active workers | 98 | 38.5 | 120 | yes: 122.45%, ≥90% |

BUSY retry events increase from 547.5 to 644.5, as expected with short handshake retries; the requested exhaustion target improves to zero. Auth BUSY is a synthetic timestamp-update failure count, not a measured failed-login count. Per-pair auth results are 193 versus 188 (+5), then 182 versus 198 (−16); averages meet the criterion without hiding that variation.

## Correctness probes and verification

Permanent r4 probes: `lib/outboundWrite.revocation.test.ts:15` tests actual membership revocation committed after a failed master BEGIN for draft, calendar series and occurrence; all return 403 with unchanged SQL, FTS, source and attachments. `:88` injects shard COMMIT BUSY after observing replacement file publication, then verifies restoration before fresh authorization denies retry. `:153` commits a real revoke during read-only planning and proves the final live assertion rejects it before any effect.

`lib/outboundWrite.test.ts` retains lock order/master-through-COMMIT tests and the original rollback/outer-transaction assertions, and adds planning, fresh-actor retries, FTS repeated-ID/collision/account isolation and unchanged coarse shard retry coverage. `lib/processLeases.hint.test.ts` verifies read-only denial hints, writer-locked positive binding/ownership checks, actual renewals and unchanged admission pacing. `lib/dbWriteRetry.test.ts` bounds all three retry policies and checks wall budget and cancellation. Existing r3 microtask and same-continuation probes remain in `lib/outboundAuthorization.routes.test.ts` and its child fixture.

Final verification: frozen install and unchanged `bun.lock`; typecheck **0 errors / 1178 files**; outbound/calendar/identity focused suites **292 passed ×3 / 39 files**; guard/revocation/admission probes **95 passed (19 cases ×5, 820 assertions)**. Full `test:ci`: **2777 server + 433 DOM passed, zero failed** (510.43 s). Full randomized `test:stress`: **8331 passed, zero failed / 303 files**, seed 1337, three repetitions (1321.23 s). Dedicated fixture-send: **31/31**. Build and whitespace gates: **exit 0**.

Lint returns **exit 1, 1 error / 25 warnings**, matching the supplied baseline. Its error is `app/components/calendar/useCalendarConflicts.ts:58`, unchanged from `d5ae17b`; no new lint findings were added. No assertion, production timeout or retry budget was relaxed. The original **8329 passed / 2 failed** stress result is retained in the history, followed by the fixture fixes, targeted ten-repeat checks (**50 metadata + 10 route tests passed**) and the final full rerun. Exact commands, exits, durations and output are in `sender-identities-r5/validation.json` and `validation-logs.json.gz`.

## Final continuation audit

The final continuation inherited the completed candidate, load evidence and a
still-running sequential verification process. It retained all executable changes
after reviewing the production diff, permanent probes and preserved r4 probes.
All seven production SHA256 values in `measurements.json` match the committed
candidate. The measured guard archive differs only in timing instrumentation and
an older comment. Both control archives match the exact revisions on the six
uninstrumented production paths; the instrumented r4/r5 guards match after
removing timing statements, comments and formatting. Both harness templates
match the preserved r4 sources byte for byte. Retry/exhaustion totals and hold
distributions for all six
accepted samples were independently recomputed from `raw-timings.json.gz` and
match the report. Earlier exploratory samples remain diagnostic only. The final
continuation completes the outstanding gates, evidence preservation, integration
handoff and commits; it does not claim a second independent set of timed runs.

The inherited stress run exposed two fixture transitions using raw
master writes without retry while identity recompute workers were releasing
durable leases:
the shared-shard path UPDATE in `senderIdentityMetadata.test.ts` and a membership
DELETE in `verifySenderIdentity.ts`. Those setup transitions now await the
existing five-attempt coarse `withDbWriteRetry` before invoking the tested
operation. The fixture's other role/revocation transitions use the same bounded
helper. Authorization/network/data assertions, contention probes, production
timeouts and retry policies are unchanged. The original failed stress history is
preserved, and the full gates are repeated on the final tests.

## Round-9 integration handoff

`git merge-tree --write-tree origin/integration/stage HEAD`, with stage fixed at
`11dc3c5f50826aec73f7547990e3b89def1dd08b`, reports one conflicted file,
`lib/db/messages/upsert.ts`, containing three conflict-marker blocks. The raw
result and structured per-block guidance are in `sender-identities-r5/merge-tree.txt`
and `sender-identities-r5/integration.json`.

1. FTS statement/planning definitions: retain stage's
   `prepareFtsIdentityWriter(db)` and `deleteFts = ftsWriter.remove`. Stage already
   uses indexed identity lookup and rowid deletion, so the v2 scan plan and its
   direct FTS insert statement are unnecessary on v3. Keep the auto-merged
   `prepareFtsIdentityWriter` import and scope-delete SQL.
2. FTS insertion opening: retain stage's
   `ftsWriter.insert(accountId, rowId, ftsRowid, [`. Keep its auto-merged lookup
   and removal before `insertMessage.run`; these validate and preserve the
   message-to-FTS identity mapping. Do not retain r5's second deletion or raw
   `insertFts.run`, which would bypass that mapping.
3. FTS insertion closing: retain stage's `]);`; omit
   `plannedFtsRows?.set(...)`, because v3 owns identity allocation and reuse.

After these three choices, remove the otherwise auto-merged, dangling
`prepareFtsDeletes` argument from `authorizedWrite(db, callback, prepareFtsDeletes)`.
Keep the `authorizedWrite` callback, shard-first acquisition, bounded retries,
final live assertion and master exclusion through file publication and shard
COMMIT. Retain the rollback and authorization probes. Adapt any direct FTS test
setup to v3's identity invariants where necessary, and rerun merged correctness,
load and validation gates. These measurements validate this feature branch;
they do not certify the unresolved stage merge or a preview deployment.

## Reproduction and evidence

`sender-identities-r5/README.md` documents the protocol. `measure.py` reconstructs scratch archives and refuses to overwrite an existing run. `load.ts.txt` and `dbProbe.ts.txt` are the preserved r4 templates. `measurements.json` contains every collected sample, final source SHA256 values and provenance; `raw-timings.json.gz` contains raw final-comparison per-process spans, draft latencies and child results. Scratch data under `.tmp` is removed after verification and evidence preservation. No production data, credentials or `.env.local` values are included.
