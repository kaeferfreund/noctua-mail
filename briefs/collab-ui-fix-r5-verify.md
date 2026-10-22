# Verification of feat/collab-ui fix round 5 (731ddc2..0ec7232) — Codex gpt-6.1-sol, 2026-10-22

Reviewed detached HEAD `0ec723280aee2d662f7b6125de41c854bc6e7944` in `/home/monkey/code/noctua-mail/wt-review-collab`, including server revision commit `ef8baf2` and client commit `0ec7232`. Read AGENTS.md, prior verification/repros, schema and storage/service boundaries, all three REST mutation/read contracts, the hook and MailClient consumer, and the calendar RSVP/completeSend path. Synthetic fixtures only. **R5 verdict: PARTIAL. The prior nine failing r5 adversaries now pass, and all three implementer targets pass; a new equal-revision GET rejection remains. Merge verdict: NOT READY.**

No tracked file was modified, committed, or deleted. All runtime/shell work used the designated checkout and `nice -n 10`; scratch and test databases lived under its `.tmp` via TMPDIR. No application server/browser was started, no port was bound, no process was killed, no real mailbox/data was opened, and no other worktree was touched. The only persistent outputs are this report and five test files plus `adversarial.log` under `briefs/collab-ui-fix-r6-repros/`. Scratch was removed after preservation.

VERIFIED:

1. **Monotonic collaboration mutations and consistent reads.** `lib/db/threadCollab.ts:117-125` advances state revision once per accepted mutation, including unchanged status/assignee, repeated edit, and repeated deletion. Add/edit/delete stamp actual comment writes with that resulting revision (`:138,150,161`); an unchanged comment retains its earlier comment revision while state advances. Revision is independent of timestamps and scoped to `(accountId,threadId)`. New tests interleave state/comment/no-op/remap operations at identical and regressing timestamps, check exact increments, and isolate two accounts sharing one SQLite file. In the interleaving, A reaches 7 and B reaches 2 without any counter reset. The permanent storage/domain/REST suites pass **35 tests, 0 failures, 292 assertions**. The new server file plus the preserved unchanged timestamp-storage control pass **13 tests, 0 failures, 137 assertions**.

2. **Implementer target: remap swaps/chains and vacated-id reuse — VERIFIED for the exercised rules.** Tests cover actual message A→B, B→A, A→B followed by fresh A reuse: A advances 1→2→3→4→5 and B 0→1→2→3; the moved comment receives B's revision 3 and the new A comment gets 5. Storage-seam simultaneous swaps/chains snapshot comment identities before moving them, do not cascade, and retain each vacated key counter. Additional live-message swap/chain tests verify the existing §3.2 rule: an old key with remaining live messages retains its metadata. Thus a live swap intentionally moves no collaboration metadata; a live chain moves vacated A into still-live B, retaining B's metadata. These are distinct from the orphan-source storage-seam swaps; no impossible all-vacated live swap is claimed. See `revision-r6.test.ts:60,83,200`.

3. **Implementer target: concurrent legacy migrations — VERIFIED.** `ensureThreadCollabRuntimeSchema` checks both revision columns on its read-only fast path (`lib/db/schema.ts:864`), then re-reads PRAGMA inside an immediate transaction before ALTER (`:902-910`). The new barrier test forces both independent Bun processes/connections to finish their old-schema preflight before either starts migration. Across **four forced races / eight connections**, every process exits 0, both columns exist exactly once, repeat ensure is idempotent, and pre-existing state/comment rows read revision 0. No duplicate-column failure. Contending connections in this test use SQLite busy_timeout=5000; production initialization separately uses withDbWriteRetry. This does not claim an unwrapped zero-timeout call can never receive SQLITE_BUSY. See `R6-migration: independent connections concurrently migrate legacy revision columns exactly once`, `revision-r6.test.ts:119`.

4. **REST revision agreement and consistent SQLite snapshot — VERIFIED for collaboration mutations.** GET now reads state/comments/activity in a single SQLite read transaction (`lib/threadCollab.ts:49-55`). The new authenticated REST test checks PATCH, repeated PATCH, POST, DELETE, repeated DELETE: revisions 1..5, with each response's entire state exactly matching a following GET, and POST comment matching the GET row. The existing API test also passes. The snapshot transaction is internally consistent; its revision does not cover message-presence changes, which causes the finding below.

