# Spike A — mailbox switch latency, end-to-end measurement

Read-only spike on **647359b** (dev preview "round 9.1"), worktree `wt-spike-switch-e2e` (detached), 2026-10-23 15:14–16:10 UTC. No commits, no branches, no tracked-file edits; `git status --short` is empty at the end. All data is synthetic (`example.test`). Harness, raw JSON and logs: `briefs/perf-mailbox-switch/e2e/` (see its `README.md`; generated tables in `analysis.md` and `segments.md`).

"Switch" = clicking another mailbox in the sidebar ("Eigene Postfächer"), i.e. `switchAccount()` in `app/components/mailclient/useAccountController.ts`. All times are in ms from the click (`performance.now()` right before `button.click()`), measured in headless Chromium against the **production standalone build**.

## 1. Summary

**Mailboxes** (one synthetic IMAP listener each, all folders fully synced before measuring): **small** 50 msgs / 6 folders, **medium** 2,000 / 6, **large** 10,000 / 6, **folders** 1,350 / 50 folders.

**Milestones.** *highlight* = sidebar `aria-current` is on the target. *folders* = first `[data-folder-id^="<target>:"]` in the DOM. *first rows* = first `[data-message-id]` row with the target's subject marker. *settled* = 500 ms with no DOM mutation and no non-SSE request in flight (the end of the last activity is reported).

### Cold = first switch after a full page load (n = 10 each)

| scenario | highlight p50 | first rows p50 / p90 | settled p50 / p90 | requests | long tasks (p50 total) |
|---|---|---|---|---|---|
| small → large | 162 | **700** / 852 | **1,658** / 2,065 | 37 | 1,290 ms |
| large → small | 210 | **676** / 840 | **1,571** / 2,331 | 38 | 708 ms |
| medium → large | 138 | **662** / 1,472 | **1,442** / 2,553 | 37 | 1,024 ms |
| large → medium | 158 | **811** / 1,032 | **1,959** / 2,376 | 38 | 1,344 ms |
| small → folders | 237 | **1,141** / 1,453 | **2,172** / 2,923 | 37 | 1,737 ms |
| folders → large | 344 | **781** / 995 | **1,569** / 2,690 | 37 | 1,190 ms |

### Warm = switching back and forth in the same page (n = 10 per direction, first switch excluded)

| scenario | `warm` (load 10–14) first rows p50 / p90 · settled p50 / p90 | `baseline-r2` (load 4–7) first rows · settled |
|---|---|---|
| large → small | **378** / 774 · 504 / 1,126 | **370** / 387 · 487 / 572 |
| small → large | **552** / 770 · 1,003 / 1,401 | **493** / 510 · 831 / 852 |
| large → medium | **711** / 895 · 1,062 / 1,276 | **520** / 592 · 771 / 816 |
| medium → large | **667** / 1,008 · 1,088 / 1,436 | **516** / 650 · 849 / 1,013 |
| folders → small | **538** / 688 · 738 / 1,020 | – |
| small → folders | **735** / 1,378 · 1,147 / 1,905 | – |
| large → folders | **729** / 832 · 876 / 962 | – |
| folders → large | **716** / 763 · 1,157 / 1,252 | – |

**Bottom line.** On this host a switch shows its first rows after **0.37–0.74 s (warm)** or **0.66–1.14 s (cold)**, and settles after **0.5–1.2 s (warm)** or **1.4–2.2 s (cold)**.

- **Server time is small.** Each request on the critical path takes 7–20 ms, except `threads` on the 10k mailbox (~110 ms).
- **Most of the time is serialization and client main-thread work.**
  - Four strictly sequential round trips with React render gaps between them.
  - 130–410 ms of JS after the thread list arrives.
  - Requests for the old mailbox that are fired after the click.
- **IMAP latency does not gate first rows** (§7), but it delays settled.
- **No SQLITE_BUSY on `switch-account` / `/auth/me`** in 354 measured switches (§7).

## 2. Critical path (timeline)

Warm small → large (`warm` series, medians, n = 10). The same chain shape holds in every scenario; per-scenario segments are in §3.

