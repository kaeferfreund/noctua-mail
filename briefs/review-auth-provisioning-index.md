# Review perf/auth-provisioning-index @ 7f082aa (Codex gpt-6.1-sol high, read-only, 2026-10-22 ~23:35 UTC)

Verdict: **MERGE**, no new correctness findings.
- DDL/repair (lib/db/authPolicy.ts:176): 10 malformed definitions (columns, order, unique, partial, collation, DESC, expressions) detected and replaced; other indexes incl. active_email keep SQL + root pages; correct index → no schema_version change; injected CREATE/receipt failures roll back index + ledger together.
- Startup: fresh, reopened and real 435ba5d-created synthetic masters pass; exactly one receipt; repeat startup = no schema changes.
- Concurrency: DDL on the auth connection (busy_timeout 0, no retry); a foreign BEGIN IMMEDIATE makes installAuthControlPlane() fail with SQLITE_BUSY on parent AND head (pre-existing, not new); two-process tests leave complete committed state; production startup keeps its lifetime lock.
- Plans (100 users, 20k completed ops): 26 provisioning statements, 15 improved / 11 unchanged / 0 regressed; probes + accessible-account reader use COVERING INDEX idx_user_provisioning_user_state (userId=?).
- Semantics unchanged; all 11 new tests fail on the parent, 43 existing pass.
- Gates: typecheck 0 (1,091 files); targeted 54/0; test:ci 2,514/0 + DOM 366/0; lint 0 new (1 error + 25 warnings pre-existing).
