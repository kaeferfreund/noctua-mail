# perf-writer-guards

## Summary

**Recommendation: keep the existing guards.** Initial 5,000-message sync was **22.672 s without / 23.124 s with guards** (median +2.0% wall, +1.1% CPU; overlapping spreads). The clear local cost is bulk flags: **138.39 / 183.78 ms for 5,100 messages** (+32.8% wall, +29.9% CPU). Watcher ingestion was **525.16 / 524.75 ms**, with no resolved guard penalty. These measurements do not support extrapolating the earlier raw-upsert doubling to whole sync.

Most cost is SQLite trigger execution and the extra work it causes, rather than the JS callback. A native constant marker retains the tested security properties, saves 2.0% only in the microbenchmark, and shows no consistent production-SQL improvement while adding native build/distribution risk. Compile-only guards remove the callback but keep almost all the flow cost and stop rejecting a registered marker that returns the wrong version.

Analysis only; no tracked files changed. Source: detached `435ba5d1885d5b016d15dbad5b269f84e6497ce3`, Bun 1.4.4, Linux arm64 / 12-core Neoverse-N1. The original 134/268 ms result is from the prior verification report, not a result reproduced verbatim here.

## Measurements

Five repetitions per flow and mode. All times below are milliseconds: **median [minimum–maximum]**. CPU is user + system time for the Bun process, including the in-process fixture; watcher CPU additionally includes the actual sync worker. This can exceed wall time. “Rows” is `total_changes()` and includes FTS shadow work, cascades, repeated writes, and derived rows; it is not a count of distinct messages. Load is host `uptime` 1/5/15-minute load, ranges across that series. Every individual timestamp/load sample is retained in the JSONL files.

### Initial sync: 5,000 messages / 1,000 threads

| Mode | Rows written | Wall ms | CPU ms | Load 1/5/15 |
|---|---:|---:|---:|---|
| 78 guards dropped | 62073 | 22,672.25 [22,593.12–23,459.87] | 24,604.24 [24,386.62–27,068.94] | 2.09–3.71/2.74–3.74/3.20–3.60 |
| Current guards | 62073 | 23,123.55 [22,514.61–23,845.13] | 24,884.72 [24,568.23–27,221.76] | 1.86–3.24/2.61–3.62/3.14–3.56 |
| Compile-only candidate | 62073 | 22,970.68 [22,790.02–23,470.58] | 24,647.46 [24,316.55–26,439.10] | 1.82–3.29/2.68–3.60/3.15–3.56 |

Current minus control: **+451.29 ms wall / +280.48 ms CPU**. Relative overhead: +2.0% wall / +1.1% CPU. Estimated share of guarded time: +2.0% wall / +1.1% CPU.

### Incremental sync: 100 new messages, existing 5,000-message folder

| Mode | Rows written | Wall ms | CPU ms | Load 1/5/15 |
|---|---:|---:|---:|---|
| 78 guards dropped | 1121 | 615.41 [610.85–646.35] | 667.96 [645.66–753.41] | 2.12–3.66/2.73–3.73/3.19–3.60 |
| Current guards | 1121 | 612.56 [605.44–629.52] | 672.36 [648.47–731.18] | 1.86–3.24/2.61–3.62/3.14–3.56 |
| Compile-only candidate | 1121 | 619.93 [614.26–642.18] | 687.02 [657.73–763.16] | 1.82–3.29/2.68–3.60/3.15–3.56 |

Current minus control: **-2.85 ms wall / +4.40 ms CPU**. Relative overhead: -0.5% wall / +0.7% CPU. Estimated share of guarded time: -0.5% wall / +0.7% CPU.

### Bulk flags: 5,100 messages → Seen + Flagged

| Mode | Rows written | Wall ms | CPU ms | Load 1/5/15 |
|---|---:|---:|---:|---|
| 78 guards dropped | 5100 | 138.39 [135.68–144.33] | 141.59 [137.51–159.75] | 2.12–3.66/2.73–3.73/3.19–3.60 |
| Current guards | 5100 | 183.78 [177.31–192.10] | 183.92 [177.46–196.31] | 1.86–3.24/2.61–3.62/3.14–3.56 |
| Compile-only candidate | 5100 | 186.55 [178.44–187.39] | 190.82 [186.83–314.44] | 1.82–3.29/2.68–3.60/3.15–3.56 |

