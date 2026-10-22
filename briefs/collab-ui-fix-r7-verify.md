# Verification of feat/collab-ui fix round 7 — 1d0f0ce, 2026-10-22

Reviewed detached HEAD `1d0f0cef5de86abe58422f9c98ad6bc7b7327535` (parent `4467be8`) in `/home/monkey/code/noctua-mail/wt-review-collab`. Read AGENTS.md, all 11 acceptance clauses at `app/hooks/useThreadCollab.ts:4-14`, their named permanent tests, the complete hook and publication/consumer paths, the prior r1-r6 reports and all preserved r2-r7 tests, relevant storage/service/REST contracts, and the requested scope diff. Synthetic fixtures only. No tracked file was modified, committed, or deleted; no branch changed, application server/browser started, deployment made, process killed, or other worktree operated on. Commands used `nice -n 10`, including inherited subprocesses. Review-authored scratch stayed under checkout `.tmp`; new/preserved repros set TMPDIR there. The required permanent/stress commands used the repository's default test-fixture temporary-directory handling. No review application listener used a port; the stress suite manages its own fixture transports.

**Verdict: VERIFIED for the written mounted-controller contract. Round-6 findings F1 and F2 are fixed, all 11 rules have direct permanent coverage, all new adversaries pass, and the previously skipped stress gate passes. No remaining in-scope correctness finding. Merge readiness: READY for feat/collab-ui at 1d0f0ce to integrate into integration/stage after the already-landed thread-collab dependency, retaining the server revision/snapshot integration described below.** This is a review of the supplied detached commit, not an integration-merge execution or a claim of cross-instance synchronization.

RESULTS:

- Required UI suite: **316 pass, 0 fail, 1552 assertions, 19 files**; exit 0.
- Required storage/domain/API/revision suite: **47 pass, 0 fail, 418 assertions, 5 files**; exit 0, including 12 permanent real-storage revision proofs.
- Every preserved r2-r7 test file: **17 files executed separately; 136 pass, 10 raw failures, 1123 assertions**. Eight are previously documented invalid historical assertions/fixtures; two are intentionally broader cross-mount probes. None is a newly reproduced failure of this spec. The passing preserved revision-aware/corrected counterparts and the precise exceptions are recorded below.
- Preserved r7 supported-contract rerun: **18 pass, 0 fail, 2 filtered, 139 assertions**. Its four original production-finding cases now pass without assertion changes.
- New r8 DOM adversaries: **18 pass, 0 fail, 173 assertions**.
- Calendar delivered-warning regression: **1 pass, 0 fail, 3 assertions**.
- Stress gate: **seed 1337, rerun-each=3, 5589 pass, 0 fail, 15513 assertions, 220 files, 216.04 seconds**, exit 0; no timeout.
- Requested TypeScript diagnostic count: **151**, matching the supplied baseline. `bun check` exits **1**; this is not a clean typecheck.
- Requested scope: **47 files changed, 3777 insertions(+), 147 deletions(-)**. Round 7 alone changes only `useThreadCollab.ts` and its permanent DOM test: 227 insertions, 31 deletions.

PER ACCEPTANCE RULE — DIRECT NAMED TEST ADEQUACY AND IMPLEMENTATION:

1. **Scope** (`useThreadCollab.ts:4`). **Test adequate: YES. Implementation conforms: YES within one mounted controller.** `R6-scope: session/account/thread isolation` changes all three dimensions, verifies no wrong-key state on navigation, rejects the old-session revision-9 GET after current-session success, and preserves the original session's separate cached entry. Keys contain `(session,account,thread)`, member/denial scopes contain `(session,account)`, and `publish` checks mount, session and denial before both cache and onUpdate publication (`:133-138`). Reload checks session and selected snapshot key. Preserved pending-success/rollback session tests and both unmount settlement variants pass. New `R8-session: pending old members and collab cannot cross session` runs both settlement orders, verifies effect abortion and one authorized publication; new `R8-unmount: pending members cannot cross fresh mount` verifies both settlement orders against an actual new hook instance. Neither old members nor old denial can reach the fresh controller.

2. **Snapshots** (`:5`). **Test adequate: YES. Implementation conforms: YES.** `R7-snapshots: earlier-started GET completes partial success with comments and activity` closes the r6 coverage gap: after partial success and failed refresh it first checks only the written comment and empty activity, then resolves the older-started agreeing GET with a distinct collaborator comment and actual nonempty activity. It verifies the complete state and both lists. The named R5 completion case supplies the other partial-state path. Reload constructs a complete server snapshot; mutation success supplies returned state, reconciles existing server comments plus its optional written comment, retains the current activity list, and marks a higher-revision result partial (`:273-291`). It cannot treat absent mutation lists as a complete replacement. Complete GET state/comments/activity are transactionally consistent on the server (`lib/threadCollab.ts:50`).

