# Verification of feat/collab-ui fix round 6 — 4467be8, 2026-10-22

Reviewed detached HEAD `4467be85020e3af3dee72854529f02fd637149b5` (parent `0ec7232`) in `/home/monkey/code/noctua-mail/wt-review-collab`. Read AGENTS.md, all ten acceptance clauses at `app/hooks/useThreadCollab.ts:4-13`, their named permanent tests, the complete hook, consumers, prior r1-r5 reports, every preserved r2-r6 test, revision storage/service/API tests, and the requested scope diff. No tracked file was modified, committed, or deleted. All commands used `nice -n 10`. No listener, browser, deployment, or process termination was needed; no ports used and no other worktree operated on.

**Verdict: PARTIAL. The round-6 equal-revision lifecycle/order fix is verified. The written acceptance specification as a whole is not satisfied: a successful recovery read newer than a denial can be discarded solely because an even newer read is pending or has failed. Merge verdict: NOT READY.** A separate members-response race also drops legitimate membership updates. Both defects reproduce against parent `0ec7232`; neither is newly introduced by round 6.

RESULTS:

- Required UI suite: **303 pass, 0 fail, 1425 assertions, 19 files**.
- Required storage/domain/API/revision suite: **47 pass, 0 fail, 418 assertions, 5 files**, including all **12 real-storage revision proofs**.
- All **16 preserved r2-r6 test files** were executed separately: **118 pass, 8 fail** literally unchanged apart from one subprocess-import relocation. The eight failures are explained below; already preserved corrected/revision-aware equivalents pass. In particular r6 lifecycle/order adversaries now pass **14/14**, and r6 revision-aware r4/r5 regressions pass **10/10 + 19/19**.
- New spec-derived DOM tests: **14 pass, 6 fail, 136 assertions, 20 tests**. Three failures demonstrate the denial defect; one demonstrates the members defect; two probe a cross-mount contract which the current single-controller architecture does not provide. The latter two are reported as an explicit limitation, not additional merge blockers.
- Independent focused rerun of the four production-finding cases: **0 pass, 4 fail, 19 assertions**, with the same results against the parent hook.
- Calendar regression: **1 pass, 0 fail, 3 assertions**.
- Requested TypeScript count: **151**, matching the baseline; `bun check` exits **1**, so this is not a clean typecheck.

PER ACCEPTANCE RULE — NAMED TEST ADEQUACY AND IMPLEMENTATION:

1. **Scope** (`useThreadCollab.ts:4`). **Named test adequate: YES** for actual session/account/thread cache isolation: `R6-scope: session/account/thread isolation` changes each key dimension, checks that old data is initially unavailable, resolves an obsolete session GET at revision 9 after current-session success, and returns to the original session's independent cached entry. **Implementation conforms: YES within a mounted controller.** Cache keys contain all three dimensions; `publish` checks mounted/session/denial, `reload` checks session and current key, and rendering selects keyed entries. New `R7-session: session switch during pending rollback rejects old publications` and the pending-success variant verify old mutation settlements cannot publish, notify, set a current-session error, or clear current scope's pending state; returning to the old session is repaired by its read. Both unmount settlement tests pass. This is a mounted-controller cache, not module-wide state.

2. **Snapshots** (`:5`). **Named test adequate: NO for the entire wording**: `R5-completion: same-revision GET completes a partial mutation response with earlier collaborator notes` genuinely tests omitted earlier comments being completed, but its activity array is empty and it does not independently establish the complete activity-list half of the rule. It is a useful comment-completion test, not proof of every supplied list. **Implementation conforms: YES.** GET installs state/comments/activity as a complete server snapshot. Mutation acceptance uses returned state and optional written comment, reconciles against accepted server comments, preserves activity, and marks higher-revision success partial. It does not consume a mutation response as a replacement complete list. Supplementary permanent `R6-repair` and preserved `R6-completion: equal-revision GET adds unknown earlier comments and activity to partial mutation`, plus new `R7-order-completion`, exercise actual nonempty activity and comments. All pass.