5. **All preserved r5 behavior repros pass after adapting fixture versions to the new contract.** The actual preserved source was copied and adapted in scratch: initial state revision 1; later mutations 2; collaborator edit/delete GET 3; deletion initial state 2 followed by commit 3; later assignment 3; comments stamped at their write revision. Equal/regressing timestamps and controlled request/response orderings were retained. All **19 r5 DOM cases pass**, including the former nine failures (ties, backwards clocks, lower-request-owner GET, thread/account pending). The ten preserved corrected r4 mutation controls also pass with revision fixtures. Combined result: **29 pass, 0 fail, 224 assertions**. The unchanged timestamp-storage control still demonstrates equal/regressing display timestamps while actual revisions advance. Original r5 artifacts were left untouched.

6. **Implementer target: partial mutation response after collaborator edit/delete and failing refresh — VERIFIED.** `R6-partial: later add preserves collaborator edit and deletion already accepted by GET when refresh fails` starts with two comments at revision 2; accepts revision 4 GET with an edited revision-3 comment and the other comment deleted; then accepts a partial add response at revision 5; post-commit GET returns HTTP 500. Final comments are the collaborator's edit and the new note, with no resurrection, error, or lingering pending flag. Lower-revision success is ignored without error, schedules a refresh, and retains the accepted GET even when that refresh fails. HTTP/network rollback cannot undo a higher-revision GET. See `adversarial-r6.dom.test.ts:68,98`.

7. **Idempotence, completion, denial and navigation — VERIFIED for covered cases.** Same-revision GET after mutation preserves committed state throughout onUpdate; observed publications are `(1,open), (1,optimistic closed), (2,closed), (2,closed)`. Identical accepted GETs still publish duplicate equal states; there is no stale-state flicker. A partial response is completed by an equal-revision GET with unknown earlier comments/activity. Equal complete revision with refreshed members is accepted when state/comments/activity are unchanged. Offscreen success followed by return GET works. Pending remains true for X while an overlapping Y mutation completes. Two new denial spot checks pass: older 403 still purges/blocks after newer failed GET and late mutation success; stale-session 403 cannot clear the current session/members. The adapted prior suite also checks superseded denials and account navigation. New DOM result: **11 pass, 3 fail, 90 assertions**, with all three failures belonging to the single finding below.

8. **Requested permanent UI suite — PASS: 286 tests, 0 failures, 1294 assertions, 19 files.** Calendar-specific delivered-warning test separately passes **1 test, 3 assertions**. Requested TypeScript diagnostic count is **151**, matching the supplied baseline; `bun check` itself exits 1, so this is not a clean typecheck claim.

REMAINING / NEW FINDING:

