# Spike A harness — mailbox switch end-to-end

The brief is `briefs/perf-mailbox-switch-e2e.md`. All data here is synthetic (`example.test`). No cookies, TOTP seeds, passwords or keys are stored.

## Files

### harness/

| file | purpose |
|---|---|
| `fixture.ts` | 4 synthetic IMAP listeners on 127.0.0.1:3906–3909 (small 50 / medium 2,000 / large 10,000 / folders 1,350 msgs in 50 folders). Reuses `scripts/dev-fixture/{imap-server,store,seed}.ts` unchanged. Options below. |
| `seed.ts` | With the app stopped: 1 admin user with TOTP (Better Auth API, as in `tests/browser/ui/seedQaShell.ts`) + 4 mailboxes with manager membership. Writes credentials to `/tmp/spike-switch-e2e/seed.json` (scratch, never copied). Password from `SPIKE_PASSWORD` or random. |
| `env.sh` | Process-only env: the worktree `.env.local` plus synthetic Better Auth settings (`BETTER_AUTH_URL=http://127.0.0.1:3905`, `PASSKEY_RP_ID=127.0.0.1`, `NOCTUA_MAILBOX_WATCHER=1`). Export a throwaway `BETTER_AUTH_SECRET` first. |
| `start-server.sh` | Starts `.next/standalone/server.js` on 127.0.0.1:3905 under `nice -n 10` and prints its PID. |
| `common.mjs` | Playwright + TOTP sign-in (same API sequence as `tests/browser/ui/qaRound2Session.ts`) and URL redaction. |
| `prime.mjs` | Per-folder full sync of every mailbox; records sync time. |
| `measure.mjs` | The measurement (see the brief, §1); writes `results/<series>.json`. Flags: `--mode cold\|warm`, `--pairs a:b,…`, `--reps`, `--second-tab`. |
| `run-all.sh`, `run-contention.sh` | The series as they were run. |
| `analyze.mjs` → `../analysis.md` | Per-request tables, duplicates, stale requests, long tasks. |
| `segments.mjs` → `../segments.md` | Critical-path segments A–H. |
| `trace.mjs` → `results/trace-summary.json` | Chrome trace; main-thread time by event type. |
| `profile.mjs` + `bychunk.mjs` → `results/cpu-profile-*.json` | V8 CPU-profile samples aggregated by function and by chunk. |
| `uidv.ts` | Read-only: copies the app's cached per-folder UIDVALIDITY so the fixture can restart without a resync. |
| `probe.mjs` | DOM/request probe used to choose the selectors. |

**`fixture.ts` options:**
- `LATENCY_MS=n` delays every command completion by n ms.
- `SPIKE_UIDV=<json>` reuses cached UIDVALIDITY values.
- While `/tmp/spike-switch-e2e/inject.flag` exists, a new INBOX mail is appended to every mailbox every `INJECT_MS` (default 10 s).

### results/

- **Measured series:** `cold`, `warm`, `baseline-r2`, `contention-watcher`, `contention-second-tab`, `imap-latency-50`, `imap-latency-50b`, `baseline-r3-lat0`. Each has a `.json` (every switch: milestones, all requests with timing, bytes and status, long tasks, mutation counts) and a `.log`.
- **Other files:**
  - `series.log` — the `uptime` taken before and after every series.
  - `prime-sync-run{1,2}.json`
  - `trace-summary.json`, `cpu-profile-summary.json`, `cpu-profile-by-chunk.json`
  - `server-run{1,2}-db-write-retry.log` — extract of every SQLITE_BUSY retry block and failed sync worker.

## Reproduce

Ports 3905–3909 only. Run everything under `nice -n 10`. Scratch lives in `/tmp/spike-switch-e2e`, and the scripts expect to sit in `/tmp/spike-switch-e2e/` (fixture, seed, env, start-server) and `/tmp/spike-switch-e2e/h/` (`*.mjs`, `*.sh`). The exact command sequence is in the brief, §10.

**Session note.** The harness signs in once (`ensureSession`) and reuses the storage state across series. That keeps it within the app's three-logins-per-ten-seconds budget.