3. **Revision order** (`:6`). **Named test adequate: NO for the full “regardless of timestamps” wording**: `R6-order: higher revision wins regardless of request start` genuinely inverts request start and revision order, and then rejects a lower revision; both fixture timestamps are equal, so it does not itself test an opposing timestamp order. **Implementation conforms: YES for eligible snapshots in the mounted authorized scope.** `canAcceptSnapshot` compares differing revisions before content/start checks; mutation success likewise accepts higher revision and ignores lower revision. Permanent R5 tie/backwards-clock tests, preserved r6 lower-mutation and HTTP/network rollback cases, and new `R7-order` exercise the additional paths and pass. Denial eligibility has the distinct defect below; there is no revision-comparator failure demonstrated.

4. **Equal complete GETs** (`:7`). **Named tests adequate: YES. Implementation conforms: YES.** `R6-order: latest-started equal-revision GET wins (earlier resolves last)` really starts two deferred GETs, accepts the later one with nonempty comments/activity/expanded members, then resolves the earlier one and checks unchanged data and publication count. The other resolution permutation also passes. All three named lifecycle tests exercise real differing lists at equal state/revision, including activity without comments. The storage/service/public-deletion proofs independently establish those are legitimate responses. `completeStart` orders complete snapshots regardless of content, and revision comparison takes precedence. The former r5 three lifecycle failures now pass. New leave/return and different-thread denial-recovery/equal-GET tests also preserve legitimate list/member growth.

5. **Equal partial success** (`:8`). **Named tests adequate: YES. Implementation conforms: YES.** The missing/conflicting-comment cases accept a complete GET while a mutation waits, then deliver partial success with a missing or same-revision conflicting comment and fail its refresh. They verify comments/activity survive, missing own comment is merged, accepted same-revision comment is not contradicted, an earlier GET remains obsolete, and a subsequently started complete GET may change visibility. This directly checks retained complete-start order, rather than only final post-refresh state. The extra equal-revision deletion permanent test checks deletion cannot replace the complete GET lists. Both preserved revision-aware mutation suites also pass.

6. **Partial completion** (`:9`). **Named tests adequate: YES. Implementation conforms: YES.** The named “different” comment case really supplies a conflicting body at the write revision; the additional “missing” case omits that comment. The state case supplies a different status at the same revision. Each retains the partial write and then admits a matching completion. State is compared field-for-field; comments written at the current state revision must exist and agree before an equal-revision GET completes unknown lists. New `R7-order-completion` verifies a GET started BEFORE a higher-revision mutation response may complete that response when it agrees; `R7-completion control` verifies an earlier contradictory GET loses and a higher-revision read repairs it. Both pass. A legitimate message-hidden GET omitting the just-written note remains inadmissible while partial; that follows the explicit spec and is not the earlier complete-to-complete lifecycle bug.

7. **Rollback** (`:10`). **Named tests adequate: YES. Implementation conforms: YES.** The mutation-owning case verifies exactly one rollback publication; the GET-owning case uses an earlier-started same-revision GET to take ownership and verifies no rollback publication. Counting publications distinguishes an illicit rollback even when the GET and base values are equal. Failure requires both owner and base revision still to match. New HTTP/network variants accept a later-started equal-base-revision GET with DIFFERENT state/comments/activity before mutation failure and verify the GET content and publication count survive. Pending clears. Stale-session and unmounted failure paths do not publish. All pass.

8. **Denial** (`:11`). **Named tests adequate: NO. Implementation conforms: NO.** `R3: a denial stays applied while a newer read is pending, then its success restores access` has only one recovery read, which is also the latest started. `R5-denial: older 403 still purges after newer HTTP 500 while mutation is in flight` proves that a failure/mutation cannot lift denial, but does not try a successful read between denial-start and latest-read-start. Those tests miss F1. The rule says a NEWER SUCCESSFUL read restores the session/account; the implementation additionally requires it to be the latest-started read while denied. A pending/failed later request vetoes a real successful recovery. Different-thread restoration in the same account is explicitly supported by the existing R4 test and new R7 combined equal-revision test; another account or session cannot lift the denial.

