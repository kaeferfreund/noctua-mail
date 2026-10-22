# imapflow 1.3.2 → 2.9.0 spike

Spike only. Worktree `/home/monkey/code/noctua-mail/wt-probe-imap` was returned to detached `c1652ec` with a clean tree and `imapflow@1.3.2`. Nothing was committed.

## Summary

**Go**, after `feat/mailbox-watcher` and `feat/thread-collaboration` are merged. The bump is real but small: the only source edits required on `c1652ec` are narrowing `status()` because imapflow 2 types it as `StatusObject | false`. Packaging, the logger, `fetch` / `download` / `search` shapes, and IDLE all worked against the synthetic fixture.

Verified on this machine with imapflow **2.9.0**:

- `bunx tsc --noEmit`: baseline **355** errors, **363** immediately after the bump (**8** new, all `status()`), **355** after the guards (added 0, removed 0). Exit code 2 both times. Those 355 are the pre-existing `bun:test` noise.
- `bun run test:ci`: **1698 pass / 0 fail** (4194 expects, 196 files) and DOM **48 pass / 0 fail** (296 expects, 8 files). Exit 0. I did not re-run the suite on imapflow 1.3.2; the quoted ~1681 is that earlier baseline, and this run was green.
- Live fixture on ports 3791–3794: signup, login, full sync, folders, threads, and PDF/PNG/calendar attachment downloads matched the `doc/DEV-FIXTURES.md` proof. IDLE delivered `event: new` for an injected message. Poll returned that message.

Apply the recipe below on the merged tree, then re-run `tsc` and `test:ci`. Two call sites that do not exist on `c1652ec` will need the same `false` / non-array handling. They were read from the branch diffs and were **not** compiled here.

## Findings

Installed before the spike: `imapflow@1.3.2` (CJS, `main: lib/imap-flow.js`, no `exports` map). Target: `2.9.0` (2026-10-22). `2.0.0` is the break from `1.7.8`. GitHub marks one breaking change. The rest are behavior and type changes across 2.0–2.9 that this repo actually touches.

### Packaging (the 2.0.0 break)

- Node `>=20`. This repo runs on Bun 1.4.4. That is enough; the suite and the live server ran.
- `"type": "module"`. `import` resolves `./dist/esm/imap-flow.js`. `require` resolves `./dist/cjs/imap-flow.js`.
- The published `files` list is `dist/` only. There is no `lib/` directory on disk. The export map still accepts the old deep paths:

  - `imapflow/lib/*` and `imapflow/lib/*.js` → `dist/esm/*` for import, `dist/cjs/*` for require.

- `lib/mail/imap.structure.test.ts` uses `createRequire` on `imapflow/lib/handler/imap-handler` (`parser`) and `imapflow/lib/tools` (`formatMessageResponse`). Both still resolve. The structure test passed with no edit. `formatMessageResponse`’s second argument is now a `MailboxObject`; later arguments `idHashAlgorithm` and `connection` are optional. The test’s partial `{ uidNext, highestModseq }` still produced the expected Content-ID.
- `next.config.ts` already lists `imapflow` in `serverExternalPackages`. Leave that.
- New direct dependency of imapflow: `pino@10.3.1` (held at 10.3.x). `bun install` pulled 13 packages. The app logger does not need to become a pino instance.

### Logger

`Logger` is still a structural object, not the pino class:

```ts
interface Logger {
  trace?: (obj: any) => void;
  debug(obj: any): void;
  info(obj: any): void;
  warn(obj: any): void;
  error(obj: any): void;
  fatal?: (obj: any) => void;
}
```

`getImapLogger()` already has those methods plus `child()`. 2.9 does not call `child()`. It calls the level methods with a single object. Our formatter `JSON.stringify`s objects. Live logs showed both `[imap] …` lines and imapflow’s own objects. `logger: false` still disables logging. No edit.

### idle() and noop()