| ms from click | step | kind | duration |
|---|---|---|---|
| 0 | click → `setState` / React | client | |
| 1 → 10 | `POST /api/auth/switch-account` | server (TTFB 8) | **10** |
| 10 → 12 | `loadInitialData()` starts | client | 2 |
| 12 → 22 | `GET /api/auth/me` (3 KB, all accounts) | server | **10** |
| 22 → 107 | main thread busy: re-render after the state wipe, stale old-mailbox effects, then `me.json()` → `setState` → `fetch(folders)` | **client gap D** | **79–85** |
| 51 → 70 | *(parallel, stale)* `consistency` + `threads` for the **old** mailbox, old `imap/stream` reopened | wasted | |
| 107 → 116 | `GET /api/accounts/{new}/folders` | server | **8** |
| 116 → 201 | render folder tree → effect sets `activeFolderId` → list effect → fetch | **client gap F** | **83** |
| 201 → 318 | `GET /threads?pageSize=300` (860 KB for large) ∥ `POST …/INBOX/consistency` | server + download | **115** |
| 318 → 569 | parse 300 threads, derive and render the list (long task 200–350 ms) | **client H** | **249** |
| **569** | **first rows visible** | | |
| ~1,000 | sender icons, 4 virtual-count `messages?pageSize=1`, more long tasks → settled | | |

**Click → highlight is 110–350 ms.** The highlight is not optimistic: it moves only after `/auth/me` returns and the shell re-renders. It is slowest (306–350 ms) when leaving the 50-folder mailbox.

## 3. Critical-path segments, all scenarios (medians)

A = click → switch-account done · B = gap → `/auth/me` start · C = `/auth/me` · D = gap `me` → `folders` start · E = `folders` · F = gap `folders` → `threads` start · G = `threads` (server + download) · H = `threads` done → first rows. Source: `e2e/segments.md`.

| series | scenario | A | B | C | **D** | E | **F** | G | **H** | first rows |
|---|---|---|---|---|---|---|---|---|---|---|
| warm | large→small | 11 | 3 | 14 | 64 | **87** | 44 | 16 | 146 | 392 |
| warm | small→large | 10 | 2 | 10 | 79 | 8 | 83 | **115** | **249** | 569 |
| warm | large→medium | 15 | 5 | 20 | 93 | **103** | 52 | 87 | **309** | 740 |
| warm | medium→large | 19 | 6 | 24 | 101 | 50 | 90 | **154** | **315** | 741 |
| warm | folders→small | 12 | 3 | 11 | **266** | 7 | 86 | 16 | 134 | 542 |
| warm | small→folders | 22 | 4 | 12 | 69 | 8 | **166** | 39 | **385** | 735 |
| warm | large→folders | 10 | 2 | 10 | 66 | **83** | **118** | 33 | **412** | 735 |
| warm | folders→large | 9 | 2 | 10 | **248** | 7 | 84 | 111 | 239 | 718 |
| cold | small→large | 12 | 2 | 14 | 87 | 11 | 101 | 134 | **357** | 751 |
| cold | small→folders | 19 | 4 | 24 | 106 | 11 | **224** | 41 | **640** | 1,202 |
| cold | folders→large | 11 | 2 | 11 | **284** | 8 | 95 | 114 | 264 | 805 |

(The first-rows column is the median of the per-run sums, so it is not exactly the sum of the column medians.)

**E is inflated whenever the previous mailbox is large.** `folders` normally takes 7–8 ms (TTFB 4–6 ms). It takes **83–115 ms** while the server is still serving the **stale** old-mailbox `threads` (860 KB) and `consistency` requests that the client fired after the click.

## 4. Requests per switch

Warm small → large, medians across 10 runs. Per-scenario tables for every series are in `e2e/analysis.md`.

