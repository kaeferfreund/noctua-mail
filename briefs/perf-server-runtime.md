# Server runtime performance

Read-only study of `/home/monkey/code/noctua-mail/repo` at `team-inbox` @ `c1652ec` (clean vs `origin/team-inbox`). Nothing in `repo/` was modified. No servers, no install, no full test suite. Microbenchmarks are single `bun -e` runs from that checkout (Bun 1.4.4). Live gzip under `bun --bun next start` was not measured; the Next source that wraps the server was read from `node_modules/next`.

Workload assumed by the ranking: one Linux box, 2 users, ~12 mailboxes (8 shared), largest ~11k messages. Goal is less work per API call and less CPU per sync, on the paths those users actually hit (thread list, open message, inline images, sync).

## Overlap tags

| Tag | Means |
| --- | --- |
| **ready** | Can land on `team-inbox` without editing the in-flight areas below. |
| **overlap: mailbox-watcher** | `lib/syncJobs.ts`, `lib/syncOperation.ts`, `lib/mail/imap/**`, `lib/workers/**`, the `imap/stream` route, `lib/db/mailboxSummary.ts`, `app/api/accounts/summary`. |
| **overlap: thread-collaboration** | `lib/mail/completeSend.ts`, `lib/mcpServer.ts`, `app/api/_helpers/**`, `lib/db/messages/**`. |
| **overlap: team-auth** | `app/api/auth/**`, `app/api/_helpers/**`, `lib/auth*.ts`, `lib/credentials.ts`. |

`feat/mailbox-watcher` also rewrites the SSE stream. Treat `app/api/accounts/[accountId]/imap/stream` as reference only.

## Measurements (this machine, synthetic)

| What | Result |
| --- | --- |
| Session cookie unseal (AES-256-GCM, 344-byte cookie, 2000 iters) | 0.0083 ms |
| `sha256` of the IMAP secret key (2000 iters) | 0.0028 ms |
| `simpleParser` of a 254,183-byte multipart (≈8 KB HTML + 180 KB base64 PDF), 8 iters after warmup | 23.55 ms |
| `sanitizeHtmlForDisplay` (parse5 normalize + sanitize-html, app options) on 53,806 chars of table HTML, 8 iters | 61.32 ms |
| `sanitize-html` alone on 49,006 chars, simpler allowlist | 38.95 ms |
| `html-to-text` on that 49,006-char HTML | 30.91 ms |
| Base64-scrub regex `/([A-Za-z0-9+/=]{200,})/g` on 508,366 chars | 0.82 ms |
| `JSON.stringify` of 900 list messages (300 threads × 3), no bodies | 941,462 bytes in 2.49 ms |
| `gzip` of that JSON | 45,543 bytes in 5.62 ms |
| One detail object, 4 KB text + 54 KB HTML | 56,425 bytes JSON, gzip 4,295 bytes, stringify 0.15 ms |
| Cold `import("./lib/syncOperation.ts")` in a fresh `bun` process, two runs, no IMAP | wall 248 ms / 238 ms, import itself 234 ms / 224 ms |

SQL timings against a real 11k mailbox were not taken. Where a cost is "one query per thread on a 300-row page", the count is from the code, not from `EXPLAIN`.

## Ranked items

### 1. Keep one sync process alive across folder jobs

**Impact.** Measured. Every sync job is a new `bun` process. Cold import of `lib/syncOperation.ts` is ~230 ms before schema init, IMAP login, or parsing. `lib/syncJobs.ts` queues one folder at a time (`syncJobs.ts:84`, `spawnSyncWorker` at 378–395: `bun.spawn(["bun", "run", scripts/runSyncJob.ts, JSON.stringify(payload)])`). A mailbox with N folders pays N process starts. The worker then calls `drainImapConnectionPool()` on the way out (`lib/workers/runSyncJob.ts:74`), so the next job also pays a fresh IMAP login. The pool's own comment puts that handshake at 50–300 ms (`lib/mail/imap/connectionPool.ts:1–7`, idle slot `POOL_IDLE_MS` 60s at line 62). IPC itself is a line protocol (`__noctua_sync_progress__:` / `__noctua_sync_result__:`); that is cheap next to startup. Parent `console.info` of every progress line (`syncJobs.ts:419`) adds log volume, not latency.

On top of startup, each message pays `simpleParser` (item 6). Startup is the fixed cost; parse is the variable cost. For a one-folder incremental sync of a few messages, ~230 ms + one login is most of the wait. For an 11k backfill, parse dominates and startup is still paid once per folder.

