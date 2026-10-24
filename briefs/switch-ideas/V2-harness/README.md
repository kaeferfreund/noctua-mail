# V2 harness (server list query)

Report: `../V2-report.md`. Synthetic data only (example.test). `fixture.ts` / `sqlcounter.ts` are copies of
`briefs/perf-mailbox-switch/server/`. Scripts were run from `<worktree>/.tmp/harness`; the `*.sh` runners hard-code
`W=<worktree>/.tmp` — adjust `W` (and copy the files to `$W/harness`) before reuse.

- `v2bench.ts`: threads route warm + cold shard, `listThreads`, topic enrichment, top statements (syn-m0 2k, syn-l0 11k).
  `runbench.sh <checkout> <label>` runs it without and with topics; `runpair.sh` alternates base/final twice.
- `v2diff.ts`: 26 views x 3 mailboxes with edge data, normalized responses. `rundiff.sh <checkout> <label> <topics 0|1>`.
  Base and branch must run within the same clock hour (edge dates are anchored to the hour).
- `v2cmp.py a.json b.json`: per-view field diff. `v2headers.ts a.json b.json` (run from a checkout with
  `bun --tsconfig-override tsconfig.json`): client group headers + collapse keys for views whose `groups` differ.
- `v2sql.ts`: equivalence-checked `INDEXED BY` variants for message rows and baseCount, with EXPLAIN plans.
- `results/`: logs of all bench runs, JSON of the first pair, `sqlvariants.json`.

Base checkout: `git archive 7425f75 | tar -x -C <dir> && ln -s <worktree>/node_modules <dir>/node_modules`.