| request | per switch | start | stall | TTFB | total | bytes | notes |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 8 | ~10 | 38 | body never read by the client |
| `POST …/{old}/folders/{old}:INBOX/consistency` | 1 | 51 | 0 | 11 | 15 | 326 | **stale, old mailbox** |
| `GET …/{old}/threads?pageSize=300` | 1 | 52 | 0 | 15 | 18 | 45,643 (860,931 when old = large) | **stale, old mailbox** |
| `GET …/{old}/imap/stream` (SSE) | 1 | 77 | 0 | 12 | stream | – | **old stream reopened**, then closed |
| `GET /api/accounts/{new}/folders` | 1 | 107 | 0 | 6 | 8 | 1,043 (8,984 for 50 folders) | critical |
| `GET /api/auth/me` | **2** | 12 / 112 | 0 | 14 | 17 | 3,028 | 2nd = compose sender-settings preload |
| `GET …/identities`, `…/prefs` | 1 each | ~140 | 0–42 | 9–13 | 12–16 | 503 / 33 | compose preload (`lib/ui/senderSettings.ts`) |
| `GET …/topics`, `…/calendar/events`, `…/members`, `…/reminders` | 1 each | ~145–165 | **1–87** | 13–45 | 19–142 | 33–201 | side panels |
| `POST …/{new}/folders/{new}:INBOX/consistency` | 1 | 200 | 0 | 111 | 113 | 334 | **opens IMAP and runs STATUS** (server log) |
| `GET …/{new}/threads?pageSize=300&groupBy=date&…` | 1 | 201 | 0 | 109 | 115 | **860,931** | critical; ~18 rows are in the DOM |
| `GET …/{new}/imap/stream` (SSE) | 1 | 229 | 0 | 122 | stream | – | |
| `GET …/topics/stats`, `…/recipient-aliases` | 1 each | ~320 | 1–59 | 14–72 | 30–110 | 33–35 | |
| `GET …/messages?pageSize=1&searchScope=all&badges=…` | **4** | 670 | 1 | 68 | 72 | 83–1,726 | virtual counts (`useSearchState.ts` ~l.208), 160 ms debounce |
| `GET …/sender-icon?from=…` | 0–8 | 400–1,400 | 1–11 | 13–57 | 25–110 | 383 | cached after the first visit |
| cold only: `POST …/{new}/sync` (202) + `sync/status` ×1–2 | 1 | 220–730 | 0 | 17–160 | | 87 | interactive "new" sync on the first visit in this page |

**Stall** = Chrome's queueing time before the request is sent. The standalone server speaks HTTP/1.1, so Chrome opens at most 6 connections per origin. Each tab holds 2 of them permanently with SSE (`/api/me/events`, `/imap/stream`). The ~8 parallel side requests therefore queue for 27–90 ms in one tab, and for up to **680–930 ms** with two tabs open (§6). Whether the dev preview sits behind an HTTP/2 proxy is not known to this spike.

**Status codes:** no 401, 409 or 5xx, and no client retries in any of the 354 switches (8 series). The only non-200 status is the expected `202` on `POST /sync` (82×).

**Aborted requests (all client-side aborts, none failed on the server):**
- The stale old-mailbox `imap/stream` was opened and then aborted in **all 354 switches**; 253 of those aborts came before the response headers.
- 82 virtual-count `messages` requests were aborted by their AbortController (debounce re-runs).

## 5. Duplicate, redundant and stale requests

Full URLs were compared (urlKey); the cold series recorded only URL templates, so the full-URL check uses the `warm-first` runs.

- **Stale requests for the old mailbox in 100 % of switches (3 per switch).**
  - Requests: `POST consistency` + `GET threads` (up to **861 KB**) + an `imap/stream` reopen for the *old* account, 50–135 ms after the click.
  - Mechanism, from the code: `switchAccount` calls `setActiveFolderId("")` while `activeAccountId` and `folders` still belong to the old account. The effect at `MailClient.tsx:4823-4825` then resets the folder to the **old** account's INBOX, and the list and stream effects fire for it.
  - Cost:
    - The server serves the stale requests in parallel with the new `folders` request (segment E +75–100 ms when leaving large).
    - The client parses the stale response during gap D (segment D 248–284 ms when leaving the 50-folder mailbox).