- `idle(options?: { whenFree?: boolean }): Promise<boolean | undefined>`.
- A completed IDLE returns `undefined` (`return;` in the IDLE command). `false` means the server refused IDLE. Throwing means the connection failed.
- If `this.idling` is already true, `idle()` returns `undefined` immediately and does not wait. That was already true in 1.3.2. A loop that calls `idle()` while auto-IDLE is in IDLE will spin. The stream loop calls `idle()` only after the previous call returns, so it does not spin. `feat/mailbox-watcher` sets `disableAutoIdle: true` and treats `idle() === false` as rejection. That check is correct for 2.9: do not treat `undefined` as failure.
- `idle({ whenFree: true })` waits until no lock and no command is in flight. The stream does not hold a mailbox lock. Do not pass `whenFree` from inside a lock (it waits for itself).
- Auto-IDLE delay is still 15s (`autoIdleDelay`, capped below `socketTimeout`). 2.9.0: auto-IDLE never waits longer than `maxIdleTime`. The stream already sets `maxIdleTime: 10 * 60 * 1000`.
- `noop(): Promise<void>` is unchanged. The fixture test that breaks IDLE with `noop()` passed.
- 2.6 emits `error` at most once per connection. `bindImapClientError` and the pool listener still run. A second failure is logged, not emitted again.
- 2.9 sets `closedByClient` before LOGOUT. Aborting the SSE stream logged `IDLE session failed` / `NoConnection` / `Fixture logging out`, then `imap.logout`. That is the client closing the socket, not a protocol break.

### fetch / fetchOne / download / downloadMany

Return shapes used by this repo are the same at runtime:

- `fetch` is still an async iterator of `FetchMessageObject` (`seq`, `uid`, `source?: Buffer`, `flags?: Set`, `envelope`, `bodyStructure`, `headers?: Buffer`, `bodyParts?: Map`).
- `fetchOne` still returns `FetchMessageObject | false`.
- `download` still returns `{ meta, content: Readable }` when the part exists. 2.9 also returns `DownloadNotFound` (`content` and `meta` absent) when nothing is selected or the part is missing. `readImapBinaryPart` / `readImapTextPart` already return null when `downloaded?.content` is missing.
- `downloadMany` is not used.
- `fetchOne` now **throws** `NoMailboxSelected` when no mailbox is open. 1.x resolved `undefined`. Every app caller opens the mailbox first. The fixture tests passed.
- `fetch()` with no selected mailbox throws instead of yielding nothing (2.6). Same call-site pattern.
- `FetchOptions.binary` and `DownloadOptions.binary` request `FETCH BINARY` when the server advertises `BINARY` or IMAP4rev2. Default `chunkSize` for `download()` is 65536. `maxBytes` is unchanged and is what sync already passes.
- `changedSince` accepts `bigint | number`. QRESYNC `mailboxOpen` options are `uidValidity` and `changedSince` (2.2.9 declares them). The stream still also sets `mailboxOptions.qresync = true`, which is not a `MailboxOpenOptions` field. The constructor `qresync: true` is what enables the extension. The fixture does not advertise QRESYNC, so this path was not exercised live.

### search / sort

- There is no `client.sort()` in 1.3.2 or 2.9.0. The repo does not call one.
- `search()` is `Promise<number[] | ESearchResult | false | undefined>`. An ordinary UID search still returns `number[]`. `false` is the old “not found / empty command” case. `undefined` is new on the type. `ESearchResult` is only when `returnOptions` is set. 2.5.6 rejects a SEARCH that did not complete instead of returning a partial array. 2.2.3 sends non-ASCII search text as literals.
- No application file on `c1652ec` calls `search()`. `scripts/dev-fixture/fixture.test.ts` does, and those tests passed (including the encoded-word search).
- `feat/thread-collaboration` adds `lib/mail/imap/sentCopy.ts`, which does `const uids = await client.search(...); return uids && uids.length ? Math.max(...uids) : null`. `false` and `undefined` are fine. `ESearchResult` has no `length`, so TypeScript will reject `.length` on the union. They do not pass `returnOptions`, so the runtime value is an array, `false`, or `undefined`. Narrow with `Array.isArray` anyway.

### TLS / socket

