# perf-db-retrieval-statements

## Summary

Committed `64cdb64` (`perf(db): reuse cached statements for message retrieval`) on `perf/db-retrieval-statements`, based on `620a785`. Stable message, attachment and calendar reads reuse the live connection's statement cache. Legacy delivery/sender-key enrichment remains byte-identical and differential tests preserve rows, SQL bindings, execution order and affected-row counts.

Paired warm medians on 11,000 synthetic messages: 5,000 exact opens **1,868.45 → 1,201.22 ms**, collision-base opens **2,188.49 → 1,192.60 ms**. Typical three-message opens **1.69 → 1.21 ms**, or **1.15 → 0.83 ms** with attachments/invites. Small-thread savings are under half a millisecond.

Typecheck passes; lint retains the baseline **1 error + 25 warnings**; test:ci passes **2581 unit + 376 DOM tests** after an environment-only retry for a temporary-filesystem quota failure. Explicit retrieval/S3 checks pass **22 tests**; headless HTML privacy passes **1 test / 177 assertions** on authorized ports 3793/3794. Tree clean; one commit; no push or PR.

## Implementation

Only `lib/db/messages/retrieval.ts` and the new `lib/db/messages/senderKey.retrieval.test.ts` changed.

- Hoist the primary message lookup out of the collision-candidate loop and get it from Bun's connection-owned `query()` cache. All candidate ordering and account predicates are unchanged.
- Use that same cache for the two fixed RFC/LIKE fallback SQL shapes and the attachment read, without changing SQL or parameters.
- Give the existing shared calendar reader a local read-only preparation adapter backed by `db.query`. This caller always supplies one message ID, so the SQL shape is stable. The shared reader's filtering, normalization, ordering and DTO mapping remain unchanged; no shared helper file changed.
- No application-owned global cache, WeakMap or cached connection handle was added. The existing connection owns statement lifetime; close/reopen is covered.
- The entire legacy delivery-metadata enrichment block, re-read, null check and `await backfillMessageSenderKey(db, row)` are byte-identical to 620a785. The provenance helper, retry behavior and writes were not modified. `listThreadMessages` in `query.ts` was not modified; the existing S3 suite exercises that backfill path too.

No changes to upsert, queries, schema, indexes, shard guards, connection/runtime probes, account keys, mail, UI or dependencies. No ANALYZE or PRAGMA optimize was run. The sibling commit 171b129 was inspected through git and its report; its worktree and source files were left alone.

## Measurements

Copied rerank `sql.ts`, `followup.ts` and `sql-results.json` from `/home/monkey/code/noctua-mail/briefs/perf-backlog-rerank/` into `/tmp/perf-retrieval/`. Added adapted `setup.ts`, `measure.ts` and `paired.ts`. Every heavy command ran under `nice -n 10`; benchmarks ran sequentially, separate from this task's browser and final gates.

The fixture uses real `getDb`/`getAccountDb`, production schema/configuration and v2 writer guards. Scripts assert the messages update guard and 11,000-message count. Synthetic IDs/addresses only; three messages per logical thread and the rerank's repeated synthetic body plus HTML. No real mailbox, external mail server or deployed app was used. Bulk retrieval reads have empty attachments/calendar, as the original read control did; the small metadata case adds one attachment and one invite per message. No MIME/source-backfill timing claim is made.

Primary series: one warmup per implementation and **nine measured repetitions each**, alternating old/new order in one process. The original retrieval implementation comes from `git show 620a785:lib/db/messages/retrieval.ts`, copied to scratch with import paths resolved to this worktree. No source replacement, branch switch or extra worktree was needed. Each repetition hashes complete returned DTOs outside timing and asserts equality between implementations. Timing includes actual `getMessageById`, connection/runtime calls, body/attachment/calendar reads and DTO hydration.