3. **Order** (`:6`). **Test adequate: YES. Implementation conforms: YES for eligible authorized snapshots.** `R7-order: revisions beat opposing timestamps and request starts` places lower revision 2 on the later request with later timestamps, then accepts earlier-started revision 3 with backwards timestamps, clearing the obsolete lists. A newly started lower-revision response also loses without another publication. Together with `R6-order: higher revision wins regardless of request start`, it directly covers the full wording. `canAcceptSnapshot` compares revision before complete/start/content checks (`:50-51`); mutation success does the same before merging (`:274-276`). Preserved lower-mutation success, backwards-clock, and failed-write-versus-higher-GET cases pass. Access and membership use their explicit separate channels; membership may update even when a thread's lower-revision snapshot loses, as directly tested by permanent `R7-members: complete GET membership uses start order independently of snapshot revision`.

4. **Equal complete GETs** (`:7`). **Test adequate: YES. Implementation conforms: YES.** Both settlement permutations of `R6-order: latest-started equal-revision GET wins` use different comments/activity/member lists and inspect publication count when the obsolete response resolves last. The three named lifecycle tests use genuine differing complete lists at unchanged revision, including activity without any comments; public/storage lifecycle proofs confirm such responses are legitimate. `completeStart` breaks complete-to-complete revision ties regardless of content (`:54-56`). The same sequence is retained through equal partial/optimistic responses. Preserved lifecycle cases and leave/return controls all pass; no legitimate restored/hidden lists are dropped.

5. **Equal partial success** (`:8`). **Test adequate: YES. Implementation conforms: YES.** The named missing/conflicting-comment variants accept a complete GET while a mutation is pending, deliver the equal-revision partial result, and fail its refresh. They prove complete lists survive, a missing own comment is merged, an existing same-revision comment is not contradicted, an earlier GET remains obsolete across that partial result, and a later complete GET may alter visibility. The equal-revision deletion control also passes. The merge compares individual comment revisions and preserves complete/completeStart on same-revision success (`:277-291`); accepting the result does not reset GET ordering.

6. **Partial completion** (`:9`). **Test adequate: YES. Implementation conforms: YES.** `R6-completion: equal-revision GET cannot contradict its written comment (different)` supplies an actual conflicting body; the additional missing variant omits the written comment. `... cannot contradict partial state` changes status at the same revision. They each preserve the partial result and then admit an agreeing completion. `sameRecord` checks state, and partial-to-complete acceptance requires each comment written at the accepted revision to exist unchanged (`:57-67`). The R7 snapshot case and preserved `R7-order-completion` prove an earlier-started GET can legitimately complete unknown history when it agrees; the contradictory control loses, then a higher revision repairs it.

7. **Rollback** (`:10`). **Test adequate: YES. Implementation conforms: YES.** The named mutation-owning and GET-owning variants start a GET before the write, let it optionally take ownership at equal revision, then fail the write and count rollback publications. An accepted GET prevents rollback even if its request started earlier. Failure checks both owner token and unchanged base server revision before restoring its own previous snapshot (`:300-304`). Preserved HTTP/network variants with differing complete content also pass. New in-flight failure after denial publishes nothing; old-session/unmounted failures cannot update current state. Finalizers clear only their own busy key.

8. **Denial** (`:11`). **Test adequate: YES. Implementation conforms: YES.** The three named `R7-denial: newer successful read restores denial despite an even newer ... read` variants directly reproduce former F1 for pending, HTTP 500 and network outcomes. They check purge/block, immediate successful recovery, nonempty activity/membership, no stale publication, and actual transport unblocking. The fourth named denial/success/later-403 case proves a later denial is applied and needs another successful recovery. Accepted access decisions, rather than arbitrary pending/failed starts, advance the access channel (`:125,201,219-226`). Purge covers every thread cache in that session/account and membership; mutation publication remains guarded. All preserved denial permutations pass. New `R8-access: B recovery survives both older A denial and older A success in that settlement order` verifies the combined cross-thread scenario with denial count, state, members, error and publication assertions. Separate A403/A200 variants pass; an older A success while still denied cannot restore access. `R8-mutation: denial on account rejects all A writes and captured callbacks without optimistic publication` checks update/add/delete, no transport, no pending, no commit, and legitimate write acceptance after a newer recovery. Both new in-flight mutation success/failure variants prove their settlements cannot lift denial or republish purged state; an actual later successful read can restore it.