- `tls` is still Node `ConnectionOptions`. `secure: false` still means cleartext unless STARTTLS is negotiated.
- `doSTARTTLS` left unset: upgrade when offered, otherwise continue in cleartext and log a warning. The fixture has no STARTTLS. The live log was `Server does not support STARTTLS, continuing over an unencrypted connection`, then login and sync succeeded. Do not set `doSTARTTLS: false` (that would forbid the upgrade). Setting `doSTARTTLS: true` on `secure: false` accounts would fail this fixture and any server without STARTTLS. Leave the option unset.
- 2.2.8 omits `servername` for IP literals because Bun rejects it. The live connection to `127.0.0.1` logged `servername: false` and completed the handshake path.
- `ImapSocket` (`client.unbind().socket`) is `ImapTransportSocket`, not `net.Socket`, since 2.5.0. The runtime object on Bun is still the socket. This repo never calls `unbind()`. It reads `client.socket` through a cast in `imapClientOptions.ts`. Those diagnostics logged `imap.socket_connect` and `imap.socket_close` during the live run. No cast change.
- `capabilities` is still `Map<string, boolean | number>`. `clientSupportsQresync` only handles `Set` and `Array`, so it returns false for a Map. That is pre-existing on 1.3.2 (same Map). 2.9 also has `enabled: Set<string>`. Not part of this bump.

### Errors, `responseText`, `serverResponseCode`, typings

`ImapFlowError` still carries optional `response`, `responseText`, `responseStatus`, `serverResponseCode`, `executedCommand`, `authenticationFailed`. `AuthenticationFailure.response` is typed as `string` (2.0). `lib/mail/imapError.ts` already reads those fields as strings. `imapError.test.ts` passed.

New exported `ImapFlowErrorCode` includes `NoConnection`, `NoMailboxSelected`, `ETHROTTLE`, `LockTimeout`, `DownloadOverflow`, `DownloadIncomplete`, `ParserErrorInternal`, `CONNECT_TIMEOUT`, and others. A throttled login is not an auth failure (2.3). Our auth check keys off `authenticationFailed`, `AUTHENTICATIONFAILED`, and the command text, so a throttle should not become `imap_auth_failed` unless the text says authentication failed.

`status()` is `Promise<StatusObject | false>`. `false` is not nullish, so `status?.uidNext` does not type-check. That was every new `tsc` error.

`host` and `port` on `ImapFlowOptions` are optional. We always pass both.

Internal class fields (`socket`, parser, locks) are stripped from the public class in the 2.0 typings. Code that already casts keeps compiling. `skipLibCheck` is on; pino’s types did not add errors.

### Repo inventory (API actually used)

| File | What it uses |
| --- | --- |
| `lib/mail/imap/_shared.ts` | `new ImapFlow(buildImapFlowOptions(...))` |
| `lib/mail/imapAuth.ts` | `new ImapFlow` |
| `lib/mail/imapClientOptions.ts` | `ImapFlow` / `ImapFlowOptions`, `connect`, `logout`, `logger`, `tls`, cast `socket` + `secureConnection`, `on("error")` |
| `lib/mail/imapLogger.ts` | logger object passed in; not an imapflow import |
| `lib/mail/imapError.ts` | `response`, `responseText`, `responseStatus`, `executedCommand`, `serverResponseCode`, `authenticationFailed` |
| `lib/mail/imap/connectionPool.ts` | `ImapFlow` type, `on("error")`, `on("close")`, `logout` via release |
| `lib/mail/imap/mailbox.ts` | `list`, `status`, `mailboxOpen`, `fetch`, `capabilities` via cast |
| `lib/mail/imap/mutations.ts` | `append`, `mailboxOpen`, `fetchOne`, `messageMove`, `messageDelete`, `messageFlagsAdd`, `messageFlagsRemove` |
| `lib/mail/imap/sync.ts` | `download({ uid, maxBytes })`, `status`, `fetchOne`, `fetch`, `list`, `mailboxOpen` |
| `lib/mail/imap.structure.test.ts` | `require("imapflow/lib/handler/imap-handler")`, `require("imapflow/lib/tools")` |
| `app/api/accounts/[accountId]/imap/stream/route.ts` | dynamic `import("imapflow")`, `mailboxOpen`, `status`, `fetch({ uid })`, `idle`, `on("exists"|"expunge"|"flags")` |
| `app/api/accounts/[accountId]/imap/poll/route.ts` | `mailboxOpen`, `fetch({ uid })` |
| `scripts/dev-fixture/fixture.test.ts` | connect, list, mailboxOpen/Close/Create/Subscribe/Delete, fetchOne, search, append, flags, copy, move, delete, idle, noop, status |
| `next.config.ts` | `serverExternalPackages: [..., "imapflow", ...]` |

