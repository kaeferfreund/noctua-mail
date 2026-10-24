# Review: perf/account-presentation-batching 84edb89 (auth area — security + correctness, one round)

Read-only review of branch perf/account-presentation-batching at 84edb89 (7 commits on e70c30b; worktree ROOT/wt-perf-account-batching — do not modify it, do not commit). For gates, use a scratch copy under ROOT/wt-perf-account-batching/.tmp (e.g. `git archive 84edb89 | tar -x -C .tmp/review-src`, then `bun install` there) or read-only commands. Ports 3980–3989.
Implementer report: ROOT/briefs/perf-account-batching.md (also -task.md, -spike.md). Claims: /auth/me 86 → 14 statements without write, summary 201 → 85, foreign event 56 → 1, busy retries under auth write load → 0; session UPDATE skip in its own commit db06a72; "Zuletzt aktiv" (last active) now only written every 5 min; lost update with switch-account smaller but not gone.

## Lenses (both, one combined report)
1. Security: membership/role revocation, session revocation, account deletion and MFA state take effect on the next request exactly as before (no cached authorization outliving a revoke); no data of one mailbox/account returned under another; batching does not widen what a user can see (summary/foreign events only for accounts the user is a member of). Check the 4 revocation seams + 5th case in the differential tests are real, and look for a seam they miss.
2. Correctness: /auth/me selection + session write skip (db06a72) vs the switch-account lost update — describe the remaining window concretely and whether it can leave the user on a mailbox they did not choose or lose a switch; 5-min last-active granularity — where is it displayed/used (admin, "Zuletzt aktiv"), any logic depending on fresher values (session expiry, idle timeout, audit)?
Also check merge with current integration/stage a518409 (merge-tree clean expected) and run focused auth tests on the merged result.

Severity per ROOT/AGENTS.md rule 2 (P0–P3), each finding with file:line, repro, fix suggestion. P3 = list only.
Output: ROOT/briefs/perf-account-batching-review-r1.md with verdict MERGE / FIX (P0–P2 list) and a one-paragraph plain statement of the "Zuletzt aktiv 5 min" trade-off for the user. Rules: ROOT/briefs/_rules-common.md. Do not modify any files except the report and your scratch dir.