- **`/api/auth/me` twice per switch (100 %).** The bootstrap call, plus a second one 100–230 ms later from the compose sender-settings preload, which also fetches `identities` and `prefs`.
- **First visit to a mailbox in a page session (cold and `warm-first`).**
  - An interactive `POST /sync` (mode `new`) runs. When it finishes, the identical `threads?pageSize=300` request runs a **second time** (860 KB again), and all **4 virtual-count requests run twice**.
  - The sync found nothing new: the mailbox was already synced and idle.
  - This is the main reason cold *settled* is 1.4–2.2 s versus 0.5–1.2 s warm.
- **SSE reconnects per switch:** `/api/me/events` **0** (good); `/imap/stream` **2** (the old stream reopened once, then the new one).
- Under watcher contention, the virtual counts ran ×2.5–3, and `threads` + `consistency` ×2 in 10–20 % of switches (new mail arriving mid-switch).

## 6. Client main-thread cost

**Long tasks between click and settled** (PerformanceObserver, medians):

| | count | total | max | before first rows |
|---|---|---|---|---|
| warm, target = small | 2–4 | 149–327 ms | 81–165 ms | 148–326 ms |
| warm, target = large | 5–7 | 541–855 ms | 212–308 ms | 259–462 ms |
| warm, target = folders | 5–7 | 552–891 ms | 216–241 ms | 452–529 ms |
| cold | 8–11 | 708–1,737 ms | 181–358 ms | 409–909 ms |

**DOM mutations:** ~250–310 mutation records per switch in 10–17 animation frames, so React commits are batched rather than excessive.

**Chrome trace, 1.5 s after the click** (`results/trace-summary.json`, 6 switches per pair):
- Renderer main thread busy: small → large **850–925 ms**, large → small **470–570 ms**, large → folders **960–1,450 ms**.
- **75–90 % of that is JS (`FunctionCall`).**
- Style + layout + paint together stay ≤ 100 ms. GC is 10–120 ms.

**V8 CPU profile, self time per switch** (`results/cpu-profile-by-chunk.json`). Chunks were identified by content fingerprints in `.next/static/chunks`:

| chunk | small → large | large → folders |
|---|---|---|
| react-dom (`0rqvshlk9e35x.js`) | 105 | 245 |
| use-intl / `IntlMessageFormat` formatting (`1y5fvokl9hn96.js`) | 64 | **212** |
| RFC-2822 address-list parser (`tokenize` over `"(<,:;`) + Radix Themes (`013iha29f-oio.js`) | **147** | 114 |
| app MailClient / message list (`0bomfrlk_0g89.js`) | 96 | 98 |
| Radix UI primitives / popper (`1mx1wqpmp9sa6`, `1_9_o3iok6nqq`) | 63 | 154 |
| native `URL` + `fetch` | 46 | 48 |
| GC | 21 | 78 |

The two app-attributable hotspots are:
- **i18n message formatting that scales with folder count:** 212 ms with 50 folders.
- **Client-side address parsing that scales with the size of the thread page:** 147 ms for 300 threads.

Hypotheses for Spike B: per-row/per-folder `t()`/formatter work that is not memoized, and parsing address strings for all 300 threads instead of only the visible rows.

## 7. Contention and environment variants

| series | condition | switch-account TTFB p50 / p90 / p99 | `/auth/me` TTFB p50 / p90 / p99 | first rows p50 (s→l / l→s / m→l / l→m) | settled p90 range |
|---|---|---|---|---|---|
| baseline-r2 | quiet, same server instance | 8 / 28 / 307 | 8 / 25 / 184 | 493 / 370 / 516 / 520 | 572–1,013 |
| contention-watcher | new INBOX mail every 10 s in **all 4** mailboxes → watcher IDLE events → background syncs | 9 / 21 / 32 | 10 / 19 / 36 | 527 / 377 / 580 / 592 | **1,081–2,617** |
| contention-second-tab | second tab on the same session (its own `/api/me/events` + `imap/stream` + summary) | 8 / 21 / **614** | 10 / 16 / **1,589** | 642 / 461 / 532 / 528 | 875–1,120 |
| all 8 series pooled | 354 switches | max 614 | max 1,589 | | |