9. **Members** (`:12`). **Test adequate: YES. Implementation conforms: YES.** The four named cases directly cover both standalone/complete ordering directions and HTTP/network failure preservation, closing F2. Additional permanent named tests cover denied-scope rejection, offscreen-thread account membership, and membership start ordering independent of thread revision. Every source receives a sequence from the same counter (`:175,193`) and publishes through `acceptMembers` (`:143-148,185,230`), which checks mount, session, denial and strictly later accepted membership source before caching/rendering. New tests cover pending members during denial, late pre-denial members after restoration, source ordering around recovery, session changes, unmount/remount, successful growth and removal, and no selected thread. Aborted/failed/denied payloads do not advance membership acceptance. No legitimate membership/access update was dropped in the opposite-direction controls. The exact before-denial ambiguity is resolved below.

10. **Pending** (`:13`). **Test adequate: YES. Implementation conforms: YES within the mounted controller.** The named `R5-pending: overlapping account mutations keep pending on the originating key after navigation` really overlaps distinct keys, settles the other key first, returns to the pending origin and verifies its duplicate never reaches transport. The thread variant, symmetric first-key finalizer, and preserved `R7-pending: A failure finalizer cannot clear B busy/pending or permit duplicate B` pass. Busy/pending are sets of the complete cache key (`:120,253,315-318`), so another account/thread finalizer cannot clear this key. New denied write tests check the early rejection path has no optimistic publication or pending transition. Cross-controller serialization is not supplied by this per-mount cache; see the limitation below.

11. **Limits / repair** (`:14`). **Test adequate: YES. Implementation conforms: YES.** `R6-repair: failed post-commit refresh is repaired by the next successful read` verifies true committed result, retained own comment and no save error after refresh failure, then an admissible equal-revision GET adds earlier collaborator history and actual activity. Refresh failure is caught inside the success path (`:295`) and cannot invoke mutation rollback. Preserved earlier-read completion and partial-add-after-collaborator-edit/deletion cases pass. New recovery/control cases verify that accepted newer members survive subsequent failed reads and a later legitimate complete read may replace them.

FINDINGS AND LIMITATIONS:

- **No new in-scope finding; no severity/file:line/failing-test tuple to report.** Former F1 at the old denial guard is fixed by accepted access decisions (`useThreadCollab.ts:125,201,219-226`); all three original preserved R7 recovery repros pass. Former F2 at the standalone members publication is fixed by the common membership gate (`:143-148,175,185,230`); the original preserved late standalone repro passes.
- **Existing per-controller limitation, not an additional merge blocker under the written Scope clause.** The two preserved `R7-multimount contract:` probes still fail: independent hook mounts can each send a write, and denial in one does not purge the other. `R7-multimount observation` confirms independent snapshots. Storage, denial, membership and busy sets are `useRef` values belonging to the mounted mail client (`:84,99-120`), and production has one hook controller (`app/components/MailClient.tsx:2842`). Do not claim module-wide coordination. The unfiltered failures are preserved, then an explicitly filtered supported-contract rerun passes 18/18; no failed assertion was rewritten to conceal this limitation.
- **Typecheck remains the known 151-error baseline.** This review does not claim type-clean integration. The supplied build/test:ci checks were not rerun as new claims; the required targeted suites and randomized stress were run here.

DENIAL / MEMBERS TIMING INTERPRETATION:

“Started before denial resolves” is not sufficient to decide membership freshness: the specification orders request STARTS and rejects payloads while the scope is denied. The new tests distinguish the cases instead of assuming a response-time cutoff:

- Standalone M starts before denial request D and recovery request S. If M settles while denied, it is rejected; if M settles after S restores, S has already accepted newer membership, so M still loses. Both tests pass with an intentionally larger obsolete M payload, making repopulation visible.
- M starts after D but before S. Settling M after recovery still loses to S's newer membership source. Pass.
- D starts, S starts, M starts, then D resolves 403, S resolves success and restores, then M resolves success. M is later-started than S and the scope is no longer denied, so its membership is accepted. The new `R8-members control: newer standalone source may publish after restoration even if started before denial resolves` passes. Requiring M to be rejected merely because it began before the 403 response would add a response-time epoch rule absent from the written spec and would drop a legitimate later source.
- A newer M that actually settles while denial is active is rejected and cannot lift denial; a subsequent admissible collaboration read restores access/members. Pass. Effect cleanup additionally aborts M on account/session change or unmount; the tests resolve the deferred promise anyway to prove the abort guard is honored.