9. **Pending** (`:12`). **Named test adequate: YES for the mounted controller. Implementation conforms: YES for that supported scope.** `R5-pending: overlapping account mutations keep pending on the originating key after navigation` starts two real writes on different account keys, settles the other key first, returns to the first, verifies pending stays true, and verifies a duplicate cannot reach transport. The thread-key variant and opposite finalizer control also exist. New `R7-pending: A failure finalizer cannot clear B busy/pending or permit duplicate B` verifies the symmetric failure/finalizer race. Busy and pending are sets keyed by the complete scope. There is no global serialization across two independent hook mounts; see the explicit architecture limitation below.

10. **Limits / repair** (`:13`). **Named test adequate: YES. Implementation conforms: YES for admissible recovery in the tested non-denied scope.** `R6-repair: failed post-commit refresh is repaired by the next successful read` verifies true committed mutation result, retained own note, no save error, and a subsequent same-revision GET adding a previously unknown collaborator note and actual activity. The refresh failure is caught inside the committed-success path and cannot invoke mutation rollback. The preserved partial edit/deletion test retains collaborator changes while merging the later own note when refresh fails. New earlier-started completion also passes. This clause's “admissible” qualification does not excuse F1: the denial clause expressly admits successful reads newer than the denial.

FINDINGS:

1. **P2 / Medium — successful denial recovery is vetoed by a later pending or failed request.** `app/hooks/useThreadCollab.ts:198-199`.

   After an initial successful read, start D2 (eventual 403), S3 (eventual successful recovery), and R4 (still pending, HTTP 500, or network failure). Resolve D2: cache/members are purged and writes blocked, correctly. Resolve S3 with a valid complete revision-2 snapshot after optionally failing R4. Expected by the written denial rule: S3 is newer than D2, so it restores access and state. Actual in every variant: `readDenied:true`, state undefined, members empty. R4 has not supplied a contrary denial or a successful newer snapshot, yet its request-start number is enough to suppress S3. Even after R4 fails, S3 is discarded and the hook stays blocked until another latest-started successful read.

   Cause: `scopeLoadSequence` tracks latest REQUEST START, not latest authoritative denial; while `denied` is set, lines 198-199 reject every successful response except that latest-started request. `scopeSuccessfulLoadSequence` cannot help because S3 is discarded before it is recorded. Distinguish the applied denial's sequence from unrelated pending/failed starts while preserving rejection of a success older than a later actual 403. Simply deleting the guard would need the passing D1/S2/D3 denial permutations rechecked.

   Tests preserved in `briefs/collab-ui-fix-r7-repros/adversarial-r7.dom.test.tsx:237`: `R7-denial: newer successful read restores denial despite an even newer pending read`, `... HTTP 500 read`, `... network read`. All three fail. A success-before-older-denial control passes, demonstrating response-order-dependent access restoration despite identical request order. Parent `0ec7232` fails the same three cases, so this is pre-existing and newly exposed by the written acceptance audit. No stale data leak or storage loss is claimed; the defect incorrectly retains the access-denied UI and blocks legitimate writes after access was restored.

2. **P2 / Medium — delayed standalone member request overwrites fresher collaboration-GET membership.** `app/hooks/useThreadCollab.ts:165-167` (unconditionally writes both member stores).

   Mount starts `/members` and `/collab`. Resolve the later `/collab` with two current synthetic members; the hook correctly displays both. Resolve the older `/members` with the earlier one-member list: the hook drops the newer member and the assignee choices lose that valid collaborator. The standalone response only checks abortion; it shares neither accepted read order nor any other ownership with `reload`'s member publication at `:212-213`. No further request automatically repairs it. No authorization bypass is claimed; server writes still validate permissions.

   Test `R7-members: late standalone members GET must not replace newer complete GET membership`, preserved file `:223`, fails after first proving the expanded list was accepted. Parent `0ec7232` fails too. The top spec enumerates state/comments/activity rather than explicitly ordering this separate membership endpoint, so this is an additional legitimate-update finding from method (5), not an invented state/comment revision violation. Existing refreshed-members tests all resolve the standalone endpoint immediately and miss this race.

MULTI-MOUNT AND LIFECYCLE LIMITS:

The premise of a module-level cache is false: `cache`, `membersCache`, `denied`, `busy` and sequences are hook `useRef` values. `useThreadCollab.ts:74` explicitly says cache belongs to the mounted mail client; production has one call at `app/components/MailClient.tsx:2842` and passes its controller to the components. Two independent calls with the same `(session,account,thread)` do not synchronize: the observation test gets revisions `[2,1]`; both can send concurrently (2 writes); a 403 in one leaves denial flags `[true,false]`. The two intentionally broader contract probes fail. Do not claim global scope-key serialization, global denial propagation, or cross-instance consistency. Under the current mounted-controller interpretation these are limitations, not extra blockers in the current UI; if “per scope key” is intended globally, Pending and Denial also fail that expanded requirement and the written spec needs that distinction made explicit.

Both unmount tests pass: late success/failure cannot publish or notify, and a fresh mount starts clean. The success path still performs a post-commit GET after unmount because the reload scheduling condition checks key, not mounted; no cancellation guarantee appears in the acceptance spec, and its response does not publish. Both session-change tests pass. Equal-revision members/activity growth after leaving and returning, earlier equal GET completing a higher partial write, later equal GET taking rollback ownership, and opposite key finalizers pass.

PRESERVED REPROS AND ADAPTATIONS:

All original artifacts remain untouched. Sixteen test files, including duplicates and earlier invalid controls, were copied into `.tmp/r2` through `.tmp/r6` and each executed in a separate Bun process. Full commands, exits, assertion output and every original failure are in the new `adversarial.log`. No historical assertion was newly edited, and no equal-revision expected ordering needed adaptation in this review.

Round 2:

- `collab-extra.dom.test.tsx`: exit 0; 2 pass; 0 fail; 6 expect() calls; Ran 2 tests across 1 file. [322.00ms].
- `compose-extra.dom.test.tsx`: exit 1; 3 pass; 1 fail; 18 expect() calls; Ran 4 tests across 1 file. [1284.00ms].

Round 3:

- `collab-adversarial.dom.test.tsx`: exit 0; 4 pass; 0 fail; 32 expect() calls; Ran 4 tests across 1 file. [504.00ms].
- `collab-extra.dom.test.tsx`: exit 0; 2 pass; 0 fail; 7 expect() calls; Ran 2 tests across 1 file. [324.00ms].
- `compose-adversarial.dom.test.tsx`: exit 0; 5 pass; 0 fail; 23 expect() calls; Ran 5 tests across 1 file. [1.53s].
- `compose-extra.dom.test.tsx`: exit 0; 4 pass; 0 fail; 19 expect() calls; Ran 4 tests across 1 file. [1153.00ms].

Round 4:

- `denial-r4.dom.test.tsx`: exit 0; 9 pass; 0 fail; 106 expect() calls; Ran 9 tests across 1 file. [340.00ms].
- `mutation-r4.dom.test.tsx`: exit 1; 9 pass; 1 fail; 87 expect() calls; Ran 10 tests across 1 file. [337.00ms].

Round 5:

- `adversarial-r5.dom.test.tsx`: exit 1; 13 pass; 6 fail; 129 expect() calls; Ran 19 tests across 1 file. [464.00ms].
- `mutation-r4-corrected-control.dom.test.tsx`: exit 0; 10 pass; 0 fail; 90 expect() calls; Ran 10 tests across 1 file. [350.00ms].
- `timestamp-contract-r5.test.ts`: exit 0; 1 pass; 0 fail; 11 expect() calls; Ran 1 test across 1 file. [29.00ms].

Round 6:

- `adversarial-r5-revision-adapted.dom.test.tsx`: exit 0; 19 pass; 0 fail; 134 expect() calls; Ran 19 tests across 1 file. [453.00ms].
- `adversarial-r6.dom.test.tsx`: exit 0; 14 pass; 0 fail; 92 expect() calls; Ran 14 tests across 1 file. [376.00ms].
- `mutation-r4-revision-adapted.dom.test.tsx`: exit 0; 10 pass; 0 fail; 90 expect() calls; Ran 10 tests across 1 file. [333.00ms].
- `revision-r6.test.ts`: exit 0; 12 pass; 0 fail; 126 expect() calls; Ran 12 tests across 1 file. [4.13s].
- `timestamp-contract-r5.test.ts`: exit 0; 1 pass; 0 fail; 11 expect() calls; Ran 1 test across 1 file. [29.00ms].

