# Verification of feat/collab-ui fix round 4 (87d1f32..731ddc2) — Codex gpt-6.1-sol, 2026-10-22

Reviewed detached HEAD `731ddc20d375cbc396e81103c57e70fb8c460c50` in `/home/monkey/code/noctua-mail/wt-review-collab`. Read AGENTS.md, the r4 diff and permanent tests, r3 verification and preserved repros, hook/consumers, thread-collaboration routes, service and SQLite storage. Synthetic fixtures only. No tracked files modified, committed or deleted. Scratch used worktree-local `.tmp`, removed after artifact preservation. **R4 verdict: PARTIAL. The nine original mutation/read regressions are fixed, but the ordering policy drops legitimate updates. Merge verdict: NOT READY.**

VERIFIED:
1. **Original stale mutation success/rollback race is fixed.** All nine expected-behavior r4 mutation repros now pass: late status/assignee/comment success preserves a newer accepted GET when refresh fails; HTTP 500 and network rollback cannot overwrite that GET. The permanent suite passes **264 tests, 0 failures, 1143 assertions, 19 files**. Snapshot ownership protects rollback; reconciling against current comments preserves collaborator notes and deduplicates ids. A strictly newer timestamp can supersede GET ownership.
2. **R3 denial protection remains verified.** All nine preserved denial adversaries pass, plus three new checks: older 403 after a newer HTTP-500/network failure still purges and blocks writes, including a late successful mutation; older 403 after an accepted newer success is ignored. Account/session denial isolation and recovery remain covered by the permanent/preserved suites.
3. **Timestamp ties require nuance.** The actual backend uses integer epoch **milliseconds**, not seconds. Two different milliseconds within one second work; this passes `R5-tie control: same-second commits with distinct milliseconds accept the genuinely newer mutation`. Genuine equal-millisecond values are permitted, however. When GET actually observes an edit after an add at the same timestamp, retaining its edited note is correct and passes. A late POST does not resurrect a note already deleted in an equal-time accepted GET. These passing controls do not establish that every equal-time GET is newer than a mutation.
4. **Navigation and same-thread serialization controls pass.** X→Y→X before the response preserves a commit whose timestamp is strictly newer than the return GET. Cross-key completion of the first operation does not clear the second key's pending flag. A status write followed immediately by an assignee write on the same thread produces only one network mutation: `busy.current.has(key)` rejects the second with `false`, completing it before the first. After completion, retrying the assignee succeeds. Thus two server responses in reverse order on one controller's same key cannot be produced through the public API; the test records that guard instead of bypassing it or asserting an invented two-request execution.

REMAINING / NEW FINDINGS:

1. **Medium (P2), r4 regression — a genuinely later mutation is discarded on a server timestamp tie.** `app/hooks/useThreadCollab.ts:229` requires `data.state.updatedAt > next.serverUpdatedAt` after GET takes ownership, even if GET read before the commit. Scenario: load X; start write; start and accept GET showing the pre-commit state; server commits the write with the same millisecond timestamp; deliver its success; post-commit refresh fails. The mutation returns `true`, emits `onCommit`, pending clears, and there is no displayed error, but status stays open instead of closed, a newly added note is missing/count zero, or a deleted note remains/count one. MailClient's unchanged `onUpdate` consumer accepts the publications it receives (`MailClient.tsx:2821-2835`); the legitimate committed snapshot is never published. A successful equal-time post-commit GET repairs the display (passing control); it cannot be assumed to succeed.
   - Tests in `briefs/collab-ui-fix-r5-repros/adversarial-r5.dom.test.tsx:67`: **`R5-tie: later status commit sharing GET timestamp survives failed post-commit refresh`**, the corresponding **`later add`** and **`later delete`** cases; all fail. `:155`: **`R5-navigation: X mutation survives X to Y to X before response (commit delta 0ms)`** also fails; the `1ms` control passes. Four failures, one ordering defect.
   - Parent `87d1f32` passes status/add tie cases; r4 introduces these dropped commits. Parent already fails the deletion's comment-list assertion, although it accepts the committed count; r4 now also rejects its state/count. Do not attribute that entire deletion symptom solely to r4.
   - **Impact:** persistent stale client state and misleading success until a later successful refresh. These tests do not show database data loss. Equal-millisecond commits are legal with the actual backend; this is not dependent on a hypothetical second-granularity server.

2. **Medium (P2), r4 regression — a backwards server clock freezes out legitimate writes and reads.** `canAcceptSnapshot` at `useThreadCollab.ts:22-25`, used by `accept` at `:87` and GET at `:169`, rejects every snapshot whose server timestamp is lower than cached authority. `lib/db/threadCollab.ts:117-125` assigns `state.updatedAt = now` directly; `:179-182` supplies `Date.now()` inside the immediate transaction. There is no `max(previous+1, now)` or revision counter. Writes remain legal after clock regression, while the UI rejects them indefinitely until a timestamp catches up or cache invalidation/remount occurs.
   - **`R5-clock: newer committed mutation and its successful refresh survive a backwards server clock`** (`adversarial-r5.dom.test.tsx:123`) fails: a new note commits at T−1000, POST returns it, and a successful GET also returns it; both are rejected, leaving no visible note although the mutation returns `true` and emits `onCommit`.
   - **`R5-clock: a later authoritative GET after backwards clock movement is accepted`** (`:134`) fails: two consecutive successful GETs with a newer logical state at T−1000 leave the old open/unassigned T state. No failed refresh is needed for either clock test. Both pass against parent `87d1f32`.
   - **Implementer target 1: CONFIRMED.** A wall-clock timestamp is not a monotonic revision. The in-memory SQLite test additionally demonstrates that actual storage preserves distinct status commits, add/edit/delete commits at equal milliseconds, and a later commit with a lower timestamp. No production database was opened for this control.

