# perf/test-parallel-fixes: test-infra fixes for `bun test --parallel`

Branch `perf/test-parallel-fixes`, worktree `/home/monkey/code/noctua-mail/wt-test-parallel-fixes`.
Base `a614f26` (`perf/test-parallel-trial`, which sits on `origin/integration/stage` `11dc3c5`). Head `018452b`.
The three commits come from a delegated Opus 5.5 task, which hit the provider's usage limit right after its last commit.
The gate re-run, the review and this report are by the deps-thread orchestrator.

## Result

All three infra defects from `perf-test-parallel-trial.md` are fixed, and the gate set by the integration owners holds on the fixed tree.
No test logic changed. `test:ci` stays serial, per the Umbau decision of 2026-10-23.

| Run (12:54–13:15 UTC, load 1.8–4.2) | Pass / fail | Wall | Harness dirs before → after |
| --- | --- | --- | --- |
| `test:stress-parallel -- --seed=1337` | 8,412 / 0 | 277 s | 0 → 1 |
| `test:stress-parallel -- --seed=4242` | 8,412 / 0 | 274 s | 1 → 3 |
| `test:stress-parallel -- --seed=9001` | 8,412 / 0 | 311 s | 3 → 4 |
| `test:ci` (serial unit + DOM) | 2,804 + 462 / 0 | 385 s | 4 → 2 |

- **Shared data dir:** 0 fd hits on `/home/monkey/code/noctua-mail/noctua-data/` (polled every 0.5 s over every process with its cwd in the worktree), 0 files modified there.
- **`undefined/` dir:** none. **SMTP sink dirs** (`boundary-smtp-*`, `sender-smtp-*`): none, in `/tmp` and in the run's `TMPDIR`.
- **Harness dirs:** the unfixed tree left 110 per stress run. Now 1–4 survive a run, and the next harness start removes them. At most 5 existed at once mid-run.
- **Wall times** are lower than in the trial (340–433 s), but the box was much quieter this time, so this is not a like-for-like speed comparison.

## Commits

| Commit | Files | Change |
| --- | --- | --- |
| `d367ea0` | `lib/testDbHarness.ts` | Data dirs carry the creator's pid; a new harness removes dirs whose creator has finished. |
| `d2e1dde` | four test files, one line each | Import the DB harness before the first real-DB import. |
| `018452b` | two fixtures, one line each | SMTP sink output goes into the fixture's harness data dir. |

Diff: 7 files, +38 / −4.

## Fix 1: harness data-dir leak (`d367ea0`)

**Findings from the agent's experiments.**
- Bun 1.4.4 never emits `process` `exit` under `bun test`, neither serially nor isolated. A standalone `bun script.ts` does emit it.
- So serial runs leaked their data dir too, one per run. In this re-run the serial unit dir alone was 224 MB.
- A file-level or preload `afterAll` fires before the `--rerun-each` repeats of the same global are done, so it would delete a dir that is still in use.

**Change.**
- Dir names are now `mywebmail-test-db-<pid>-XXXXXX`.
- At harness start, the harness removes dirs whose creator is this process or a process that no longer exists (`kill(pid, 0)` fails with `ESRCH`).
- A dir owned by this process belongs to an earlier isolated file on the same worker. Files run one after another per worker, and `--rerun-each` repeats share the global, so they never reach the sweep.
- `EPERM` counts as alive. Dirs of other users are skipped.
- The exit hook stays for standalone fixture scripts, where it does fire.

**Bound.** At most one dir per test process outlives a run. The next harness start in the same `TMPDIR` removes it.

**Not covered.** Dirs in the old naming scheme carry no pid, so the sweep never touches them. See "Operations note".

## Fix 2: four test files on the shared data dir (`d2e1dde`)

These files reached the real DB or storage without importing the test DB harness:
- `app/api/accounts/[accountId]/mcp-tokens/route.test.ts`
- `lib/caldav/emailEventImporter.test.ts`
- `lib/calendarInviteProcessor.test.ts`
- `lib/messageMoveJobs.test.ts`