**Effort.** Medium. One long-lived `bun` child per account (or one for the box), jobs on stdin, progress on stdout, same line protocol.

**Risk.** Medium. A crash still takes only the child. A wedged IMAP socket needs an idle timeout and a respawn. `runSyncOperationBatched` currently calls `getAccounts()` and decrypts every mailbox, then picks one (`lib/syncOperation.ts:254–255`). A resident worker should load the one account it was started for. Do not share a `bun:sqlite` `Database` across threads or into the parent: open a new connection in the child. WAL + `busy_timeout` 15000 are already set in `configureDb`. Bun's sqlite docs describe one synchronous `Database` per connection and WAL for concurrent readers; they do not document transferring a `Database` to a Worker. In-process sync on the Next server would run `simpleParser` on the API event loop. `lib/db/categories.ts:460–464` already treats that as a stall and chunks it at 4.

**Proposal.**

```ts
// parent: spawn once, write one JSON line per job, read progress lines
const child = bun.spawn(["bun", "run", "scripts/runSyncWorker.ts"], {
  stdin: "pipe", cwd: process.cwd(), stdout: "pipe", stderr: "pipe"
});
child.stdin.write(JSON.stringify(payload) + "\n");
// child: import the graph once, keep its Database and its IMAP pool.
// Do not call drainImapConnectionPool() between jobs. Drain on SIGTERM.
```

argv JSON stays under Linux `MAX_ARG_STRLEN` (~128 KB) today because the payload is one argv element (`syncJobs.ts:384–389`). A stdin protocol removes that cap for `backfillUids`.

**Files.** `lib/syncJobs.ts`, `scripts/runSyncJob.ts`, `lib/workers/runSyncJob.ts`, `lib/workers/syncProtocol.ts`, `lib/syncOperation.ts`. Same spawn shape in `lib/workerJobRegistry.ts` (category recompute). `lib/mail/imap/connectionPool.ts` only if the child must stop draining it.

**Tag.** overlap: mailbox-watcher. Not ready. `lib/workerJobRegistry.ts` is outside the named list, but the worker entrypoints it launches are in `lib/workers/**`.

### 2. Batch topic suggestions on the thread list

**Impact.** Not measured on a real DB. Count is from the code. `GET /api/accounts/[accountId]/threads` always calls `enrichMessagesWithThreadTopics(..., { includeSuggestions: true })` (`app/api/accounts/[accountId]/threads/route.ts:49–53`). `getTopicSuggestionsForThreads` loads signals once, then calls `getTopicSuggestionsForSignals` once per thread (`lib/topics/suggestions.ts:513–540`). Each call is a `topic_learning_signals` join (`suggestions.ts:288–308`). The client asks for 300 threads in a folder and 600 when search scope is all (`app/components/mailclient/messageListQueryUrl.ts:53–55`). Threads that already have assigned topics skip the suggestion query; untagged threads do not. A page of mostly untagged mail is a few hundred extra queries before the JSON response. The messages list handler enriches topics without `includeSuggestions`.

Turning suggestions off on the list is the wrong cut. `needsMessageContentHydration` returns false when `body` is empty, `htmlBody` is absent, and `hasSource` is true (`lib/ui/messageView.ts:27–37`). Synced mail takes that path: the list sets `body: ""` and omits `htmlBody` (`lib/db/messages/query.ts:2612–2613`), and the test "treats empty attachment-only messages with source as loaded" locks it in. `useThreadContent.ts` only GETs the message when that predicate is true. The open view reads `topicSuggestions` off the list item (`MessageViewOrchestrator.tsx` around the list-item suggestion read). A later GET would not run for ordinary synced mail.

**Effort.** Small. One query, group in JS. Keep the per-thread weight rules (`TOPIC_SUGGESTION_WEIGHTS`, exclude the requesting `threadId`).

**Risk.** Low if the batch reproduces the same score and the same "exclude this thread" filter. High if suggestions disappear from the list payload.

**Proposal.** Inside `getTopicSuggestionsForThreads`, collect every `(signalType, signalValue)` across the page, one `SELECT` with a row-value `IN`, then in JS drop rows whose `threadId` is the requesting thread and apply the same `SUM(weight)` / `MAX` ranking as `getTopicSuggestionsForSignals`. Cap the `IN` list (signals per thread are a handful: sender, domain, list-id, recipients, Jira key). Leave `includeSuggestions: true` on the route.