PRESERVED REPROS AND ADAPTATIONS:

All original artifacts remain untouched. Every original test file in r2-r7, including duplicate suites and known invalid controls, was copied into `.tmp/rN/` and executed separately. Full commands, individual exits, assertion output and failure text are preserved in `briefs/collab-ui-fix-r8-repros/adversarial.log`. The only edit to an old file was path relocation for the r6 migration subprocess: `new URL("../lib/db/schema.ts", import.meta.url)` became `new URL("../../lib/db/schema.ts", import.meta.url)` because its copy now lives in `.tmp/r6/`. No assertion, timestamp, revision, denial or membership expectation was newly adapted. Existing corrected/revision-aware counterparts were also executed as their own original files.

- `collab-ui-fix-r2-repros/collab-extra.dom.test.tsx`: 2 pass; 0 fail; 6 expect() calls; Ran 2 tests across 1 file. [329.00ms]; EXIT: 0.
- `collab-ui-fix-r2-repros/compose-extra.dom.test.tsx`: 3 pass; 1 fail; 18 expect() calls; Ran 4 tests across 1 file. [1343.00ms]; EXIT: 1.
- `collab-ui-fix-r3-repros/collab-adversarial.dom.test.tsx`: 4 pass; 0 fail; 32 expect() calls; Ran 4 tests across 1 file. [501.00ms]; EXIT: 0.
- `collab-ui-fix-r3-repros/collab-extra.dom.test.tsx`: 2 pass; 0 fail; 7 expect() calls; Ran 2 tests across 1 file. [323.00ms]; EXIT: 0.
- `collab-ui-fix-r3-repros/compose-adversarial.dom.test.tsx`: 5 pass; 0 fail; 23 expect() calls; Ran 5 tests across 1 file. [1.50s]; EXIT: 0.
- `collab-ui-fix-r3-repros/compose-extra.dom.test.tsx`: 4 pass; 0 fail; 19 expect() calls; Ran 4 tests across 1 file. [1231.00ms]; EXIT: 0.
- `collab-ui-fix-r4-repros/denial-r4.dom.test.tsx`: 9 pass; 0 fail; 106 expect() calls; Ran 9 tests across 1 file. [712.00ms]; EXIT: 0.
- `collab-ui-fix-r4-repros/mutation-r4.dom.test.tsx`: 9 pass; 1 fail; 87 expect() calls; Ran 10 tests across 1 file. [357.00ms]; EXIT: 1.
- `collab-ui-fix-r5-repros/adversarial-r5.dom.test.tsx`: 13 pass; 6 fail; 129 expect() calls; Ran 19 tests across 1 file. [478.00ms]; EXIT: 1.
- `collab-ui-fix-r5-repros/mutation-r4-corrected-control.dom.test.tsx`: 10 pass; 0 fail; 90 expect() calls; Ran 10 tests across 1 file. [345.00ms]; EXIT: 0.
- `collab-ui-fix-r5-repros/timestamp-contract-r5.test.ts`: 1 pass; 0 fail; 11 expect() calls; Ran 1 test across 1 file. [32.00ms]; EXIT: 0.
- `collab-ui-fix-r6-repros/adversarial-r5-revision-adapted.dom.test.tsx`: 19 pass; 0 fail; 134 expect() calls; Ran 19 tests across 1 file. [465.00ms]; EXIT: 0.
- `collab-ui-fix-r6-repros/adversarial-r6.dom.test.tsx`: 14 pass; 0 fail; 92 expect() calls; Ran 14 tests across 1 file. [404.00ms]; EXIT: 0.
- `collab-ui-fix-r6-repros/mutation-r4-revision-adapted.dom.test.tsx`: 10 pass; 0 fail; 90 expect() calls; Ran 10 tests across 1 file. [359.00ms]; EXIT: 0.
- `collab-ui-fix-r6-repros/revision-r6.test.ts`: 12 pass; 0 fail; 126 expect() calls; Ran 12 tests across 1 file. [5.29s]; EXIT: 0.
- `collab-ui-fix-r6-repros/timestamp-contract-r5.test.ts`: 1 pass; 0 fail; 11 expect() calls; Ran 1 test across 1 file. [31.00ms]; EXIT: 0.
- `collab-ui-fix-r7-repros/adversarial-r7.dom.test.tsx`: 18 pass; 2 fail; 142 expect() calls; Ran 20 tests across 1 file. [522.00ms]; EXIT: 1.