3. **Medium (P2), pre-existing rejection retained by r4 — owner ordering discards a genuinely fresher GET after rollback.** `useThreadCollab.ts:24` requires owner order and timestamp order together. Load T; start GET; start mutation (higher owner); mutation fails and rollback keeps that higher owner (`:251-252`); GET's query/response observes a collaborator's later state T+10. GET is the latest read, the current thread/session is unchanged, and its timestamp is strictly higher, but its earlier request owner makes it fail `canAcceptSnapshot`. The old state stays; failure schedules no automatic recovery.
   - **`R5-owner: GET started before failed mutation but reading a later server snapshot is not discarded`** (`adversarial-r5.dom.test.tsx:143`) fails, observing open/T instead of waiting/T+10. Parent also fails (its generation guard discards the read), so this is **not newly introduced by r4**. A fresh manually started GET can repair it. Request-start order does not establish snapshot capture/commit order.

4. **Low (P3), pre-existing — `pendingKey` loses an outstanding originating mutation across navigation.** `useThreadCollab.ts:76,209,260-263,281` stores one reactive pending key although `busy` supports several. Start X write; navigate to Y (or another account); start its write; return to X before either responds. X's DOM reports `pending: false` despite its request still running. Complete the other key first: X remains falsely non-pending. Attempting another action on X returns `false` without sending a request because `busy` still tracks it. Collaboration controls use `pending` to disable status/assignee (`ThreadCollaborationBar.tsx:31,38`) and discard the returned promise's boolean, so enabled actions can be ignored while X is still busy.
   - **`R5-pending: overlapping thread mutations keep pending on the originating key after navigation`** and the **`overlapping account`** variant (`adversarial-r5.dom.test.tsx:169`) fail, both recording `pendingWhileFirstInFlight: false` and `pendingAfterSecondFinishes: false`. Two failures; no demonstrated server corruption or bypass of same-key serialization. Parent has the same failures. **Implementer target 2: CONFIRMED**, limited here to pending/UI correctness.

The new DOM suite totals **10 pass, 9 fail, 127 assertions, 19 tests**. All nine failures occur at product-state assertions after successful fixture setup. The timestamp-storage control adds **1 pass, 0 fail, 11 assertions**. These are deterministic controlled fetch orderings, not measurements of race frequency under normal load.

SERVER CONTRACT AND FIX ASSESSMENT:

`collab/route.ts` GET returns state/comments/activity/members through separate service reads; PATCH returns the state provided by `updateThreadCollabState`. POST comments returns `{comment,state}`; DELETE returns `{state}`. None supplies an authoritative revision or changes timestamp resolution. `lib/threadCollab.ts` delegates mutations to the immediate transaction boundary and forwards its stored timestamps. `thread_comments.updatedAt` also receives the same raw `now` for add/edit/delete (`lib/db/threadCollab.ts:132-163`); no distinct version is added. Remapping can change collaboration content while preserving `updatedAt` (`:280-309`), which the hook already handles separately through `refreshVersion` invalidation. That invalidation does not run for every ordinary post-commit callback: MailClient bumps `collabRevision` for counts and filtered-search refreshes.

Ownership-only rollback and current-list comment reconciliation are sound improvements for the reproduced original race. The combined publication rule is **not sound as a general freshness order under the existing server contract**: operation start, server commit/capture, and wall-clock order can disagree. Merely switching ties to favor mutations would reintroduce the opposite stale-response/edited-or-deleted-note errors. A fix needs a real ordered server version or a reconciliation/recovery strategy that preserves both directions, plus an authoritative way to accept refreshes after a clock regression. Keep access-denial handling and originating-key notifications intact. No implementation changes were made in this review.

SCOPE CHECK:

`git diff 133bddc..731ddc2 --stat`: **39 files, 2660 insertions, 108 deletions**. Round 4 itself changes only `app/hooks/useThreadCollab.ts` and its DOM tests. The full branch does **not literally stay inside the supplied path allowlist**. Treating tests as allowed, these **10 production/documentation paths** are outside it:

