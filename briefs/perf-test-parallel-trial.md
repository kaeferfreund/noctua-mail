# Trial: `bun test --parallel` for the unit suite

Branch `perf/test-parallel-trial` (worktree `wt-test-parallel`), based on `integration/stage` 11dc3c5. Commit `a614f26` adds two scripts to `package.json` and changes nothing else. `test`, `test:ci`, `test:stress`, the bunfig files and all test files are untouched. Raw logs and the driver script are in `briefs/perf-test-parallel-trial/`.

```json
"test:parallel-probe": "bun test --timeout 20000 --parallel=4",
"test:stress-parallel": "bun test --timeout 20000 --parallel=4 --randomize --rerun-each=3",
```

## Summary and recommendation

**Switch, but only after two fix sets land (no test logic changes, just fixture hygiene).** The gate the integration owners set is met: `test:stress-parallel` passed for seeds 1337, 4242 and 9001, each with 8,412 pass and 0 fail. The three plain probes passed too (2,804 pass, 0 fail each). No test failed in any run, so there are no flakes to classify. The trial did find two problems that don't show up as failing tests but block adoption:

1. **Temp-dir leak under `--isolate`.** Each parallel unit pass leaves 106 `mywebmail-test-db-*` dirs behind (about 370–450 MB). Each stress run leaves 110. The seven runs plus single-file checks left 3.5 GB in `$TMPDIR`. The default `/tmp` here is a 12 GB tmpfs with 5.2 GB free, so about a dozen local parallel runs would fill it.
2. **Four test files write to the shared default data dir.** Under isolation these files run with no `NOCTUA_DATA_DIR`, so they open `/home/monkey/code/noctua-mail/noctua-data/` (that is `cwd/../noctua-data`, the same directory for every worktree). One of them takes the auth lifetime flock on that shared `main.db` and holds it until its worker exits. Serial runs hide this because an earlier file's harness import leaves `NOCTUA_DATA_DIR` set process-wide.

Fix both (details in "Findings and fix ideas"), then re-run `test:stress-parallel` for the three seeds and check for zero leftover dirs and zero fds on `../noctua-data`. After that, switch the unit half of `test:ci` to `--parallel=4`. The DOM suite stays serial; that is a separate decision.

**Speedup (same box, same day):**

| Comparison | Serial | Parallel (`--parallel=4`) | Speedup |
| --- | --- | --- | --- |
| Unit suite, plain | 335.5 s (round-8 figure, not re-measured today) | 138.7 / 142.4 / 150.8 s (median 142.4) | **2.2–2.4×** (median 2.36×) |
| Stress (`--randomize --rerun-each=3`) | 1,220.9 s (seed 1337, measured today) | 340.2 / 350.9 / 433.2 s | **2.8–3.6×** (3.5× at the two runs below load 12) |

**CPU caveat.** `--parallel=4` puts four busy `bun` workers on the box instead of one. Load during the parallel runs peaked at 8.7–18.2. Two other worktrees ran serial `test:ci` alongside the first probes, and the 433 s seed-9001 run overlapped a load spike from other work. The round-8 probe (122.0 s) ran on a quieter box. On the shared 6-core dev box, keep N explicit (4) rather than the default "one worker per core" (Bun sees 12 CPUs here). On a CI runner, set N to that runner's core count only after measuring.

## Bun 1.4.4 `--parallel` semantics

Sources: `bun test --help` and `node_modules/bun-types/docs/test/parallel.mdx`. Observations come from the runs above, a `ps` of the worker command line, and a six-file scratch experiment outside the repo (since deleted).