All ten raw failures are accounted for:

- r2 `New: account switch cancels pending source hydration`: the desktop harness forces the modal visible but expects the subject input to disappear. The recorded subject is empty, send targets account B and no private synthetic A body leaks. This invalid visibility assertion was already documented in r2; the preserved r3 corrected mobile/zero-send control passes. No new assertion weakening.
- r4 `R4-race control: successful post-commit GET eventually repairs stale status publication`: explicitly expects the former transient regression to `closed` and `[3,2,3]` publication timestamps. Fixed behavior retains `waiting`, so this bug-expecting assertion correctly fails. Preserved corrected r5 and revision-aware r6 versions pass 10/10 each.
- Six r5 cases use pre-revision fixtures omitting required state/comment revisions: status/add/delete ties, the distinct-millisecond control and two X→Y→X commit variants. They no longer describe actual server responses. The already preserved r6 revision-adapted suite retains their timestamps and race order with valid revisions and passes all 19 cases. Both raw and adapted outputs are retained.
- Two r7 probes demand synchronization across independent hook mounts. They remain outside the mounted-controller contract, as explicitly reported in r6; the limitation is carried forward above. All four actual r7 production-finding repros now pass unchanged, and the supported-scope rerun passes 18/18.

NEW TESTS / OPPOSITE-DIRECTION CONTROLS:

`briefs/collab-ui-fix-r8-repros/adversarial-r8.dom.test.tsx` preserves 18 tests driving the real hook with only deferred transport responses: four denial/member rejection orderings; a legitimate later-member acceptance control; separate and combined thread-B restoration followed by older A403/A200; older A success while still denied; all mutation entry points and captured callbacks during account denial; in-flight success and rollback during denial; both session settlement orders; both unmount/remount settlement orders; member growth/removal with no thread selected; accepted members surviving failures and a later legitimate read repairing them. Assertions cover both visible state and transport/publication/denial/commit counts where applicable. All 18 pass, with 173 assertions. These complement the permanent successful recovery with even newer pending/failed requests and membership source ordering independent of thread revisions, rather than only testing that obsolete data is rejected.

STRESS GATE:

Executed the exact requested gate from the detached checkout under the lowered-priority shell:

```sh
timeout 1800 nice -n 10 bun run test:stress
# bun test --timeout 20000 --randomize --seed=1337 --rerun-each=3
# Bun v1.4.4 (38afee6c8); exit 0

 --seed=1337
 5589 pass
 0 fail
 15513 expect() calls
Ran 5589 tests across 220 files. [216.04s]
```

No failing test or timeout to quote. The full original output is preserved in the combined log, including expected injected `db unavailable` / `lookup failed` errors from tests which pass. This is the repository's default randomized server/non-DOM gate: default bunfig excludes DOM tests. It does not randomize the 316-test DOM suite; that suite separately passed the requested deterministic command. The stress process was launched before scratch repro files were populated, so its 220-file discovery was not contaminated by the historical failing controls.

SCOPE:

`git diff 133bddc..1d0f0ce --stat` confirms the known 47-file set. It matches the r6 filename set; round 7 modifies only the hook and its permanent test. The paths comprise collaboration components/hook and tests, MailClient/message-view/message-list/search/data consumers, composition/detached send-warning handling and tests, the justified calendar delivered-warning hook/test, global styles, `lib/ui/detachedComposeHandoff.ts`, revision schema/storage/service plus tests, and exactly one REST route file: `threads/[threadId]/collab/route.ts`. Comment POST/DELETE acquire revision-bearing returned values without textual route changes against this base. `doc/TEAM-INBOX.md` is absent. This is the known functional scope with the acknowledged server/calendar exceptions, not an assertion that every changed path lies inside components/collab. The calendar regression passes; no new scope exception in r7.

COMMANDS AND RESULTS:

All commands ran from `/home/monkey/code/noctua-mail/wt-review-collab`; full raw outputs and the per-file preserved runner source are in the combined log.

