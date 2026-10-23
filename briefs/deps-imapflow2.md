# imapflow 2.9.1 implementation

Worktree: `/home/monkey/code/noctua-mail/wt-deps-imapflow`  
Branch: `chore/deps-imapflow2`  
Base: `9424150f5aa0a446ed9bc03ed199e6825129467d`  
Runtime: Bun 1.4.4 / Next 16.2.4 / React 19.2.5. Synthetic mail only.

## Summary

- Upgraded `imapflow` from `^1.7.8` to `^2.9.1`. The npm registry reported 2.9.1 as the latest stable 2.9.x on 2026-10-23. Edited `package.json`, then ran `nice -n 10 bun install`; committed its generated `bun.lock` without hand editing.
- Added minimal STATUS false-result guards and an array guard for the sent-copy SEARCH fallback. Kept the structural logger and fetch/download/search call shapes.
- Added one imapflow trace include to the existing sync-route `outputFileTracingIncludes`: Next otherwise traced only the ESM export, leaving the CJS root and legacy require paths unavailable in standalone. Both exports and legacy deep paths resolve after the include. The next-intl wrapper and `serverExternalPackages` (including imapflow) are intact.
- No edits to `connectionPool.ts`, `imapCancellation.ts`, `mailboxWatcher.ts`, `syncJobs.ts`, `lib/workers/**`, or `idle.ts`. No close/logout/abort changes were needed.
- Live dev acceptance passed signup, password login, mandatory TOTP enrollment and fresh MFA login, full sync, folders, threads, attachments, IDLE injection and poll. Populated standalone SIGTERM passed in **63 ms**, with the pool drained, SSE EOF, zero fixture connections, empty lease/queue tables and database integrity `ok`.
- CI passed **2,754 backend + 433 DOM tests**, zero failures. Stress and the final commit remain pending.

## Call sites and minimal source changes

Re-derived the inventory on this tree with the requested command:

```sh
grep -rn "imapflow" lib app scripts --include=*.ts
```

Also searched `.status(`, `.search(`, `.fetch(` and `.download(` rather than relying on the older spike's line numbers.

Changed call sites:

- `lib/mail/imap/mailbox.ts`, `getImapMailboxStatus`: reject a false STATUS before reading the status snapshot. This treats an unsuccessful command as an error instead of producing a snapshot of null fields.
- `lib/mail/imap/sync.ts`, new-sync planning: reject false STATUS before saving UIDVALIDITY. The existing catch records `reason: "status-error"`, `skip: false`; existing recovery/full-sync policy remains in charge.
- `app/api/accounts/[accountId]/imap/stream/route.ts`: the shared `readFolderStatus` helper rejects false before initial/EXISTS/flags status reads and UIDVALIDITY persistence. The remaining-folder poll skips a false result. All readers consequently receive a StatusObject.
- `lib/mail/imap/sentCopy.ts`: `Array.isArray(uids)` before length/spread in the UIDPLUS SEARCH fallback. The installed 2.9.1 ordinary-search overload already typechecks, but the explicit guard also covers false/undefined and protects the array assumption.
- `scripts/dev-fixture/fixture.test.ts`: narrow the two results whose message/unseen/UIDNEXT fields are inspected. Other direct STATUS assertions already assert the expected object without dereferencing the union.

Other inventory reviewed and unchanged:

- Constructors and client options: `lib/mail/imap/_shared.ts`, `lib/mail/imapAuth.ts`, `lib/mail/imapClientOptions.ts`, `lib/mail/imap/idle.ts`, `lib/mail/imapStreamRuntime.ts`.
- Lifecycle: `lib/mail/imap/connectionPool.ts`, `lib/mail/imapCancellation.ts`, `lib/mailboxWatcher.ts`; dependent worker/sync shutdown paths retain their current implementation.
- Protocol consumers: `lib/mail/imap/mutations.ts`, `app/api/accounts/[accountId]/imap/poll/route.ts`, `app/api/_helpers/newMailCheck.ts`, and the sync fetch/download helpers.
- Tests/probes: `lib/mail/imap.structure.test.ts`, `lib/testFixtures/ingestedSenders.ts`, `lib/testFixtures/sourceOwnership.ts`, connection-pool/IDLE tests, `scripts/verifyMailboxWatcher.ts`, and the dev fixture tests.

Immediately after installation, typecheck found **17 errors in 3 files**, all STATUS false-union reads. After guards, it passed. No logger, fetch, download, append, TLS or cancellation typing changes were necessary.

## Packaging and dependency constraints