- **SQLITE_BUSY.** The server log has **no** `SQLITE_BUSY` / `db-write-retry` for `switch-account`, `setActiveAccountId` or `/auth/me` in any series.
  - Busy retries occurred only in background paths:
    - `acquireMailboxScheduler` ×2, during the prime sync;
    - the sync worker's `initializeMasterSchema` ×2, under watcher contention;
    - `heartbeatSyncWorkers` ×1, run 1.
  - The previous spike's p99 599 ms (SQLITE_BUSY on the session UPDATE) was **not reproduced** at this scale.
  - **Side finding: background sync is fragile under heavy new-mail load.** The discarded first contention attempt (a new mail every 3 s in all 4 mailboxes, host load 10–16, 15:38–15:47) logged **191 SQLITE_BUSY retries**, all in background paths:

    | operation | retries |
    |---|---|
    | `initializeMasterSchema` (sync-worker startup) | 159 |
    | `queueSyncWorker` | 37 |
    | `heartbeatSyncWorkers` | 17 |
    | `acquireMailboxScheduler` | 11 |
    | `releaseSyncWorker` | 7 |

    In **3 cases `initializeMasterSchema` exhausted its retries** (4 retries, ~2 s) and the sync worker failed (`[sync] worker failed`). None of these touched the switch path. Relevant for Spike C and the watcher; not a switch-latency cause.
- **Watcher contention leaves first rows nearly unchanged** (+0–70 ms). Settled p90 grows to 1.1–2.6 s, because mail that arrives mid-switch triggers refetches (duplicates in §5).
- **Second-tab outlier.** The first switch with a second tab open took 3.6 s to first rows:
  - `switch-account` 613 ms, `/auth/me` 1,589 ms, stale-old-mailbox requests 2.2 s.
  - The follow-up requests stalled **680–930 ms in Chrome's connection queue**: 4 of the 6 HTTP/1.1 connections were held by the two tabs' SSE streams.
  - No SQLITE_BUSY was logged in that second, and host load was 16, so this is not lock contention.
  - Steady-state second-tab cost: +0–150 ms on first rows.
  - Side observation (correctness, not perf): the second tab does **not** follow the session-level switch. It keeps showing and querying the old mailbox (2 `threads` + 12 `messages` during the series) while the session's active account has changed.
- **Remote IMAP latency** (fixture delays every command completion by 50 ms; NOOP round trip measured 58 ms), back-to-back with a latency-0 run at similar load (13–16):
  - `consistency` TTFB +29–39 ms.
  - **`imap/stream` TTFB 14–127 → 486–671 ms.**
  - Settled +280–290 ms.
  - **First rows +45–63 ms**, about one load-noise interval.
  - Conclusion: rows are not gated by IMAP; the live stream and "settled" are. Real TLS handshakes would add more to `imap/stream`; that is not simulated.

## 8. Re-bootstrap (`loadInitialData`) vs. what a switch strictly needs

**What the switch does today:**
1. `switch-account`
2. then `/auth/me` (the full user + **all** accounts payload, 3 KB; unchanged by a switch except `accountId`)
3. then `folders`
4. render
5. then `threads` + `consistency`

Plus about 12 side requests: compose preload (`/auth/me`, `identities`, `prefs`), topics, calendar, members, reminders, topics/stats, recipient-aliases, 4 virtual counts, sender icons.

**Strictly needed for the first rows:**
- the persisted selection (`switch-account`),
- the new account's `folders`,
- its INBOX `threads`.

The new id is known at click time, so all three can start immediately and in parallel. `/auth/me` contributes only the serialized ~10–25 ms round trip plus `setState` churn; the large cost is the serialization it forces (gaps D and F) and the state wipe that triggers the stale old-mailbox fetches.

**Measured pure bootstrap share on the critical path** (A + B + C + D + E + F, warm medians): **190–390 ms of the 392–741 ms** to first rows. Server time inside that share is only 30–60 ms; the rest is client main-thread time and serialization.