**Files.** `lib/topics/suggestions.ts` only. The call site in `threads/route.ts` can stay. Do not edit `app/api/_helpers/enrichMessagesWithThreadTopics.ts`.

**Tag.** ready.

### 3. Cap and slim the thread-list response

**Impact.** Mixed, measured for JSON size, not for SQL.

The route takes `pageSize` with no cap (`threads/route.ts:24`: `Number(searchParams.get("pageSize") ?? "300") || 300`). The messages route clamps to 1–1000, default 200 (`app/api/messages/listMessagesHandler.ts:37`). A client can ask for `pageSize=100000` and the handler will load every message of every matching thread. The real UI uses 200 / 300 / 600.

`listThreads` returns every message in the page of threads, not one row per thread (`query.ts:2510–2559`). Bodies are already absent (`body: ""` at 2612, `htmlBody: undefined` dropped by `JSON.stringify`). A synthetic page of 900 messages (300 threads × 3, addresses and flags, no body) is 941 KB JSON / 46 KB gzip. Next's default `compress: true` gzip-encodes JSON responses over 1 KB and sets `Vary: Accept-Encoding` (`node_modules/next` router server). The browser still parses the decompressed 941 KB. Gzip of this payload was not confirmed live under `bun --bun`.

Default `groupBy=date` is thread-date-sensitive, so every list call also runs `getThreadGroupCounts` (`query.ts:2654`, SQL at 1355–1372): `messages` joined to `threads` for the whole folder filter, `GROUP BY` date bucket, `COUNT(*)` counting messages. That is a scan of the mailbox's visible messages on every list request, including page 2. Indexes that exist and match the list shape: `idx_threads_account_latest`, `idx_messages_account_thread_date`, `idx_messages_thread`, `idx_attachments_message`, `idx_message_calendar_events_account_message`, `idx_thread_signals_account_thread`. The meaningful-attachment `EXISTS` (`buildMeaningfulAttachmentExistsSql`, selected at `query.ts:2550`) is per returned row via `idx_attachments_message`. Denormalizing `hasMeaningfulAttachment` is worth it only after a profile, and the write path is sync.

Fields the list cards actually read: `category` (string), flag booleans and `flags`, `sizeBytes`, `to` / `cc` / `bcc` (tooltips), `threadId` / `messageId` / `parentId` (tree), `calendarEventUids` (`deleteConfirm.ts` reads them off list items). Safe to stop shipping: `body: ""`, empty `attachments`, empty calendar arrays, `categoryScore`, `categorySignals`. `topics` is copied onto every message in the thread; list rows do not read `message.topics` (Message menu and the open topic row do, and the open row uses suggestions — item 2). Leave `replyTo` until compose-from-list is checked; it was not verified unused.

The large SQL change — one summary row per thread, group counts from the `threads` table (`messageCount`, `unreadCount`, `latestMessageId`, dates) — is a contract change. The client builds the thread tree from `parentId` on every member. That rewrite lives in `lib/db/messages/query.ts`.

**Effort.** Small for the cap and the post-map omit. Large for the one-row-per-thread query.

**Risk.** Low for the cap (UI max is 600; do not change the default of 300). Low for omitting empty `body`, scores, and signals. Medium for dropping `topics` from list messages if any card still wants them. High for changing `listThreads` to one row per thread.

**Proposal.** In the route, before `listThreads`:

```ts
const requested = Number(searchParams.get("pageSize") ?? "300") || 300;
const pageSize = Math.max(1, Math.min(600, requested));
```

After enrichment, map items and omit `body` when it is `""`, omit `categoryScore` / `categorySignals`, omit `topics` when the thread-level payload already carries them, omit empty `calendarInviteStates` / `attachments`. Keep `calendarEventUids`, `category`, `flags`, addresses, `parentId`.

Leave `listThreads` and `getThreadGroupCounts` for the collaboration branch. `listThreads` also calls `getAccountEmail` even for an unfiltered list (`query.ts:2188`) after `requireAccountContext` already loaded the account. Passing the email in would change the `query.ts` signature; skip it while that file is in flight. A process cache of the account row (item 9) makes the extra `SELECT email` cheap anyway.

**Files.** Ready slice: `app/api/accounts/[accountId]/threads/route.ts`. Deferred slice: `lib/db/messages/query.ts`.

**Tag.** Cap and post-map slim: **ready**. SQL rewrite: overlap: thread-collaboration.

### 4. Cache attachment bytes in the browser