1. **Medium (P2), introduced by r5 — equal-revision complete GET rejection drops legitimate message-lifecycle updates.** `app/hooks/useThreadCollab.ts:51-52` requires complete snapshots at the same revision to have identical comments/activity; `reload` drops the entire response at `:198` when that comparison fails. However `lib/threadCollab.ts:53-54` conditionally hides comments/activity when `threadHasMessages` is false, while preserving historical state/revision. Message deletion/restoration does not increment the collaboration revision. Consequently, two legitimate complete GETs can have identical state/revision and different visible lists.

   Reproduction: a thread has one retained note/activity at revision R; delete its last message; GET returns historical state R with empty lists; reimport its message; GET returns the same state R with the note/activity restored. A mounted hook that accepted the empty GET rejects the restored GET and keeps the note/activity missing. In the reverse direction it rejects the empty GET and keeps lists that the service intentionally hides. A status-only thread likewise fails to restore activity at the same revision even with no comments. Repeated successful GETs do not repair the latter case. This is a stale display/publication defect, not demonstrated database loss or an authorization bypass.

   - Failing expected-behavior tests at `briefs/collab-ui-fix-r6-repros/adversarial-r6.dom.test.tsx:199`: **`R6-lifecycle: equal-revision complete GET must restore comments and activity when message presence changes`** and the **`must hide`** variant. Logs show one publication throughout, retaining respectively empty or populated lists.
   - Third failure at `:212`: **`R6-lifecycle-activity: equal-revision complete GET must restore activity even without comments`**. Two successful refreshes leave activity empty.
   - Passing real-storage/service proof at `revision-r6.test.ts:185`: **`R6-lifecycle-contract: real snapshots change visible comments/activity at the same revision when messages disappear and reappear`**. Actual service returns lengths `[1,1]→[0,0]→[1,1]` at unchanged revision 1 when the message deleted flag changes.
   - Passing public API proof at `revision-r6.test.ts:231`: **`R6-lifecycle-public: deleteMessageById and reimport change GET visibility without changing revision`**. Uses the real fixture API's `deleteMessageById` and upsert/reimport, not mocked service responses or only direct SQL. It confirms identical state/revision across all three snapshots.
   - Attribution control: all **three lifecycle DOM tests pass** against the preceding hook from **ef8baf2**, with the same revision-bearing fixtures. They fail on **0ec7232**. This is introduced by r5's complete-snapshot equality rule.

   The comment at `lib/threadCollab.ts:48` overstates the version contract: the transaction guarantees a consistent read, but revision currently does not uniquely identify every visible snapshot. The client must distinguish/refresh these legitimate lifecycle changes, or the server must version all changes that affect GET visibility. Simply accepting every conflicting equal-revision snapshot would need the existing opposite-direction race protections reverified. No implementation change was made in this review.

SCOPE AND CALENDAR JUSTIFICATION:

`git diff 133bddc..0ec7232 --stat`: **46 files changed, 3119 insertions(+), 147 deletions(-)**. All production paths fit collaboration UI integration/send-warning delivery, the explicit revision contract extension, or the justified calendar hook. UI integration includes MailClient, message view/list badges and layout, search/data invalidation, composition warning delivery, and `lib/ui/detachedComposeHandoff.ts` (session-scoped detached warning receipts). These related consumers extend beyond the narrow component directories used by the earlier review; this is a functional scope assessment, not a claim that every path is under `components/collab`. The prior unrelated `doc/TEAM-INBOX.md` change is absent from the requested base-to-head diff.

Server exceptions actually changed in the diff are `lib/db/schema.ts`, `lib/db/threadCollab.ts`, `lib/threadCollab.ts`, **one route file** (`threads/[threadId]/collab/route.ts`) and their tests. The three relevant REST contracts were read and tested; POST/DELETE already forward returned objects and have **no textual diff** against 133bddc. Therefore the premise that all three route files changed is not literally accurate; their payloads acquire revision fields through returned state/comment types.

**Calendar justification: ACCEPTED.** `app/api/accounts/[accountId]/calendar/events/[eventId]/respond/route.ts:149` calls completeSend after SMTP accepts the RSVP, passing actor/client identity and thread headers. `lib/mail/completeSend.ts:37` calls recordReplySent before IMAP work and converts attribution errors into delivered-mail warnings. `lib/db/threadCollab.ts:341-342` records reply_sent and touches the collaboration state/revision when a parent thread is found. The respond route returns delivered `ok:true` warnings even if local participation persistence fails (`:212-213`). The hook change correctly consumes those warnings and closes the resend path when SMTP succeeded but event/participation are absent. This is directly related to collaboration send activity and the branch's post-send warning behavior. The calendar DOM regression passes.

VALIDATION AND REPRODUCTION:

All commands below are from `/home/monkey/code/noctua-mail/wt-review-collab`. Full final output, type diagnostics, initial default-timeout run outputs, scope stat and integrity checks are preserved in `briefs/collab-ui-fix-r6-repros/adversarial.log`. Test requests use the existing synthetic auth harness's `http://localhost:3000` origin in memory; no listener or process uses that port. No CI/stress/build or browser verification is claimed. Initial concurrent server runs with Bun's default 5000ms per-test timeout each timed out in one test (new server: 9 pass/1 timeout; permanent server: 34 pass/1 timeout). Sequential reruns using the repository's 20000ms server-test budget passed. An early draft reuse fixture also needed a fresh synthetic Message-ID, because reusing the old Message-ID correctly exercises deduplication/remapping instead of independent thread-id reuse; the preserved fixture uses a distinct identity.

