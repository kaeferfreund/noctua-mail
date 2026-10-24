# Task draft: perf/html-sanitize-single-pass (rerank-r8 rank 9)

Status: DRAFT, approved by the Umbau thread on 2026-10-23. Start only when BOTH are true:
1. The Umbau thread has pushed the round-9 head of `origin/integration/stage` and sent its SHA.
2. The Umbau thread reports that its security re-check on `98b4301` is back.

## Base and isolation
- Worktree `/home/monkey/code/noctua-mail/wt-perf-html-sanitize`, branch `perf/html-sanitize-single-pass` from `origin/integration/stage` @ `e70c30b (round 9, pushed 2026-10-23 ~15:45 UTC)`.
- Own `.env.local` with `NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-html-sanitize`; ports from 3905–3919 that no other task of this thread uses; 3895–3899 belong to the Umbau thread.
- Model: `claude-judith` / `claude-opus-5-5` / `{"effort":"high","fastMode":false}`.
- Agent commits on the branch only; never push, merge, rebase, deploy. Heavy commands under `nice -n 10`; `TMPDIR` inside the worktree.

## Scope, exactly as approved
Source: `briefs/perf-html-sanitize-spike.md` and `briefs/perf-html-sanitize/`.
- Normalize once and feed both policies.
- Cache CSS-filter results per call, keyed by the exact input, scoped to one call.
- Skip the "allowed" pass entirely when the "blocked" pass rewrote no remote URL.
- Allowlist and per-tag rewrite code unchanged. No policy relaxation; remote-content blocking semantics unchanged.
- The shared account-pref resource is NO-GO; do not touch `useRemoteContent.ts` for caching.

## Mandatory proof (Umbau conditions)
- In-repo differential test `lib/html/sanitize.pair.test.ts`:
  - golden SHA-256 hashes from `0ac6cfa` (`golden-0ac6cfa.json`) for the 8 corpus items, raw and after `stripConditionalComments`, and for every payload of the existing sanitize tests, both modes, including whether the "remote content blocked" banner shows;
  - a frozen reference copy of `git show 0ac6cfa:lib/html/sanitize.ts` as a test-only fixture module, e.g. `lib/html/__fixtures__/sanitizeReference0ac6cfa.ts`;
  - the seeded fuzz with seeds 7, 1009 and 424242, old vs new byte for byte.
  - Prefer regenerating the corpus with the deterministic `gen-corpus.ts` inside the test plus checked-in hashes over committing about 1 MB of HTML fixtures; if regeneration is impractical, commit the corpus and say why.
- Browser gate `tests/browser/htmlPrivacy.test.ts` (177 assertions) green:
  `TMPDIR="$PWD/.tmp" PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 bun test --config=bunfig.browser.toml --timeout 120000 ./tests/browser/htmlPrivacy.test.ts`
- `bun run typecheck`, `bun run lint`, `bun run test:ci`, `bun run test:stress`.
- Re-run the spike benchmark (`briefs/perf-html-sanitize/bench.ts`) before/after on the new base and report per-size savings.

## Report
`briefs/perf-html-sanitize.md`: diff stat, test list with counts, benchmark table, browser gate result, merge-tree against the then-current stage head. Review by the Umbau thread.


## Launch overrides (2026-10-23 ~15:55 UTC, orchestrator)
Base `origin/integration/stage` @ `e70c30bf316cde3f3e266806b34687e311c74088` (round 9; gates: typecheck 0 / 1,244 files, test:ci 2,915 + 564 DOM, lint 0 errors / 181 warnings = new baseline, auth browser 20/20). Worktree and branch are already created and installed. Instance claude-judith. PORTS for this task: 3915–3916 only (overrides any port list above; 3895–3899 are released to this thread since round 9; never 3790, 3795–3799, 3905–3914 = other running tasks of this thread). Load discipline: four sibling tasks run heavy gates in parallel on a shared 6-core box — before each `test:stress`, `bun run build` or full `test:ci`, check `uptime`; if the 1-min load is above 12, wait and re-check (do not skip the gate). `nice -n 10` always. Agent commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