Each now imports `testDbHarness` first. The trial suggested `testAuthHarness` for the mcp-tokens route test, but `testDbHarness` is enough: the auth lifetime lock is now taken on the temp `main.db`, and the file passes.

**Evidence from the agent.** The agent ran with `NOCTUA_DATA_DIR` unset, once with each file alone and once with all four under `--parallel=4`. Result: 38 pass. The shared-dir listing was identical before and after, and no file there was newer than the marker.

## Fix 3: SMTP sink dirs and `undefined/` (`018452b`)

`lib/testFixtures/verifyOutboundAuthorization.ts` and `lib/testFixtures/verifySenderIdentity.ts` passed `` out: `${process.env.TMPDIR}/…` `` to `startSmtpSink`.
That created a literal `undefined/` dir when `TMPDIR` was unset, and the dirs were never removed.
The option is now dropped. The sink falls back to its default `$NOCTUA_DATA_DIR/fixture-outbox`, which lives inside the fixture's harness dir. The harness exit hook removes it, because these fixtures run as standalone processes; this also holds after a throw.

**Evidence.**
- Both fixtures run standalone (`direct`, `bogus-path`) leave 0 entries.
- The two route tests with `TMPDIR` unset: 9 pass, no `undefined/`, 0 sink dirs.
- The gate runs above: 0 sink dirs.

**Known residual (pre-existing, harmless).** After an error exit, a racing async write can recreate `db/main.db` in the fixture's harness dir. This showed up in 1 of 2 synthetic-failure runs. The next harness start sweeps it.

**Round-9 overlap.** Both fixtures are also changed by `feat/sender-identities-2` `327f6d9`, a round-9 input.
- The Fix-3 delta applied onto `327f6d9` is clean and changes exactly the two `startSmtpSink(...)` lines:
  `git merge-tree --write-tree --merge-base d2e1dde origin/feat/sender-identities-2 018452b`
- A literal `git merge-tree origin/feat/sender-identities-2 018452b` reports a conflict in `lib/db/messages/upsert.ts`. That conflict already exists between `11dc3c5` and `327f6d9` without this branch, because sender-2 is based on team-inbox `9424150`. The round-9 integration resolves it.
- `018452b` is the last commit, so it can be dropped or re-applied on its own if preferred.

## Gate driver

`perf-test-parallel-fixes/run.sh` (copied next to this brief) did the following:
- set a dedicated `TMPDIR` (`/tmp/pfix-gates/tmp`) and used `nice -n 10`;
- ran the three seeds of `test:stress-parallel`, then `test:ci`, one after another;
- counted harness and sink dirs before and after each run;
- polled for fds on the shared data dir.

`summary.txt` and the tails of each log are in the same folder.

## Operations note (not part of the branch)

At 13:15 UTC, `/tmp` (a 12 GB tmpfs) held 190 harness dirs in the old naming scheme, 5.4 GB in total, with 4.8 GB free.
They come from serial and parallel runs on unfixed trees in all worktrees. Their age was 0–9 h, and no process had one as cwd or open fd.
The new sweep does not touch them. Until this branch is merged, every serial `test:ci` on an unfixed tree leaks one more dir of about 200 MB.
Suggested one-off cleanup, only while no `bun test` runs anywhere:

```sh
pgrep -af '[b]un test' || find /tmp -maxdepth 1 -name 'mywebmail-test-db-*' -mmin +60 -exec rm -rf {} +
```

## Recommendation and follow-ups

- **Merge in round 10** with the other deps inputs. From then on, `test:stress-parallel` (N=4, the three seeds) is an extra integration gate next to the serial `test:stress` reference, until two rounds agree.
- **`test:ci`** is unchanged by this branch. Switching its unit half to `--parallel=4` stays the integration owners' decision.
- **Follow-up a:** have `lib/testSetupEnv.ts` point `NOCTUA_DATA_DIR` at a per-process temp dir when it is unset, so a future harness-less test file cannot reach a real data dir.
- **Follow-up b:** the auth lifetime lock fds stay open across isolated files on one worker. This is latent and not hit, because each file has its own dir.