*Estimate, not measured:* parallel `folders` + `threads` at click time plus no stale fetches would bring first rows to roughly **G + H + 30–50 ms**:
- ~180–200 ms for small,
- ~400–450 ms for large with the current 300-thread page,
- below 300 ms if H shrinks as well.

## 9. Top contributors on the critical path, ranked

Ranking uses warm medians across the 8 warm scenarios plus the cold values.

| # | contributor | ms on critical path | hypothesis |
|---|---|---|---|
| 1 | **H: `threads` response → first rows** (client JS) | **134–412 warm, 246–640 cold**; median of warm medians ≈ 280 | All 300 threads of the page are parsed, address-parsed, i18n-formatted and turned into a list model, then React renders. Only ~18 rows are visible (virtualized DOM). Scales with page payload (860 KB for large) and with folder count (Intl formatting). CPU profile: react-dom 105–245, IntlMessageFormat 64–212, address `tokenize` 114–147. |
| 2 | **D: `/auth/me` done → `folders` request start** (main thread blocked, serialized bootstrap) | **64–101**, **248–284 when leaving the 50-folder mailbox** | `switchAccount` wipes list/view/search state, then `loadInitialData` awaits `/auth/me` before it requests folders. Meanwhile the main thread renders the wipe, tears down the old folder tree, and processes the **stale** old-mailbox `threads` response. |
| 3 | **F: `folders` done → `threads` request start** | **44–166 warm, up to 224 cold** | Thread fetching is chained behind React state: folders → render tree → effect sets `activeFolderId` → list effect → fetch. Grows with folder count (166–224 ms for 50 folders). The INBOX id is derivable at click time. |
| 4 | **G: `threads` server + download** | **108–154 (10k / 2k mailboxes)**, 16 (small), 33–41 (folders) | `pageSize=300`, 860 KB JSON, TTFB ~105–140 ms for the 10k INBOX. The concurrent `consistency` POST (STATUS over IMAP plus DB work) competes on the same server thread. Server profiling is Spike C's. |
| 5 | **Stale old-mailbox requests inflating E** (and D) | **+75–100** on `folders` when leaving large; +190–220 on D when leaving 50 folders | See §5: the effect at `MailClient.tsx:4823` re-selects the old INBOX after `setActiveFolderId("")`, which fires `threads` + `consistency` + `imap/stream` for the old account. |
| 6 | **A + B + C: `switch-account` → `/auth/me` round trips** | **25–45** (p99 150–300, one outlier 2.2 s) | Two serial round trips. The switch response could carry what `/auth/me` is re-fetched for. Not lock-bound at this scale. |
| – | **Off critical path, but "settled" and jank** | cold settled +600–1,000 ms vs. warm; 300–900 ms of long tasks after first rows | First-visit interactive `sync` → identical second `threads` (860 KB) + second set of 4 counts; 8 sender-icon requests; the second `/auth/me` + compose preload; HTTP/1.1 queueing behind 2 SSE connections per tab. |

## 10. Exact commands and environment

- **Host.** aarch64 Neoverse-N1, 12 vCPU, 23 GB RAM (Oracle).
- **Software.** Linux 7.0.0-1013-oracle; Bun 1.4.4; Node 24.22.1 (harness); Playwright 1.58.2 / Chromium 145.0.7632.0 headless, viewport 1440×900, locale de-DE; Next 16.4.2 / React 19.3.1.
- **Priority.** Every process ran under `nice -n 10`.
- **Load average** (`uptime` before each series, in `results/series.log`):

  | series | load average (before → after) |
  |---|---|
  | cold | 7.99 → 12.51 |
  | warm | 12.51 → 10.23 |
  | baseline-r2 | 4.09 → 7.45 |
  | contention-watcher | 7.45 → 16.28 |
  | contention-second-tab | 16.28 → 10.91 |
  | imap-latency-50 | 21.44 |
  | imap-latency-50b | 12.86 → 14.45 |
  | baseline-r3-lat0 | 17.65 → 15.86 |

  Sibling agents shared the box, so p90 values are load-sensitive and medians are more robust.

