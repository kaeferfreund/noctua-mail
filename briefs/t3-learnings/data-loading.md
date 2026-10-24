# T3 Code learnings: data loading

Research date: 2026-10-23. Read-only inspection of T3 checkout `research/t3code` at `5bb54a0f77c6655fdb2ab551612ca1ca1fcd3667` and Noctua reference `wt-integration-dryrun` at `34dd18e5`. No application code was run, installed or built. Measurements below are attributed to upstream PR authors; none were reproduced here. Noctua gains are hypotheses, not measured results.

## Relevant commits and PRs

The older orchestration implementation provides useful history; current code uses orchestration V2. A historical limit or result is not automatically the current implementation. PR descriptions were checked alongside diffs; caveats in later measurement updates take precedence over PR titles.

| Commit | PR | Relevant change and evidence |
|---|---|---|
| `6b73b3defe` | [#5493](https://github.com/pingdotgg/t3code/pull/5493) | Historical user-turn pagination: recent 10 user turns, older pages of 20, opaque exclusive cursors. One large thread's initial JSON fell from 8.4 MB to 1.0 MB. Cache versioning and stale-page rejection were part of the change. |
| `ca72e381c6` | [#5147](https://github.com/pingdotgg/t3code/pull/5147) | Bound stale-cursor catch-up and use a fresh snapshot beyond the limit; stop hydrating the whole database to obtain one thread. Prevents unbounded decode/allocation, not a published UI benchmark. |
| `7e460f429b` | [#8992](https://github.com/pingdotgg/t3code/pull/8992) | Add serialized-byte preflight to replay eligibility, alongside event count; historical budget 8 MiB. A small number of huge tool events could otherwise exhaust memory before delivery. |
| `50bfca43d7` | [#9726](https://github.com/pingdotgg/t3code/pull/9726) | Query the selected thread's indexed event range instead of decoding global events then filtering. Event-store benchmark: 600 → 6 decoded events, median replay 21.6 → 0.9 ms. |
| `3da315e7b5` | [#5482](https://github.com/pingdotgg/t3code/pull/5482) | Project tool results into UI fields/summaries while preserving full persistence. Useful separation of stored detail and list/stream payload; no timing claimed here. |
| `04ad17425a` | [#17029](https://github.com/pingdotgg/t3code/pull/17029) | Select/sort IDs before attaching large JSON; add partial indexes for user-message anchors and live nodes. On one 8,499-item thread: snapshot 662–870 → 264–369 ms; returned projection unchanged. |
| `42c6623d49` | [#17387](https://github.com/pingdotgg/t3code/pull/17387) | Reuse visibility lookups, hydrate only needed ancestor fields, carry rowids, order IDs before bodies, avoid redundant budget encoding. Frozen-database response-preparation medians: 395.6 → 303.5 ms and 176.6 → 140.4 ms; shorter thread unchanged. This excludes network/rendering. |
| `d0a73b56c2` | [#19423](https://github.com/pingdotgg/t3code/pull/19423) | Treat qualifying notification starts as pagination boundaries, so automated threads also stay bounded. Synthetic wake-heavy first response: 30.4 MB → 118 KB, 0.86–0.96 s → 13–27 ms. Not a general thread benchmark. |
| `b437ec1ab2` | [#20064](https://github.com/pingdotgg/t3code/pull/20064) | Use retained text length as a conservative overflow proof before full JSON encoding; retain exact-size fallback. Final PR explicitly omits older timings; no current end-to-end performance measurement. |
| `28f5516a9a` | [#15385](https://github.com/pingdotgg/t3code/pull/15385) | Opt-in wire compaction sends duplicate local turn items once, then restores the internal shape. Synthetic raw JSON −23–46%; compression benefit varies, including one Brotli regression. Native simulator follow-up is preliminary. |
| `12069eefd7` | [#10439](https://github.com/pingdotgg/t3code/pull/10439) | Search canonical history server-side; return counts/identities and page to offscreen matches. Cached navigation measured 0.09–0.49 ms versus 28–30 ms; first scan 355 ms. These are server timings. |
| `f3bb914efb` | [#20801](https://github.com/pingdotgg/t3code/pull/20801) | Parsed-text cache 512 → 8,192 entries avoids sequential-scan cache thrashing. On 2,000–2,700-message threads, subsequent typing calls roughly 600–760 → 100–110 ms. First query unchanged; measured extra heap 4–9 MB. |
| `765e1b5fc0` | [#4006](https://github.com/pingdotgg/t3code/pull/4006) | Avoid encoding/persisting active thread snapshots during streaming, including teardown. Prior affected writes encoded about 78 MiB each; no matching UI latency measurement. |
| `e2b929f10a` | [#19915](https://github.com/pingdotgg/t3code/pull/19915) | Cache immutable shell-row encodings and yield between chunks. Chrome, 1,417 threads: save after one row changed 791 → 11 ms UI-thread work; identical output. Extra encoded-row memory is a tradeoff. |
| `3b2ebcee2f` | [#18890](https://github.com/pingdotgg/t3code/pull/18890) | Patch timestamp with SQL `json_set` instead of decoding/re-encoding the thread row on every streamed event. Synthetic in-process 5,000-event runs about one-third faster; not disk/network evidence. |
| `c2283ce146` | [#9152](https://github.com/pingdotgg/t3code/pull/9152) | Incremental projection update and ordered activity append with duplicate/out-of-order fallback. Reducer benchmark: 10,000 appends 1,180 → 70 ms. Historical reducer, not a claim that all current updates are O(1). |
| `0e40614ad5` | [#19626](https://github.com/pingdotgg/t3code/pull/19626) | Coalesce ACP full-text updates into ~50 ms snapshots; first text immediate, final text flushed. Synthetic 5,000-chunk burst: 15,006 → 17 adapter events. Database/socket savings were not measured. |
| `15eda897d3` | [#9760](https://github.com/pingdotgg/t3code/pull/9760) | Acquire image URLs for mounted rows instead of all loaded history. Real-atom proof: initial requests 300/3,000 → 15. Newly mounted rows may wait; no browser/device benchmark. |
| `c7e3993fe9` | [#23751](https://github.com/pingdotgg/t3code/pull/23751) | Partial interrupt index and grouped shell counts. Historical affected-data count query 3.018 → 0.236 s; final synthetic takeover did **not** show overall snapshot/subscription improvement. Transfer the query-plan technique, not the headline gain. |

## What T3 actually loads

- **List versus detail:** environment shell state contains thread summaries, not every conversation. Thread detail is a separate keyed state/subscription. Persistent web thread entries are keyed by environment + thread, schema-versioned and validated on load (`apps/web/src/connection/storage.ts:802`).
- **Cold open:** shared client state asks the bounded HTTP loader for the selected thread, installs projection + history metadata atomically, then subscribes with its sequence. A generic missing bounded route can fall back to the older full route; a structured missing-thread response terminates the load. See `packages/client-runtime/src/state/boundedThreadSnapshotHttp.ts` and `threads.ts:768`.
- **Warm switch:** retain committed in-memory detail for five minutes while releasing the live state immediately when unused; a visit can seed from that retained state or persistent cache and request catch-up. Cached content is distinguished from synchronizing/live content. This is cache reuse, not evidence of hover prefetch (`threads.ts:900`, `threadRetention.ts`).
- **History:** current V2 defaults are 10 user turns, 20 for older pages, a 150-raw-turn ceiling, and a nominal 75-item/1 MiB policy. Ordinary conversation turns are kept whole; item/byte limits mainly govern turnless history, and `payloadBudgetExceeded` can be true. **The 1 MiB policy is not a universal hard response cap.** Active control dependencies also survive windowing (`apps/server/src/orchestration-v2/threadHistoryPaging.ts:9`).
- **Resume/live:** current V2 checks thread-scoped raw bytes before decoding, then encoded replay bytes and event count; the replay policy is 128 events / 1 MiB. Unsafe or invalid resume falls back to a snapshot. A captured high-water mark and live tail avoid the read-to-subscribe gap (`ThreadStream.ts:14`, `apps/server/src/ws.ts:901`).
- **Delta qualification:** events update individual entities rather than resending the whole conversation. However, `turn-item.updated` carries a replacement item, potentially including its entire current text. #19626 explicitly reduces repeated full-text production; this is not a universal text-diff protocol (`WireProjection.ts:239`, `orchestrationV2Projection.ts:316`).
- **Client incrementality:** preserve unchanged row identity, batch fresh events, reject duplicate sequences and obsolete history completions. Older-page merges do not become the live cursor. Expanded history is kept out of monolithic persistent snapshots; active runs are persisted when settled (`threads.ts:111`, `:445`, `:619`).
- **Search:** canonical server search can find unloaded messages; result navigation is revision-cached and response bodies are omitted. Parsed displayed-text segments are cached independently of each query. Current caches separate normal texts (8,192 entries) from >32,768-character texts (32 entries), TTL one minute; eight query scans are revision-validated (`ThreadFind.ts:267`). This still scans/decodes on cache misses; it is not an FTS index.
- **Prefetch:** no general neighboring-thread or hover-history prefetch was found in the inspected client-runtime/web paths. The concrete upstream direction is less eager detail/image loading. Do not cite T3 as evidence for speculative mailbox prefetch.

## Noctua baseline and overlaps

All Noctua file references below are under `/home/monkey/code/noctua-mail/wt-integration-dryrun/`.

- `/threads` already pages 300 threads by default, max 600 (`app/api/accounts/[accountId]/threads/route.ts:17`). The client requests 300 in folder scope / 600 across folders (`app/components/mailclient/messageListQueryUrl.ts:49`). SQL then expands the selected threads into **all matching message headers**, so a page is not bounded to 300 messages (`lib/db/messages/query.ts:2995`). Its main list query already omits bodies.
- `/thread/related` is shared by list completion and reader content. `listThreadMessages` has no output paging, selects `m.*`, loads attachments/calendar data for all selected messages, and returns both `body` and `htmlBody` (`lib/db/messages/query.ts:3179`, `:3219`, `:3333`). The 400-ID batching is a SQLite parameter limit workaround, **not** a response-size bound.
- The list completion effect requests whole related threads and only then filters out current-folder/excluded rows in the browser (`app/components/MailClient.tsx:4462`). The reader also requests that endpoint for its whole active thread (`:4632`). Thus body work can occur before the user opens those messages.
- An in-memory thread cache already exists, limited to **50 threads**, with hydration request sharing and targeted flag/message updates (`app/components/mailclient/constants.ts:23`, `useThreadContent.ts:59`, `utils/threadContentCache.ts:18`). It has no byte limit or partial-window contract; account switches clear it (`MailClient.tsx:4926`).
- Do not re-propose the already shipped parallel account/folder switch or superseded list-load aborts (`useAccountController.ts:266`, `useMessageData.ts:93`). Dedup tracks first page in the switch, deferred secondary reads, list query/render work, compression measurement, stale fetch measurement and parked payload slimming. Deep-link work already owns location restoration and latest-navigation semantics.

## Transferable ideas, ranked by likely gain versus implementation risk

### 1. Separate related-message headers from body hydration

- **Technique / T3:** distinct summary/detail projections, wire field selection and demand-loaded resources (#5482, #15385, #9760).
- **Noctua location / fact:** `app/api/accounts/[accountId]/thread/related/route.ts:45`, `lib/db/messages/query.ts:3219`, `app/components/MailClient.tsx:4462`. List completion currently receives full bodies/HTML and discards some returned messages afterwards.
- **Change:** give list completion a metadata-only projection, push its folder exclusions into the read, preserve parent/reference/flag/topic/collaboration fields needed by the tree; reserve content reads for reader expansion. Keep the existing full-detail path for callers requiring it.
- **Expected gain:** high for HTML-heavy mailboxes: remove unused body bytes, associated JSON parsing and retained strings from mailbox switch/list completion. Benefit is proportional to currently transferred hidden bodies; no defensible percentage yet.
- **Risk:** medium; the endpoint also serves the reader and other callers. Dropping fields blindly can break threading, invites, reply/forward or topic suggestions. Never replace full email contents with lossy tool-style summaries.
- **Overlap:** **switch work**, dedup H/K (K is parked/audit-gated); hand this concrete endpoint finding to those owners rather than start a duplicate slimming branch.
- **Verify:** synthetic 300-thread mailbox with large HTML and cross-folder replies; compare raw/compressed bytes, server time, parse time and first rows. Assert list JSON has no bodies, forest membership is identical, and reader/reply/forward still obtain complete contents.

### 2. Page conversation metadata around the selected message; load expanded bodies separately

- **Technique / T3:** anchored windows and exclusive older cursors (#5493); fix boundary types that accidentally defeat windowing (#19423); late payload reads (#17029).
- **Noctua location / fact:** `app/components/MailClient.tsx:4521`, `app/api/accounts/[accountId]/thread/related/route.ts:17`, `lib/db/messages/query.ts:3234`. Opening a long conversation has no response limit and enriches every related message.
- **Change:** an initial bounded header window containing the selected message plus relevant recent context, opaque stable cursor(s), total/hasMore metadata; fetch each body on expand. Older-message deep links need an anchor window, not mandatory page-by-page traversal from the newest message. Include parent placeholders when the tree crosses a window.
- **Expected gain:** high on long conversations; initial body transfer can approach one selected message instead of the sum of all thread bodies. Metadata/attachment enrichment becomes proportional to the window.
- **Risk:** medium–high: stable ordering, moved/deleted messages, threading recomputation and append races. Budget headers by bytes as well as count. A single oversized mail remains available intact via its separate detail response, never silently truncated.
- **Overlap:** **none** for reader API pagination; **deep links** for the selected anchor and restoration contract. List representative-row slimming is separately tracked under switch K.
- **Verify:** 1/100/1,000-message synthetic threads, equal dates, old-message anchors, cross-folder parents and very large HTML. Walk all cursors for exact coverage/no duplicates; concurrent arrivals/deletes must not resurrect rows. Compare click-to-selected-body and heap on desktop and 390 px.

### 3. Keep normal body reads separate from IMAP repair

- **Technique / T3:** bounded local detail first, optional older/supporting content afterwards; demand loading (#5493, #9760).
- **Noctua location / fact:** `useThreadContent.ts:172` posts `/resync` whenever the hydration helper sees a resync-capable message, before reading the local detail route. Automatic hydration invokes it only when contents are absent and `hasSource` is false (`lib/ui/messageView.ts:29`). Normal source-backed opens currently obtain content through `/thread/related`.
- **Change:** when splitting body loading, fetch the existing authorized local message detail first (`app/api/accounts/[accountId]/messages/[messageId]/route.ts:31`). Invoke repair only when the server explicitly reports missing stored content or the user requests it. Model unloaded versus genuinely missing/empty content explicitly.
- **Expected gain:** high for opens that would otherwise enter repair: avoid an IMAP-dependent operation when local contents already exist; enables #1/#2 without turning every header-only row into a resync.
- **Risk:** low–medium if storage completeness is explicit; a truly empty mail must not loop through repair. This is not evidence that every current open resyncs.
- **Overlap:** **none**; coordinate with reader pagination and existing automatic hydration throttling.
- **Verify:** stored body with/without source, legitimately empty mail, missing content, offline remote server and explicit repair. Count requests: successful local open makes no resync request; missing storage still offers repair and clear error handling.

### 4. Cancel superseded detail reads and give only the current request ownership of loading state

- **Technique / T3:** scope-owned thread state, committed resume snapshots, cursor/sequence guards for late pages (#5493; current `threads.ts:229`, `:619`).
- **Noctua location / fact:** `MailClient.tsx:4632` has no AbortSignal or selected-thread generation guard before `upsertThreadCache` / clearing the shared loading flag at `:4669`. List-related reads check the list key after parsing (`:4492`) but continue network/parse work. List page loads already abort (`useMessageData.ts:209`).
- **Change:** extend the existing list ownership pattern to detail/list-completion reads, deduplicated by account + thread/window + projection. Guard state after each await and keep per-request loading ownership; abort obsolete GETs on navigation. Aborting a client request does not guarantee server SQLite work stops.
- **Expected gain:** medium for rapid mailbox/thread switching; fewer obsolete transfers/parses and less loading-state churn, with no need for speculative prefetch.
- **Risk:** low–medium; repair POSTs may already have committed. Cancellation must not be presented as undoing server mutations.
- **Overlap:** **switch work**, dedup G (measurement); **deep links** owns navigation generation. Reuse that mechanism.
- **Verify:** delayed A → B → A responses, mailbox change during a body read, unmount, same-key concurrent consumers. Only the current reader controls its spinner/error; stale requests cannot repopulate a reset account cache.

### 5. Bound body caches by retained bytes and record partial completeness

- **Technique / T3:** explicit cursor/hasMore metadata, cache schema compatibility, skip expanded/active monolithic persistence (#5493, #4006); reuse immutable encodings if persistent list caching is later introduced (#19915).
- **Noctua location / fact:** `useThreadContent.ts:75`, `utils/threadContentCache.ts:18`, `constants.ts:23`. Fifty complete threads can retain arbitrary amounts of HTML. Coverage checks at `MailClient.tsx:4580` assume the current cache shape rather than a paged contract.
- **Change:** retain a bounded amount of body text/HTML and header windows separately; cache entries identify account, thread, projection/version, loaded message IDs, continuation and completeness. Prefer in-memory reuse within the current authorized session first. Keep revocation/logout eviction; account switching currently clears content deliberately.
- **Expected gain:** high memory predictability on phones; same-account revisits can reuse loaded selected bodies. Headers can remain warm after heavy bodies are evicted.
- **Risk:** medium: byte estimates understate JS object/DOM cost, and overly small budgets thrash. Persisted email-body caches introduce a separate privacy/storage decision and are not needed to get the in-memory benefit.
- **Overlap:** **none** for a body-byte budget; **deep links** for completeness/anchor handling. Cache encoding optimization is **backlog** unless persistent list caching is actually added.
- **Verify:** alternating small and multi-megabyte threads; retained-byte/heap plateau, hit rate and reread count. Partial windows must never count as complete; delete/recompute/auth changes invalidate appropriate entries. Capture server revision before applying late responses.

### 6. Preserve targeted SSE updates and avoid replacing the list for every change

- **Technique / T3:** entity updates, ordered append fast paths, batching and immutable identity (#9152, #18890, #19626); snapshot repair after ambiguous gaps (#5147/#9726).
- **Noctua location / fact:** already targeted flag/remove updates at `useSyncController.ts:1298` / `:1328`; user events coalesce per mailbox for 250 ms (`lib/userEvents.ts:61`), and collaboration revisions dedupe (`app/hooks/useMailboxSummaries.ts:102`). Conversely, `useMessageData.ts:306` reloads/replaces page 1 and resets pagination at `:357` when a full refresh is requested.
- **Change:** preserve these existing delta paths. Where measurements show sync bursts repeatedly call full refresh, coalesce invalidations by query key and refresh only impacted thread summaries/details, retaining unaffected rows and loaded pages. Use bounded snapshot reconciliation for unknown sort/filter/membership effects. Do not append unsorted summaries blindly.
- **Expected gain:** medium during busy shared-inbox activity: fewer repeated page payloads and fewer discarded loaded pages. Email is not token streaming; copying T3's 50 ms interval literally is unjustified.
- **Risk:** medium–high: arrivals/flags/assignment can alter filtered membership, order, group counts and folder totals. Retain current authorization and revision acceptance rules; an optimistic local patch is not authoritative membership evidence.
- **Overlap:** **switch work** already removes duplicate post-sync reloads; dedup I covers unchanged value publication (**backlog**). The remaining idea is scoped invalidation/page retention after measuring actual refresh frequency.
- **Verify:** replay identical, out-of-order and burst events into synthetic active filters; compare eventual rows/order/counts with a fresh authorized query. Count list/body requests and confirm unrelated body cache entries and unchanged row references survive.

### 7. If reconnect replay is needed, scope and budget it before decoding

- **Technique / T3:** per-aggregate event index, raw-byte/count SQL preflight, captured sequence and snapshot fallback (#8992/#9726; current V2 `ThreadStream.ts:14`).
- **Noctua location / fact:** `lib/userEvents.ts:53` sends event/data without replay IDs; `useMailboxSummaries.ts:129` reconnects by attaching the reader and overlaying events onto a fresh summary read. IMAP EventSource reconnect uses polling/repair (`useSyncController.ts:1364`). There is no durable app-event replay contract to tune today.
- **Change:** only if reconnect measurements justify a durable change feed: authorize and index it by account/thread plus sequence, inspect row count/serialized bytes before hydration, capture a high-water mark and buffer the live tail. A missed/expired/oversized range triggers a bounded fresh read, never a silently truncated replay.
- **Expected gain:** potentially medium on frequent mobile reconnects or many tabs, but **unproven for Noctua**. Current summary overlay already solves part of the snapshot/event race.
- **Risk:** high relative to immediate gains: retention, idempotence, revocation, tombstones and transactional publication become protocol responsibilities. SSE transport alone does not provide durable replay; IMAP UIDs are not global app event sequences.
- **Overlap:** **backlog**; not a prerequisite for the existing mailbox-switch work or go-live.
- **Verify:** disconnected clients, missed deletes, membership revoked while offline, future/expired cursors, few huge events, unrelated mailbox traffic. Work must scale with relevant events and converge to a fresh authorized snapshot.

### 8. Apply ID-first SQL and stable cursor ordering where paging still expands large sets

- **Technique / T3:** narrow ordered ID selection, late body join, targeted partial/covering indexes (#17029/#17387); grouped counts only after query-plan evidence (#23751).
- **Noctua location / fact:** thread list uses `LIMIT/OFFSET` at `lib/db/messages/query.ts:2829` / `:2917`, then expands all messages for those thread IDs at `:2995`; reader uses unbounded `SELECT m.*` at `:3219`. Thread sorting often lacks an explicit unique tie-breaker.
- **Change:** for #2, first select account-scoped `(dateValue, id)` header identities using the existing account/thread/date index where suitable; fetch selected payloads/enrichment afterwards. If list paging is changed to keyset, its full sort tuple must include flagged priority, selected date source and stable thread ID, with an explicit mutation/snapshot policy.
- **Expected gain:** medium on deep pages/large body rows; lower intermediate allocations and stable page boundaries. Cursor paging alone does not fix expansion of hundreds of selected threads into thousands of messages.
- **Risk:** medium: equal timestamps, flagged-first order, event/invite groupings and thread recomputation complicate cursors. SQLite optimizer behavior differs between T3's Node SQLite and Noctua's Bun SQLite; do not copy CROSS JOIN/index hints without checking the actual plan.
- **Overlap:** **switch work**, dedup C/H/K already owns list-query and payload changes; reader-window ID selection is **none**. New shard indexes require the existing stopped-backup runbook.
- **Verify:** EXPLAIN plans on synthetic shards; equal-date and flagged transitions; full paged walk with mutations. Compare bytes, selected IDs/order and query time, not just one micro-query. #23751 demonstrates why a faster subquery need not make the full response faster.

### 9. Search unloaded history without fetching/parsing every body in the browser

- **Technique / T3:** server find returns identities/counts, caches rendered-text extraction separately from query results, and pages to the chosen result (#10439/#20801).
- **Noctua location / fact:** server search already uses capped FTS candidate IDs (`lib/db/messages/query.ts:917`, `:956`), so replacing it with T3's scan would regress the architecture. Reader body/HTML transformation and display are separate (`lib/ui/messageView.ts:20`, `app/components/mailclient/message/MarkdownPanel.tsx:50`).
- **Change:** preserve server FTS when implementing bounded reader history; return a matching message identity and load its anchor window/body. If conversation-local find is later requested, reuse indexed text/canonical visible-text extraction rather than concatenate/render all unloaded HTML. Cache extraction by message content revision independently of search query, with a byte budget and a separate policy for oversized mail.
- **Expected gain:** medium for long-thread search/navigation, no benefit established for current mailbox switching. Avoids forcing complete body hydration to reveal one distant match.
- **Risk:** medium: FTS token semantics differ from exact visible-text occurrences; HTML sanitization, quoted sections, entity decoding and highlight positions must agree. An entry-count cache large enough for the scan can consume excessive memory; T3's one-minute expiry also leaves cold scans expensive.
- **Overlap:** **deep links** for target restoration; conversation-local find and parsed-text caching are **backlog**. Existing FTS is already implemented, not a new proposal.
- **Verify:** a match outside the initial window, edited/removed mail, quoted HTML, Unicode/entities and same message IDs across accounts. Network captures must show only result identities plus the selected window/body, and search results must agree before/after cache invalidation.

## Five-line summary

1. T3's strongest loading pattern is summary shell → bounded selected history → demand-loaded older/detail content, with explicit completeness and sequence metadata.
2. Noctua already paginates body-free main lists, but `/thread/related` sends complete bodies for both list completion and reader opens; address that shared contract first.
3. Anchor-aware reader windows, local body GETs and byte-bounded in-memory caches offer the clearest additional benefits for long conversations and mobile memory.
4. Preserve existing switch cancellation, SSE deltas, revision guards and server FTS; coordinate overlaps instead of launching duplicate switch/deep-link work.
5. Upstream gains are workload-specific; verify Noctua payload bytes, selected-body latency, heap and race correctness before adopting larger replay/cache protocols.
