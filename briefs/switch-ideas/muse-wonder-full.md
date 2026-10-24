# More mailbox-switch optimizations — muse-wonder-full-1.0 (read-only idea round)

Code read: `wt-switch-ideas` @ a504783. Evidence: `perf-mailbox-switch-e2e.md` (segments A–H, CPU profile §6),
`-client.md`, `-server.md`, `perf-mailbox-switch.md` (post-D1 state: first rows 191–479 ms warm, 214–543 ms cold,
13–14 requests). Remaining hot segments after D1: H (threads→first rows, 134–412 ms warm), G (threads server+download,
108–154 ms at 2k/10k), F (folders→threads start, 44–224 ms), plus settled tail. Ideas ranked by expected gain per
risk. Gains marked M = measured in the spikes, E = estimate from cited segments.

## M1. Folder/sidebar i18n: cached translator, lazy hover titles
- Change: cache per-locale translator inside `getTranslator` (`lib/i18n/translator.ts:11-13`, pattern already in
  `lib/i18n/folderNames.ts:10,16-20`); stop formatting `List.folderCountTitle` (ICU plural) eagerly in
  `getFolderCountTitle` (`app/components/mailclient/folder/folderBadgePresentation.ts:30`), called per node per render
  at `FolderTreeNode.tsx:102` only for `title=` attributes (`:119,197`) — compute on mouseenter/focus, or build it
  from the already-cached formatters in `lib/i18n/format.ts:21-39`. Same for the sidebar row title
  (`app/components/shell/ShellSidebar.tsx:99-101`). Fixes also per-row `getTranslator` in `describeMessageSize`
  (`lib/ui/byteSize.ts:33`, row callers `MessageRow.tsx:247`, `MessageTable.tsx:533-534`).
- Why: use-intl/`IntlMessageFormat` chunk = 212 ms per switch at 50 folders, 64 ms small→large (e2e §6); segment F
  grows with folder count (166–224 ms).
- Gain: E −50–150 ms first rows into many-folder mailboxes, −5–20 ms elsewhere; also speeds every re-render that
  touches the folder tree.
- Risk: ~none. Translator is a pure function of locale over static catalogs; title text identical, just produced on
  demand.
- Overlap: none. Verify: existing `FolderTree.i18n.dom.test.tsx`, `folderBadgePresentation.test.ts`; e2e harness
  `small:folders` pair, segment F/H.

