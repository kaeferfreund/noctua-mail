# FTS identity v3 implementation handoff

2026-10-23 UTC. Implementation checkout: `/home/monkey/code/noctua-mail/wt-fts-v3`, branch `perf/fts-identity-v3`, base `9424150f5aa0a446ed9bc03ed199e6825129467d` (round-7 team-inbox). Implemented the owners’ approved option (d) from `perf-fts-identity-spike.md`. The audit contract is `audit-s1s2-verify.md` and the corrected conclusions in `perf-writer-guards.md`.

## Summary

- Contentful FTS5 now uses `message_fts_v3` and a composite-owned `message_fts_identity` integer rowid map. Single/scoped deletions use integer membership before message deletion; existing upserts retain their integer identity.
- The atomic v3 migration retains both writer markers during upgrade, replaces the original 78 guards and adds three map guards (81 total), and exposes both old FTS names as read-only views. Damaged v3 shapes fail explicitly.
- All 112 legacy DML sites reject; 81 guard combinations and both views reject unauthorized writes. Required crash points recover the complete v2 state, and retry converges once. Stale v2 handles fail.
- Synthetic 11k median: 200 FTS deletes **5,504.571 → 5.852 ms**; existing SQL upsert **29.187 → 0.231 ms**; v3 full validated rebuild **960.846 ms**. Committed migration median **1,041.766 ms**. Ordered differential results match `9424150`.
- Final gate results and commit inventory are recorded below after completion.

## Design as built

`message_fts_identity` has `ftsRowid INTEGER PRIMARY KEY AUTOINCREMENT`, non-null `accountId` and `messageId`, `UNIQUE(accountId,messageId)`, and the composite `FOREIGN KEY(accountId,messageId) REFERENCES messages(accountId,id) ON DELETE CASCADE`. Its key refers to the final local storage ID, including mailbox collision variants, rather than the RFC Message-ID. Every FTS insert supplies that integer as its explicit rowid. AUTOINCREMENT preserves identity across ordinary updates and avoids reuse after deletion; VACUUM stability is tested.

`ftsIdentity.ts` centralizes the new DDL, FTS column list, canonical bulk population, validation, orphan counting, prepared lookup/allocation/insertion and single-delete SQL. `SHARD_FTS_TABLE` remains exported from `shardFormat.ts`; its definition is re-exported from the helper to avoid a module-initialization cycle between schema probing and the DDL helper.

Upsert looks up the final `(accountId,rowId)` mapping, deletes FTS by mapped rowid, upserts the message, allocates a missing mapping with `INSERT ... RETURNING`, and inserts FTS with the explicit integer, within the existing immediate transaction. Prepared statements remain outside the row loop. A surviving message without a mapping raises an explicit repair error. `replaceExisting` snapshots may describe rows already deleted by the enclosing scope replacement; those rows correctly receive new mappings. This distinction preserves source/identity metadata without a key-scan fallback.

Single deletes use `rowid=(SELECT ftsRowid FROM message_fts_identity WHERE accountId=? AND messageId=?)`. Account, folder, batch and folder-prefix deletes use `rowid IN (SELECT ...)` through scoped mapping/message queries. Same-copy duplicate purge uses the shared single-delete statement. FTS is deleted before messages, then the composite FK removes mappings. Existing file staging, attachment/calendar work, collaboration remapping and retry handling remain in place.

The measured single-delete plan is `SCAN message_fts_v3 VIRTUAL TABLE INDEX 0:=`, with a scalar subquery using the covering composite UNIQUE index on the identity table. The virtual-table rowid equality is an integer lookup, not the old whole-index key scan.

## Atomic migration and cold open