**Steps:**

```sh
# build (worktree, once)
rm -rf .next && nice -n 10 bun run build          # compile 21.1 s, exit 0
cp -r public/. .next/standalone/public/ && cp -r .next/static .next/standalone/.next/static
(cd .next/standalone && APP_ENV_LABEL=SPIKE ENV_FILE=/nonexistent bun ../../build-scripts/generateRuntimeConfig.ts)
# fixture: 4 IMAP listeners 127.0.0.1:3906-3909 (repo dev-fixture server/store/seed reused unchanged)
nice -n 10 bun harness/fixture.ts            # opt-in: LATENCY_MS=50, SPIKE_UIDV=uidv.json, inject.flag
# seed (app stopped): 1 admin user with TOTP + 4 mailboxes with manager membership
. harness/env.sh && nice -n 10 bun harness/seed.ts
# server: .next/standalone, PORT=3905 HOSTNAME=127.0.0.1, worktree .env.local + process-only synthetic
#         BETTER_AUTH_SECRET/BETTER_AUTH_URL=http://127.0.0.1:3905/PASSKEY_RP_ID=127.0.0.1, NOCTUA_MAILBOX_WATCHER=1
harness/start-server.sh run1
node harness/prime.mjs                        # per-folder full sync of every mailbox
harness/run-all.sh                            # cold, warm, (contention series re-run via run-contention.sh)
node harness/measure.mjs --series imap-latency-50b --mode warm --reps 10 --pairs small:large
node harness/trace.mjs --pairs small:large,folders:large --reps 3 --window 1500
node harness/profile.mjs small:large,large:folders && node harness/bychunk.mjs
node harness/analyze.mjs <results> > analysis.md ; node harness/segments.mjs <results>/*.json > segments.md
```

**Initial sync (not switch cost):**
- Watcher INBOX full sync on first start: medium ~6 s, large ~30 s.
- Per-folder full sync of all folders:
  - Run 1: small 3.9 s, medium 5.9 s, large 26.8 s, folders 57.9 s (50 jobs).
  - After the fixture restart: large 38.7 s, folders 32.4 s.

## 11. Caveats

- **Load.** Shared host with load average 4–21 (see §10). Absolute numbers on a quiet desktop browser will be lower. The cold and warm series ran at load 8–14; `baseline-r2` ran at load 4–7 and is ~10–30 % faster.
- **Headless Chromium** on an ARM server, not a user laptop. The CPU profile uses minified chunks, mapped by content fingerprints (labels in `cpu-profile-by-chunk.json`).
- **Loopback IMAP**, plaintext, fixture server. Remote IMAP with TLS adds to `consistency`, `imap/stream` and `sync` (see the §7 latency run; TLS is not simulated).
- **Synthetic content.** Short single-part messages, 1–4 per thread. Real threads with long bodies, many participants, HTML and attachments would likely make `threads` payloads and H larger.
- **Infrastructure.** Single-process standalone server over HTTP/1.1. Behind an HTTP/2 reverse proxy, the connection-queue stalls (§4, §7) would not occur. The dev preview's proxy and protocol was not checked.
- **`switch-account` timing.** Chrome emits no `loadingFinished` for `switch-account` because the client never reads its body; the harness uses response arrival for it (body 38 bytes; curl total 9 ms).
- **Run 1 IMAP retries.** 4 `imap.connect_retry` "Unexpected close" events for `spike-large` (watcher, 250 ms backoff), probably a fixture artefact; none affected measured switches.
- **Restart mid-run.** The T3 runtime restarted during the run (15:47 UTC) and killed fixture, server and the first `contention-watcher` attempt. That attempt used a 3 s inject interval and injected subjects without a marker, so `firstRows` never matched; it is discarded. Fixture and server were restarted, the mailboxes re-primed, and `baseline-r2` + both contention series re-run on the same server instance. `contention-second-tab` ran only after the restart.
- **Data dir left in place.** `/home/monkey/code/noctua-mail/data/noctua-data-spike-switch-e2e` (synthetic only) is intact for reuse; delete it if not needed.
