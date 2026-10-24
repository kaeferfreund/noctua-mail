# Review: perf/switch-server-list 529a7b8 (one round, combined correctness + security lens)

Read-only review of branch perf/switch-server-list (8 commits on 7425f75; worktree ROOT/repo/wt-switch-server — do not modify it, do not commit). For gates use a scratch copy under ROOT/repo/wt-switch-server/.tmp/review-src (`git archive 529a7b8 | tar -x -C …`, `bun install`). Ports 3990–3999.
Implementer report: ROOT/briefs/switch-ideas/V2-report.md (harness ROOT/briefs/switch-ideas/V2-harness/). Brief: V2-server-list.md.

Focus:
1. Correctness of list results: topic-suggestion enrichment (1aa18a22: early exit without topics, own-address normalization once, score reuse for identical signals) — same suggestions as before incl. own-address exclusion; date group key (62bb2014); skipping date bucket counts only for groupBy=date (df97f6a1) — client behaviour with loaded counts, collapse state, paging, "Alle einklappen"; the rewritten assertion in lib/db/senderIdentityFixes.test.ts (8034d8ed) — is the coverage equivalent? `INDEXED BY` for baseCount (5fce0da5) — index exists in every shard schema version/migration path that can be live (check migrations), deterministic results.
2. Security: Q1 (570954bf) and S8 (529a7b81) — getAccountDb warm check reading only own addresses: confirm no authorization/revocation or account-deletion path relied on the full account row read there; no cross-account data.
3. Merge with current integration/stage a518409 (merge-tree clean expected); run bun check + focused tests (lib/db/messages, topics, threads route, senderIdentityFixes, listModel) on the merged result.

Severity per ROOT/AGENTS.md rule 2 (P0–P3), each with file:line, repro, fix suggestion; P3 list only. Output: ROOT/briefs/switch-ideas/V2-review-r1.md with verdict MERGE / FIX. Rules: ROOT/briefs/_rules-common.md. Do not modify any files except the report and your scratch dir.
