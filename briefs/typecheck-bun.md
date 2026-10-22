# typecheck-bun-types

## Summary

Continued the existing `chore/typecheck-bun` worktree based on `0beb9a6`. Kept `41643cc` (`chore(types): add @types/bun and a bun check script`) and reviewed/finalized the inherited changes in 33 test files. No production source or protected file was changed. No assertions were removed, no new `as any` or suppression escapes were added, and no compiler strictness/exclusions were weakened. Existing `skipLibCheck: true` predates this work and is unchanged.

The lockfile diff from `0beb9a6` to `41643cc` adds only the root `@types/bun` dependency entry and the `@types/bun@1.4.3` / `bun-types@1.4.3` package records. Existing Node/undici records did not change. Runtime/tool versions: Bun 1.4.4, TypeScript 6.0.3, Next.js 16.2.4.

## Error counts and wall times

Commands are `nice -n 10 bunx tsc --noEmit` and `nice -n 10 bun check`; diagnostic counts count `error TS`. Wall times use Python `time.monotonic()` around the complete command, not Bun's internal checker timer.

| State | tsc errors | tsc wall | bun check errors | bun check wall |
| --- | ---: | ---: | ---: | ---: |
| Before Bun types (historical logs) | 356 | not retained | 356 | not retained |
| `41643cc` before test fixes (inherited measured logs) | 263 | 4.600s | 264 | 0.306s |
| Start of this continuation, with 33 inherited edits | 59 | 4.414s | 60 | 0.295s |
| Final | 59 | 28.076s | 60 | 0.833s |

The measured pre-fix count is 263/264, higher than the approximate 110 in the handoff. The retained logs establish the measured count. The tests resolve 204 diagnostics in each checker. No remaining diagnostic comes from a non-test file. `bun:test` module-resolution errors are eliminated.

Historical evidence: `/tmp/typecheck-before-{tsc,bun}.txt`, `/tmp/typecheck-continuation/committed-{tsc,bun}.{log,time}`. Current initial evidence: `/tmp/typecheck-initial-{tsc,bun}.{log,time}`. Final evidence: `/tmp/typecheck-continuation/verify-{tsc,bun}.{log,time}`.

## Fixes by file