1. `prepareAccountShardConnection`, still invoked by `configureAccountDb`, refuses versions above 3 before configuration or marker registration. Schema initialization separately checks complete v3 shape; the preparation hook registers `noctua_writer_v2() => 2` and `noctua_writer_v3() => 3` on supported handles.
2. Shape checks inspect schema metadata: exact normalized map/FTS DDL, the five physical FTS shadow objects, both view definitions, the audited ordinary tables, and every discovered account-scoped table’s three exact v3 guard definitions. Old v2 guards cannot satisfy this probe. The account-key check also validates the audited composite keys/FKs. No full message traversal, integrity write or writer lock occurs on a healthy cold open. A separate connection holding `BEGIN IMMEDIATE` does not prevent full initialization of a healthy v3 shard.
3. Initialization of pre-v3 shards owns one outer immediate transaction, including additive schema work. Pre-v2 initialization retains foreign-key OFF before the transaction and restoration afterward. Normal v2 upgrades leave foreign keys ON. The historical composite-key/FTS conversion remains intact inside the same outer transaction; direct `ensureAccountKeySchema` callers retain their own transaction/FK procedure. The key migration body accepts the caller’s transaction instead of nesting immediate transactions.
4. The migration rechecks under the writer lock. It counts old FTS orphans, creates the side table and the new physical FTS while historical FTS exists, assigns integers by binary `(accountId,id)` order, and bulk-populates from canonical messages. Old FTS rowids are deliberately unrelated to message rowids in fixtures.
5. Validation checks all three counts, message↔mapping↔FTS coverage in both directions, exact account/local-ID ownership, unique ownership, FTS integrity, and foreign keys. Historical duplicate/missing FTS entries are reconstructed from messages. No messages table is copied or updated during an ordinary v2→v3 migration.
6. It drops the old view/physical FTS, creates **both** `message_fts` and `message_fts_v2` as `SELECT rowid,* FROM message_fts_v3`, drops/replaces old guard definitions, and installs all 81 v3 guards. `user_version=3` is the final write, followed by a read-only schema verification and commit. There is no intermediate committed v2 state.
7. Runtime schema readiness caches are marked only after the outer initialization commits. Their additive installers can run inside the caller’s transaction, preventing nested immediate transactions or false readiness after rollback.

The selected v3 repair policy is **explicit failure**: an incomplete physical index/map, missing view/table/guard or weakened guard body produces `explicit atomic repair required` before additive initialization can recreate an empty old index. There is no automatic repair CLI or in-place downgrade. A future repair must rebuild map and index together under an explicitly owned atomic transaction. Cold-open probing is a schema check, not a full data-corruption audit; `validateFtsIdentity` provides the full traversal used during migration/maintenance.

## Audit semantics statement (owner condition c)

Composite keys and authorization/account predicates are unchanged. The original guard discovery still covers all account-scoped ordinary tables and retains missing-function preparation rejection, including zero-row operations, plus runtime wrong-version rejection. It now installs 78 equivalent v3 guards and the three additional identity guards. The historical marker returns 2 throughout upgrade; it is never changed to return 3. Writer-marker registration remains in the existing `configureAccountDb` hook; `connection.ts` and its pragmas/retries are unchanged. Separately configured cleanup handles preserve the existing absent/partial collaboration-schema behavior; they retain version refusal and marker registration without invoking full schema initialization.

The original FTS name remains read-only, and the v2 physical name becomes a second read-only view. SQLite cannot install these row guards on FTS virtual/shadow tables. Deliberate DML against the new physical `message_fts_v3` from an unregistered SQL client remains outside the audited legacy-binary guarantee. This implementation makes no broader arbitrary-SQL protection claim.

`messages` columns, `senderKey`/`sourceSha256` NULL/known values and raw-source ownership semantics are preserved. The migration reads no raw source files and performs no sender backfill. The master `users.uiLocale` addition is retained. `query.ts`, `retrieval.ts`, `senderKey.ts`, `connection.ts`, auth/sync/UI/parser code and `bun.lock` are byte-unchanged from the base.

## Orphan inventory and handling (owner condition b)

Before starting the upgraded preview, run:

```sh
nice -n 10 bun scripts/checkShardMessageCollisions.ts /absolute/synthetic-or-stopped-shard.db
```