**Impact.** Not measured as a millisecond, structural. Inline images are a separate authenticated GET per `cid`, and each GET pays `requireSessionOr401` (including the `[client]` log, item 8), `getAccountDb` (item 9), and a file read. The response has no `Cache-Control`, no `ETag`, no `Last-Modified` (`app/api/accounts/[accountId]/messages/[messageId]/attachments/[attachmentId]/route.ts:96–102`). Headers today: `Content-Type`, `Content-Disposition`, `nosniff`, `Content-Security-Policy: default-src 'none'`. Opening one HTML message re-fetches every inline image, and a second open in the same session does it again.

Attachment ids are `att-${account.id}-${uid}-${index}` (`lib/mail/imap/parser.ts:201`). Stable for a UID and part index, not a content hash. `saveAttachmentData` can overwrite that path when the same UID is resynced. Bytes change only if the MIME part changes under the same UID. `immutable` is the wrong default for that URL. A long private max-age plus an ETag of `mtime-size` revalidates when a resync rewrites the file.

`preview=1` returns an HTML shell. That response stays uncacheable. Error JSON stays uncacheable.

The source route (`messages/[messageId]/source/route.ts:45–52`) reads the `.eml`, regex-scrubs base64 runs of ≥200 chars (0.82 ms on a 508 KB string), truncates to 200k chars, and returns JSON with no cache headers. Secondary. Same private ETag treatment, short max-age, because the scrubbed view is derived.

**Effort.** Small.

**Risk.** Low if the preview shell and errors stay `no-store`, and if `ETag` changes when the file is rewritten. Medium if someone sets `immutable` and a resync changes bytes under a stable URL while a browser holds the old image.

**Proposal.**

```ts
const stat = await fs.stat(filePath);
const etag = `"${stat.mtimeMs.toString(16)}-${stat.size.toString(16)}"`;
if (request.headers.get("if-none-match") === etag) {
  return new NextResponse(null, { status: 304, headers: {
    ETag: etag,
    "Cache-Control": "private, max-age=86400"
  }});
}
headers["ETag"] = etag;
headers["Cache-Control"] = "private, max-age=86400";
```

Apply only to the byte response. Preview shell: `Cache-Control: no-store`. The client currently fetches with `cache: "no-store"` on message hydration; attachment `<img>` loads follow the URL default, so a response header is enough for images. A message GET ETag does nothing while the client forces `no-store`.

**Files.** Attachment route above. Optionally `messages/[messageId]/source/route.ts` with `private, max-age=300` and an ETag of the source file's mtime and size (the scrub is deterministic).

**Tag.** ready. Extraction-from-source (`extractAttachmentBufferFromSource` → `simpleParser` of the whole `.eml`) stays as the cold-miss path. Changing the parser is overlap: mailbox-watcher.

### 5. Memoize client HTML sanitizing

**Impact.** Measured. The SPA does not use `GET .../html`. `HtmlMessage.tsx` calls `sanitizeHtmlForDisplay` on every preview-document build (`HtmlMessage.tsx:369–379`). That function runs parse5 `normalizeHtmlStructure` and then sanitize-html (`lib/html/sanitize.ts:79–81`, `allowVulnerableTags: true`). 53,806 characters of table HTML took 61.32 ms. Dark-mode and font-scale rebuilds of the iframe pay it again. First open still pays. The debug HTML route re-sanitizes and sets `Cache-Control: no-store`; almost no traffic.

Sync does not sanitize. `lib/mail/syncMessageSanitizer.ts` rewrites `cid:` / data URLs and stores source plus attachment bytes. Storing sanitized HTML at sync time does not help until the client stops sanitizing, and a sanitizer change would not apply without a version key.

**Effort.** Small.

**Risk.** Low. The memo key must include every input of `buildPreviewDocument` that changes the sanitized string (html length is not enough if two messages share a length; include message id). Dark mode and font scale change the wrapper, not the sanitize output, so the sanitized string can be cached separately from the srcdoc wrapper. Keep the sanitizer call. A wrong key would show one message's HTML inside another.

**Proposal.**

```ts
const SANITIZER_VERSION = "1";
const sanitizedCache = new Map<string, string>();
function cachedSanitize(messageId: string, html: string) {
  const key = `${SANITIZER_VERSION}:${messageId}:${html.length}:${hashSample(html)}`;
  const hit = sanitizedCache.get(key);
  if (hit !== undefined) return hit;
  const safe = sanitizeHtmlForDisplay(stripConditionalComments(html));
  sanitizedCache.set(key, safe);
  return safe;
}
```