| Topic | Documented | Observed |
| --- | --- | --- |
| Workers | `--parallel=N` runs N worker processes. The default is the CPU core count. Workers start lazily (`--parallel-delay`, default 5 ms). | Header `4x PARALLEL`. Four `bun test --test-worker` processes run under the coordinator. |
| Isolation | Implies `--isolate`: each file gets a fresh `globalThis` and cleared ESM/CJS registries, and leftover servers, sockets, watchers, timers and subprocesses are closed. `--no-isolate` opts out. | Worker argv contains `--isolate`. Each file sees a fresh `globalThis` **and a fresh `process` object**: properties stuck on `process` don't carry over between files on the same worker. |
| `process.once("exit")` | Not documented. | **Handlers registered by isolated files never fire** (0 of 6 in the experiment). This is why `testDbHarness` leaks. Module-level `afterAll` **does** run per file. |
| Raw fds | Not mentioned. The close list covers servers, sockets, watchers and subprocesses only. | The auth lifetime lock fds (`openSync` + `flock`) stay open across files on a worker: about 10 open lock fds per worker mid-run. |
| Flags forwarded | `--timeout`, `--preload`, `--rerun-each`, `--randomize`/`--seed`, … are forwarded to workers. | Worker argv: `--isolate --timeout=20000 --randomize --seed=1337 --rerun-each=3 --max-concurrency=20 --preload ./lib/testSetupEnv.ts`. |
| bunfig `[test]` | Applies as usual. | `preload` from `bunfig.toml` is forwarded as `--preload`. `pathIgnorePatterns` is applied by the coordinator: 304 files, the same set as serial, and no `*.dom.test.tsx`. `bunfig.dom.toml` is not involved. |
| `--randomize` | Randomizes test order. Nothing specific about parallel. | **File distribution is shuffled per seed too**: seeds 1337 and 4242 start different files, while plain probes start from sorted path chunks. The seed is printed at the end (`--seed=1337`). |
| `--rerun-each` | Forwarded. | **Reruns of a file run in the same global** (2nd run sees the 1st run's `globalThis`, same pid). So stress still catches same-file rerun state, as it does serially. |
| Worker env | `BUN_TEST_WORKER_ID` / `JEST_WORKER_ID` = 1-based index. | Confirmed (1, 2 in the experiment). No repo code uses it yet. |
| `--bail`, crashes | Coordinator applies `--bail` per file. A worker crash fails that file and a replacement worker continues. A fatal signal aborts the run. | Not exercised. No crashes. |

What `--parallel` changes for this suite: cross-file `mock.module` leakage, the main concern in `arch-tech-debt.md` §7, cannot happen within a parallel run, because every file starts with a cleared module registry. The other side is that a parallel `test:stress` no longer detects cross-file leaks that still bite a developer running plain serial `bun test`.

## Results

All runs used `nice -n 10`, `TMPDIR=$PWD/.tmp/parallel/tmp`, and a driver that waited until the 1-minute load was below 10 before each run.

| Run | Seed | Start (UTC) | Load at start (1m) | Max load during | Wall (shell) | Bun-reported | Pass / fail |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `test:parallel-probe` #1 | – | 11:22:13 | 8.53 | 14.24 | 150.8 s | 150.78 s | 2,804 / 0 (304 files) |
| `test:parallel-probe` #2 | – | 11:25:46 | 6.42 | 13.35 | 142.4 s | 142.41 s | 2,804 / 0 |
| `test:parallel-probe` #3 | – | 11:29:09 | 6.48 | 9.65 | 138.7 s | 138.69 s | 2,804 / 0 |
| `test:stress-parallel` | 1337 | 11:31:28 | 8.96 | 11.35 | 340.2 s | 340.18 s | 8,412 / 0 |
| `test:stress-parallel` | 4242 | 11:37:25 | 6.47 | 8.73 | 350.9 s | 350.85 s | 8,412 / 0 |
| `test:stress-parallel` | 9001 | 11:43:16 | 5.58 | 18.16 | 433.2 s | 433.14 s | 8,412 / 0 |
| `test:stress` (serial reference) | 1337 | 11:52:30 | 7.45 | 10.36 | 1,220.9 s | 1,212.25 s | 8,412 / 0 |

Round-8 reference: serial `test:stress` was 8,412 pass in 1,319 s, and the parallel probe was 2,804 pass in 122.0 s.

Failures per seed: **none** (1337: 0, 4242: 0, 9001: 0). No serial reproduction was needed. The `error:` lines in the logs are expected-error output from passing tests (`db unavailable`, `lookup failed`, …), the same as in serial logs.

## Findings and fix ideas

There were no failing tests, so the classes below are about what each class looked like in the evidence.

| Class | Result | Files | Fix idea (not applied) |
| --- | --- | --- | --- |
| Port / socket coupling | None. Listeners in the tests reviewed use `port: 0`. No new listening ports after the runs; every LISTEN socket afterwards belongs to other worktrees (`wt-deploy-stage`, `wt-dev-fixture`, `briefs/reader-focus-regressions-r2`) or other projects. | – | – |
| **Shared fixture directory: default data dir** | Real, but masked serially. Under isolation these files open `cwd/../noctua-data`, which is `/home/monkey/code/noctua-mail/noctua-data` for every worktree. Detected by polling `/proc/<pid>/fd` while running each of the 210 non-harness files alone, and by checking the pid in the lock file. In the serial `test:stress` run, polling every 0.5 s saw 0 fds on that dir. | `app/api/accounts/[accountId]/mcp-tokens/route.test.ts` (opens `main.db` and **acquires the auth lifetime flock** on the shared `main.db.auth.lock`, held for the worker's lifetime); `lib/caldav/emailEventImporter.test.ts` (`main.db`, `accounts/acc-1.db`); `lib/calendarInviteProcessor.test.ts` (`accounts/acc-1.db`, writes `sources/acc-1/msg-*.eml`); `lib/messageMoveJobs.test.ts` (`main.db`) | Make each file import `@/lib/testDbHarness` (route test: `@/lib/testAuthHarness`) before the first real-DB import. Optional hardening: have `lib/testSetupEnv.ts` point `NOCTUA_DATA_DIR` at a per-process temp dir when it is unset, so a missing harness can never reach a real data dir. Risk if left as is: two parallel suites in different worktrees that overlap on the mcp-tokens file contend for one flock and fail with "Auth datastore lifetime lock is held". |
| **Shared fixture directory: temp-dir leak** | Real, and 13× worse in parallel. `lib/testDbHarness.ts` keeps its state on `globalThis` and cleans up in `process.once("exit")`. Isolated files get a new global and never fire that handler, so each harness-using file leaks its mkdtemp dir. Counts are deterministic: **106 per unit pass, 110 per stress run**. Serial `test:stress` left 24 (collab/admission fixture DBs, about 8 per pass). | `lib/testDbHarness.ts` (88 test files import it directly or through `testAuthHarness`) | Under a parallel worker (`BUN_TEST_WORKER_ID` set), register `afterAll(() => rmSync(dataDir, …))` from `bun:test` in the harness. Keep the exit handler for serial, where state is shared across files. Re-check after the fix that no dirs are left. |
| Shared fixture directory: SMTP sink dirs and `undefined/` | Not parallel-specific. `startSmtpSink({ out: \`${process.env.TMPDIR}/…\` })` never removes its dir: 8 `boundary-smtp-*` per unit pass and 2 `sender-smtp-*`, in serial and parallel alike. The `undefined/boundary-smtp-*` artifact from the round-8 probe is **`TMPDIR` unset in the shell, not parallel workers unsetting it**: reproduced serially with `env -u TMPDIR bun test lib/outboundAuthorization.routes.test.ts`, which created 8 dirs in `undefined/`. No worktree artifacts appeared in this trial because `TMPDIR` was set. | `lib/testFixtures/verifyOutboundAuthorization.ts:26`, `lib/testFixtures/verifySenderIdentity.ts:44` | Use `os.tmpdir()` (with mkdtemp) instead of `process.env.TMPDIR`, and remove the dir in the fixture's teardown. |
| mock.module leak across workers | None observed, and structurally excluded: workers are separate processes and every file starts with a cleared module registry. | (the 17 `mock.module` files, e.g. `lib/calendarInviteProcessor.test.ts`, `lib/mail/imap/connectionPool.test.ts`) | – (they still matter for serial `bun test`) |
| Wall-clock sensitivity | None. All runs green at `--timeout 20000`, including at load 18.2. | – | – |
| SQLite locking between workers | None observed. The only SQLite files workers can share are the default-dir ones above (WAL mode); no `SQLITE_BUSY` seen. Latent issue: the auth lock fds stay open across isolated files on one worker, and `flock` locks per open file description, so two files on the same worker that share one data dir would lock each other out. That can't happen today because each file gets a fresh harness dir. | `lib/authLifetimeLock.ts` (registry on `globalThis`, release only on `exit`) | Fixed by the default-data-dir fix. Optionally release the lock in the harness `afterAll` under workers. |
| Genuine order dependence | None across 3 seeds × 3 reruns, which also shuffled file distribution. | – | – |

## Artifacts and leftovers

- Worktree: `git status --porcelain --ignored` after every run shows only `.env.local` (pre-existing, ignored) and `.tmp/`. No new top-level files and no `undefined/`.
- Processes: no `bun test` or worker processes with cwd `wt-test-parallel` remain.
- Ports: none of ours are listening.
- `$TMPDIR` (`.tmp/parallel/tmp`) at the end: 681 `mywebmail-test-db-*`, 128 `boundary-smtp-*`, 16 `sender-smtp-*`, 3.5 GB in total. Evidence is recorded in `perf-test-parallel-trial/tmp-*.txt`, and I then deleted the directory (it was my own scratch).
- `data/noctua-data-test-parallel` (from `.env.local`) was not used. Bun doesn't load `.env.local` under `NODE_ENV=test`, and the dir is still empty.
- `/home/monkey/code/noctua-mail/noctua-data/` (shared by all worktrees) was written by these runs: `db/main.db`, `db/accounts/acc-1.db`, `db/main.db.auth.lock`. Every serial run that hits those four files does the same, and so do other worktrees' runs. I left it untouched. Snapshot before the runs: `perf-test-parallel-trial/noctua-data.before`.

## Exact commands

```sh
cd /home/monkey/code/noctua-mail/wt-test-parallel
export TMPDIR=$PWD/.tmp/parallel/tmp
# driver: waits for 1-min load < 10, logs wall/load/ports/git status per step
.tmp/parallel/driver.sh probe1 probe2 probe3 sp1337        # copy in briefs/perf-test-parallel-trial/driver.sh
.tmp/parallel/driver.sh sp4242 sp9001 serial-stress
# i.e. nice -n 10 bun run test:parallel-probe            (x3)
#      nice -n 10 bun run test:stress-parallel -- --seed=1337|4242|9001
#      nice -n 10 bun run test:stress
# undefined/ reproduction (serial):
(unset TMPDIR; nice -n 10 bun test --timeout 20000 lib/outboundAuthorization.routes.test.ts)
# shared-data-dir sweep: each non-harness test file alone, polling /proc/<pid>/fd for .../noctua-data/
#   and checking the pid in noctua-data/db/main.db.auth.lock (results: default-datadir-sweep.txt)
```

## Caveats

- Load: the box was shared. Wall times are under 1-minute load 5.6–9.0 at start and 8.7–18.2 peak. Seed 9001 (433 s) ran during a spike to 18.2 from other work. The first two probes overlapped two other worktrees' serial `test:ci` (`wt-reader-focus`, `wt-perf-headers`). For about 2 minutes at the start, the serial reference overlapped my single-file sweep (one extra nice'd `bun` process). Treat the speedups as conservative ranges, not exact ratios.
- The plain-unit speedup uses the round-8 serial figure (335.5 s). Serial unit-only was not re-run today; the stress comparison is same-day.
- Shared-dir detection polled fds (20 ms single-file, 500 ms serial run), so a very short open could be missed. The lock-file pid check is exact.
- DOM suite (`bunfig.dom.toml`, 58 files) is out of scope and stays serial.
- `--timings` (duration-balanced chunks) and `--no-isolate` were not tested. `--no-isolate` would bring back cross-file leaks within each worker, so it is not recommended here.