The existing CLI still opens each deduplicated path with `{ readonly: true }`, without importing/configuring the connection layer or initializing schema. It now reports `shardVersion` and `ftsOrphanCount` alongside the existing collision inventory. On v2, an orphan is an FTS row lacking a message with the same `(accountId,id)`; an identical ID in another account does not rescue it. The helper also supports older unscoped historical FTS shapes.

The migration counts every orphan row, discards it deterministically by rebuilding exclusively from canonical messages in binary key order, returns `{ migrated, droppedFtsOrphans }`, and logs `[shard-format-v3] dropped N orphan FTS rows` after successful commit when N is nonzero. No arbitrary orphan is promoted into a message or mapped to another account. Regression: two orphans, a duplicated historical entry, and a missing historical entry migrate to exactly two canonical mappings/FTS rows; return value is 2, both message rows remain byte-equivalent, and retry returns 0. A separate read-only CLI test reports one v2 orphan and leaves the full schema/data/version snapshot unchanged.

## Crash injection, concurrency and audit matrix (owner condition d)

The child-process test worker intercepts the actual production SQL; it kills only itself with SIGKILL. Disk/WAL fixtures compare the complete schema, version, and every table’s rows before recovery and after rollback. All required points pass:

- Immediately after side-table creation.
- After bulk FTS population.
- After the 81st new guard, with the views already swapped.
- Immediately before the version assignment.

Additional kills after version assignment/before commit also recover the complete v2 snapshot. A kill after commit leaves complete v3 and a subsequent opener reports no migration. Every rollback case retries successfully, then a second initialization leaves the snapshot unchanged.

Other passing regressions cover population exceptions/FK restoration, historical key-copy/guard/version failures, two simultaneous production openers (exactly one migrates), a writer-lock failure followed by retry, a reader retaining its v2 snapshot across commit, healthy cold-open lock freedom, damaged v3 shape refusal, repeated updates and delete/reuse, shared-account local-ID collisions, replacement, missing-map failure without mutation, identity-allocation rollback, and VACUUM identity stability. Existing shared-shard tests now validate the three-way bijection after single/batch/prefix/account/folder deletion/replacement.

The frozen **112-site corpus from 164a57e**, supplied by the audited writer-guard probe, is retained in `lib/testFixtures/legacyShardDml.json` and replayed in `shardFormat.test.ts`: **105 missing-v3-function preparation failures + 7 read-only-view failures; zero accepted sites, snapshots unchanged**. All **81/81** ordinary-table INSERT/UPDATE/DELETE combinations reject an unregistered or v2-only handle with FK enforcement OFF, including zero-row UPDATE/DELETE. Both old FTS names reject all **6/6** INSERT/UPDATE/DELETE operations. A registered v3 marker returning 2 rejects an actual row mutation. Previously prepared v2 message and physical-FTS statements fail after migration, without mutation.

The writable-opener inventory still passes: common get/with-account handles, evicted/reopened handles, separately configured membership cleanup, watcher/sync worker, recompute workers, scripts, and MCP/application callers consume the common configured API. The collision CLI remains read-only. No new alternate production writable opener was introduced.

S3 focused sender-key/retrieval/provenance/shared-shard tests pass. The headless `tests/browser/htmlPrivacy.test.ts` regression passes **1 test / 177 assertions**, using this worktree’s synthetic data and only ports **3897/3898**. Temporary port literals were restored afterward. Its app, tracker and browser were closed by test cleanup. The shared fixtures on 3790–3799 and reserved 3800 were left alone.

## Measurements

Bun **1.4.4**, SQLite **3.53.4**, Linux arm64; all heavy commands under `nice -n 10`. Shared-host 1/5/15 load at the timing series endpoints was **12.27/16.50/14.38 → 10.39/15.22/14.08**. These are local synthetic measurements, not production latency guarantees.