`hashSample` can be a cheap length-prefixed prefix+suffix if a real hash is awkward in the client bundle. Cap the map (a few dozen open messages).

**Files.** `app/components/HtmlMessage.tsx`. Calendar snapshot components call the same sanitizer (`CalendarEventEmailSnapshot.tsx`, `EventDetailDescription.tsx`); same memo if those views re-render the same HTML. Do not write sanitized HTML from `lib/mail/imap/**`.

**Tag.** ready. Sync-time sanitize: overlap: mailbox-watcher.

### 6. Stop decoding attachment bodies during sync parse

**Impact.** Measured per message, extrapolated. `parseImapMessage` (`lib/mail/imap/sync.ts:439–628`) calls `parseMailForCategorization`, which is `simpleParser(source, { skipTextToHtml: true, skipImageLinks: true })` (`lib/mail/categorization/classifier.ts:58–66`). The name says categorization; the options still materialize attachment buffers. One 254 KB multipart took 23.55 ms. An 11k mailbox of messages that size is on the order of 4 minutes of single-thread CPU, plus `html-to-text` (30.91 ms on 49 KB) when `body` is empty or contains QP artifacts (`sync.ts:535–538`). Typical small mail is faster; the 23 ms figure is a heavy message, not the median. `categories.ts:460–464` already documents that this blocks the event loop. The worker isolates that from the API. It does not make the CPU smaller.

`extractAttachmentBufferFromSource` parses the whole source again to pull one part on an attachment cache miss. That is a read-path cost, rare if sync saved the bytes.

**Effort.** Medium, and it is inside the sync parser.

**Risk.** Medium. Calendar UID collection and attachment metadata merge both read `parsedSource.attachments` (`sync.ts:455–468`). A `simpleParser` option that skips content without dropping filename, content-type, and cid has to be checked against mailparser's current options. Getting it wrong drops inline-image rewrite or invite detection.

**Proposal.** Prefer a parse that keeps text, html, and attachment metadata and skips content buffers. Keep `html-to-text` only when `!hasTextBody || hasQpArtifacts`. Leave the worker (item 1) as the isolation boundary either way.

**Files.** `lib/mail/imap/sync.ts`, `lib/mail/categorization/classifier.ts` (`CATEGORY_SOURCE_PARSE_OPTIONS`).

**Tag.** overlap: mailbox-watcher. Not ready. Recorded because it is the per-message half of sync cost. Do not implement against the current tree.

### 7. Draft autosave should not FETCH the message it just appended

**Impact.** Not microbenchmarked. Structural. Autosave debounce is 2s. `saveDraftForAccount` (`lib/drafts.ts:204–278`) builds an RFC822, IMAP-deletes the previous draft, appends, then `syncImapMessage` (full FETCH + `parseImapMessage` + `sanitizeSyncedMessage` + `upsertMessages`). The IMAP delete and append dominate (a round trip each). The follow-up FETCH adds another round trip plus ~24 ms parse on a small message and more on a draft with attachments. Compose latency is the user-visible part.

**Effort.** Medium, if the local row can be built from the RFC822 already in hand. Large if threading metadata only exists inside `syncImapMessage`.

**Risk.** Medium. The saved row must keep the same `messageId`, `inReplyTo`, `references`, flags (`\Draft`, `\Seen`), and the UID returned by append. A mismatch breaks the next autosave's delete and the thread tree. IMAP messages are immutable, so delete+append stays. A local-only draft (no IMAP append) is a product change, not a perf patch.

**Proposal.** After `appendImapMessage` returns `uid`, parse the `raw` buffer already built at line 228 with the same `parseMailForCategorization` path in-process (one small message on the request, acceptable), set `imapUid` / `mailboxPath` from the append result, and `upsertMessages`. Skip `syncImapMessage`. If that parse does not reproduce threading fields, stop and leave the FETCH in place rather than editing `lib/mail/imap/**`.

**Files.** `lib/drafts.ts`. `lib/serverImap.ts` only if `syncImapMessage` is the only correct writer; that file's IMAP implementation sits on the mailbox-watcher surface, so treat any edit there as overlap.

**Tag.** ready while the diff stays in `lib/drafts.ts`. Becomes overlap: mailbox-watcher if it needs `lib/mail/imap/**` or `lib/syncOperation.ts`.

### 8. Log less on the hot path