The eight raw historical failures are accounted for individually:

- Original r2 `New: account switch cancels pending source hydration` expects the desktop harness to remove a subject input although it forces the modal visible. It observes empty subject, account-B send, and no private-A body. The r2 report already documents why this is an invalid visibility assertion; the preserved r3 mobile/zero-send corrected version passes 4/4. No new weakening or assertion edit was applied.
- Original r4 final control explicitly expects the stale status `closed` and publication sequence `[3,2,3]`. Fixed behavior keeps `waiting`, so it correctly fails that bug-expecting assertion. The already preserved r5 corrected control and r6 revision-aware equivalent pass 10/10. The nine actual original r4 regressions pass even in the literal source.
- Six original r5 cases omit all required server/comment revision fields: three tied status/add/delete commits, the distinct-millisecond control, and the two X→Y→X commit cases. Their old fixtures no longer represent real API responses. The provided r6 revision-adapted file preserves the triggers/timestamps and supplies initial revision 1, later write 2, later collaborator/assignment 3, deletion base 2/write 3, and per-comment write revisions. All 19 pass. Both raw and valid-contract results are retained; the raw failures are not product regressions under the final contract.
- Operational adaptation only: preserved r6 `revision-r6.test.ts` assumes it is copied directly under `.tmp`. Since this review retained `.tmp/r6`, its subprocess schema-import expression was changed from `new URL("../lib/db/schema.ts", import.meta.url)` to `new URL("../../lib/db/schema.ts", import.meta.url)`. No fixture or assertion changed. All 12 real-storage tests pass.

SCOPE AND INTEGRATION:

`git diff 133bddc..4467be8 --stat`: **47 files changed, 3581 insertions(+), 147 deletions(-)**. All paths fit the previously known collaboration UI/send-warning integration, revision contract changes in thread-collaboration-owned files, and the justified calendar hook/tests. Relative to parent `0ec7232`, only four files change: hook, hook tests, new `lib/threadCollab.revision.test.ts`, and the service comment documenting message visibility. The one newly appearing path compared with r5's 46-file stat is the revision proof test; no unrelated production scope was added. `doc/TEAM-INBOX.md` is absent.

The thread-collaboration-owned changes are additive shard revision schema, storage/counter/remap logic, consistent service snapshot, one textually changed collab GET route, and tests. Comment POST/DELETE routes already forward the revision-bearing returned objects; they are not extra textual changes in this base diff. Schema migration rechecks both columns under an immediate transaction; all four barrier-forced concurrent legacy-migration races pass in the 12-test proof file. Existing rows default to revision 0, and vacated thread counters are retained through reuse/remaps. API proofs check mutation responses against following GETs.

The calendar change remains justified by SMTP-accepted RSVP paths calling `completeSend` and recording collaboration `reply_sent` activity. Delivered-warning handling closes the resend path even if local event/participation data is absent. Its dedicated DOM regression passes.

VALIDATION / EXACT COMMANDS:

All commands ran in `/home/monkey/code/noctua-mail/wt-review-collab`. Full output is preserved in `../briefs/collab-ui-fix-r7-repros/adversarial.log`. The initial permanent runs inherited default TMPDIR; their fixture harness cleans it on process exit. Both were repeated with local TMPDIR to enforce the requested scratch location; every preserved/new repro run uses local TMPDIR. No CI/stress/build/browser claim is made for this read-only audit.