## M2. Address fast path: use the server-parsed sender, parse own-addresses once
- Change: `getMessageFromDisplay`/`recipientEmail`/`isMessageFromUser`
  (`app/components/mailclient/messagelist/threadGroupUtils.ts:39,56-58,177-240`) re-parse `from` (and to/cc/bcc) per
  message via `parseAddressEmails` (nodemailer tokenizer, `lib/ownAddresses.ts:23-50`) and rebuild+renormalize the
  own-address Set per call (`lib/ownAddresses.ts:60-63,67-70`). The threads payload already carries the canonical
  `senderKey` (derived at ingestion from envelope/headers, `lib/mail/imap/parser.ts:45-53`; field `lib/data.ts:152`)
  and `fromEmail`, unused by list derivation. Pass a precomputed own-address Set and the message's `senderKey ??
  fromEmail` into the display derivation; keep the full parser only when both are absent or `from` holds several
  mailboxes.
- Why: address-parser chunk = 114–147 ms self time per switch (e2e §6), inside segment H; server spike measured the
  same parse at ≈13 µs/row (server §9 S1).
- Gain: E −50–120 ms of H on a 300-thread first page; scales down with page size.
- Risk: parser-vs-`senderKey` disagreement on exotic From headers (quoted names, comments, groups). `senderKey` is
  explicitly "never from a stored display string", so it is the more trustworthy source; still differential-test.
- Overlap: overlaps in-flight H (stacks: H shrinks rows derived, this cheapens each derivation). Verify:
  `threadGroupUtils.test.ts`, `lib/ownAddressConsumers.test.ts` + new differential test (fast path == parser path over
  the address fixtures, incl. group/quoted/comment cases).

## M3. Folder tree: mount the Radix menu lazily, memoize nodes
- Change: every `FolderTreeNode` mounts a full `DropdownMenu.Root` + tooltip button
  (`app/components/mailclient/folder/FolderTreeNode.tsx:202-245`) while closed. Render the plain action button first;
  mount the menu on first open intent. Wrap node in `memo` and stabilize the inline `state`/`helpers` objects built
  per render in `FolderTree.tsx:86-98` (useMemo at the `FolderSidebarPane` level).
- Why: Radix primitives/popper chunk = 63–154 ms per switch (e2e §6); folder tree render sits in segment F and in the
  D1 commit (highlight into the 50-folder mailbox is +13–18 ms for exactly this reason, impl report §4 n.2).
- Gain: E −30–100 ms into many-folder mailboxes, single-digit ms at 6 folders; also cheaper folder-count stream
  updates afterwards.
- Risk: first menu open pays one mount frame; keyboard/AT path must open the same menu from the button (keep focus +
  aria-haspopup on the plain button).
- Overlap: none. Verify: `FolderTree.i18n.dom.test.tsx`, manual keyboard menu check, e2e `small:folders` pair
  (highlight + first rows).

## M4. One virtual-counts endpoint instead of 4× `messages?pageSize=1`
- Change: replace the four parallel count fetches in `useSearchState`
  (`app/components/mailclient/useSearchState.ts:210-229`) with one `GET /api/accounts/[accountId]/virtual-
  counts?excludeFolderIds=…` that runs the four badge-filtered COUNTs under one `requireAccountContext`, reusing
  `applyBadgeFilters` from `lib/db/messages/query.ts`. Today each call runs the full list handler (items + group
  counts + total) to read only `total` (`app/api/messages/listMessagesHandler.ts:84`).
- Why: 4 requests/switch, 82 of them aborted by debounce reruns in e2e (§4), queueing stalls 1–87 ms behind the 2 SSE-
  held HTTP/1.1 connections (§4); each side route costs ~14 guard/read statements before its query (server §3).
- Gain: E −3 requests, −30–80 ms settled (server + queue), frees connection slots during first rows. Counts re-run on
  every folder-count change (`useSearchState.ts:201-203,244`), so the saving repeats all session long.
- Risk: count drift if the COUNT path diverges from badge-filter semantics.
- Overlap: overlaps in-flight D5 (deferral) — complementary: deferral moves them off the critical path, this quarters
  their cost wherever they land. Verify: route test asserting equality with the four legacy calls on a mixed fixture
  (focused/todo/calendar/calendar+unread) + `useSearchState.dom.test.tsx`.

## M5. Take topic *suggestions* out of the threads response
- Change: `threads/route.ts:89-93` always enriches with `includeSuggestions: true`. Return assigned topics only; fetch
  suggestions at idle or when the suggestion section is expanded (it renders collapsed by default,
  `listModel.ts:483`), reusing the existing `message-topics/suggest` route shape for a batch variant.
- Why: suggestion enrichment = 20.1 ms per first page with zero topics, 24–43 ms with topics (server §3 anatomy) —
  paid inside segment G for UI that starts collapsed.
- Gain: E −20–40 ms of G on topic-using mailboxes, −20 ms even without topics until parked S1 lands; smaller JSON too.
- Risk: suggestion section/badges populate a beat after rows; the open view reads suggestions off the list item (route
  comment `:27-29`) — must confirm the reader tolerates late suggestions or fetches on open.
- Overlap: improvement on parked S1 (S1 still worth it for the deferred call). Verify: route test (items carry topics,
  no `topicSuggestions`), dom test that the suggestion group appears after the idle fetch, reader-open test.

## M6. Build the thread forest once per list change
- Change: the forest is built up to three times for one page: `buildGroupedMessages` (`listModel.ts:172`, incl. a full
  `flattenThread` per root), again per group in `buildThreadGroupEntries` (`threadGroupUtils.ts:497`), plus
  `threadForest` in `MailClient.tsx:2927`. Build once in `messagelist/listState.ts` and pass the forest (bucketed by
  group) into both consumers; precompute `threadLatestDateValue` on nodes instead of recursing per entry
  (`threadTree.ts:68-75`).
- Why: app list chunk = 96–98 ms self time per switch (e2e §6), inside H; two of the three builds are pure repeats
  over the same 900 messages.
- Gain: E −10–40 ms of H (needs one bychunk profile to split precisely).
- Risk: low; pure refactor of pure functions.
- Overlap: overlaps in-flight H. Verify: `listModel.test.ts`, `listBehavior.test.ts`, `threadTree.test.ts` unchanged-
  green; CPU profile by chunk before/after (e2e harness `profile.mjs`).

## M7. gzip the threads JSON (verify current state first)
- Change: confirm with one `curl -H 'Accept-Encoding: gzip'` against the preview whether `/threads` answers `Content-
  Encoding: gzip`. The e2e harness recorded 860,931 encoded bytes for the large mailbox (§4), i.e. effectively
  uncompressed on the standalone/Bun path; `next.config.ts` sets no `compress`. If identity, enable gzip in the
  launcher/proxy for JSON responses above ~10 KB.
- Why: segment G includes download of 860 KB; spikes ran on loopback, the household uses `mails.monkeymed.de` over
  WAN/Wi-Fi where this dominates.
- Gain: E wire 860 KB → ~120–180 KB; at 20 Mbit/s ≈ −280 ms of G, at LAN speeds −20–60 ms, loopback ~0. Client
  decompression is native/off-main-thread.
- Risk: server CPU ~3–8 ms per 860 KB on the single Bun thread; net loss only on loopback. No caching involved, no
  auth change.
- Overlap: none (parked HTTP/2 item is a sibling, gzip helps under both). Verify: curl header check; e2e harness under
  CDP network throttling (a measurement dimension the spikes did not cover).

## M8. IMAP stream keyed by account only; watch-folder via the registry
- Change: the stream effect depends on `activeFolderId` (`useSyncController.ts:1412`), so every folder click tears
  down the SSE and all IMAP IDLE sessions and reconnects. At switch time the folder is always INBOX, which the server
  watches anyway (`imap/stream/route.ts:390-397`); other folders are already covered by its poll loop. Drop
  `activeFolderId` from the deps; to keep instant IDLE for a non-INBOX folder, extend `StreamControl` with `addFolder`
  (`lib/mail/imapStreamRegistry.ts:1-3`, today `removeFolder` only) behind a small authorized POST.
- Why: stream TTFB 486–671 ms at 50 ms IMAP RTT (e2e §7) plus TLS/LOGIN against real providers (server §6); a folder
  click right after a switch — the common next action — currently pays a full reconnect and holds an HTTP/1.1 slot
  during first rows.
- Gain: E −100–600 ms settled after switch+folder-click on real IMAP, −1 connection setup competing with the list
  load.
- Risk: without the POST, new mail in a non-INBOX folder waits for the existing folder poll instead of IDLE — state
  which variant ships.
- Overlap: small local half of the parked resident-sync-worker design. Verify: harness EventSource-open count per
  folder click (expect 0 new), new-mail-in-subfolder still arrives (poll or POST), stream auth tests.

## M9. Keep per-account consistency fingerprints across switches
- Change: on every account change, `useSyncController` wipes `lastConsistencyFingerprintByFolderRef` and the initial-
  check flag (`useSyncController.ts:236-238`), although keys are already `${accountId}:${folderId}`. Retain the map
  across switches (bounded; drop on logout, 401, `mailboxes-changed`). The STATUS POST still runs on switch — the
  retained fingerprint is only compared against the fresh response (`:817-829`), so no check is ever skipped; what is
  skipped is the redundant initial-check sync decision (`decideFolderConsistencySync`) on switch-back.
- Why: a switch-back within one session currently re-enters the initial repair path, which can enqueue a folder sync +
  full list refresh although the remote fingerprint is unchanged — settled-tail cost (e2e §5 class).
- Gain: E avoids one sync job + one threads/counts refresh per switch-back when nothing changed (up to ~1 s settled in
  the worst observed cases).
- Risk: negligible for authz (fingerprint is remote-state metadata, refreshed by an authorized POST each time); a
  stale entry can only cause an extra comparison, never skip the STATUS.
- Overlap: none (in-flight defers the POST; this removes its follow-up work). Verify: counting harness A→B→A — second
  A visit issues no `POST /sync` from the consistency path when the fingerprint matches.

## M10. Instant "pending" feedback on the clicked sidebar row
- Change: add a local `pendingAccountId` set synchronously in the sidebar `onSwitch` wrapper (`ShellSidebar.tsx:98`),
  rendered as pressed/busy (`aria-busy`, spinner or dimmed active style — explicitly *not* `aria-current`, which stays
  bound to the committed `activeAccountId`, `:102`). Clear it when the `switchAccount` promise settles
  (`useAccountController.ts:264-363`, all exits incl. superseded versions).
- Why: highlight now lands at 61–72 ms warm but 124–162 ms into the 50-folder mailbox and later cold (impl report §4);
  users perceive the click as unregistered until then. Zero data is shown early, so the "only a persisted selection
  activates" invariant is untouched.
- Gain: perceived click latency → ~0 ms; no change to first-rows time.
- Risk: one more piece of UI state; must clear on failure and on the in-flight A→B→A fix's early-return path.
- Overlap: none. Verify: dom test — pending style visible while folders are gated, `aria-current` unchanged until
  commit, cleared after a 403.

## M11. Re-rank parked server prototype S1+S2+S3 to "next after in-flight"
- Change: land the measured, byte-identical prototype (`proto.patch`): S1 topic-suggestion early-exit+memo
  (`lib/topics/suggestions.ts`), S2 date-grouping memo (`lib/messageGrouping.ts`), S3 thread-index seeks
  (`lib/db/messages/query.ts`, coordinate with FTS). Exclude S4 (auth) for now.
- Why: M (measured) critical path 66.5 → 38.4 ms p50; threads 49.1 → 23.1 ms at 2k, 90.6 → 54.0 ms at 11k (server §1).
  After D1, threads is ~75 % of the remaining server path, and in-flight client work only raises that share.
- Gain: M −26 to −37 ms of G per first page, more under load.
- Risk: low; response hashes verified 72/72 in the spike. S1's no-topic early-exit is subsumed if M5 lands first — S1
  memo still pays for the rest.
- Overlap: parked item (re-ranked). Verify: differential tests named in server §9 (identical rows/order/counts +
  EXPLAIN assertion for S3); `anatomy.ts` before/after.

## M12. Slim the threads payload further (audit-gated)
- Change: `slimThreadListItem` (`threads/route.ts:31-45`) deletes only four things; items still carry `references[]`,
  `bccAddr`, `deliveredTo`, `originalTo`, `xComposeFormat`, `mailboxPath`, `priority` for ~900 rows. Audit list-path
  readers (tree build needs only `threadId`/`parentId`, `threadTree.ts:5-40`) and drop fields provably unread before a
  message is opened; e.g. `references` is read by compose init (`composition/composeInitState.ts:190,396`) from the
  *opened* message — confirm the reader's `useThreadContent` copy is authoritative there. Introduce a `ListMessage`
  subset type so `bun check` surfaces consumers.
- Why: 860 KB JSON = parse + GC inside H (GC 21–78 ms in the CPU profile).
- Gain: E payload −10–25 % (≈90–200 KB), parse/stringify roughly proportional.
- Risk: a hidden consumer reads a dropped field off the list item (mutations, drag, calendar badges). The subset-type
  refactor is the mitigation and the cost.
- Overlap: none; stacks with M7. Verify: typecheck, reply/forward-threading browser test from a list-opened message,
  payload byte count in harness.

## M13. Re-rank S4c: handshake retries for the switch-account session write
- Change: `setActiveAccountId` (`lib/betterAuth.ts:223-227`) gets the existing `handshakeRetry` pacing (1–8 ms steps,
  same 2.16 s budget, `lib/dbWriteRetry.ts`; precedent `lib/db/processLeases.ts:37`). Pacing only — same statement,
  same semantics.
- Why: quiet p50 is 4.6 ms, but under sync-writer load 25–27 % of these writes retry in 96–144 ms steps (p99 167–457
  ms, rare exhaustion → 500, server §4). E2E saw no switch-path BUSY at household scale, so this is tail insurance.
- Gain: E p99 of segment A under load 167–457 ms → ~20–40 ms; median unchanged.
- Risk: low, but auth-owned file — needs the auth owner's review (one line).
- Overlap: parked item (S4 family, re-ranked low). Verify: server `switch-load.ts` phase b/all retry counts; test
  "succeeds once a held master write lock is released, within the handshake budget" (server §9).

## M14. Second tab: broadcast the selection change (product decision)
- Change: emit a `selection-changed {accountId}` user event on `/api/me/events` (the stream `useMailboxSummaries`
  already consumes, `app/hooks/useMailboxSummaries.ts`); a receiving tab either follows via the normal authorized
  `switchAccount` path or — minimal variant — stops its old-mailbox polling/list refreshes until it next bootstraps.
- Why: today tab 2 keeps querying the old mailbox (2 threads + 12 messages observed, e2e §7) and its requests stall
  tab 1's switch by 680–930 ms in the HTTP/1.1 queue; the persisted selection is session-shared anyway.
- Gain: E removes that cross-tab contention for the switching tab; correctness side effect, not a median gain.
- Risk: UX — a user may *want* two tabs on different mailboxes; following tabs would yank the reading view. Needs an
  explicit product call.
- Overlap: parked item (re-ranked low). Verify: two-context Playwright test; receiving tab never renders B data before
  its own authorized switch commits.

## M15. Considered and rejected for now: hover/pointer prefetch of folders
- Change (would be): prefetch `GET /accounts/B/folders` on row hover after ~150 ms into a single-slot promise consumed
  by `switchAccount` (`useAccountController.ts:289`).
- Why not: folders cost 2.5 ms server / ~8 ms end-to-end and run parallel to the ~10 ms selection write, so they are
  rarely the `max()` in `max(switch, folders) + threads`. Reusing a prefetched body for the commit would create a
  revocation-age window; discarding it (warm-up only) leaves ≈0–10 ms. The client spike already advised against hover
  prefetch (§5).
- Gain: E ≈0–10 ms warm. Risk: speculative authorized reads ×12 sidebar rows.
- Overlap: none. Revisit only if a future trace shows folders as the max() (e.g. cold shard 7 ms + real-network RTT
  dominating the write).

## Summary
Cheapest real wins are client-side formatting/parse work: cached+lazy i18n in the folder tree (M1), the senderKey address fast path (M2), and lazy folder menus (M3) attack the measured F/H segments without touching auth or data flow.
Next tier removes whole requests and server work from the switch: one virtual-counts endpoint (M4), suggestions out of the threads response (M5), one thread-forest build (M6), and gzip after a one-curl check (M7).
M8–M10 cut reconnect/recheck churn and perceived latency around the switch; M11 re-ranks the already-measured server prototype (66.5→38.4 ms) as the next server step once in-flight client work lands.
M12–M14 are audit- or decision-gated (payload slimming, auth-owned retry pacing, second-tab behaviour) and should wait for their owners' calls.
Nothing proposed caches authorization or shows mailbox data before an authorized response: every win is either less formatting, fewer/cheaper authorized requests, or work moved after first rows — and hover prefetch (M15) is explicitly not worth it.