Current minus control: **+45.39 ms wall / +42.34 ms CPU**. Relative overhead: +32.8% wall / +29.9% CPU. Estimated share of guarded time: +24.7% wall / +23.0% CPU.

### Bulk move: folder-prefix rewrite of 5,100 messages

| Mode | Rows written | Wall ms | CPU ms | Load 1/5/15 |
|---|---:|---:|---:|---|
| 78 guards dropped | 5100 | 63.44 [62.88–63.70] | 63.53 [62.98–63.86] | 2.12–3.66/2.73–3.73/3.19–3.60 |
| Current guards | 5100 | 69.75 [69.37–69.99] | 69.78 [69.42–70.01] | 1.86–3.24/2.61–3.62/3.14–3.56 |
| Compile-only candidate | 5100 | 69.17 [68.45–69.65] | 69.33 [68.52–69.94] | 1.82–3.29/2.68–3.60/3.15–3.56 |

Current minus control: **+6.31 ms wall / +6.25 ms CPU**. Relative overhead: +9.9% wall / +9.8% CPU. Estimated share of guarded time: +9.0% wall / +9.0% CPU.

### Thread recompute: 5,100 messages / 1,020 threads

| Mode | Rows written | Wall ms | CPU ms | Load 1/5/15 |
|---|---:|---:|---:|---|
| 78 guards dropped | 6120 | 325.42 [318.25–345.56] | 338.78 [333.88–353.44] | 2.12–3.66/2.73–3.73/3.19–3.60 |
| Current guards | 6120 | 332.93 [324.77–346.83] | 345.68 [338.34–354.80] | 1.86–3.24/2.61–3.62/3.14–3.56 |
| Compile-only candidate | 6120 | 339.33 [320.84–343.74] | 359.17 [346.52–389.99] | 1.82–3.29/2.68–3.60/3.15–3.56 |

Current minus control: **+7.52 ms wall / +6.89 ms CPU**. Relative overhead: +2.3% wall / +2.0% CPU. Estimated share of guarded time: +2.3% wall / +2.0% CPU.

### Draft autosave: 10 actual IMAP/local replacements

| Mode | Rows written | Wall ms | CPU ms | Load 1/5/15 |
|---|---:|---:|---:|---|
| 78 guards dropped | 248 | 152.27 [140.82–177.94] | 218.93 [173.57–262.81] | 2.12–3.66/2.73–3.73/3.19–3.60 |
| Current guards | 248 | 153.98 [144.91–165.39] | 189.40 [157.11–195.54] | 1.86–3.24/2.61–3.62/3.14–3.56 |
| Compile-only candidate | 248 | 148.92 [145.73–168.19] | 179.03 [152.27–185.28] | 1.82–3.29/2.68–3.60/3.15–3.56 |

Current minus control: **+1.72 ms wall / -29.53 ms CPU**. Relative overhead: +1.1% wall / -13.5% CPU. Estimated share of guarded time: +1.1% wall / -15.6% CPU.

### Bulk delete: 5,100 messages plus dependents

| Mode | Rows written | Wall ms | CPU ms | Load 1/5/15 |
|---|---:|---:|---:|---|
| 78 guards dropped | 23759 | 251.01 [250.78–261.35] | 264.55 [260.44–273.63] | 2.12–3.66/2.73–3.73/3.19–3.60 |
| Current guards | 23759 | 254.96 [250.88–264.94] | 268.17 [258.59–279.66] | 1.86–3.24/2.61–3.62/3.14–3.56 |
| Compile-only candidate | 23759 | 250.50 [248.24–259.06] | 262.20 [258.13–264.23] | 1.82–3.29/2.68–3.60/3.15–3.56 |