**Impact.** Small per call, high volume. `requireSessionOr401` logs `[client] {id} {pathname}` on every request that sends `X-Noctua-Client` (`lib/auth.ts:127–134`). The mail client sets that header on `apiFetch`. Inline images, sync-status polls (every 450 ms while a job runs, else 1200 ms — `app/components/mailclient/constants.ts:21–22`), and the version poll all log. Sync status adds a JSON line per poll (`app/api/_helpers/syncJobs.ts:61–70`). The parent also logs every worker progress line (item 1). `installBackendConsoleTimestamps` (`instrumentation.ts:7`, `lib/logging/backendConsole.ts`) patches `console.*` once at startup; the patch is cheap next to the write volume.

**Effort.** Small.

**Risk.** Low for dropping status and progress logs to debug. The `[client]` line is inside `lib/auth.ts`.

**Proposal.** Log `[sync-status]` on state transitions (queued → running → done/failed), not on every poll. Log worker progress when `percent` crosses a 10-point boundary. Sample or drop `[client]` for attachment and version paths.

**Files.** `[client]`: `lib/auth.ts` (overlap: team-auth). Status line: `app/api/_helpers/syncJobs.ts` (overlap: team-auth and thread-collaboration, both name `_helpers`). Progress line: `lib/syncJobs.ts` (overlap: mailbox-watcher).

**Tag.** Not ready. No slice avoids those files.

### 9. Memoize the per-call work in `getAccountDb`

**Impact.** Small per call, on every API call including images. The `Database` itself is process-cached per shard path (`lib/db/connection.ts:219–228`), WAL, `busy_timeout` 15000, idle close default 5 minutes. Every `getAccountDb` still does:

- `resolveAccountDbPath`: `SELECT id, dbPath FROM accounts` on the master (`connection.ts:203–216`)
- schema ensures, which short-circuit in memory after the first call
- `ensureThreadSignalRuntimeData`: `SELECT 1 FROM thread_signals` (`lib/db/threads.ts:144–148`)
- `ensureThreadLatestReceivedDateValues`: `SELECT 1 ... WHERE latestReceivedDateValue IS NULL LIMIT 1` (`threads.ts:222–238`)
- `ensureTopicLearningRuntimeData`: `SELECT 1 FROM topic_learning_signals` (`lib/db/topics.ts:183–187`)
- `ensureCalendarEventRuntimeData` (memoized after the first call; first call loads the account)
- a deferred `import("./threads")` (memoized promise)
- `scheduleAccountDbIdleClose` (clears and resets a timer)

`mkdirSync` runs only when opening a new file. No per-request `readFileSync` of `build-version.json` or `runtime-config.js` on this path. `generateRuntimeConfig.ts` writes `public/runtime-config.js` at startup. `markdownEmail`'s `readFileSync` is module-load once.

Bun's `Database.prepare()` does not cache the statement. `Database.query()` does (default 20 entries, statements over 64 KB are not cached). Hot list SQL is dynamic (`IN` lists, optional filters), so a 20-slot cache would churn if those strings were cached. The three `SELECT 1` probes above are stable and are the ones worth `query()`.

Decrypting the account on every `requireAccountContext` is not a latency item: unseal 0.008 ms, key hash 0.003 ms, and `decodeSecret` runs two to four times per full account load (`lib/db/rowParsers.ts` `mapAccountRow`). `getKey()` hashes on every call (`lib/secret.ts:28–34`). Caching the key buffer and the decoded account row is hygiene, not a user-visible win. `feat/team-auth` rewrites credential storage; `lib/secret.ts` and `lib/db/accounts.ts` are not in its file list, but a cache of decoded secrets will collide with that design. Leave both alone.

**Effort.** Small for the probe memo. Tiny for `db.query` on the three stable probes.

**Risk.** Low if the memo key is `(dbPath, accountId)` and any writer that can invalidate the backfill clears it. The `SELECT 1` exists so a process that opened the DB before a backfill still backfills. A memo that sticks after a true "no rows yet" result would skip a later backfill. Memo only the "already populated" result, and clear it in the message-upsert path if that path can be the first writer. Resetting the idle timer can stay.

**Proposal.**

```ts
const probesDone = new Set<string>();
export async function getAccountDb(accountId: string) {
  const dbPath = await resolveCachedAccountDbPath(accountId); // memo until accounts row changes
  const db = openCached(dbPath);
  ensureSchemasOnce(db); // already mostly memoized
  if (!probesDone.has(dbPath)) {
    await runRuntimeProbes(db, accountId); // existing SELECT 1s, via db.query()
    if (probesReportHealthy(db, accountId)) probesDone.add(dbPath);
  }
  scheduleAccountDbIdleClose(dbPath);
  return db;
}
```