- `app/api/accounts/[accountId]/calendar/conflicts/[eventId]/resolve/route.test.ts`: Type the injected updateRemoteEvent mock with ResolveConflictDeps so captured arguments retain their signature.
- `app/components/HtmlMessage.memo.dom.test.tsx`: Remove the obsolete bun:test import suppression.
- `app/components/LinkifiedText.test.tsx`: Give React element guards the anchor href prop type.
- `app/components/emailFontRegistry.test.ts`: Model the fake DOM independently of real DOM globals and mark partial fetch implementations explicitly.
- `app/components/mailclient/composition/composeContentBuilder.test.ts`: Supply the required inline attachment ID.
- `app/components/mailclient/composition/composeInitState.test.ts`: Use the current Message field names, optional absent values, and supported locale date format in fixtures.
- `app/components/mailclient/composition/resetComposeSession.test.ts`: Type React state setters, widen resettable fields to their actual unions, and coerce the browser timer ID to a number; retain intentional partial Message/Attachment mocks.
- `app/components/mailclient/composition/useComposeHandlers.test.ts`: Supply the required html hash input as undefined.
- `app/components/mailclient/messageListQueryUrl.test.ts`: Use supported latestDateValue/latestReceivedDateValue options and assert that the selected option is serialized.
- `app/components/mailclient/messagelist/listBehavior.test.ts`: Complete row display dates and type callback-mutated assertion values without dropping assertions.
- `app/components/mailclient/messagelist/listModel.test.ts`: Supply threadSize on synthetic tree nodes.
- `app/components/mailclient/syncJobProgress.test.ts`: Reuse a typed base progress fixture with the required account, mailbox, phase, and processed fields.
- `app/components/mailclient/utils/calendarInviteState.test.ts`: Supply the required message thread ID.
- `app/components/mailclient/utils/calendarReminders.test.ts`: Mark the partial fetch replacement with an explicit unknown bridge.
- `app/components/mailclient/utils/reminderNotificationHelpers.test.ts`: Type the callback result as Record<string, number>.
- `app/components/mailclient/utils/threadContentCache.test.ts`: Use undefined for the optional category reason.
- `lib/caldav/client.test.ts`: Type the DAV mock argument from tsdav and refer to the dynamically imported error class via InstanceType.
- `lib/caldav/emailEventImporter.test.ts`: Derive DB mock parameters from the real function signature and remove the any return cast.
- `lib/calendarInviteProcessor.test.ts`: Give nullable/calendar-source mocks their actual result or function types; retain the original reminder no-op.
- `lib/calendarReply.test.ts`: Complete the Account fixture with avatar.
- `lib/crossAccountCopy.test.ts`: Type captured threading inputs, normalize optional flags, and return the upsert result shape.
- `lib/drafts.test.ts`: Allow optional message IDs in the references equality assertion without asserting non-nullness.
- `lib/mail/attachmentFromSource.test.ts`: Represent absent attachment matching metadata as empty strings, preserving CID-only extraction.
- `lib/mail/categorization/classifier.test.ts`: Replace Partial<any> with a typed parsed-mail fixture.
- `lib/mail/imap/connectionPool.test.ts`: Compare client identity to the intentionally partial stub with an unknown assertion subject.
- `lib/mail/imapClientOptions.test.ts`: Mark intentionally incomplete certificate inputs as unknown-to-PeerCertificate mocks.
- `lib/mail/mime/removeAttachmentPart.test.ts`: Type attachment filename callbacks despite the existing ambient mailparser any result.
- `lib/mail/removeMessageAttachment.test.ts`: Use the source Buffer backing type, normalize optional flags, return saved byte length, and widen attachment equality typing.
- `lib/messageMoveJobs.test.ts`: Type the IMAP move mock from the production function signature.
- `lib/senderIcons.test.ts`: Mark the partial fetch replacements with explicit unknown bridges.
- `lib/syncMoveReconciliation.test.ts`: Type the stored-message mock from DB and include flags in mailbox-copy fixtures.
- `lib/ui/detachedComposeHandoff.test.ts`: Validate handoff/event fixtures with satisfies to retain discriminated literal types.
- `scripts/dev-fixture/fixture.test.ts`: Compare saved and captured sources with a common Buffer assertion type.

Fixtures that previously used unsupported field names/options now follow the production contracts. Optional missing text/HTML fields use undefined, CID-only matching uses empty metadata strings, and the query test still verifies serialization with a supported date-source value. Equality assertions retain their runtime values and expectations. Partial DOM, fetch, certificate, and identity mocks are intentionally scoped to the tested behavior.

## Protected files and ownership

Recomputed the protected list from read-only `git -C /home/monkey/code/noctua-mail/repo diff --name-only $(git ... merge-base team-inbox BRANCH) BRANCH` for `feat/team-auth`, `feat/mailbox-watcher`, and `feat/thread-collaboration`, plus `git -C /home/monkey/code/noctua-mail/wt-compact-toolbar status --short`. Snapshot: `/tmp/typecheck-protected.txt`; ownership detail: `/tmp/typecheck-ownership.json`.

Files reverted because protected: **none**. None of the 33 inherited modified files intersects the refreshed list. The two remaining obsolete import suppressions are protected and therefore intentionally unchanged.

Several files appear in both team-auth and thread-collaboration diffs. The full diagnostic list below assigns those shared files once to team-auth and explicitly records shared ownership; the thread-collaboration section lists its exclusive files. This avoids double-counting without implying exclusive ownership.

## Remaining agreed baseline

The final standalone checks report **59 tsc errors / 60 bun check errors in 7 protected test files**, with zero non-test diagnostics. These remain the baseline for the owning branches; this branch does not suppress or exclude them.

| Owning branch (shared files assigned once) | tsc | bun check |
| --- | ---: | ---: |
| team-auth (also protected by thread-collaboration) | 55 | 56 |
| mailbox-watcher | 2 | 2 |
| thread-collaboration (exclusive files) | 2 | 2 |
| compact-list-toolbar | 0 | 0 |

