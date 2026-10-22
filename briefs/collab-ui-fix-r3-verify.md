# Verification of feat/collab-ui fix round 3 (551aedf..87d1f32) — Codex gpt-6.1-sol, 2026-10-22

Reviewed detached HEAD `87d1f3243613e0659287ba03f5e1b110e0e95681` in `/home/monkey/code/noctua-mail/wt-review-collab`; read repository AGENTS.md, the r3 diff, prior report, predecessor repros, hook, consumers, and API response contracts. Synthetic data only. No tracked files modified, committed, or deleted. Scratch confined to worktree `.tmp`, removed after preserving the requested artifacts. **R3 denial fix: VERIFIED. Branch merge verdict: hold for one reproduced Medium mutation race that predates r3.**

VERIFIED:
1. **Medium — the remaining r2 denial regression: verified root-cause fix.** `app/hooks/useThreadCollab.ts:70` stores successful reads separately for each account/session. `:133` suppresses a 403 only if a newer accepted successful read exists; pending/failed requests do not advance that successful watermark. Denial handling now precedes the latest-started guard at `:147`, so an older authoritative 403 still purges thread/member caches, disables writes, and publishes invalidation. `:157-162` records an accepted success and restores that scope. This addresses latest-started versus latest-successful ordering directly. The permanent tests cover both HTTP 500 and network failure, plus denial while a newer request is pending and subsequent successful recovery. All pass.
2. **C6 / R2-3 behaviours remain fixed.** The predecessor C6 stale denial after newer success, two-newer-successful-reads denial, and latest genuine denial tests pass. The permanent hook suite passes both same-thread reload and different-thread success variants. Genuine denials still clear state/members and block mutation requests; obsolete denials do not invalidate newer successful state.
3. **NEW denial adversaries: 9/9 pass**, preserved in `briefs/collab-ui-fix-r4-repros/denial-r4.dom.test.tsx`:
   - `R4-denial: newer pending DIFFERENT thread success restores the denied account scope` (`:43`): cached thread one, pending read one, newer pending read two, deny one, succeed two. Access/members restore for the account, and the earlier revoked thread cache stays purged.
   - `R4-denial: account B success cannot lift A denial (...)` (`:64`, two orderings): deny A before or after B succeeds, then return to A with its new read pending. B remains usable; A remains denied until its own success.
   - `R4-denial: session change between denial and success rejects old success and retains old-scope denial` (`:83`): s1 denial, pending s1 recovery, switch to s2, old recovery arrives, s2 succeeds, return to s1. Old success cannot populate s2; s2 success cannot lift s1 denial. A new s1 success recovers normally.
   - `R4-denial: a previous session denial arriving after current-session success is ignored` (`:102`). No current-session state cleared or denial callback emitted.
   - `R4-denial: two denials interleaved with accepted success require a second recovery` (`:112`), plus three D1/S2/D3 response-order permutations (`:129`). A second genuine denial is enforced; an earlier success cannot erase a newer denial; a still newer success recovers.
4. **Previous findings 1, 2, 4, 5 remain covered by passing regressions.** All 15 predecessor repros now pass, including the formerly failing failed-refresh/denial case, send ownership, obsolete hydration, and receipt access/owner isolation. The required permanent suites pass 219 tests (18 files). An additional collaboration component suite passes 19 tests, including originating commit/rollback after account navigation, authoritative refresh, equal timestamps, and denial cache purge. The earlier report's mobile layout measurement was read; it was not repeated here. No full application browser/E2E claim is made.

REMAINING (fix round 4):
1. **Medium (P2) — real user-visible mutation/read race; stale success and rollback overwrite a newer successful GET** — `app/hooks/useThreadCollab.ts:212-221` (success, especially `:215` and `:217`) and `:227` (failure rollback); `accept` at `:73-78` checks mount/session/access but has no snapshot freshness/ownership check.
   - **Scenario:** load thread X at server version 1; start a status, assignee, or note mutation; start a newer GET for X; resolve that GET with version 3; then deliver the mutation's older response (version 2), HTTP 500, or network rejection. A delayed mutation response is plausible even if its server commit preceded the GET and a collaborator's newer update. Tests use API-shaped state/comment responses and render the hook's returned state/comments into a DOM `<output>`.
   - **Observed success path:** version 3 is replaced by version 2 and published through `onUpdate`. Status regresses `waiting → closed`; assignee regresses `synthetic-collaborator → synthetic-editor`; a two-note snapshot becomes one note because `previous.comments + data.comment` drops the newer collaborator note. A post-commit GET starts, but if it returns 500 the operation still returns `true`, pending clears, and stale state remains after completion. If the follow-up GET succeeds, the stale state is repaired; the passing control records publications `3 → 2 → 3`, proving the intermediate regression too.
   - **Observed failure path:** HTTP 500 and network rejection call `accept(previous, key)`, replacing accepted version 3 with version 1. Status becomes `open`, assignee becomes null, and notes/count become empty/zero. The mutation returns `false`, pending clears, and no recovery GET is scheduled. A visible error does not restore the newer snapshot.
   - **User impact and severity:** incorrect collaboration controls, counts, and notes remain until another successful refresh. The hook also publishes stale state into MailClient's summary/message caches through `onUpdate` (`MailClient.tsx:2821-2839`), whose handler applies it without a freshness check. This is client state loss/stale display, with potential misleading subsequent actions; these tests do **not** demonstrate database data loss, a server lost update, or an authorization bypass. Medium is appropriate. Success is often repaired by its follow-up read, but rollback has no such automatic recovery. A later unrelated application refresh can repair either case.
   - **Repros:** `briefs/collab-ui-fix-r4-repros/mutation-r4.dom.test.tsx:68`: `R4-race: late status mutation success must preserve newer GET when post-commit refresh fails`; `:81`: `R4-race: late status mutation failure (HTTP 500) must not roll back a newer successful GET`. Equivalent assignee/comment cases and network failures also fail: **9 expected-behavior tests fail** at DOM snapshot equality. `:97`: `R4-race control: successful post-commit GET eventually repairs stale status publication` passes. Raw expected/actual values and publications are in `adversarial.log`.
   - **Attribution:** extracting the parent `551aedf` hook and running the status success/HTTP-500 repros produces the same two failures. This is an existing race confirmed by this review, **not introduced by the r3 denial change**.
   - **Suggested fix:** give per-session/account/thread snapshot publication an ordering/ownership rule that covers GETs, optimistic writes, success responses, and rollback. A rollback should restore `previous` only while that operation still owns the optimistic snapshot, never after a newer authoritative read. Reconcile mutation success against accepted newer state; retain newer comments and deduplicate by id rather than rebuilding from the pre-mutation list. Preserve originating commits after navigation and post-commit notification, and keep the denial protections. A blanket global sequence check should not silently drop legitimate commits in another thread/account. Promote the failing cases with the fix.