`resolveCachedAccountDbPath` is a `Map<accountId, path>` filled by the existing master `SELECT`. Account create/move deletes the entry.

**Files.** `lib/db/connection.ts`, `lib/db/threads.ts` (`ensureThreadSignalRuntimeData`, `ensureThreadLatestReceivedDateValues`), `lib/db/topics.ts` (`ensureTopicLearningRuntimeData`).

**Tag.** ready. Do not touch `lib/auth.ts`, `lib/credentials.ts`, `lib/secret.ts`, or `app/api/_helpers/**` for this item.

### 10. Keep `build-version.json` in memory

**Impact.** Tiny. `GET /api/version` `readFile`s `public/build-version.json` on every poll (`app/api/version/route.ts`, `force-dynamic`, `Cache-Control: no-store`). The client polls every 60s (`BUILD_VERSION_POLL_INTERVAL_MS`) plus focus and visibility. The page itself uses `getBuildVersionLabel()` from the environment, not this file. The read is async. Two users, so a few reads a minute.

**Effort.** Tiny.

**Risk.** Low. A deploy restarts the process, which drops the cache. A rewritten file without a restart would be invisible until restart; that matches how the standalone server already works.

**Proposal.** Read once into a module variable. Keep `no-store` so a proxy does not pin the old version. The route is not session-gated; that is a separate note, not a perf change.

**Files.** `app/api/version/route.ts`.

**Tag.** ready.

### 11. Static file headers, keep-alive, compression

**Impact.** Low on this deployment (localhost, two users, one long-lived SSE socket).

`_next/static` in the standalone server is already `Cache-Control: public, max-age=31536000, immutable` (Next router server, `nextStaticFolder`). Files in `public/` do not get that header. `public/runtime-config.js`, `public/sw.js`, and `public/build-version.json` must stay revalidated. Fonts and icons under `public/` can take a long cache via `headers()` in `next.config.ts`. There is no `headers()` today.

`next start` passes `keepAliveTimeout` only when the CLI flag is set (`node_modules/next` `start-server.js`). Production is `exec bun --bun server.js` (`Dockerfile`, `deploy-scripts/container-entrypoint.sh`, `doc/DEPLOYMENT.md`). Node's default is about 5 seconds. Not verified under Bun. SSE already holds its socket. Raising keep-alive only helps the short API calls if Bun honors the same flag on `server.js`. Check the standalone server's `--help` before picking a number. A wrong flag makes the process fail at boot.

JSON compression is already the Next default (`compress: true`, threshold 1 KB, `Vary: Accept-Encoding`). `generateEtags` applies to static files served by `send`, not to App Router route handlers. Do not add a compress toggle. Do not turn ETags on at the framework layer expecting route handlers to grow them; set them on the attachment and source responses (item 4).

`images.qualities: [75, 85]` (`next.config.ts:28–30`) affects `next/image` only. Mail images are attachment URLs. Next 16 changed `images.minimumCacheTTL` from 60s to 4 hours; that default does not apply here.

**Effort.** Tiny for `headers()` on font and icon paths. Small to confirm keep-alive, and only then to pass it.

**Risk.** Low for font caching. Medium for a long cache on `sw.js` or `runtime-config.js` (stale client config). Medium for a keep-alive flag the standalone binary does not accept.

**Proposal.**

```ts
async headers() {
  return [
    { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    { source: "/icons/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] }
  ];
}
```

Match the real directories under `public/` before adding the rule. Leave `runtime-config.js`, `sw.js`, and `build-version.json` on the default revalidate path.

**Files.** `next.config.ts`.

**Tag.** ready.

## Studied, leave alone

**Session and credential crypto.** Unseal 0.008 ms, key hash 0.003 ms. `IMAP_CREDENTIALS_STORAGE` is parsed once at module load. `requireAccountContext` is session unseal + string compare of `accountId` + `getAccountById` (`SELECT *` and `decodeSecret`). Caching the decoded account would save a master `SELECT` and a few decodes. It is not on the list because team-auth is about to change credential storage, and the measured cost is noise next to SQLite and IMAP.

**In-process sync, or a `bun:sqlite` handle passed to a Worker.** Parse blocks the event loop (`categories.ts:460`). One `Database` per process, WAL already on. Item 1 is the shape that keeps crash containment.

**`immutable` on attachment URLs.** Ids are UID + part index (`parser.ts:201`), and resync can overwrite the file.