Checker difference: at `messages/flags/bulk/route.test.ts:485`, tsc emits one TS2769 at column 19; Bun emits two TS2769 diagnostics at columns 28 and 42 for the same array assertion. All other locations/codes match. The union below includes every diagnostic from both tools, marking this difference explicitly.

### team-auth

All four files in this section also appear in the thread-collaboration protected diff.

```text
app/api/accounts/[accountId]/folders/[folderId]/consistency/route.pendingMoves.test.ts:103:5 TS2322 [both] Type 'number' is not assignable to type 'null'.
app/api/accounts/[accountId]/folders/[folderId]/consistency/route.pendingMoves.test.ts:104:5 TS2322 [both] Type 'string' is not assignable to type 'null'.
app/api/accounts/[accountId]/folders/[folderId]/consistency/route.pendingMoves.test.ts:105:5 TS2322 [both] Type 'string' is not assignable to type 'null'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:260:14 TS2493 [both] Tuple type '[]' of length '0' has no element at index '1'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:260:27 TS2493 [both] Tuple type '[]' of length '0' has no element at index '2'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:260:33 TS2493 [both] Tuple type '[]' of length '0' has no element at index '3'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:261:23 TS2769 [both] No overload matches this call. Argument of type '"\\Seen"' is not assignable to parameter of type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:262:25 TS2769 [both] No overload matches this call. Argument of type 'true' is not assignable to parameter of type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:263:33 TS2769 [both] No overload matches this call. Argument of type '{ mailboxPath: string; uid: number; }[]' is not assignable to parameter of type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:287:14 TS2493 [both] Tuple type '[]' of length '0' has no element at index '1'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:288:13 TS2352 [both] Conversion of type 'undefined' to type '{ uid: number; }[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:289:13 TS2352 [both] Conversion of type 'undefined' to type '{ mailboxPath: string; }[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:366:21 TS2493 [both] Tuple type '[]' of length '0' has no element at index '1'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:367:18 TS2493 [both] Tuple type '[]' of length '0' has no element at index '2'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:368:20 TS2493 [both] Tuple type '[]' of length '0' has no element at index '3'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:370:42 TS2352 [both] Conversion of type 'undefined' to type '{ mailboxPath: string; }[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:371:44 TS2352 [both] Conversion of type 'undefined' to type '{ mailboxPath: string; }[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:372:34 TS2769 [both] No overload matches this call. Argument of type '"\\Seen"' is not assignable to parameter of type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:373:36 TS2769 [both] No overload matches this call. Argument of type 'true' is not assignable to parameter of type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:374:13 TS2352 [both] Conversion of type 'undefined' to type '{ uid: number; }[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:375:13 TS2352 [both] Conversion of type 'undefined' to type '{ uid: number; }[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:394:78 TS2493 [both] Tuple type '[]' of length '0' has no element at index '1'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:395:42 TS2769 [both] No overload matches this call. Argument of type 'string[]' is not assignable to parameter of type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:396:42 TS2769 [both] No overload matches this call. Argument of type 'string[]' is not assignable to parameter of type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:422:50 TS2493 [both] Tuple type '[]' of length '0' has no element at index '1'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:422:62 TS2769 [both] No overload matches this call. Argument of type '{ id: string; flags: string[]; }[]' is not assignable to parameter of type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:426:54 TS2493 [both] Tuple type '[]' of length '0' has no element at index '1'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:426:66 TS2769 [both] No overload matches this call. Argument of type 'string[]' is not assignable to parameter of type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:484:63 TS2493 [both] Tuple type '[]' of length '0' has no element at index '2'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:485:19 TS2769 [tsc only] No overload matches this call. Type 'string' is not assignable to type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:485:28 TS2769 [bun check only] No overload matches this call. Type 'string' is not assignable to type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:485:42 TS2769 [bun check only] No overload matches this call. Type 'string' is not assignable to type 'undefined'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:487:50 TS2493 [both] Tuple type '[]' of length '0' has no element at index '1'.
app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts:487:62 TS2769 [both] No overload matches this call. Argument of type '{ id: string; flags: string[]; }[]' is not assignable to parameter of type 'undefined'.
app/api/accounts/[accountId]/sync/new-candidates/route.test.ts:84:51 TS2322 [both] Type '{ folderId: string; mailboxPath: string; uidNext: number; skip: boolean; reason: string; }' is not assignable to type 'NewSyncFolderDecision'.
app/api/mcp/route.test.ts:811:12 TS2493 [both] Tuple type '[]' of length '0' has no element at index '0'.
app/api/mcp/route.test.ts:811:25 TS2493 [both] Tuple type '[]' of length '0' has no element at index '1'.
app/api/mcp/route.test.ts:811:38 TS2493 [both] Tuple type '[]' of length '0' has no element at index '2'.
app/api/mcp/route.test.ts:811:47 TS2493 [both] Tuple type '[]' of length '0' has no element at index '3'.
app/api/mcp/route.test.ts:811:57 TS2493 [both] Tuple type '[]' of length '0' has no element at index '4'.
app/api/mcp/route.test.ts:811:68 TS2493 [both] Tuple type '[]' of length '0' has no element at index '5'.
app/api/mcp/route.test.ts:814:30 TS2769 [both] No overload matches this call. Argument of type '"INBOX"' is not assignable to parameter of type 'undefined'.
app/api/mcp/route.test.ts:815:26 TS2769 [both] No overload matches this call. Argument of type '101' is not assignable to parameter of type 'undefined'.
app/api/mcp/route.test.ts:816:27 TS2769 [both] No overload matches this call. Argument of type '"\\Flagged"' is not assignable to parameter of type 'undefined'.
app/api/mcp/route.test.ts:817:28 TS2769 [both] No overload matches this call. Argument of type 'true' is not assignable to parameter of type 'undefined'.
app/api/mcp/route.test.ts:818:31 TS2769 [both] No overload matches this call. Argument of type 'string' is not assignable to parameter of type 'undefined'.
app/api/mcp/route.test.ts:840:12 TS2493 [both] Tuple type '[]' of length '0' has no element at index '0'.
app/api/mcp/route.test.ts:840:27 TS2493 [both] Tuple type '[]' of length '0' has no element at index '1'.
app/api/mcp/route.test.ts:840:42 TS2493 [both] Tuple type '[]' of length '0' has no element at index '2'.
app/api/mcp/route.test.ts:840:53 TS2493 [both] Tuple type '[]' of length '0' has no element at index '3'.
app/api/mcp/route.test.ts:840:65 TS2493 [both] Tuple type '[]' of length '0' has no element at index '4'.
app/api/mcp/route.test.ts:840:78 TS2493 [both] Tuple type '[]' of length '0' has no element at index '5'.
app/api/mcp/route.test.ts:843:32 TS2769 [both] No overload matches this call. Argument of type '"INBOX"' is not assignable to parameter of type 'undefined'.
app/api/mcp/route.test.ts:844:28 TS2769 [both] No overload matches this call. Argument of type '101' is not assignable to parameter of type 'undefined'.
app/api/mcp/route.test.ts:845:29 TS2769 [both] No overload matches this call. Argument of type '"\\Flagged"' is not assignable to parameter of type 'undefined'.
app/api/mcp/route.test.ts:846:30 TS2769 [both] No overload matches this call. Argument of type 'false' is not assignable to parameter of type 'undefined'.
app/api/mcp/route.test.ts:847:33 TS2769 [both] No overload matches this call. Argument of type 'string' is not assignable to parameter of type 'undefined'.
```

