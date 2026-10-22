# perf-server-quickwins

Branch `chore/perf-server-quickwins` in `/home/monkey/code/noctua-mail/wt-perf-server`, based on team-inbox `a1f4c633d5cb49f3f5cf9b2cac122e5671e61ca7`. Six items landed. Nothing was pushed.

## Summary

Thread-list topic suggestions are one batched query per page instead of one query per thread. Attachment bytes now send `Cache-Control: private, max-age=86400` and a quoted mtime/size ETag, and answer `If-None-Match` with 304. The thread-list route caps `pageSize` at 600 and drops empty fields the cards do not read. `HtmlMessage` memoizes `sanitizeHtmlForDisplay`. Draft autosave stores the appended RFC822 locally and skips the follow-up IMAP FETCH when the parsed headers match the payload. `getAccountDb` skips the one-shot data probes once an account shard is settled.

`lib/db/messages/query.ts` was not edited. The group-count scan and a one-row-per-thread list query stay deferred.

## Per-item

### 2. Batch topic suggestions

`getTopicSuggestionsForThreads` now calls `getTopicSuggestionsForThreadSignalBatch`. Unique `(signalType, signalValue)` pairs go through one `IN ((?, ?), ...)` query per chunk of 400 (`TOPIC_SUGGESTION_SIGNAL_PAIR_BATCH`). Aggregation stays in JS: a requesting thread excludes learning rows whose `threadId` equals that request's `signals.threadId`, `suggestionScore` is the max per-thread score, `matchCount` is the number of learning threads, and names sort with `Buffer.compare` UTF-8 (SQLite binary collation). The map still omits threads with no suggestions. `getTopicSuggestionsForSignals` is unchanged and still serves the single-thread APIs.

Same synthetic bench as the runtime brief (`/tmp/perf-suggest-bench.ts`: 40 history threads, 8 topics, 300 target threads sharing a GitLab sender and 8 list-id buckets). The counter wraps `Database.prototype.prepare` and counts SQL containing `FROM topic_learning_signals`.

| | learning queries | elapsed | threads with suggestions | sample |
| --- | --- | --- | --- | --- |
| Before | 301 | 64.68 ms | 300 | score 9, "Project 0", matchCount 5 |
| After | 1 | 26.99 ms | 300 | score 9, "Project 0", matchCount 5 |

The query count is the stable result. Elapsed time also dropped on this box; load was high, so the millisecond gap is not a lab measurement.

Tests added in `lib/topicSuggestions.test.ts`: batched scores, self-exclusion, and name order match the per-thread function; a page with more than 400 signal pairs stays equivalent across the chunk boundary.

Commit `c93e5bb259fa69f6470125b2ed14f7657b8319d8`.

### 4. Attachment cache headers

`statAttachmentData` stats the same candidate files `getAttachmentData` reads. The byte response sets `Cache-Control: private, max-age=86400` and `ETag: "<mtimeMs hex>-<size hex>"`. `If-None-Match` uses weak comparison (exact tag, comma-separated list, and a `W/` prefix). A match returns 304 before the body is read, and again after an extract-and-save if the written file's tag matches. The `?preview=1` HTML shell is `Cache-Control: no-store` and has no ETag. 404 JSON is not given the long cache. The message source route was left alone.

No millisecond before/after. The runtime brief measured this as a missing header, not a timer. The route test checks the header, a 304 for the same tag and for `W/"stale", <etag>`, a 200 for a different tag, a changed tag after an overwrite, an uncacheable preview shell, and an uncacheable 404.

Commit `7005c09bd60e13b6cf234e059ee523b9977a432d`.

### 3. Cap pageSize and slim the thread list

Only `app/api/accounts/[accountId]/threads/route.ts`. `clampThreadListPageSize` uses `Number(raw ?? "300") || 300`, then returns 300 when the value is not finite, otherwise `Math.max(1, Math.min(600, Math.trunc(requested)))`. So a missing, zero, or non-numeric value stays 300, `100000` becomes 600, and a negative value becomes 1.

`slimThreadListItem` runs after `enrichMessagesWithThreadTopics` (`includeSuggestions` stays true). It deletes `body` when it is `""`, `categoryScore`, `categorySignals`, empty `attachments`, and empty `calendarInviteStates`. It keeps `calendarEventUids`, `category`, flags, addresses, `parentId`, `replyTo`, `topics`, and `topicSuggestions`.

Topics stay on each message. There is no thread-level topic payload, and the open view reads suggestions off the list item. `needsMessageContentHydration` is false for synced mail that has a source and an empty body, so a later GET does not refill suggestions that the list dropped.