```sh
nice -n 10 mkdir -p .tmp
# Reproduction setup after artifacts have been preserved:
nice -n 10 cp ../briefs/collab-ui-fix-r6-repros/*.test.ts* .tmp/

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml app/hooks app/components/mailclient/composition app/components/collab
# exit 0; 286 pass, 0 fail, 1294 assertions, 19 files.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/adversarial-r5-revision-adapted.dom.test.tsx ./.tmp/mutation-r4-revision-adapted.dom.test.tsx
# exit 0; 29 pass, 0 fail, 224 assertions, 2 files.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/adversarial-r6.dom.test.tsx
# exit 1; 11 pass, 3 fail, 90 assertions, 1 file. All three lifecycle tests fail.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --timeout 20000 ./.tmp/revision-r6.test.ts ./.tmp/timestamp-contract-r5.test.ts
# exit 0; 13 pass, 0 fail, 137 assertions, 2 files.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --timeout 20000 lib/db/threadCollab.test.ts lib/db/threadCollab.remap.test.ts lib/threadCollab.test.ts lib/threadCollab.api.test.ts
# exit 0; 35 pass, 0 fail, 292 assertions, 4 files.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml app/components/calendar/useEventResponseState.dom.test.tsx
# exit 0; 1 pass, 0 fail, 3 assertions.

nice -n 10 sh -c 'git show ef8baf2:app/hooks/useThreadCollab.ts > .tmp/pre-r5-useThreadCollab.ts'
nice -n 10 python3 - <<'PARENT_CONTROL'
from pathlib import Path
s = Path('.tmp/adversarial-r6.dom.test.tsx').read_text()
Path('.tmp/pre-r5-adversarial-r6.dom.test.tsx').write_text(s.replace("from '@/app/hooks/useThreadCollab'", "from './pre-r5-useThreadCollab'"))
PARENT_CONTROL
TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml ./.tmp/pre-r5-adversarial-r6.dom.test.tsx --test-name-pattern R6-lifecycle
# exit 0; 3 pass, 0 fail, 11 filtered, 13 assertions.

TMPDIR="$PWD/.tmp" nice -n 10 bash -c 'set -o pipefail; bun check --no-pretty --all 2>&1 | tee .tmp/bun-check.log | grep "error TS" | grep -v bun:test | wc -l; printf "PIPESTATUS: %s\n" "${PIPESTATUS[*]}"'
# 151; PIPESTATUS: 1 0 0 0 0. bun check exits 1.

nice -n 10 git diff 133bddc..0ec7232 --stat
# 46 files changed, 3119 insertions(+), 147 deletions(-).

nice -n 10 git status --porcelain=v1 --untracked-files=all
nice -n 10 git diff --exit-code
nice -n 10 git diff --cached --exit-code
nice -n 10 git rev-parse HEAD
# No status/diff output; both diff checks exit 0; HEAD 0ec723280aee2d662f7b6125de41c854bc6e7944.
# Scratch .tmp removed after preserving the report/test/log artifacts.
```

Merge readiness: **NOT READY** for `feat/collab-ui` at `0ec7232`, even once `feat/thread-collaboration` is present in the integration branch. Fix the P2 legitimate equal-revision lifecycle GET rejection and rerun the new lifecycle tests together with the passing mutation/denial/navigation tests. Original r4 timestamp/owner/pending problems and the implementer's three named targets are verified fixed within the exercised contract.

Exact integration note to carry:

> feat/collab-ui includes changes to thread-collaboration-owned files: additive `revision INTEGER NOT NULL DEFAULT 0` columns on shard tables `thread_collab_state` and `thread_comments`, per-(accountId,threadId) mutation/remap counters with retained vacated-key counters, comment revision stamps, and consistent GET snapshot plumbing. Existing rows migrate to revision 0. Preserve these schema/storage/service/REST changes and their tests when integrating after feat/thread-collaboration; the UI requires server state/comment revisions and must land with that contract. Do not discard these changes as collab-ui ownership conflicts.