Current minus control: **+3.96 ms wall / +3.62 ms CPU**. Relative overhead: +1.6% wall / +1.4% CPU. Estimated share of guarded time: +1.6% wall / +1.3% CPU.

### Watcher: one new message after synthetic mailbox bootstrap

| Mode | Rows written | Wall ms | CPU ms (parent + worker) | Load 1/5/15 |
|---|---:|---:|---:|---|
| none | 32 (1 parent + 31 worker) | 525.16 [524.21–536.71] | 589.52 [586.77–621.75] | 2.38–2.55/2.67–2.70/3.15–3.15 |
| current | 32 (1 parent + 31 worker) | 524.75 [523.94–530.11] | 587.10 [581.24–638.94] | 2.38–2.55/2.67–2.70/3.15–3.15 |

Watcher uses `MailboxWatcher` → `startSyncJob` → the real `scripts/runSyncJob.ts`, not a direct callback substitute. Its worker entry path is selected at runtime by a scratch wrapper so a newly opened worker can drop guards **after** production initialization; otherwise initialization would reinstall them. The timed worker startup includes that scratch setup, which slightly penalizes the unguarded control. Timing stops on `synced`, after asserting the injected message arrived. Worker CPU is recorded by each actual worker; it is not inferred from elapsed time. There is no resolved positive watcher penalty in this setup.

Initial-sync, incremental, recompute, delete, draft, and watcher spreads overlap. Their small differences are estimates, not precise causal percentages or evidence that guards speed anything up. Bulk flags and folder-prefix move have non-overlapping ranges. Draft CPU variation is substantial; its negative delta is not a guard saving. These are library/service flows, not HTTP/auth/browser response times.

## Cost anatomy

Nine repetitions, 50,000 minimal production-table UPSERTs against an existing row, one prepared statement and one transaction, `:memory:` database with the full production schema. Each conflict-update executes both BEFORE INSERT and BEFORE UPDATE guards. Callback counting is done on a separate probe after timing; the timed JS marker is the production `() => 2` callback. “Native” uses the exact same marker name and current trigger body, implemented by the scratch SQLite extension.

Variant definitions: `builtin` replaces the marker expression with `length('v2')`; `when` moves the `IS NOT 2` test to the trigger WHEN clause with RAISE in its body; `det` keeps the current body and registers a deterministic function; `when_det` combines those two. `prepare` uses `SELECT noctua_writer_v2() WHERE 0`; `deadcase` uses `CASE WHEN 0 THEN noctua_writer_v2() END`.

| Guard variant | Wall ms | CPU ms | JS calls / conflict UPSERT | Load 1/5/15 |
|---|---:|---:|---:|---|
| none | 212.21 [210.56–220.29] | 216.58 [210.90–221.75] | 0 | 2.18–2.55/2.61–2.70/3.11–3.15 |
| current | 333.48 [310.49–338.39] | 335.27 [313.39–338.47] | 2 | 2.18–2.55/2.61–2.70/3.11–3.15 |
| builtin | 327.25 [323.07–335.89] | 328.85 [323.25–337.80] | 0 | 2.18–2.55/2.61–2.70/3.11–3.15 |
| when | 333.68 [329.30–336.31] | 334.59 [331.14–336.49] | 2 | 2.18–2.55/2.61–2.70/3.11–3.15 |
| det | 335.40 [331.18–341.94] | 336.79 [331.49–343.87] | 2 | 2.18–2.55/2.61–2.70/3.11–3.15 |
| when_det | 333.98 [328.49–341.11] | 335.29 [329.13–342.81] | 2 | 2.18–2.55/2.61–2.70/3.11–3.15 |
| native | 326.76 [321.07–328.77] | 327.23 [322.90–329.05] | 0 | 2.18–2.43/2.61–2.67/3.11–3.14 |
| prepare | 322.82 [319.01–330.38] | 324.49 [319.11–332.08] | 0 | 2.18–2.43/2.61–2.67/3.11–3.14 |
| deadcase | 321.71 [318.60–326.43] | 323.48 [320.13–328.26] | 0 | 2.14–2.43/2.59–2.67/3.10–3.14 |