- small: 3 exact messages: **1.6853 → 1.2061 ms**; before min–max **1.3664–2.2078 ms**, after **1.0108–2.3419 ms**.
- 5000 exact messages: **1868.4490 → 1201.2168 ms**; before min–max **1798.1889–2086.9515 ms**, after **1158.0958–1267.5007 ms**.
- 5000 collision-base fallbacks: **2188.4942 → 1192.6029 ms**; before min–max **2150.5797–2443.7072 ms**, after **1178.6974–1363.1905 ms**.
- small: 3 messages with attachments and invites: **1.1531 → 0.8270 ms**; before min–max **1.0639–2.2879 ms**, after **0.7368–1.0430 ms**.

Earlier sequential production runs independently measured exact 5,000 opens **2,018.8993 → 1,261.1671 ms**, collision fallbacks **2,424.1155 → 1,257.9602 ms**, small exact **1.7363 → 1.2578 ms**, and small metadata **1.3343 → 0.8146 ms**; all whole-result hashes match. The paired results above are preferred because unrelated host work affected controls.

Exact rerank read-loop controls use 5,000 `SELECT filename FROM attachments WHERE accountId=? AND messageId=?` reads, one warmup and **seven measured repetitions**:

- Baseline process: reprepare **72.0311 ms** (70.2819–105.6092), one reused statement **34.3988 ms** (30.8940–49.1201).
- Updated process: reprepare **66.2775 ms** (63.7119–137.4318), one reused statement **23.5299 ms** (23.2499–30.0175).

These are scratch statement-reuse controls, not end-to-end production savings. The prior research's **73.56 → 21.62 ms** is a historical reference, not a newly shipped measurement. Control drift is explicit; timings are warm synthetic medians, not production p95s. Three-message median savings are **0.4792 ms** exact / **0.3261 ms** with metadata. Ranges overlap in the small exact case.

Paired load 1/5/15 started **[6.89, 6.16, 6.62]**, ended **[8.71, 6.76, 6.79]** on the shared six-core host. Sequential baseline load **[7.03, 6.67, 6.99] → [5.83, 6.4, 6.88]**; updated load **[4.72, 5.9, 6.66] → [4.8, 5.83, 6.61]**. Other users' processes were left alone.

## Differential and regression coverage

The new test file freezes the full original 620a785 `getMessageById` body under a test-local name. Twelve behavioral cases passed against the unmodified baseline before the production edit. The thirteenth test checks the new statement reuse behavior.

Each differential run starts from the same guarded shard and source files, executes in a transaction and rolls back. It compares complete returned messages, ordered stored messages/attachments/calendar rows, and executed SQL/method/bindings/read-write order/write affected counts. No global module mocks or production dependency-injection API were added. Temporary observation of the current fixture's live statement methods is restored in `finally`.

Coverage includes:

- Owned exact wire source, missing provenance, digest mismatch, preexisting sender key, missing source, and a collision variant with only a base source. Delivery hydration still precedes sender backfill; source fallback still cannot grant sender ownership.
- Already hydrated metadata and COALESCE preservation of populated original recipients/sender identity.
- Concurrent resync changing senderKey, raw From or sourceSha256 just before backfill: conditional writes affect zero rows, with the same subsequent sender-key reread and return value as baseline.
- Exact/collision/RFC/LIKE/blank/missing lookup behavior, newest RFC-ID match, attachment hydration and calendar normalization/state filtering/order.
- Two accounts sharing a shard and identical local IDs, plus closing/reopening the shard between calls.
- Primary statement lookup once per open, reused across two collision candidates; exact same cached message/attachment/calendar statement instances across opens, with no fresh preparations for those fixed reads.

## Gates and S3 verification

Final repo gates ran sequentially under nice 10, after source/test edits. Typecheck and lint ran once. The test:ci command required one environment-only retry, detailed below; no source changes were made between attempts:

- `nice -n 10 bun run typecheck`: exit 0, **0 errors**, 1,098 files.
- `nice -n 10 bun run lint`: exit 1, **1 error + 25 warnings**, exactly the supplied baseline. Error is the existing synchronous effect setState at `app/components/calendar/useCalendarConflicts.ts:58`. No findings in the changed files.
- `nice -n 10 bun run test:ci`: exit 0, **2581 unit + 376 DOM**, zero failures. Unit count is the 2,568 baseline plus 13 new tests.
- First test:ci attempt ended after 241.47 s with SQLite `SQLITE_IOERR_SHMSIZE` during shard initialization, then `SQLITE_IOERR_WRITE` during fixture-account creation, before the affected retrieval assertions could run. The shared `/tmp` was a 12 GiB tmpfs with 9.4 GiB used when inspected after failure; the log ended without a full suite summary. Subsequent scratch-file writes explicitly failed with `Disk quota exceeded`, confirming an environment quota issue. Preserved `test-ci-first-io-error.log` and `gates-first.json`; removed only this task's closed 97 MiB benchmark database and reran test:ci with `TMPDIR=$PWD/.tmp/perf-retrieval-ci` on the disk-backed worktree (73 GiB free). No other user's files/processes or repo code changed for the retry. The final successful run is the count reported above.
- `bun run stress` is not defined in this base, so the conditional stress gate does not apply. The separate `test:stress` script was not run.
- `nice -n 10 bun test lib/db/messages/senderKey*.test.ts lib/db.senderKey.test.ts lib/db/messages/retrieval.orphanedNullUid.test.ts`: **22 pass, 0 fail**. This base had no preexisting `lib/db/messages/senderKey*.test.ts`; the new differential suite uses that location, and the seven existing S3 tests in `lib/db.senderKey.test.ts` were explicitly included.
- Headless HTML privacy: **1 pass, 0 fail, 177 assertions**, 62.22 s. Ran a scratch copy of `tests/browser/htmlPrivacy.test.ts` with only imports resolved and 3798/3799 remapped to the authorized **3793/3794**. Invocation: `TMPDIR="$PWD/.tmp" PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 nice -n 10 bun test --config=bunfig.browser.toml --timeout 120000 /tmp/perf-retrieval/htmlPrivacy.test.ts`. Its production Bun bundle, routes, authentication, fixture assertions and Playwright browser behavior are unchanged. Synthetic database lived under this worktree's `.tmp`; the test closed browser/servers and removed scratch outputs, and a socket check confirmed both ports released.
- The first browser attempt on initially requested 3795/3796 failed before fixture setup with `EADDRINUSE`; existing Bun PID 1598 already owned both ports. It was left untouched. The user then authorized 3793/3794, and the corrected run passed. Initial failure is retained in `htmlPrivacy.log`.
- `git diff --check` / staged diff checks clean. Final branch and clean status verified. No stash, push, merge, rebase, PR, deployment or persistent server.

## Diff and commit

```text
lib/db/messages/retrieval.ts                |  16 +-
 lib/db/messages/senderKey.retrieval.test.ts | 315 ++++++++++++++++++++++++++++
 2 files changed, 324 insertions(+), 7 deletions(-)
```

`git log --oneline 620a785..HEAD`:

```text
64cdb64 perf(db): reuse cached statements for message retrieval
```

## Artifacts

Report: `/home/monkey/code/noctua-mail/briefs/perf-db-retrieval-statements.md` (outside the worktree).

Scratch source/results/logs: `/tmp/perf-retrieval/`, including copied rerank inputs, `setup.ts`, `measure.ts`, `paired.ts`, `baseline.ts`, `before.json`, `after.json`, `paired.json`, `differential-before.log`, `targeted-after.log`, `s3-targeted.log`, both browser logs, `typecheck-final.log`, `lint-final.log`, `test-ci-final.log`, `test-ci-first-io-error.log`, `gates-first.json`, `test-ci-retry-result.json`, `gates.json` and `gates-run.log`. Synthetic benchmark database removed after all measurement handles closed; scripts and evidence remain.