```sh
nice -n 10 bun test --config=bunfig.dom.toml app/hooks app/components/mailclient/composition app/components/collab
# exit 0; 316 pass, 0 fail, 1552 assertions, 19 files, 17.57s.

nice -n 10 bun test --timeout 20000 lib/db/threadCollab.test.ts lib/db/threadCollab.remap.test.ts lib/threadCollab.test.ts lib/threadCollab.api.test.ts lib/threadCollab.revision.test.ts
# exit 0; 47 pass, 0 fail, 418 assertions, 5 files, 6.83s.

nice -n 10 python3 .tmp/run-preserved.py
# Iterates every r2-r7 file in separate Bun processes; sets TMPDIR=$PWD/.tmp.
# DOM: bun test --timeout 20000 --config=bunfig.dom.toml ./.tmp/rN/FILE
# Other: bun test --timeout 20000 ./.tmp/rN/FILE
# 17 files; 136 pass, 10 explained raw failures, 1123 assertions.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --timeout 20000 --config=bunfig.dom.toml ./.tmp/r7/adversarial-r7.dom.test.tsx --test-name-pattern '^(?!R7-multimount contract:)'
# exit 0; 18 pass, 0 fail, 2 filtered, 139 assertions.

# Reproduce new tests after cleanup:
nice -n 10 mkdir -p .tmp
nice -n 10 cp ../briefs/collab-ui-fix-r8-repros/adversarial-r8.dom.test.tsx .tmp/
TMPDIR="$PWD/.tmp" nice -n 10 bun test --timeout 20000 --config=bunfig.dom.toml ./.tmp/adversarial-r8.dom.test.tsx
# exit 0; 18 pass, 0 fail, 173 assertions, 1 file, 460ms.

TMPDIR="$PWD/.tmp" nice -n 10 bun test --config=bunfig.dom.toml app/components/calendar/useEventResponseState.dom.test.tsx
# exit 0; 1 pass, 0 fail, 3 assertions.

timeout 1800 nice -n 10 bun run test:stress
# exit 0; seed 1337; 5589 pass, 0 fail, 15513 assertions, 220 files, 216.04s.

# Exact requested pipeline rerun after scratch removal:
nice -n 10 bash -c 'set -o pipefail; bun check --no-pretty --all 2>&1 | grep "error TS" | grep -v bun:test | wc -l; printf "PIPESTATUS: %s\n" "${PIPESTATUS[*]}"'
# 151 (baseline 151); PIPESTATUS: 1 0 0 0. bun check exits 1.
# Original complete diagnostics captured before scratch test copies are also in the log.

nice -n 10 git diff 133bddc..1d0f0ce --stat
# 47 files changed, 3777 insertions(+), 147 deletions(-).
nice -n 10 git diff 4467be8..1d0f0ce --stat
# 2 files changed, 227 insertions(+), 31 deletions(-).
```

MERGE READINESS AND EXACT INTEGRATION NOTE:

**READY from this review for feat/collab-ui 1d0f0ce to integrate into integration/stage, after the already-present thread-collab dependency.** No merge/push was performed. Preserve the known baseline typecheck limitation and mounted-controller scope; neither is newly introduced here. The round-7 production defects and stress gate no longer block integration.

> feat/collab-ui includes required changes to thread-collaboration-owned files: additive `revision INTEGER NOT NULL DEFAULT 0` columns on shard tables `thread_collab_state` and `thread_comments`, per-(accountId,threadId) mutation/remap counters with retained vacated-key counters, comment revision stamps, concurrency-safe idempotent migration, and consistent GET snapshot plumbing. Existing rows migrate to revision 0. Preserve these schema/storage/service/REST changes and their tests when integrating after thread-collab; the UI requires server state/comment revisions and must land with that contract. Do not discard them as collab-ui ownership conflicts. Revision identifies collaboration writes; message presence can alter complete GET visibility without advancing it, so retain the complete-GET request-start ordering too.
>
> For the `collab/route.ts` GET conflict/resolution, retain the integrated authentication/context wrapper and role-based member filtering, import/use `getThreadCollabSnapshot`, and read `[snapshot, members] = await Promise.all([getThreadCollabSnapshot(ctx.accountId, threadId), listAccountMembers(ctx.accountId)])`. Return `{ ok: true, ...snapshot, members: members.filter(member => ctx.role === "manager" || !member.disabled) }` through the existing JSON/auth response wrapper. Do not restore the old independent state/comments/activity service calls: the single SQLite read transaction is necessary for a revision-consistent complete snapshot. Preserve PATCH behavior and the integrated thread decoding/error/auth plumbing. The members endpoint remains owned by the team-auth integration; its route is not part of this branch's textual diff.

Persistent outputs are exactly this report plus the new DOM test and combined log in `briefs/collab-ui-fix-r8-repros/`. Final tracked/index/HEAD integrity and scratch removal are recorded at the end of that log.