**Pre-sanitized HTML stored at sync.** The client re-sanitizes (`HtmlMessage.tsx:379`). A stored copy without a sanitizer version goes stale when the allowlist changes, and the write path is `lib/mail/imap/**`.

**Next experimental flags.** Nothing in the 16.2–16.3 line helps this API.

- Next 16 blog (`https://nextjs.org/blog/next-16`): `cacheComponents` replaces `experimental.ppr` and `experimental.dynamicIO`. These routes are per-user SQLite reads. Caching a mailbox list serves stale mail. Leave `cacheComponents` off.
- `experimental.turbopackFileSystemCacheForDev` is dev-only.
- `reactCompiler` memos client components and slows builds. It does not change API latency. Item 5 is a direct memo of one function.
- `experimental.adapterPath` moved to stable `adapterPath` (build adapters).
- `gh api repos/vercel/next.js/releases/tags/v16.2.4` body has no match for experimental, cache, compress, route handler, keep-alive, or serverExternal. v16.2.0 and v16.3.0 flags that do match are dev, router, prefetch, turbopack, or image optimization: `cachedNavigations`, optimistic routing (default in 16.3 when `cacheComponents` is on), `prefetchInlining`, `varyParams` (default on in 16.3), `strictRouteTypes`, `--experimental-cpu-prof`, `immutableAssetToken`, image-optimizer cache, server-components HMR cancellation, turbopack HMR for route handlers, `experimental.unstableIO`. Installed app is `next@16.2.4` (`package.json`; `packageManager` in that file is `bun@1.3.12`, the runtime used here is Bun 1.4.4). Later tags exist through v16.4.2. None of them is a reason to upgrade for route-handler latency.

**`serverExternalPackages`.** `next.config.ts:36` externalizes `rrule`, `imapflow`, `mailparser`, `nodemailer`, `html-to-text`, `sanitize-html` so the worker can import them at runtime, and so the standalone tracer copies `sanitize-html`. `outputFileTracingIncludes` copies the worker TS graph (`build-scripts/workerRuntimeTraceFiles.ts`) plus sanitize-html's deps into the sync route, and the worker graph into the recompute routes. The server bundle does not include that graph; each worker process transpiles the TS again. That cost is item 1. Narrowing `serverExternalPackages` would break the worker's runtime import. The app must run on Bun: `lib/db/connection.ts` throws unless `bun:sqlite` is present. `package.json` `start` is `bun --bun next start`. Production is `bun --bun server.js`.

**IMAP pool vs stream vs sync.** The pool is a single idle slot per account, 60s idle, 10 min max age, on `globalThis`. Poll and parent-process mutations use it (`imap/poll` acquires it). `/imap/stream` opens its own ImapFlow connections, up to `maxIdleSessions` 3, and does not use the pool. Sync workers drain the pool on exit, so they never reuse the parent's slot. Reworking the stream is mailbox-watcher's change. Item 1 is how sync stops logging in per job.

**`getMessageById` `LIKE` fallback** (`lib/db/messages/retrieval.ts`, `SELECT *` including body and htmlBody, `LIKE %trimmed%` on `messageId`). Not the list path. The file is overlap: thread-collaboration.

**Double account lookup** (`getAccountById` then `getAccountEmail` inside `listThreads`). Cheap after item 9. The signature change is in `query.ts` (overlap: thread-collaboration).

## What a request pays today

`GET /threads`, `GET /messages`, folder list, search, drafts, categories, sync start, attachment, source:

1. `rejectOverlongSearchQuery` on list/search only, before auth.
2. `requireAccountContext`: unseal session, compare account id, `getAccountById` (decrypt), `[client]` log if the header is set.
3. `getAccountDb`: cached connection + the probes in item 9.
4. The handler query. Thread list adds suggestion N+1 (item 2) and group-count scan (item 3).
5. `NextResponse.json`. Compression is Next's default when the body is JSON and at least 1 KB.

Attachment GET uses session auth rather than a full account decrypt, then the same `getAccountDb` probes, then the file. No cache headers (item 4).

No synchronous `fs` read sits on the list or message path. The version route's `readFile` is the exception (item 10).

## Suggested order

Ready, in the order they pay off for the two users: item 2 (suggestion batch), item 4 (image cache), item 3 cap + slim, item 5 (sanitize memo), item 7 (draft skip-fetch, stop if it needs IMAP code), item 9 (db probes), then 10 and 11.

After mailbox-watcher lands: item 1 (resident worker), then item 6 (lighter parse). Item 8 waits on whoever owns `lib/auth.ts` and `_helpers`.