No other new finding was reproduced. The r3 denial change itself is verified; the mutation success/rollback paths are one shared freshness defect with multiple symptoms.

Validation and reproducibility:

All commands below ran from `/home/monkey/code/noctua-mail/wt-review-collab`. Runtime commands used `nice -n 10` and worktree-local TMPDIR. No server, browser, or other process was started, killed, or modified. No other worktree was touched. The only persistent writes are this report and the two new test files plus `adversarial.log` under `../briefs/collab-ui-fix-r4-repros/`.

Recreate scratch and copy tests:

```sh
mkdir -p .tmp
cp ../briefs/collab-ui-fix-r3-repros/*.dom.test.tsx .tmp/
cp ../briefs/collab-ui-fix-r4-repros/*.dom.test.tsx .tmp/
```

The predecessor `compose-extra.dom.test.tsx` import already names this checkout's absolute ComposeOrchestrator path; in scratch it was normalized to `@/app/components/mailclient/composition/ComposeOrchestrator`. All other predecessor files were copied unchanged. New tests already use repo aliases. The predecessor's two deliberate synthetic hydration failures log errors while their tests pass.

Exact validation commands (their stdout/stderr was captured into scratch logs and is preserved in `adversarial.log`):

```sh
TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml app/hooks app/components/mailclient/composition
# exit 0: 219 pass, 0 fail; 762 assertions; 18 files.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/compose-extra.dom.test.tsx ./.tmp/collab-extra.dom.test.tsx ./.tmp/compose-adversarial.dom.test.tsx ./.tmp/collab-adversarial.dom.test.tsx
# exit 0: 15 pass, 0 fail; 81 assertions; 4 files.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/denial-r4.dom.test.tsx
# exit 0: 9 pass, 0 fail; 106 assertions; 1 file.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/mutation-r4.dom.test.tsx
# exit 1: 1 pass, 9 fail; 81 assertions; 1 file.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml app/components/collab
# exit 0: 19 pass, 0 fail; 122 assertions; 1 file.

TMPDIR="$PWD/.tmp" nice -n 10 bun check --no-pretty --all 2>&1 | tee .tmp/bun-check.log | grep "error TS" | grep -v bun:test | wc -l
# 151: unchanged baseline. PIPESTATUS: 1 0 0 0 0; bun check exits 1.
```

Parent control setup and exact test command:

```sh
git show 551aedf:app/hooks/useThreadCollab.ts > .tmp/parent-useThreadCollab.ts
python3 - <<'PY'
from pathlib import Path
p = Path('.tmp/mutation-r4.dom.test.tsx')
Path('.tmp/parent-mutation-r4.dom.test.tsx').write_text(p.read_text().replace("from '@/app/hooks/useThreadCollab'", "from './parent-useThreadCollab'"))
PY
TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/parent-mutation-r4.dom.test.tsx --test-name-pattern 'late status mutation (success|failure \(HTTP 500\))'
# exit 1: 0 pass, 2 fail, 8 filtered; 16 assertions.
```

Full CI/stress/build were not run for this read-only verification; required touched suites, predecessor repros, new adversaries, extra collaboration component coverage, and type-count check were run. All failures in the new mutation suite are product-behavior assertions after successful setup and newer GET acceptance. The parent control confirms they are independent of r3. Tracked working tree/index remained clean; `.tmp` was removed after artifact preservation.

Merge readiness: **NOT READY** at `feat/collab-ui` `87d1f32`, even once `feat/thread-collaboration` is in the integration branch, until the Medium mutation freshness/rollback defect is fixed and its nine regression cases pass while retaining the verified denial and navigation behaviours. There is no remaining reproduced blocker in the r3 denial fix itself.