Against no triggers, current guards add **2.43 µs per conflict UPSERT**. The compile-only body still adds **2.21 µs** (~91% of the guard overhead). Replacing JS with a native function saves **6.72 ms / 50,000 UPSERTs**, approximately **0.07 µs per callback** and 2.0% of total microbenchmark time. This is an empirical decomposition: the compile-only body changes VDBE instructions, and the native control still has a C call plus comparison; it is not an exact instruction-level profile.

For the exact bulk-flag UPDATE, `EXPLAIN` grows from **166 opcodes / 59 Column operations** without guards to **271 / 71** with current guards. WHEN is **269 / 71** and compile-only is **266 / 71**. The same extra row-reading machinery survives callback removal, consistent with the measured flag-update cost. Full programs are retained in `explain.json`.

`deterministic: true` is supported: runtime `PRAGMA function_list` reports flag **2048** versus **0** by default. It still calls the marker for every trigger invocation: three rows updated → three callbacks; conflict UPSERT → two callbacks. `innocuous: true` is silently ignored: flags remain 0 (or 2048 with deterministic), and `trusted_schema=OFF` still rejects the JS function as unsafe. `directOnly: true` sets the corresponding flag but prohibits use from the trigger, so it is unsuitable. The installed `node_modules/bun-types/sqlite.d.ts` has no `Database.function` declaration; runtime probes and [Bun’s FunctionOptions reference](https://bun.sh/reference/bun/sqlite/FunctionOptions) establish the supported options. The native control registers `SQLITE_DETERMINISTIC | SQLITE_INNOCUOUS`.

SQLite supports row triggers only, one operation per trigger. The earlier verification note suggesting one check per statement is inaccurate: a 5,100-row UPDATE invokes the guard 5,100 times. A combined `BEFORE INSERT OR UPDATE` trigger fails syntax validation; persistent triggers cannot read a TEMP marker table. See the local probes and [SQLite CREATE TRIGGER documentation](https://www.sqlite.org/lang_createtrigger.html).

### Exact production UPSERT SQL, fresh disk shards

Seven repetitions, 5,000 distinct message rows, full 45-column SQL and bindings captured from `upsertMessages`. Inserts start empty; updates start with the same 5,000 rows. “Reused” prepares once; “reprepare” prepares and finalizes for each row. Both use one transaction. Setup, schema installation, row generation, and update prefill are outside timing. These raw SQL cases exclude FTS/thread/API work and are not interchangeable with the prior report’s workload.

| Workload / statement lifetime | Without: wall ms | Current: wall ms | Without / current CPU median ms |
|---|---:|---:|---:|
| insert / reused | 108.59 [107.31–110.03] | 166.99 [164.73–172.43] | 109.94 / 167.61 |
| insert / reprepare | 470.06 [453.04–478.67] | 702.17 [689.58–716.57] | 482.53 / 715.00 |
| update / reused | 156.40 [154.86–157.60] | 208.98 [207.42–211.83] | 156.74 / 210.43 |
| update / reprepare | 509.52 [498.80–520.49] | 736.85 [710.17–743.43] | 517.92 / 746.75 |

Full raw CPU spreads and all 1/5/15 load samples are in `rawprod.jsonl` and `summary.json`; each variant uses identical SQL/data/configuration. Preparation amplifies the guard cost, explaining why a raw per-row preparation result can overstate production batching impact.

## Alternatives

All costs below are the same **5,000-row production INSERT / reused statement** benchmark above (seven repetitions). Its load ranges across all alternatives were 1.70–2.57 / 2.26–2.61 / 2.87–3.10; per-variant ranges and every individual sample are in `summary.json` and `rawprod.jsonl`. No candidate changes composite keys, FTS naming, version refusal, or the migration transaction. Security probes use plain unregistered `bun:sqlite` handles with foreign keys off by default, so their rejection cannot depend on foreign-key enforcement.

| Alternative | Wall ms | Security evidence / property lost | Files a production change would touch | Risk |
|---|---:|---|---|---|
| current | 166.99 [164.73–172.43] | Reference; full matrix passes. | None | Current behavior |
| builtin | 167.45 [157.72–179.17] | Fails: every unregistered table mutation prepares; pre-migration statements mutate data. A builtin cannot identify a connection. | lib/db/shardFormat.ts | Unacceptable |
| when | 168.52 [165.18–170.88] | Full tested matrix passes; wrong marker still aborts. No material measured improvement. | lib/db/shardFormat.ts; lib/db/accountKeys.ts for trigger-revision migration; tests | Low code scope, security-sensitive trigger replacement |
| det | 169.17 [167.03–172.33] | Full tested matrix passes; wrong marker aborts. No callback reduction. | lib/db/shardFormat.ts; registration tests | Low scope, no demonstrated benefit |
| when_det | 169.68 [166.24–175.95] | Same guarantees as WHEN/deterministic; still two callbacks on conflict UPDATE. | lib/db/shardFormat.ts; lib/db/accountKeys.ts for trigger-revision migration; tests | Low scope, no demonstrated benefit |
| native | 168.19 [163.87–173.41] | Full tested matrix passes; marker check preserved. Connection-local native registration replaces JS. | lib/db/shardFormat.ts; new native source; native build/package and deployment configuration; tests | High: ABI/platform packaging, extension loading, version-constant coupling |
| prepare | 169.20 [161.16–174.84] | Listed legacy/prepare/stale/version/crash tests pass; **wrong registered marker 1 is accepted**. Keeps trigger machinery cost. | lib/db/shardFormat.ts; lib/db/accountKeys.ts for existing-trigger replacement; tests | Weakens runtime version validation; no useful flow gain |
| deadcase | 168.27 [162.52–173.57] | Same tradeoff as compile-only WHERE 0; wrong registered marker accepted. | lib/db/shardFormat.ts; lib/db/accountKeys.ts for existing-trigger replacement; tests | Same weakening; no useful gain |

Changing persistent trigger text requires an atomic replacement path for existing v2 shards: `CREATE TRIGGER IF NOT EXISTS` and the current name-only installed check will otherwise leave the old bodies in place. Connection registration flags/native callbacks alone need no trigger-body migration.

`prepare` is `BEGIN SELECT noctua_writer_v2() WHERE 0; END`; `deadcase` uses an unreachable CASE arm. SQLite resolves the function name before eliminating execution, which is why unregistered connections still fail at preparation. They satisfy the specifically enumerated legacy-connection properties in these probes, but are **not equivalent to the current marker-equals-2 check**. They are not recommended.

### Security probe evidence

| Candidate group | Fresh unregistered preparation | Statements prepared before trigger installation / migration | FTS legacy name | Newer format / crash |
|---|---|---|---|---|
| current | 78/78 missing-function failures | 3/3 ordinary DML failures; 3/3 pre-migration FTS failures | 3/3 view failures; 6/6 DML variants rejected | v3 refusal/data unchanged: True; crash rollback: True |
| builtin | 0/78 missing-function failures | 0/3 ordinary DML failures; not pursued after failure | 3/3 view failures; 0/6 DML variants rejected | v3 refusal/data unchanged: True; crash rollback: n/a |
| when | 78/78 missing-function failures | 3/3 ordinary DML failures; 3/3 pre-migration FTS failures | 3/3 view failures; 6/6 DML variants rejected | v3 refusal/data unchanged: True; crash rollback: True |
| det | 78/78 missing-function failures | 3/3 ordinary DML failures; 3/3 pre-migration FTS failures | 3/3 view failures; 6/6 DML variants rejected | v3 refusal/data unchanged: True; crash rollback: True |
| when_det | 78/78 missing-function failures | 3/3 ordinary DML failures; 3/3 pre-migration FTS failures | 3/3 view failures; 6/6 DML variants rejected | v3 refusal/data unchanged: True; crash rollback: True |
| native | 78/78 missing-function failures | 3/3 ordinary DML failures; 3/3 pre-migration FTS failures | 3/3 view failures; 6/6 DML variants rejected | v3 refusal/data unchanged: True; crash rollback: True |
| prepare | 78/78 missing-function failures | 3/3 ordinary DML failures; 3/3 pre-migration FTS failures | 3/3 view failures; 6/6 DML variants rejected | v3 refusal/data unchanged: True; crash rollback: True |
| deadcase | 78/78 missing-function failures | 3/3 ordinary DML failures; 3/3 pre-migration FTS failures | 3/3 view failures; 6/6 DML variants rejected | v3 refusal/data unchanged: True; crash rollback: True |

Snapshots include all ordinary/virtual/shadow tables and views and remain unchanged for accepted candidates. Variant probes cover UPSERT `ON CONFLICT DO UPDATE`, `INSERT OR REPLACE`, `REPLACE`, `INSERT OR IGNORE`, `UPDATE OR REPLACE`, and a zero-row DELETE. Unknown-function compilation prevents mutations even where a trigger would not execute for any row. Separate stale-schema handles can initially prepare against a cached old schema; execution auto-reprepares and fails before writing. The “fail at prepare” claim applies to preparation against the migrated schema, not to a connection that has not yet refreshed its cached schema.

The crash probe SIGKILLs each child by its exact returned PID after all guard/FTS DDL and before the version bump, inside the transaction. Schema/data/version snapshots match the pre-transaction state; restart installs 78 guards at version 2. This exercises the guard/FTS/version atomic boundary, not a repeat of the unchanged full composite-key table-copy migration tests from the earlier audit.

Legacy SQL sites were independently extracted from `git archive 164a57e lib/db` using the TypeScript AST. Literal and template DML against protected tables were retained; dynamic scalar expressions/list predicates were normalized to parameters; the optional thread filter was rendered as `AND t.threadId IN (?)`. The previous audit’s exact 112-site extraction was not supplied, so this is an independent coverage set rather than a claim to have replayed the same 112 bindings.

| Mode | Extracted sites | Missing function | Read-only legacy FTS | Other rejection / prepared |
|---|---:|---:|---:|---:|
| current | 112 | 105 | 7 | 0 |
| when | 112 | 105 | 7 | 0 |
| det | 112 | 105 | 7 | 0 |
| when_det | 112 | 105 | 7 | 0 |
| native | 112 | 105 | 7 | 0 |
| prepare | 112 | 105 | 7 | 0 |
| deadcase | 112 | 105 | 7 | 0 |

Important boundary: **direct SQL to `message_fts_v2` is writable on a plain unregistered connection for the current design as well as the candidates**. SQLite does not permit these guards on FTS virtual/shadow tables. The existing guarantee is that the legacy binary’s `message_fts` DML fails against the read-only view; it is not a defense against an arbitrary client that deliberately names v2 internals or drops triggers. If “all FTS paths” is intended to require arbitrary new-name writes to fail, the current design itself does not meet that stronger requirement, and none of these variants fixes it.

TEMP markers, authorizers registered only on new connections, and application-only version checks do not replace persistent legacy rejection. A permanent scalar/version value would be visible to legacy writers too. Physical-table renaming behind writable views would require changing essentially every SQL writer and conflicts with UPSERT-on-view semantics; it was not implemented or benchmarked. These are rejected architectural directions, not measured equivalents.

## Recommendation

**Do nothing to the writer guards.** Retain the connection-local version check and all 78 persistent BEFORE triggers. There is a real bulk-mutation cost, but changing CASE to WHEN or setting deterministic does not remove it; removing the callback preserves almost all of it. The native marker preserves the tested security properties and saves 2.0% in the minimal microbenchmark, but its production INSERT median is slightly slower than current (168.19 versus 166.99 ms). There is no consistent production-SQL gain to justify a native distribution and versioning dependency in security code. No measured low-complexity alternative both preserves the full current runtime check and materially improves these flows. Revisit only if production profiling shows bulk mutation latency is a user-visible bottleneck; this brief authorizes no implementation.

## Methodology

> Evidence copy: the harness scripts and result files from `/tmp/perf-guards/` (scripts, `*.json`, `*.jsonl`, `writer.c`) are preserved in `briefs/perf-writer-guards/`. The synthetic shard copies and probe databases were deleted after the run.


All implementation/harness/data files are under `/tmp/perf-guards/`; the deliverable is outside the worktree. No real mailbox or worktree runtime data was read. `.env.local` was masked out inside the sandbox; only explicit synthetic secrets were supplied. `NOCTUA_DATA_DIR` points into scratch. Source and dependencies are mounted read-only; the scratch root is the writable bind. `bwrap --unshare-all` isolates network and PIDs; fixture IMAP/control servers bind port **0** on the isolated loopback interface. No host ports, including 3786–3797, were used. Each server is stopped using its returned `stop()` handle; watcher workers finish/cancel via their exact process handles; crash children are killed only by their exact returned PID.

Harnesses: `flows.ts` (real sync/mutations/drafts), `watcher.ts` + `watch-worker.ts` (real watcher/subprocess), `anatomy.ts`, `rawprod.ts`, `common.ts` (scratch trigger selection), `writer.c`/`writer.so` (native control), `probes.ts`, `crash.ts`/`crash-worker.ts`, `flags.ts`, `explain.ts`, `legacy-sites.ts`, `summarize.py`. `production-upsert.json` contains the exact captured SQL/bindings. `*.jsonl` retain every repetition; `summary.json` contains all medians, spreads and load ranges; `*.log` retain command results. Smoke measurements are kept separately as `*-smoke.jsonl` and are excluded.

Exact invocations from `/home/monkey/code/noctua-mail/wt-perf-guards`:

```sh
nice -n 10 cc -O2 -fPIC -shared -o /tmp/perf-guards/writer.so /tmp/perf-guards/writer.c
mkdir -p /tmp/perf-guards/legacy
git archive 164a57e lib/db | tar -x -C /tmp/perf-guards/legacy
/tmp/perf-guards/run.sh /tmp/perf-guards/flows.ts 5 none,current,prepare
/tmp/perf-guards/run.sh /tmp/perf-guards/watcher.ts
/tmp/perf-guards/run.sh /tmp/perf-guards/anatomy.ts
/tmp/perf-guards/run.sh /tmp/perf-guards/rawprod.ts
/tmp/perf-guards/run.sh /tmp/perf-guards/probes.ts
/tmp/perf-guards/run.sh /tmp/perf-guards/crash.ts
/tmp/perf-guards/run.sh /tmp/perf-guards/flags.ts
/tmp/perf-guards/run.sh /tmp/perf-guards/explain.ts
/tmp/perf-guards/run.sh /tmp/perf-guards/legacy-sites.ts
python3 /tmp/perf-guards/summarize.py
git status --porcelain=v1
```

`run.sh` records the complete sandbox/env invocation and applies `nice -n 10`, 1,800-second CPU and wall limits, a 4 GiB address-space cap, bounded process/file limits, and the worktree tsconfig. The main flow series ran at effective nice 10; the sequential remaining batch inherited nice 10 and applied the wrapper again, yielding effective nice 19. All variants within a comparison share the same niceness. Own timed series did not overlap; the earlier overlapping smoke run is excluded. Host load was sampled with `uptime` after every timed flow/variant and is retained verbatim. Fixture injection, startup/schema migration, and synthetic row construction are outside the primary flow timing; sync includes real IMAP fetch, parsing/sanitization, source storage, FTS, derived-thread work and mailbox state updates. These messages are simple text without attachments; the results do not model remote network latency, large HTML bodies, or expensive attachment parsing. Message bodies/headers are fixed synthetic text; each five-message group shares a thread. Every initial and incremental run asserts exactly 5,000 then 5,100 stored messages. Move/delete and flag counts are identical in all modes. The unguarded control keeps composite keys, format v2, and the read-only legacy FTS view, dropping only the 78 writer guards on the already initialized scratch handle.

Worktree verification at completion: `git status --porcelain=v1` produced no output. No Next build/dev server, commits, branches, pushes, or tracked-file changes.