```sh
TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml app/hooks app/components/mailclient/composition app/components/collab
# exit 0; 303 pass, 0 fail, 1425 assertions, 19 files.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --timeout 20000 lib/db/threadCollab.test.ts lib/db/threadCollab.remap.test.ts lib/threadCollab.test.ts lib/threadCollab.api.test.ts lib/threadCollab.revision.test.ts
# exit 0; 47 pass, 0 fail, 418 assertions, 5 files.

# Every preserved file was invoked separately with this exact expansion:
# command args and individual exits are listed in adversarial.log.
nice -n 10 bash -c '
for test_file in .tmp/r{2,3,4,5,6}/*test.ts*; do
  if [[ "$test_file" == *.dom.test.tsx ]]; then
    TMPDIR="$PWD/.tmp" bun test --timeout 20000 --config=bunfig.dom.toml "./$test_file"
  else
    TMPDIR="$PWD/.tmp" bun test --timeout 20000 "./$test_file"
  fi
done'
# Actual execution used a nice-inherited Python subprocess runner with these
# same per-file argv/env values. Totals: 118 pass, 8 raw historical failures.

# To reproduce new cases after cleanup:
nice -n 10 mkdir -p .tmp
nice -n 10 cp ../briefs/collab-ui-fix-r7-repros/adversarial-r7.dom.test.tsx .tmp/
TMPDIR="$PWD/.tmp" nice -n 10 bun test --timeout 20000 --config=bunfig.dom.toml ./.tmp/adversarial-r7.dom.test.tsx
# exit 1; 14 pass, 6 fail, 136 assertions, 20 tests.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --timeout 20000 --config=bunfig.dom.toml ./.tmp/adversarial-r7.dom.test.tsx --test-name-pattern "R7-denial:|R7-members:"
# exit 1; 0 pass, 4 fail, 16 filtered, 19 assertions.

# Parent attribution control (scratch only):
nice -n 10 bash -c 'git show 0ec7232:app/hooks/useThreadCollab.ts > .tmp/parent-useThreadCollab.ts'
# Copy the new test in scratch and change only its production-hook import to
# ./parent-useThreadCollab, then:
TMPDIR="$PWD/.tmp" nice -n 10 bun test --timeout 20000 --config=bunfig.dom.toml ./.tmp/parent-adversarial-r7.dom.test.tsx --test-name-pattern "R7-denial:|R7-members:"
# exit 1; 0 pass, 4 fail, 14 filtered (parent copy predates two added passing controls), 19 assertions.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml app/components/calendar/useEventResponseState.dom.test.tsx
# exit 0; 1 pass, 0 fail, 3 assertions.

nice -n 10 bash -c 'set -o pipefail; bun check --no-pretty --all 2>&1 | grep "error TS" | grep -v bun:test | wc -l; printf "PIPESTATUS: %s\n" "${PIPESTATUS[*]}"'
# 151; PIPESTATUS: 1 0 0 0; bun check exits 1.

nice -n 10 git diff 133bddc..4467be8 --stat
# 47 files changed, 3581 insertions(+), 147 deletions(-).

nice -n 10 git status --porcelain=v1 --untracked-files=all
nice -n 10 git diff --exit-code
nice -n 10 git diff --cached --exit-code
nice -n 10 git rev-parse HEAD
# Clean tracked/index state; unchanged 4467be85020e3af3dee72854529f02fd637149b5.
```

Merge readiness: **NOT READY for feat/collab-ui at 4467be8 even once feat/thread-collaboration is in the integration branch.** The r6 complete-GET tie-break fix is verified; repair F1's successful denial recovery and F2's members-response ownership before the final gate. Rerun the new cases with all passing denial permutations and revision/mutation/list lifecycle regressions. Cross-mount guarantees should be explicitly described as per-controller unless broader behavior is actually intended.

Exact integration note to carry:

> feat/collab-ui includes changes to thread-collaboration-owned files: additive `revision INTEGER NOT NULL DEFAULT 0` columns on shard tables `thread_collab_state` and `thread_comments`, per-(accountId,threadId) mutation/remap counters with retained vacated-key counters, comment revision stamps, and consistent GET snapshot plumbing. Existing rows migrate to revision 0. Preserve these schema/storage/service/REST changes and their tests when integrating after feat/thread-collaboration; the UI requires server state/comment revisions and must land with that contract. Do not discard these changes as collab-ui ownership conflicts. Revision identifies collaboration writes; message presence can change complete GET visibility without advancing it, so retain the r6 complete-GET request-start ordering as well.

Persistent review outputs are exactly this report and the new DOM test plus combined log under `briefs/collab-ui-fix-r7-repros/`. Worktree `.tmp` is removed after preservation; final integrity output is appended to that log.