`downloadMany`, `sort`, `getMailboxLock`, `setFlagColor`, `unbind`, and `compress()` are unused.

## Migration recipe (per file, copy-pasteable diffs)

On the merged tree:

```sh
# package.json
#   "imapflow": "^1.3.2",
#   "imapflow": "^2.9.0",
```

```diff
--- a/package.json
+++ b/package.json
@@ -56,7 +56,7 @@
     "cn": "^0.5.0",
     "entities": "^7.0.1",
     "html-to-text": "^9.0.5",
-    "imapflow": "^1.3.2",
+    "imapflow": "^2.9.0",
     "lexical": "^0.43.0",
```

Then `nice -n 10 bun install`. Lockfile resolution seen in this spike: `imapflow@2.9.0` (`sha512-8drBcDmYhDNkMHzoXVd46/XnZg3krcZyLsyOyVuAxTQPPKUc0u/bpb3ocl36u2b9ZD/8J6rz2YdUbzHyaj1Pmw==`) depending on `pino@10.3.1`. Do not hand-edit `bun.lock`.

`app/api/accounts/[accountId]/imap/stream/route.ts` on **c1652ec** (this is what was compiled and live-tested):

```diff
--- a/app/api/accounts/[accountId]/imap/stream/route.ts
+++ b/app/api/accounts/[accountId]/imap/stream/route.ts
@@ -257,7 +257,8 @@ export async function GET(request: Request, { params }: AccountRouteParams) {
             { ...logContext, mailbox },
             async () => await client.status(mailbox, { uidNext: true })
           );
-          const uidNext = status?.uidNext ?? previousUidNext;
+          // imapflow 2 status() resolves false when the server rejects STATUS.
+          const uidNext = (status ? status.uidNext : undefined) ?? previousUidNext;
           if (uidNext <= previousUidNext) return;
@@ -421,6 +422,7 @@ export async function GET(request: Request, { params }: AccountRouteParams) {
                       unseen: true
                     })
                 );
+                if (!status) continue;
                 updates.push({
                   id: folder.id,
                   uidNext: status.uidNext,
```

`scripts/dev-fixture/fixture.test.ts`:

```diff
--- a/scripts/dev-fixture/fixture.test.ts
+++ b/scripts/dev-fixture/fixture.test.ts
@@ -158,6 +158,7 @@ test("STATUS, EXAMINE, folder CRUD, subscription and UNSELECT", async () => {
   const appended = await connection.append(path, raw);
   if (!appended || !appended.uid) throw new Error("No APPENDUID");
   const status = await connection.status(path, { messages: true, unseen: true, uidNext: true, uidValidity: true, recent: true });
+  if (!status) throw new Error("STATUS failed");
   expect(status.messages).toBe(1);
   expect(status.unseen).toBe(1);
   expect(status.uidNext).toBe(2);
@@ -242,7 +243,8 @@ test("literal-like mailbox names stay ordinary strings and APPEND stays byte-exa
     await connection.mailboxOpen(path);
     const fetched = await connection.fetchOne("1", { source: true });
     expect(fetched && fetched.source).toEqual(raw);
-    expect((await observer.status(path, { messages: true })).messages).toBe(1);
+    const status = await observer.status(path, { messages: true });
+    expect(status && status.messages).toBe(1);
     await connection.mailboxClose();
```