- `app/components/calendar/useEventResponseState.ts` — RSVP post-SMTP warnings and successful-send handling.
- `app/components/mailclient/message/MessageViewOrchestrator.tsx` — collaboration bar, note draft/composer and activity integration.
- `app/components/mailclient/messagelist/MessageListPane.module.css` — responsive collaboration badge layout.
- `app/components/mailclient/messagelist/MessageRow.module.css` — mobile collaboration badge layout.
- `app/components/mailclient/messagelist/MessageRow.tsx` — collaboration badges.
- `app/components/mailclient/messagelist/MessageTable.tsx` — collaboration badges/layout.
- `app/components/mailclient/messagelist/MessageThreadList.tsx` — collaboration badges/layout.
- `app/components/mailclient/useMessageData.ts` — authoritative revision for collaboration invalidation.
- `app/components/mailclient/useSearchState.ts` — collaboration virtual folders/counts and request cancellation.
- `doc/TEAM-INBOX.md` — status accent wording, indigo→iris.

`app/components/calendar/useEventResponseState.dom.test.tsx` is also outside the named component directories but fits the explicit tests allowance. These diffs relate to collaboration integration or the branch's send-warning work; no server/API/storage changes appear in this base-to-head diff. The scope exception should be acknowledged rather than reported as an exact allowlist pass.

VALIDATION AND REPRODUCTION:

All commands ran from `/home/monkey/code/noctua-mail/wt-review-collab`. Heavy runtime commands used `nice -n 10` and local TMPDIR. No server or browser started; no port used; no process killed; no other worktree touched. No full CI/stress/build claim is made. Raw output (including expected/actual DOM values, publication sequences, parent control, type diagnostics and branch stat) is preserved in `briefs/collab-ui-fix-r5-repros/adversarial.log`.

```sh
mkdir -p .tmp
cp ../briefs/collab-ui-fix-r4-repros/*.dom.test.tsx .tmp/
# These files already import via @/ aliases; no import edits were needed.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml app/hooks app/components/mailclient/composition app/components/collab
# exit 0: 264 pass, 0 fail, 1143 assertions, 19 files.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/denial-r4.dom.test.tsx ./.tmp/mutation-r4.dom.test.tsx
# exit 1: 18 pass, 1 fail, 193 assertions, 2 files.
# Nine original race regressions and nine denial cases PASS.
# The remaining old control explicitly EXPECTS the original bug:
# status closed and publications [3,2,3]. Actual fixed status is waiting.
```

The original preserved files were not changed. In a new scratch copy, only the obsolete control's two assertions were corrected: status `closed`→`waiting`, and publication sequence `slice(-3) [3,2,3]`→`slice(-2) [3,3]`. That corrected test file is preserved under the r5 artifacts. Thus the literal unchanged suite cannot all pass because one assertion requires the bug; this is not a surviving original race.

```sh
# To rerun the final review artifacts:
cp ../briefs/collab-ui-fix-r5-repros/*.test.ts* .tmp/
TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/denial-r4.dom.test.tsx ./.tmp/mutation-r4-corrected-control.dom.test.tsx
# exit 0: 19 pass, 0 fail, 196 assertions, 2 files.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/adversarial-r5.dom.test.tsx
# exit 1: 10 pass, 9 fail, 127 assertions, 1 file.

TMPDIR="$PWD/.tmp" nice -n 10 bun test ./.tmp/timestamp-contract-r5.test.ts
# exit 0: 1 pass, 0 fail, 11 assertions; in-memory SQLite only.

# Parent attribution setup:
git show 87d1f32:app/hooks/useThreadCollab.ts > .tmp/parent-useThreadCollab.ts
python3 - <<'PY'
from pathlib import Path
s = Path('.tmp/adversarial-r5.dom.test.tsx').read_text()
Path('.tmp/parent-adversarial-r5.dom.test.tsx').write_text(s.replace("from '@/app/hooks/useThreadCollab'", "from './parent-useThreadCollab'"))
PY
TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/parent-adversarial-r5.dom.test.tsx --test-name-pattern 'R5-tie:|R5-clock:|R5-owner:|R5-pending:'
# exit 1: 4 pass, 4 fail, 11 filtered, 51 assertions.
# Pass: tie status/add, both clock cases.
# Fail: tie deletion comment list; lower-owner GET; thread/account pending.

TMPDIR="$PWD/.tmp" nice -n 10 bun check --no-pretty --all 2>&1 | tee .tmp/bun-check-final.log | grep "error TS" | grep -v bun:test | wc -l
# 151, unchanged baseline. PIPESTATUS: 1 0 0 0 0; bun check exits 1.

git diff 133bddc..731ddc2 --stat
# 39 files changed, 2660 insertions(+), 108 deletions(-).

git status --porcelain=v1 --untracked-files=all
git diff --exit-code
git diff --cached --exit-code
# No status/diff output; both diff checks exit 0.
```

Persistent outputs are exactly this report and three preserved test files plus `adversarial.log` in `briefs/collab-ui-fix-r5-repros/`. Tracked worktree/index remain clean, HEAD unchanged, and `.tmp` was removed after preservation.

Merge readiness: **NOT READY** for `feat/collab-ui` `731ddc2`, even after `feat/thread-collaboration` lands in the integration branch. Fix the Medium dropped-commit/timestamp-order defects (and address the retained fresher-GET rejection), rerun both-direction races and denial/navigation controls, and acknowledge the scope exceptions. The pending-key UI bug is lower severity and pre-existing, but remains reproducible. The original r3-reported stale mutation success/rollback race itself is verified fixed.