The shard contains **11,000 messages, 11,000 attachments and 11,000 retained source files** with matching SHA-256 provenance. Two accounts share local IDs, RFC IDs, thread IDs and attachment IDs. Body is 3,900 characters (`Synthetic body alpha beta gamma delta. ` repeated 100 times), HTML carries the same body, and source files include synthetic headers/body. Half the initial sender keys are NULL. Message dates are distinct. Every 400th subject carries `needle`; subjects also contain café and quoted-phrase cases. All ordinary tables, indexes and guards use production initialization. Historical FTS rowids start at message rowid + 500,000. No ANALYZE or PRAGMA optimize was run.

Write samples use one warmup and then the stated repetitions, inside `BEGIN IMMEDIATE`/ROLLBACK to restore the same fixture. The 200-delete operation removes FTS only, including lookup cost. The narrow upsert uses the unchanged production 47-binding messages UPSERT and FTS maintenance; source staging, network, attachment/calendar/thread/collaboration work are outside the timing. The v3 rebuild includes the production builder’s full validation, both views and guard installation; the v2 rebuild recreates and bulk-populates the old FTS and restores its view, without the new validation/guard-swap work. Thus rebuild totals have deliberately different validation work and should not be presented as a pure storage-engine comparison.

| Workload | Samples | v2 median [min–max], ms | v3 median [min–max], ms |
| --- | ---: | ---: | ---: |
| 200 FTS deletes | 5 | 5,504.571 [5,436.648–5,509.575] | 5.852 [5.789–6.086] |
| Existing-message SQL upsert | 15 | 29.187 [28.543–29.946] | 0.231 [0.210–0.291] |
| Full FTS / validated index+map rebuild | 3 | 480.230 [472.881–481.940] | 960.846 [950.373–1,158.686] |

The fixture-specific delete/upsert ratios are approximately **941× / 126×**. They do not imply corresponding whole-sync or UI speedups. The larger shared fixture/attachments/sources and validation differ from the read-only spike, so its exact timings are not acceptance constants.

Differential: a temporary copy of the **exact `9424150` query implementation**, changing only the imported physical table constant to the v2 literal, ran before migration. The current unchanged query implementation ran afterward on the same shard. **134 application comparisons** (message/thread lists plus related mail, including identical errors for unsupported baseline inputs) and **10 fully ordered SQL FTS queries** match. Cases cover both accounts, selective/common/no-hit and empty searches, case/accents, phrase and multi-token input, field scopes, preview, RFC/local/thread substrings, attachment names, unread/visibility/folder exclusions, page boundaries, totals and groups. SQL cases include prefix, column scopes, phrase, NEAR, OR and NOT. The existing baseline error for the literal application input `alpha OR needle` was preserved; no parser change was made.

A streaming canonical snapshot of every messages column was identical across migration (SHA-256 `5880fedde4cc6ab607eedab24fee7579a7d865edf62d7697db41fdfc6057e58e`). FTS integrity, composite ownership and foreign-key checks pass. Temporary baseline modules and all `/tmp/fts-v3` scratch are removed at handoff; no synthetic source/database fixture is committed.

## Deploy handoff (owner condition a)

**The preview migrates at startup.** Three separately committed production v2→v3 migrations on this 11k shard took **1,039.209 / 1,048.154 / 1,041.766 ms**, median **1,041.766 ms**. This includes the production initialization path, mapping/index population, full coverage/integrity/FK validation, guard/view replacement and commit. It excludes synthetic fixture/file generation. Normal v2 migrations retained foreign keys ON.

The initial compact v2 main file was **169.61 MiB**. After the entire migration/rebuild benchmark series, logical database page allocation was **235.32 MiB total / 176.95 MiB live** (14,943 free pages). This is a page-count-based end-of-series allocation sample, **not a measured main-file size, migration peak-space or WAL bound**; WAL peak was not captured. The migration builds alongside the old index, keeps contentful body duplication, and does not shrink the main file. Do not add startup VACUUM/optimization or extrapolate the 11k lock duration into a guaranteed larger-shard budget.