No other file on `c1652ec` needed an edit. `lib/mail/imap/sync.ts` and `lib/mail/imap/mailbox.ts` already cast `status` before reading `uidNext`.

### After `feat/mailbox-watcher` (not compiled in this spike)

That branch rewrites the stream’s connect/IDLE section and adds unguarded `status.uidValidity` reads. Re-apply a `false` guard wherever `status` is used as an object. Their new lines look like:

```ts
uidValidity: status.uidValidity == null ? currentState?.uidValidity : String(status.uidValidity),
const uidNext = status?.uidNext ?? previousUidNext;
uidValidity: status.uidValidity == null ? null : String(status.uidValidity),
```

Use:

```ts
if (!status) return; // or continue, in the poll loop
const uidNext = status.uidNext ?? previousUidNext;
const uidValidity = status.uidValidity == null ? null : String(status.uidValidity);
```

`lib/mail/imap/sync.ts` on that branch adds `status.uidValidity` next to an existing cast of `uidNext`. Same guard: if `status` is `false`, skip the folder (the surrounding `catch` already records `status-error`).

`lib/mail/imap/idle.ts` on that branch is already the right 2.9 shape: `disableAutoIdle: true`, and `if (await client.idle() === false) throw`. Leave it. Do not change `undefined` into an error.

`lib/mail/imapClientOptions.ts` on that branch only adds `getImapConnectBlockedUntil` and `maxAttempts`. No imapflow type conflict expected.

### After `feat/thread-collaboration` (not compiled in this spike)

`lib/mail/imap/sentCopy.ts`:

```ts
const uids = await client.search({ header: { "Message-ID": messageId } }, { uid: true });
return uids && uids.length ? Math.max(...uids) : null;
```

Replace with:

```ts
const uids = await client.search({ header: { "Message-ID": messageId } }, { uid: true });
return Array.isArray(uids) && uids.length ? Math.max(...uids) : null;
```

`append()` is still `AppendResponseObject | false`. Their `if (!result) throw` matches. `connectionPool.ts`’s `fresh` flag does not touch imapflow types. `completeSend.ts` does not import imapflow.

## Verification (exact commands + numbers)

Worktree: `/home/monkey/code/noctua-mail/wt-probe-imap`, HEAD `c1652ec12dc6d4e4b8bcb9a34e4875f9a6b88cfb`.

```text
nice -n 10 bunx tsc --noEmit --pretty false
  before bump:  exit 2, 355 error signatures
  imapflow@2.9.0, no source edits: exit 2, 363 signatures
  after the status guards: exit 2, 355 signatures (added 0, removed 0)
```

The 8 new errors, all `TS2339` on `false | StatusObject`:

- `app/api/accounts/[accountId]/imap/stream/route.ts(260,35)` `uidNext`
- `app/api/accounts/[accountId]/imap/stream/route.ts(426,35)` `uidNext`
- `app/api/accounts/[accountId]/imap/stream/route.ts(427,34)` `unseen`
- `app/api/accounts/[accountId]/imap/stream/route.ts(428,34)` `messages`
- `scripts/dev-fixture/fixture.test.ts(161,17)` `messages`
- `scripts/dev-fixture/fixture.test.ts(162,17)` `unseen`
- `scripts/dev-fixture/fixture.test.ts(163,17)` `uidNext`
- `scripts/dev-fixture/fixture.test.ts(245,62)` `messages`

```text
nice -n 10 bun run test:ci
  1698 pass, 0 fail, 4194 expect() calls, 196 files, 5.09s
  bun test --config=bunfig.dom.toml dom.test
  48 pass, 0 fail, 296 expect() calls, 8 files, 12.17s
  exit 0
```

Live (synthetic only). PIDs started and later killed: IMAP+control **35995** (3792 and 3794), SMTP **35997** (3793), Next **36561** (3791). No child processes. Ports were free after `kill` of those three PIDs. 3790 was not touched.