`lib/db/messages/query.ts` was not edited (owned by `feat/thread-collaboration`). The group-count scan and a one-row-per-thread SELECT stay deferred. No payload-byte measurement: the runtime brief did not time this route.

Tests: the pure clamp covers null, 300, 600, 100000, 0, -4, and a non-numeric string. The route test seeds two threads, requests `pageSize=-1` (SQLite treats a negative LIMIT as unlimited), and expects one item, `hasMore: true`, the dropped fields absent, and topics, suggestions, category, and `calendarEventUids` still present.

Commit `477f3b5c0245b16bf4e9f019a4c233afe181d745`.

### 5. Memoize sanitized HTML

`HtmlMessage` computes `safeHtml` with `useMemo(() => sanitizeHtml(cleanedHtml), [cleanedHtml, sanitizeHtml])`. `cleanedHtml` is `stripConditionalComments` of the input. `sanitizeHtml` defaults to `sanitizeHtmlForDisplay` and is a prop so the DOM test can count calls without `mock.module`. `buildPreviewDocument` takes that string and no longer sanitizes. Dark mode, font scale, and zoom still rebuild the srcdoc wrapper. The sanitizer has no per-call options, so the key is the cleaned HTML plus the function identity.

The DOM test renders once, rerenders with different `darkMode`, `fontScale`, and `zoom` without a second sanitize, then renders new HTML and expects one more call.

`sanitizeHtmlForDisplay` itself is not faster. A similar table (53,760 chars; the runtime brief used 53,806 of a different fixture), one warmup, then 8 calls: 195.81 ms total, 24.48 ms per call. That does not beat or confirm the brief's 61.32 ms figure. The memo removes the repeat when the wrapper changes. The first open still pays the full sanitize. Calendar snapshot components were not changed.

Not checked in a browser. The sanitized string and the wrapper markup are the same function outputs as before; the DOM test covers the call count. No dev server was started.

Commit `628043bf9c9ee4161cf808eed2d477cdbad1fe91`.

### 7. Draft autosave without the follow-up FETCH

Implemented in `lib/drafts.ts` only. After append, `messageFromAppendedDraft` parses the RFC822 with `parseMailForCategorization` and builds the local `Message` (row id, `\Draft` + `\Seen`, source, attachment bytes with `att-${accountId}-${uid}-${index}` ids). It returns null, and `saveDraftForAccount` falls back to `syncImapMessage`, when parsing throws, the message id is missing, a preserved message id disagrees, `inReplyTo` disagrees, or `references` are not an exact match. Threading, sanitizing, and the existing compose-format / quoted-html / invite updates still run.

`lib/mail/imap/**` and `lib/syncOperation.ts` were not edited. The local row does not reproduce the IMAP parser's category or `calendarEventUids`. Invite metadata still comes from the save payload.

No IMAP timing. The new test feeds a real RFC822 (`Message-ID`, `In-Reply-To`, `References`, `X-Forwarded-Message-Id`) and asserts `syncImapMessage` is not called and the stored id, reply headers, uid, flags, and source match. The older tests still pass a non-RFC822 mock raw (`raw:${subject}`), so they still take the FETCH fallback, including the preserved Message-ID overwrite.

Commit `c48898966ddcfa091f87499b5f9dbc0974ac8590`.

### 9. Skip settled account-db probes

Inside `lib/db/connection.ts` only. Schema ensures and `ensureCalendarEventRuntimeData` still run on every `getAccountDb`. The deferred thread-signal backfill, the received-date backfill, and `ensureTopicLearningRuntimeData` run only while the probe key `${dbPath}\0${accountId}` is unsettled.

Settled means: at least one message, at least one `thread_signals` row, no thread with `latestReceivedDateValue IS NULL`, and, when `thread_topics` rows exist, at least one `topic_learning_signals` row. An empty account is not settled, so the first messages still get the backfill. Messages that produce zero signals do not settle the memo. The health check uses `db.query`, which the prepare-counter does not see.

The account db path is cached only after the account row exists. Both caches are cleared from `cleanupAccountLifecycleArtifacts`, not on idle close.

Same bench as before (`/tmp/perf-db-probe-bench.ts`): one message upsert, then 40 `getAccountDb` calls. The counter wraps `prepare`.

| | probe prepares | path prepares | elapsed |
| --- | --- | --- | --- |
| Before | 120 | 40 | 7.01 ms |
| After | 0 | 0 | 0.40 ms |

