# perf-account-batching spike harness (outside git)

Report: `../perf-account-batching-spike.md`. All data synthetic. Scripts take the checkout as cwd/argument, so the same files measure the legacy tree and the batched tree.

| File | Purpose |
|---|---|
| `sqlcounter.ts` | Driver-level bun:sqlite instrumentation (patches `Database.prototype` before any app import). Counts compiles / cached hits / executions / transactions per handle (master, auth, shard), records each statement's SQL, supports one-shot "after first matching statement" injections. |
| `sqlcount.ts` | Baseline driver: builds a 12-mailbox fixture with real Better Auth MFA sessions and calls the public entry points (route GET handlers, lib exports, real SSE stream). Writes JSON with per-statement histograms. |
| `sqlcount-baseline-0ac6cfa.{json,log}`, `baseline-table.md` | Baseline on 0ac6cfa (9 warm runs, median). |
| `differential/legacyAccountPresentation.ts` | Verbatim legacy copy, destination `tests/differential/`. |
| `differential/accountPresentation.differential.test.ts` | Side-by-side byte-identity suite, destination `tests/differential/`. 52/52 green on 0ac6cfa (legacy vs itself); catches the two probe mutations. |
| `load.ts`, `dbProbe.ts`, `prepare.py`, `run-load.sh`, `summarize.py` | r4 paired load protocol + `/api/auth/me`, summary and SSE readers + role/member/revoke auth writer. |
| `results/base-1/`, `logs/load-base-1.log` | Baseline load sample on 0ac6cfa. |
| `decrypt-micro.ts`, `decrypt-micro.log` | `mapAccountRow` decryption cost (12.8 µs/row). |

## Reproduce

```sh
W=/home/monkey/code/noctua-mail/wt-spike-account-batching   # or the implementation worktree
B=/home/monkey/code/noctua-mail/briefs/perf-account-batching
cd $W && export TMPDIR=$W/.tmp/tmp && mkdir -p $TMPDIR

# SQL counts (≈2 min). SQLCOUNT_ONLY='^me/' narrows; SQLCOUNT_RUNS=9 default.
nice -n 10 bun --tsconfig-override tsconfig.json $B/sqlcount.ts $B/sqlcount-<sha>.json

# Differential suite (copy into the tree under test; legacy file must be re-copied from the round-9 base)
mkdir -p tests/differential && cp $B/differential/*.ts tests/differential/
nice -n 10 bun test --timeout 30000 tests/differential/accountPresentation.differential.test.ts

# Paired load: archive each variant, then alternate samples (base, head, base, head), 60 s each
python3 $B/prepare.py $W base <ROUND9_SHA>
python3 $B/prepare.py $W head <BRANCH_SHA>
$B/run-load.sh $W base base-1; $B/run-load.sh $W head head-1; $B/run-load.sh $W base base-2; $B/run-load.sh $W head head-2
python3 $B/summarize.py $B/results/base-1 $B/results/head-1 ...
rm -rf $W/.tmp/base $W/.tmp/head $W/.tmp/load-* && rm -rf $TMPDIR/*
```

`run-load.sh` waits (30 s polls, max 20 min) for 1-min load < 10 before each sample and logs start/end load. Load samples are only comparable within one paired session.