```text
bun scripts/dev-fixture/imap-server.ts --host 127.0.0.1 --port 3792 --control-port 3794 \
  --user demo@monkeydent.test --pass demo --seed monkeydent
bun --env-file=.env.local scripts/dev-fixture/smtp-sink.ts --port 3793 \
  --imap-control http://127.0.0.1:3794
ENV_FILE=.env.local bun --bun build-scripts/generateRuntimeConfig.ts
bun --env-file=.env.local --bun next dev -p 3791
```

`scripts/dev-fixture/verify-http.ts` accepts `--base-url` only. IMAP 3789 and SMTP 3787 are hardcoded. The proof was the same script with those two ports set to 3792 and 3793, against `http://127.0.0.1:3791`, invite taken from the server log. Output:

```text
signup {"ok":true,"accountId":"acc-0357e6dc07a93be003c3321b"}
login {"ok":true,"accountId":"acc-0357e6dc07a93be003c3321b"}
sync INBOX: done count=60
sync Sent: done count=15
sync Drafts: done count=3
sync Archive: done count=4
sync Junk: done count=2
sync Trash: done count=3
sync Projekte: done count=0
sync Projekte/Website: done count=3
folders INBOX (\Inbox), Sent (\Sent), Drafts (\Drafts), Archive (\Archive), Junk (\Junk), Trash (\Trash), Projekte, Projekte/Website
messages=90; INBOX=60; threads API: 25 conversations / 75 messages (total=60); unread=20; flagged=8; sent team members=2; drafts=3
attachment downloads verified: application/pdf, image/png, text/calendar; newsletter HTML + inline image verified
```

IDLE: `GET /api/accounts/acc-0357e6dc07a93be003c3321b/imap/stream?activeFolderId=acc-0357e6dc07a93be003c3321b:INBOX` then `POST http://127.0.0.1:3794/inject`. SSE:

```text
event: folder:update  uidNext 64, exists 63
event: new            uid 64, subject "IDLE probe 3"
```

A first SSE read missed `new` because the checker called `reader.read()` twice at once. The server log for that attempt still showed `fetchNew` `{ previousUidNext: 63, uidNext: 64, range: "63:63", count: 1, uids: [63] }`. Poll `GET .../imap/poll?mailbox=INBOX&sinceUidNext=61` returned 200 and the injected subjects, including `IDLE probe`.

A direct imapflow 2.9 client (`disableAutoIdle: true`) reached `idling: true`, received `exists` `{ count: 62, prevCount: 61 }`, and both `fetch({ uid: "…" })` and `fetch(range, query, { uid: true })` returned the injected subject.

Cleartext warning observed, then success: `Server does not support STARTTLS, continuing over an unencrypted connection` for `127.0.0.1:3792`.

Restore, after the servers were killed:

```text
git checkout -- . && git clean -fd -e node_modules
nice -n 10 bun install --frozen-lockfile
  + imapflow@1.3.2, 10 packages installed
git status
  Not currently on any branch.
  nothing to commit, working tree clean
```

## Overlap with in-flight branches

`git -C /home/monkey/code/noctua-mail/repo diff --stat c1652ec..feat/mailbox-watcher -- lib/mail lib/syncOperation.ts lib/syncJobs.ts app/api`

```text
 app/api/_helpers/mailboxSummary.ts                |  46 +++++
 app/api/_helpers/newMailCheck.ts                  |  23 ++-
 app/api/accounts/[accountId]/imap/stream/route.ts |  47 ++---
 app/api/accounts/summary/route.test.ts            |  67 ++++++
 app/api/accounts/summary/route.ts                 |   5 +
 lib/mail/imap/idle.test.ts                        |  49 +++++
 lib/mail/imap/idle.ts                             |  67 ++++++
 lib/mail/imap/sync.ts                             |  32 ++-
 lib/mail/imapClientOptions.ts                     |   8 +-
 lib/syncJobs.ts                                   | 237 ++++++++++++++--------
 lib/syncOperation.ts                              |  16 +-
 11 files changed, 471 insertions(+), 126 deletions(-)
```

`git -C /home/monkey/code/noctua-mail/repo diff --stat ad6db7a..feat/thread-collaboration -- lib/mail`