The published [imapflow 2.9.1 package metadata](https://registry.npmjs.org/imapflow/2.9.1) declares Node `>=20.0.0`, `type: module`, an ESM `import` export at `dist/esm/imap-flow.js` and a CJS `require` export at `dist/cjs/imap-flow.js`. Its export map preserves `imapflow/lib/*` and `imapflow/lib/*.js`. Verified ESM import, CJS require, and createRequire resolution of:

- `imapflow/lib/handler/imap-handler`
- `imapflow/lib/tools`
- `imapflow/lib/tools.js`

These checks also pass inside `.next/standalone` after the trace include; `pino` resolves there too. `.next/standalone/noctua-server.mjs` exists, the generated server launcher references it, and `build-scripts/verifyStandaloneWorkerBuild.ts` passes.

The logger remains structural (`debug/info/warn/error`, optional trace/fatal); the app logger needs no pino instance. `idle() === false` still signals refusal; normal `undefined` completion is left alone. `close()` is synchronous, marks an application-requested close and tears down pending work; `logout()` marks the close before awaiting LOGOUT. Existing abort-through-close and awaited pool logout remain compatible.

**imapflow 2.9.1 has no nodemailer or mailparser dependency and no peer dependency on either.** It does not require the app to upgrade either package. This branch preserves direct `nodemailer: ^8.0.11` (resolved 8.0.11) and `mailparser: ^3.12.3` (resolved 3.12.3). The already-installed mailparser 3.12.3 independently depends on nodemailer **10.2.0**, which was already nested in the baseline lockfile; this is not introduced by the imapflow upgrade. The sibling `chore/deps-nodemailer-mcp` can change the app's direct nodemailer independently. Regenerate the combined lockfile when integrating that branch; do not copy old nested lock entries manually.

## Lock delta

`nice -n 10 bun install` exited 0, reporting **7 packages installed**. Relative to this base there are **no new package names or lock paths**. In particular, pino **10.3.1 and its dependency tree were already present in imapflow 1.7.8**; the older spike's claim that pino is newly introduced does not apply here.

Six existing lock entries changed versions:

- imapflow 1.7.8 → 2.9.1
- @zone-eu/mailsplit 5.4.16 → 5.4.29
- encoding-japanese 2.3.0 → 2.4.0
- libbase64 1.3.0 → 1.4.1
- libmime 5.4.3 → 5.6.3
- libqp 2.1.1 → 3.0.1

imapflow now uses the existing hoisted socks 2.8.10 instead of its nested 2.8.9. Bun removed nine redundant nested paths: `imapflow/socks`, `mailparser/@zone-eu/mailsplit`, `mailparser/libmime`, two dependencies under the nested mailsplit, and four dependencies under the nested libmime. No unrelated package versions changed. pino's existing dependencies include @pinojs/redact, atomic-sleep, on-exit-leak-free, pino-abstract-transport, pino-std-serializers, process-warning, quick-format-unescaped, real-require, safe-stable-stringify, sonic-boom and thread-stream; none were newly added here.

## Gates

Every heavy command ran with `nice -n 10` in the assigned worktree. Stress details will be finalized after the last suite exits.

- `bun run typecheck`: exit **0**, **0 errors / 1,175 files** after build/dev type generation. It also passed immediately after the guards (1,173 files before generated build/dev types).
- `bun run lint`: exit **1**, exactly the supplied baseline **1 error + 25 warnings**, including the final rerun. The error remains `useCalendarConflicts.ts`, `react-hooks/set-state-in-effect`; no lint suppression or unrelated fix was added.
- `bun run test:ci`: exit **0** with `TMPDIR=/home/monkey/code/noctua-mail/wt-deps-imapflow/.tmp/imapflow2-proof/tmp`: **2,754 backend pass / 0 fail**, 11,309 assertions, 300 files, 468.30 s; **433 DOM pass / 0 fail**, 2,550 assertions, 52 files, 68.49 s. The initial default-TMPDIR run failed with SQLite I/O errors (**2,043 pass / 599 fail**, 2,642 tests; DOM not reached). The retry isolated scratch from shared `/tmp`; no database/test implementation was changed to address that failure. Completed CI scratch was deleted before stress.
- Stress: the package script is `test:stress`, not `stress`; final run pending.
- `bun run build`: passed. Repeated after adding the dual-export trace include; passed again, including standalone shutdown launcher preparation.
- `bun build-scripts/verifyStandaloneWorkerBuild.ts`: passed.
- Standalone ESM, CJS, legacy deep-path and pino resolution checks: passed.
- `bun scripts/checkGracefulShutdown.ts --port 3791 --data-dir /home/monkey/code/noctua-mail/data/noctua-data-wt-deps-imapflow`: mandatory probe passed with watcher disabled (**505 ms**) and with `NOCTUA_MAILBOX_WATCHER=1` (**52 ms**). Both exited 0, signal null, forced false. These final probes ran before creating the synthetic mailbox; the populated-watcher proof below is additional. Timing was measured on the shared box; the supplied baseline was 102/75 ms.
- `git diff --check`: passed; final clean-tree verification pending commit.

## Live synthetic acceptance

Ran an untracked temporary harness with:

```sh
nice -n 10 bun --env-file=.env.local .tmp/imapflow2-proof/live.ts
```

It used only app port **3791**, fixture IMAP port **3792**, and the prescribed `.env.local` data root `/home/monkey/code/noctua-mail/data/noctua-data-wt-deps-imapflow`. Auth used an isolated loopback origin and synthetic identity/password, independent auth/encryption keys, invite provisioning and the normal mandatory TOTP flow. No real mailbox was configured or contacted.

To honor the two-port restriction, imported `startImapServer({ host: "127.0.0.1", port: 3792, seed: "monkeydent" })` without a control listener. Injected through its real MailStore, which emits EXISTS to selected/IDLE clients. No SMTP service was started. The mailbox configuration was seeded offline through `upsertAccount`, after real `verifyImapCredentials` against port 3792; normal admin membership API granted manager access. SMTP verification, admin mailbox creation over HTTP and SMTP sending were outside this check. The authenticated HTTP verifier itself ran unchanged from `scripts/dev-fixture/verify-http.ts` with its cookie supplied only in the child environment.

Passed:

1. Offline `recoverTeamAuth.ts --application-stopped --confirm-personal-handover --bootstrap-invite`; invite retained in memory, never printed in the report.
2. Dev server `bun --bun next dev --hostname 127.0.0.1 --port 3791`; normal signup, password sign-in, TOTP enrollment with a password-bound proof, fresh password sign-in challenge and TOTP verification, manager membership, mailbox selection.
3. Unchanged `verify-http.ts --base-url http://localhost:3791`: full sync INBOX **60**, Sent **15**, Drafts **3**, Archive **4**, Junk **2**, Trash **3**, Projekte **0**, Projekte/Website **3**. Eight folders, **90 total messages**, **25 INBOX conversations / 75 flattened thread messages**, unread **20**, flagged **8**, both Sent identities and all three draft flags verified.
4. Actual PDF, PNG and calendar attachment bytes; newsletter HTML and inline image verified.
5. IMAP stream initial folder STATUS and IDLE, then injected synthetic message **UID 61**; `event: new` contained the expected subject. Poll returned HTTP 200, **uidNext 62**, UID 61 and the same subject.
6. Cancelled the dev IMAP stream, then SIGTERM: dev exited **0 in 336 ms**, shutdown complete, no forced kill, no fixture connections left. An earlier harness attempt left the dev stream open through SIGTERM and observed ECONNRESET despite exit 0; dev's CLI owns final transport closure, so the cooperative EOF/pool assertion was made against standalone instead.
7. Started `.next/standalone/server.js` on 3791 with the watcher enabled. Confirmed watcher `idling`, **one watcher lease**, zero queued/running workers, opened `/api/me/events`, and performed poll to populate the IMAP pool. Kept the event stream open through SIGTERM.
8. Standalone exited **0 in 63 ms**, forced false, `[shutdown] complete`, **pool-drain logged (2 ms)**, SSE EOF, zero fixture socket listeners, `mailbox_watcher_lease`, `sync_worker_leases` and `sync_worker_queue` all **0**, `PRAGMA integrity_check = ok`.

All owned app/fixture processes stopped. The final harness completed exit 0. Its temporary scripts/logs and test scratch are removed before handoff; the isolated synthetic runtime data remains only at the prescribed data root. No other worktree, real mailbox, stash, push, merge, rebase or PR was used.

## Review for sync and shutdown owners

- Review STATUS rejection policy at mailbox snapshot, new-sync planning and stream helper/poll sites. A false STATUS must never clear UIDVALIDITY or publish fabricated counts. Existing `status-error` recovery remains unchanged.
- Review the one trace include: both imapflow export targets must ship for standalone and Bun worker resolution. The build and real packaged watcher/pool proof passed with this include.
- Existing cancellation closes the client immediately; do not replace that with queued LOGOUT on an aborted/stalled command. Normal pool drain continues to await logout. `error` may be emitted once per connection; existing close listeners remain necessary. No lifecycle source was rewritten by this branch.
- Retain `disableAutoIdle: true` and `idle() === false` handling in the shared IDLE loop. `undefined` remains a normal outcome.
- Integrate the nodemailer sibling independently and regenerate the lockfile. Its SMTP/MCP changes are outside this branch; no nodemailer/mailparser requirement is imposed by imapflow 2.9.1.
- The fixture is plaintext and does not advertise CONDSTORE/QRESYNC or BINARY. This run does not establish behavior for those extensions or production TLS. Their existing options and behavior were left untouched.