### mailbox-watcher

```text
lib/syncJobs.test.ts:30:3 TS2322 [both] Type '(args: string[]) => { pid: number; stdout: null; stderr: null; exited: Promise<number>; kill: () => void; }' is not assignable to type '{ <const In extends SpawnOptions.Writable = "ignore", const Out extends SpawnOptions.Readable = "pipe", const Err extends SpawnOptions.Readable = "inherit">(options: SpawnOptions<In, Out, Err> & { cmd: string[]; }): Subprocess<...>; <const In extends SpawnOptions.Writable = "ignore", const Out extends SpawnOptions.R...'.
lib/syncJobs.test.ts:85:3 TS2322 [both] Type 'unknown' is not assignable to type '{ <const In extends SpawnOptions.Writable = "ignore", const Out extends SpawnOptions.Readable = "pipe", const Err extends SpawnOptions.Readable = "inherit">(options: SpawnOptions<In, Out, Err> & { cmd: string[]; }): Subprocess<...>; <const In extends SpawnOptions.Writable = "ignore", const Out extends SpawnOptions.R...'.
```

### thread-collaboration

```text
app/api/accounts/[accountId]/messages/[messageId]/attachments/[attachmentId]/route.test.ts:1:1 TS2578 [both] Unused '@ts-expect-error' directive.
app/api/accounts/[accountId]/threads/route.test.ts:1:1 TS2578 [both] Unused '@ts-expect-error' directive.
```