```text
 lib/mail/completeSend.ts        | 82 +++++++++++++++++++++++++++++++++++++++++
 lib/mail/imap/connectionPool.ts | 11 ++++--
 lib/mail/imap/index.ts          |  2 +
 lib/mail/imap/mutations.ts      |  7 ++--
 lib/mail/imap/sentCopy.ts       | 12 ++++++
 5 files changed, 107 insertions(+), 7 deletions(-)
```

Files this spike edited that the branches also edit:

- `app/api/accounts/[accountId]/imap/stream/route.ts` is the only overlapping edit. Mailbox-watcher replaces the inline `new ImapFlow` / `idle()` loop with `connectIdleImapClient` and `runImapIdleLoop`, and it reads `status.uidValidity` without a `false` check. Expect a conflict on the `status?.uidNext` line and on the poll `updates.push`. Take their structure, then add the `if (!status)` guards from the recipe.
- `package.json`, `bun.lock`, and `scripts/dev-fixture/fixture.test.ts` are not in those diffs.

Files the branches edit that this spike did not, but that will feel the new types:

- `lib/mail/imap/sync.ts` (`status.uidValidity`).
- `lib/mail/imap/sentCopy.ts` (`search()` result used as an array).
- `lib/mail/imap/mutations.ts` (`append` result already checked for falsy).
- `lib/mail/imap/idle.ts` (compatible with 2.9 `idle()` as written).

## Risks & recommendation

**Go**, as a follow-up to those two merges, not before. The c1652ec delta is the dependency bump plus four lines that teach TypeScript that `status()` can be `false`. Runtime behavior on the fixture (sync of every folder, attachment bytes, IDLE EXISTS → `event: new`, poll) matched imapflow 2.9.

Do not fold these into the bump:

- Switching sync from `fetch({ source: true })` to chunked `download()` or `binary: true`. Worth a later look for the ~11k-message mailboxes, not required to land 2.9. `download()` already defaults to 64KiB chunks. `binary: true` uses `FETCH BINARY` only when the server advertises it; the fixture does not. Client-side decode remains the path that passed.
- `COMPRESS=DEFLATE` stays on unless `disableCompression` is set. Leave it on.
- `idHashAlgorithm` defaults to `md5`, which keeps fallback message ids stable. Do not set `sha256` unless a host has no MD5.
- `doSTARTTLS: true`. It would reject this fixture and any cleartext server. The new behavior is a warning, then the same cleartext session.
- Fixing `clientSupportsQresync` to read the `Map`. Pre-existing, and the fixture does not advertise QRESYNC.

11k-folder notes from the 2.x changelog, none of which require a code change:

- A SEARCH answer of plain numbers is stored as a number array and is not counted against `maxResponseTokens` (default 1_000_000). An 11k-UID search is far under the 1GB line cap.
- Hostile literals and token bombs are bounded (`maxLiteralSize` 1GB, `maxResponseSize` 2GB, `LineTooLarge` / `LiteralTooLarge` / `TooManyTokens`).
- `libbase64@1.4.1` (2.4.1) decodes padded base64 in linear memory. That is the attachment path.
- `fetch()` is still one message at a time. Peak memory for a full sync is still “one RFC822 `source` buffer”, which this code already requests. 2.9 does not make that worse.
- Empty `download()` chunks are retried (2.2.11 / 2.3) instead of failing the part. Chunked download stops if the server ignores the partial range (2.0.3).

Risks to re-check on the merged tree only:

1. Every new `status.uidValidity` / `status.uidNext` read must narrow `false` or `tsc` grows again.
2. `sentCopy` `search()` must be treated as an array.
3. Watcher connections should keep `disableAutoIdle: true` so the idle loop owns IDLE. `idle() === false` means refusal; `undefined` means the IDLE ended normally or was already running.
4. `error` fires once per connection. A watcher that waited for a second `error` to tear down will not get it. `close` still fires. The mailbox-watcher loop also listens for `close`.
5. Re-run `nice -n 10 bunx tsc --noEmit` and `nice -n 10 bun run test:ci`, then one fixture IDLE inject. Compare the tsc count to 355, not to zero.