Stop old clients before rollout and inventory orphans first. On process death before commit, restart/retry recovers v2 and performs the migration once; after commit, reopen verifies v3 without migrating. Existing retry handling remains in force for lock contention. Stale v2 handles reject on the new guards/views, and a v2 binary opening an already upgraded file refuses its newer version. Reverting the binary does not provide an in-place downgrade: restore a stopped pre-upgrade backup or use a separately reviewed export/rebuild procedure. The SIGKILL tests establish process-crash behavior, not power-loss durability.

## Deviations and implementation choices relative to the spike

- No storage/query design deviation: option (d), contentful FTS, canonical composite identities, both views, exact runtime marker checks, all original guards plus three, and version-last atomic commit are implemented.
- The implementation is based on round-7 `9424150`, rather than the spike’s `620a785`; `users.uiLocale` and current S3 columns/semantics are preserved.
- Pre-v3 additive initialization joins the outer migration transaction, which is stronger than the old v2 initializer’s additive work before its key transaction. Two schema installers now accept the existing transaction and defer readiness-cache publication until commit. This is necessary to avoid nested immediate transactions and incorrect retry state, without changing their data semantics.
- Incomplete v3 schema uses the explicitly permitted failure policy. No automatic repair/reindex entrypoint is added.
- The physical-table constant is re-exported from the helper to keep DDL/schema probing free of circular initialization. Public imports from `shardFormat.ts` remain valid.
- Added test-only v2/crash fixtures and the frozen 112-site corpus beyond the brief’s named test files to make recovery/audit checks reproducible. Updated the collaboration contention test to construct an actual v2 fixture before removing collaboration tables, rather than incorrectly retaining a complete-v3 header on an older-schema fixture. Extended the existing read-only collision script rather than adding another inventory opener.
- Benchmarks include actual retained sources/attachments, shared-account IDs and the implemented full validation. v3 rebuild cost is therefore reported with its validation/guard work, not as the spike’s narrower repopulation number.
- Used the repository’s actual `test:stress` script (there is no `stress` script). Graceful shutdown receives explicit isolated data/port arguments. Browser port edits were temporary and restored.

## Gates

Pending final gate completion.

## Diff stat and commits

Pending final commits.

## Explicit owner review checklist

- [ ] Marker lifecycle: future-version refusal before configuration; v2 returns 2 throughout upgrade, v3 returns 3; registration remains in configureAccountDb, including cleanup handles; wrong marker still fails at runtime.
- [ ] Guard discovery: original 26 account-scoped tables plus identity (81 guards), extra discovered scoped tables still guarded, missing/changed definitions rejected; physical FTS/shadow limits described accurately.
- [ ] Migration composition: audited composite-key conversion, S3/custom-index/custom-trigger retention, foreign-key OFF/restore for pre-v2, ON for ordinary v2, one outer immediate transaction, recheck under lock, version assignment last.
- [ ] Cold-open fast path: complete v3 schema/constraints/views/guards checked without a writer lock or full message scan; schema repair cannot silently create an empty index.
- [ ] All writable openers: get/with-account API, cache reopen/eviction, membership cleanup, watcher, sync worker/runSyncJob, recompute workers/CLIs, calendar scripts and MCP paths retain the common configuration hook; inventory CLI stays read-only.
- [ ] Stale v2 handles: prepared message DML rejects under the v3 marker; the former physical name is read-only; all 112 legacy sites and 81 guard combinations remain rejecting.
- [ ] Mutation scope: final collision IDs, same-copy duplicates, repeated upsert, folder/account replacement and every single/batch/prefix delete preserve the map/FTS/message bijection and other account’s rows/files/provenance.
- [ ] Rollout/retry: preview startup duration and temporary space headroom reviewed; old clients stopped; orphan inventory reviewed; process-crash recovery and lock retry understood; larger production-like shard/WAL sizing remains deployment planning work.
- [ ] No in-place downgrade: user_version is not reset as a rollback mechanism; use a stopped pre-upgrade backup or a separately reviewed export/rebuild.
