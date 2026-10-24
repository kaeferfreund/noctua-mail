# V2 report — cheaper threads/list query on the server (mailbox switch)

Branch `perf/switch-server-list` in `repo/wt-switch-server`, from `integration/stage` 7425f75. Not pushed, not merged. 2026-10-23.

## Result

The threads route (first page, 300 threads, default view) takes about half as long. Values are p50/p90 in ms, two alternating runs each (base = 7425f75, final = 529a7b8). Fixture: syn-m0 (2,000 messages) and syn-l0 (11,000), in-process with a real MFA session. 1-min host load during the runs was 5.7–9.7.

| Threads route | base run 1 | base run 2 | final run 1 | final run 2 |
|---|---|---|---|---|
| 2k, no topics, warm | 61.8/75.6 | 51.2/58.1 | **23.1/28.2** | **22.7/26.8** |
| 2k, no topics, cold shard | 67.0/80.8 | 62.5/69.3 | 28.7/35.2 | 30.1/36.9 |
| 11k, no topics, warm | 101.0/117.6 | 93.2/100.2 | **49.3/54.8** | **50.2/54.0** |
| 11k, no topics, cold shard | 112.4/127.9 | 108.9/120.3 | 59.6/71.1 | 61.0/70.5 |
| 2k, with topics, warm | 71.6/79.3 | 69.6/76.8 | **39.2/47.2** | **40.8/48.7** |
| 2k, with topics, cold shard | 80.1/84.8 | 78.4/83.5 | 45.1/55.8 | 45.5/52.0 |
| 11k, with topics, warm | 124.9/134.8 | 121.4/128.7 | **76.3/99.0** | **70.0/75.7** |
| 11k, with topics, cold shard | 138.9/159.6 | 133.6/160.7 | 89.7/110.4 | 86.4/93.4 |

"With topics" means 6 topics on 400 older threads, and every sender shares one domain. That is a heavy case: every learning thread matches every page thread.

## Per idea

The ms come from the phase timings (`listThreads`, enrichment) and the per-statement timings of the same runs. All values are warm p50, base → final.

| Idea | Commit | Decision | Before → after |
|---|---|---|---|
| **(a)** S1/S1b/G02: topic suggestions. No `thread_signals` read when the mailbox has no topics. Own addresses are normalized once per call (`ownAddressMatcher`), and each signal is decided once per call. The score is reused for page threads with the same signal sequence, except when the thread is itself a learning thread. All memos are call-local. | 1aa18a2 | **keep** | enrichment without topics: 2k 20.6/20.2 → 1.0/1.1, 11k 22.1/20.6 → 1.1/1.0. With topics: 2k 34.4/33.7 → 13.5/13.5, 11k 41.8/42.4 → 15.2/14.3 (p90 37.2 → 16.7, 43.5 → 19.6). |
| **(b)** G04: the date group key is built once per thread. `buildMessageGroupKey` computes the display day only for `year`. | 62bb201 | **keep** | JS part of `listThreads`: 2k ≈ 9.4 → 3.3 ms, 11k ≈ 10.2 → 3.2 ms. This also contains small parts of S8. |
| **(c)** Grok G2: no `getThreadGroupCounts` for `groupBy=date`. Instead, every date bucket is returned with its loaded count. | df97f6a (+ ac235ec test typing, 8034d8e test adjustment) | **keep** (date only) | the bucket-count statement is gone: 2k 2.0–2.2 ms, 11k 12.0–12.7 ms. |
| (c) for week/year | — | **drop** | The client uses the server keys of these groupings for collapse state and collapse-all of buckets that only arrive on later pages (`mergeCollapsedGroupsWithMeta`, `computeToggleAllGroupsState`). Loaded-only keys would lose that. Not on the switch path. sender/domain/invite/event are unchanged. |
| **(d)** G06/S3: `baseCount` via `INDEXED BY idx_messages_account_thread_date` (filtered thread list only) | 5fce0da | **keep** | 2k 0.88 → 0.65 ms, 11k 4.93 → 0.77 ms (inbox, 21 runs). The route statements: 2k 1.1–1.5 → 0.9–1.0, 11k 5.5–5.7 → 1.15. EXPLAIN changes from `idx_messages_account_folder_unread (accountId, folderId)` to `idx_messages_account_thread_date (accountId=? AND threadId=?)`. Identical counts in all 10 view × size cases, including search (34.1 → 29.7 ms at 11k). The unfiltered branch already uses the thread index, so it is unchanged. |
| (d) message rows with the thread index + `rowid` tie-break | — | **drop** | 11k 10.5–11.1 → 3.7–4.0 ms, but 2k 3.5–3.7 → 3.5–3.7 (±0.2, three of five views slower), and the plan adds a `TEMP B-TREE FOR ORDER BY`. That fails the "2k and 11k both improve" rule. A size-dependent hint would be the follow-up if the 11k saving is wanted. |
| **(e) Q1**: own addresses (master `accounts` + `sender_identities`) are read only for a non-empty query. This applies to listThreads, listMessages, and their total and group counts. | 570954b | **keep** (small) | Per threads request, 2 fewer master read pairs (execs 46 → 42/40 with S8). Well under 1 ms. The value is fewer readers next to the session write. |
| **(e) S8**: the warm `getAccountDb` signature check reads `getAccountOwnAddresses` (id, email + identities) instead of `getAccountById` (full row + secret decryption). | 529a7b8 | **keep** | 6 calls per request: master SQL 0.7–1.2 → 0.35–0.48 ms, plus the decryption JS that no longer runs. |
| Muse M5 (suggestions as their own request) | — | **not done** | After (a), suggestions cost about 1 ms without topics and 13.5–15 ms in the heavy topic fixture. A client contract change (and the overlap with D5) is not worth it. |