### compact-list-toolbar

No remaining diagnostics.


## Verification

Every long command below used `nice -n 10`. Commands ran in `/home/monkey/code/noctua-mail/wt-typecheck`, with `NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-typecheck` explicitly set by the timing wrapper. Tests also use their existing temporary DB harnesses. No dev server was started.

| Exact command | Result | Wall time |
| --- | --- | ---: |
| `nice -n 10 bunx tsc --noEmit` | exit 2; 59 baseline errors, 7 protected test files, zero production-file errors | 28.076s |
| `nice -n 10 bun check` | exit 1; 60 baseline errors, 7 protected test files, zero production-file errors | 0.833s |
| `nice -n 10 bun run test:ci` | exit 0; 1705 unit tests / 198 files, 4259 assertions; 53 DOM tests / 10 files, 340 assertions; zero failures | 18.020s |
| `nice -n 10 bun run test:stress` | exit 0; seed 1337, rerun-each=3; 5115 passes / 198 files, 12777 assertions; zero failures | 13.075s |
| `nice -n 10 bun run build` | exit 0; Next.js 16.2.4; compiled in 14.8s, TypeScript finished in 27.0s, 21 static pages generated | 45.539s |
| `nice -n 10 bun run lint` | exit 1, unchanged baseline: 1 error + 27 warnings | 35.091s |

`bun run test:ci` ran once; `bun run build` ran exactly once during this continuation. Logs/timings are `/tmp/typecheck-continuation/{verify-tsc,verify-bun,verify-tests,verify-stress,verify-build,lint}.{log,time}`. Initial and final standalone diagnostics are identical after review corrections.

The lint error remains `app/components/calendar/useCalendarConflicts.ts:58:5`, `react-hooks/set-state-in-effect` (synchronous `setConflicts([])` in an effect). Existing hook/image warnings were left untouched; no edited test file produces a lint warning/error.

The successful Next build and failing standalone typecheck are consistent: the installed Next checker (`node_modules/next/dist/lib/typescript/runTypeCheck.js`) filters `*.test.*` / `*.spec.*` diagnostics. No project configuration was changed to achieve that result. No Bun/Node global conflict was reported in production files.

`git diff --check` passed. Refreshed the protection list again before committing: 274 protected paths, zero overlap with the edited files. Final branch is `chore/typecheck-bun`; clean tracked/untracked status.

Commits:

- `41643cc`: `chore(types): add @types/bun and a bun check script` (retained).
- `799533b`: `test: type bun:test mocks after enabling @types/bun` (33 test files).


## Risks and limitations

- `bun run typecheck` intentionally still exits nonzero until the owning feature branches fix the documented protected baseline. The production build and CI tests pass.
- The obsolete `bun:test` import suppressions in the protected attachment route and threads route remain TS2578 diagnostics; their owners must remove them.
- Several protected paths are shared between team-auth and thread-collaboration, so their fixes need coordination across those branches.
- Intentional partial fetch/DOM/certificate mocks are marked with unknown bridges; they exercise only the methods used by each test. Existing ambient mailparser `any` typing and unrelated pre-existing `as any` in other tests remain outside this task.
- Historical pre-types wall times were not retained, so none are invented. Warm/cold incremental caches and shared-machine load affect timing comparisons; the final tsc run followed the Next build.
- The brief is the explicitly requested external artifact at `/home/monkey/code/noctua-mail/briefs/typecheck-bun.md`, outside the worktree; the code changes are committed in the worktree.