Upsert's thread recompute calls `getAccountDb` after the message exists, so the timed 40 calls are already settled. Tests: an empty `getAccountDb` does not settle; a raw message plus a NULL `latestReceivedDateValue` is backfilled on the next call; two further calls issue no probe SQL; a resolved account does not re-read `accounts.dbPath`.

Commit `6692c322278239f0d03ed9ea141741c3b20fc70d`.

## Skipped items and why

The task said to skip these even where the runtime brief marks them ready.

| Item | Why |
| --- | --- |
| 1. Resident sync worker | Overlaps `feat/mailbox-watcher` (`lib/mail/imap/**`, `lib/syncOperation.ts`). |
| 6. Lighter message parse | Same overlap. Not ready in the runtime brief. |
| 8. Session auth log / helper cost | Touches `lib/auth.ts` and `app/api/_helpers/**`. |
| 10. In-memory `build-version.json` | Brief marks it ready. The task said to skip it. |
| 11. `Cache-Control` for `public/fonts` and `public/icons` | Brief marks it ready. The task said to skip it. `next.config.ts` was not edited. |

Also left undone inside landed items: message-source response caching (item 4 is the attachment byte response), SQL slimming of the thread list (item 3 stops at the route), and memoizing the calendar snapshot sanitizer calls (item 5 names `HtmlMessage`).

## Verification

All commands from `/home/monkey/code/noctua-mail/wt-perf-server`, prefixed with `nice -n 10`. `bun run build` was not run. No dev server was started.

| Command | Result |
| --- | --- |
| `bun test lib/topicSuggestions.test.ts` and the new route, drafts, and probe tests | 31 pass, 0 fail |
| `bun test --config=bunfig.dom.toml app/components/HtmlMessage.memo.dom.test.tsx` | 1 pass, 0 fail |
| `bun test lib/drafts.test.ts` (after the final attachment-type annotation) | 5 pass, 0 fail |
| `bun run test:ci` (committed tree) | 1708 pass, 0 fail (199 files, 4280 expect); DOM 49 pass, 0 fail (9 files) |
| `bunx tsc --noEmit \| grep -c "error TS"` | 355 |
| `bun run lint` | 1 error (`useCalendarConflicts.ts`), 27 warnings |

Baseline on this tree was 1698 unit + 48 DOM, 355 TypeScript errors, and the same lint result. The new tests are the +10 unit and +1 DOM. The four new test files carry a `@ts-expect-error` on the `bun:test` import so they do not add another copy of the pre-existing "cannot find module bun:test" error. Lint exits 1 because of that pre-existing `useCalendarConflicts.ts` error.

## Risks

- Attachment ids are `att-${accountId}-${uid}-${part}` and are reused when a resync overwrites bytes. The cache is private and revalidated, not immutable. A rewrite that keeps the same size and the same `mtimeMs` would keep the same ETag.
- The thread list still sends `topics` and `topicSuggestions` on every message. Clients that read `attachments` or `calendarInviteStates` already use `?? []`. `pageSize` above 600 is now 600.
- The draft local path skips IMAP category classification and `calendarEventUids`. A header mismatch falls back to FETCH. A parser that rewrites `Message-ID`, `In-Reply-To`, or `References` would take that fallback and pay the old round trip.
- Once probes are settled, a later raw insert of a NULL `latestReceivedDateValue`, or `thread_topics` without learning rows, is not backfilled until account cleanup. The normal upsert, thread recompute, and topic writers maintain those rows. Idle close does not drop the memo. A `dbPath` change that skips `cleanupAccountLifecycleArtifacts` keeps the cached path for the process lifetime. Empty accounts stay unsettled on purpose.
- The HTML memo is keyed on the cleaned string. Two different messages with the same HTML share one sanitized result, which is what the sanitizer would have returned anyway. Theme and zoom do not change that string.

## Files touched

- `lib/topics/suggestions.ts`
- `lib/topicSuggestions.test.ts`
- `lib/storage.ts`
- `app/api/accounts/[accountId]/messages/[messageId]/attachments/[attachmentId]/route.ts`
- `app/api/accounts/[accountId]/messages/[messageId]/attachments/[attachmentId]/route.test.ts`
- `app/api/accounts/[accountId]/threads/route.ts`
- `app/api/accounts/[accountId]/threads/route.test.ts`
- `app/components/HtmlMessage.tsx`
- `app/components/HtmlMessage.memo.dom.test.tsx`
- `lib/drafts.ts`
- `lib/drafts.test.ts`
- `lib/db/connection.ts`
- `lib/db/accountDbProbes.test.ts`