## Differential test

`.tmp` harness, kept under `briefs/switch-ideas/V2-harness/`:
- Route responses of base 7425f75 and final, normalized for topic ids.
- 3 mailboxes (50 / 2k / 11k), each with edge data: Today/Yesterday/This Week dates in Europe/Berlin, equal `dateValue`s inside and across threads, a flagged non-first message, a thread across INBOX and Trash, an alias sender, a free-mail sender, and an own address as sender and recipient.
- 26 views per mailbox:
  - default, page 2, page 3 at 50, `latestDateValue`;
  - groupings week, year, sender, domain, none, event, invite-date;
  - filters: unread, flagged, attachments;
  - all mail and all mail page 2, with and without exclusions;
  - searches: subject, `from:`, `from:me`, `to:`, `in:`, `topic:none`;
  - a foreign folder and a foreign exclusion.
- Each view runs with topics and without topics.

Results:
- **Topics on and off: 78/78 views have identical items (order and every field), total, hasMore and baseCount.** The foreign folder and the foreign exclusion still return `400 folder_account_mismatch`.
- The only difference is `groups` on the 49 date-grouped views. That is change (c).
  - Run through the real client grouping (`buildGroupedMessages` with `buildThreadTree`/`flattenThread`), the **group headers are identical in 49/49 views**: key, label, count, `countIsLoaded`, item ids.
  - The collapse keys the client keeps (`mergeCollapsedGroupsWithMeta`) are now always all four date buckets. Before, they were the buckets with a non-zero host-local SQL count.
- After (a) alone, after (b) alone and after (d), the full responses were 78/78 identical with topics.

New unit tests:
- `lib/topicSuggestions.test.ts`:
  - no topics → no `thread_signals` statement;
  - a topic created between two calls appears in the second;
  - threads with identical signals, including a learning thread, an alias sender and a free-mail sender, match the per-thread result;
  - results are distinct objects.
- `lib/ownAddresses.test.ts`: `ownAddressMatcher` equals `isOwnAddress`.
- `lib/messageGrouping.test.ts`: year at the Berlin new-year boundary, thread-date override, non-date groupings.
- `lib/db/messages/query.threadSelector.test.ts`:
  - date groups list all four buckets with loaded counts and no bucket SQL runs, while week still runs it;
  - the EXPLAIN plan and the value of `baseCount` (inbox, exclusions, search);
  - `from:me` reads the identities exactly 3 more times than an empty query.
- `lib/db/senderIdentityFixes.test.ts`:
  - the light own-address read equals the full account's own addresses (alias, IDN, unknown account);
  - the existing "me search" check of server bucket counts on `listThreads` now uses `week`, because `date` returns loaded counts.

## Risks

- **(c) changes the `groups` contract of `GET threads?groupBy=date`.** Counts are now loaded counts, and zero-count buckets are listed.
  - The only consumer is the web client. It already showed loaded counts. `listThreads` is only called by this route.
  - Behaviour difference: the collapse state of a date bucket that is temporarily empty is now kept rather than dropped.
  - Revert path: df97f6a + 8034d8e.
- **(d) `INDEXED BY` fails loudly** if `idx_messages_account_thread_date` is ever renamed or dropped. It is part of the base shard schema.
- **Same file as the FTS work:** (c), (d) and Q1 touch `lib/db/messages/query.ts`. The diffs are small and local.
- **S8 and revocation:** `getAccountDb` is not an authorization point. Membership and role are checked per request in `requireAccountContext` (`resolveAccountRole` + `getAccountById`). That is unchanged, so revocation is not delayed. The signature is the same list as before (test). An identity change still changes it and reruns the backfill once.
- **(a) caches nothing across requests.** Learning threads are excluded from the reuse, so their own history stays excluded.

## Gates

- `bun check`: 0 errors.
- `eslint` on all 10 touched files: 0 errors, 0 warnings.
- Focused tests: **327 pass, 0 fail** (22 files). They cover `lib/db/messages/*`, topic suggestions, `lib/topics`, own addresses, grouping, the threads route, `folderAccount`, sender identities, the shared shard, collab filters, topic search, calendar events, shard probes and `listModel`.
- Wider set (8 files that use `getAccountById`, `groupBy: "date"` or the calendar runtime data): 201 pass, 1 fail.
  - The failure is `lib/teamAuthSlice3.test.ts` › "absolute expiry and idle liveness close…", a 5 s timeout.
  - It **fails the same way on the unmodified 7425f75** (run in `.tmp/base`).
- `bun run build`: OK.
- No schema or migration change, no `PRAGMA optimize` or `ANALYZE`.
- Not run: the full `test:ci` (by rule hourly on stage).

## Commits

```
529a7b8 perf(db): read only the own addresses in the warm getAccountDb check
570954b perf(list): read the own addresses only for a search query
8034d8e test(identities): check filtered thread bucket counts through week grouping
5fce0da perf(threads): count the page's messages through the thread index
ac235ec test(threads): type the optional groups in the date-groups test
df97f6a perf(threads): skip the date bucket count query for the date grouping
62bb201 perf(threads): derive the date group key once per thread
1aa18a2 perf(topics): cheaper suggestion enrichment for the thread list
```

8034d8e and ac235ec belong to (c). For a partial cherry-pick, take them together with df97f6a.

## Notes

- Took about 2.5 h instead of the planned ≤ 90 min. Most of the extra time went to the base/branch pair runs at host load 6–25 and the client-side check of (c).
- Reproduction is in `V2-harness/README.md`. The harness extends the spike harness `briefs/perf-mailbox-switch/server/` (fixture, sqlcounter).
