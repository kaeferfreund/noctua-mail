# V3 — mailbox switch: gzip, counts endpoint, IMAP deferral, stale fetches (measurement only)

Worktree `repo/wt-switch-verify` (branch `perf/switch-verify-scratch` @ 7425f75), 2026-10-23 18:38–19:20 UTC. No commits; the worktree is clean at the end, and `.tmp`/`.next` were removed. Synthetic data only (`example.test`), own ports 3970–3976.

**Measured build.** The questions ask about the state *after D5*, so the scratch tree was 7425f75 plus `git diff 7425f75 b4bf037` (perf/mailbox-switch-2 as committed) plus the uncommitted D5 work from `wt-perf-switch-2`, read at ~18:40 UTC: `useSecondaryAccountReads.ts` and the `readsEnabled`/`secondaryReadsReady` gates on topics, recipient aliases, reminders/calendar, members, virtual counts, the consistency POST and the startup sync. These changes were applied uncommitted and reverted afterwards.
- This tree lacks stage's e40b131 (A→B→A last-click fix), which does not change single-click switches.
- Production standalone build (`bun run build`, assembled as in `ops/deploy-dev.sh`), started with `bun --bun server.js` like the `noctua-dev` unit.

**Harness.** Spike A (`briefs/perf-mailbox-switch/e2e/harness`) with the same milestones:
- *first rows* = first row of the target mailbox in the DOM;
- *settled* = end of the last activity before 500 ms of quiet.

Setup:
- Mailboxes: small 50, medium 2,000 and large 10,000 messages, 6 folders each. The 50-folder mailbox was not used.
- Headless Chromium 1440×900, de-DE, warm switches back and forth.
- n = 10 per direction per series; the baseline pools three series (n = 30).
- Host load average 5–18 (shared host), so treat p90 as load-sensitive.

Harness additions are scratch only and described in the appendix:
- `THROTTLE` (CDP throughput/RTT);
- `HOLD` (hold matching requests until first rows);
- `FAKE` (answer matching requests from a cache);
- `OPEN` (open a message before the switch);
- `PRE` (click a third mailbox shortly before the measured switch);
- a compressing reverse proxy.

## Summary

**Context: first rows after D5.** Warm first rows are already low: p50 **155 ms** (large→small), **223 ms** (small→large), **200 / 220 ms** (large↔medium). Spike A, at different load, had 378–741 ms.

| # | Question | Result | Recommendation |
|---|---|---|---|
| 1 | gzip | API JSON is **not compressed**: no `Content-Encoding`, even though Next `compress: true` is active. HTML and `_next/static` are gzipped. Large first page: 860,918 B → 49,687 B with gzip-5 (3.5 ms CPU). Throttled first rows small→large: **581 → 292 ms** at 20 Mbit/s and 40 ms RTT, **1,603 → 306 ms** at 5 Mbit/s and 80 ms RTT. | **Do now, as a go-live item:** Caddy `encode` in the runbook (no app code). App-level compression only if Caddy is not used. |
| 2 | Counts endpoint | The 4 counts start **after** first rows (p50 286–389 ms) and are done by 320–431 ms. They are applied in one `setState`. Server time on the 10k mailbox is 9 + 28 + 28 + 15 = **80 ms** in sequence (medium 35, small 25). Answering them from a cache changed neither first rows nor settled measurably. | **After go-live.** Worth it only together with a single-pass count query; the request saving alone is ~3 × 3.5 ms. |
| 3 | IMAP POST / IDLE stream | After D5 the consistency POST starts at 118–201 ms (TTFB 13–32 ms). The `imap/stream` starts at 60–80 ms (TTFB 11–20 ms, 63–67 ms on the 10k mailbox). Holding the stream until first rows: first rows 157 / 220 / 225 ms vs baseline 155 / 223 / 220 ms, so **no change**. | **Drop** the stream deferral. Keying the stream by account: after go-live, no first-rows gain. |
| 4 | Stale fetches | **0 of 120** warm switches started a request for the old mailbox after the click (Spike A: 3 per switch, up to 861 KB). With an open message, nothing from the old mailbox was in flight except a sender icon (383 B), and no reader content leaked. Rapid A→B→C: tiny deferred reads of B still start 9–22 ms after the click. | **Drop** abort work for body/refresh/folder reads. An optional small follow-up for the rapid-click case goes to the switch-2 follow-up / backlog. |

## 1. gzip (Muse M7, GPT G13)

### 1.1 What the production build sends today

Requests sent with `Accept-Encoding: gzip, deflate, br, zstd` to `bun --bun server.js`:

| response | bytes on the wire | `Content-Encoding` |
|---|---|---|
| `GET /api/accounts/{large}/threads?page=1&pageSize=300&groupBy=date&…` | **860,918** | none (chunked, `Vary` without `Accept-Encoding`) |
| same with `identity` / `gzip` / `br` | 860,918 each | none |
| `GET …/{medium}/threads` (first page) | 867,857 | none |
| `GET /api/auth/me`, `…/folders` | 2,376 / 1,031 | none |
| `GET /` (HTML) | 29,046 | **gzip** |
| `GET /_next/static/chunks/*.js` (largest, 876,547 raw) | 305,752 | **gzip** |

- **Next's `compress` is on.** It is `"compress":true` in the standalone `server.js`, and `router-server.js` wraps every response with the `compression` middleware.
- **Route-handler JSON never gets the middleware's header hook.** API responses carry no `Vary: Accept-Encoding`.
- **Root cause not isolated.** A minimal Bun `node:http` + Next `compression` test (setHeader, appendHeader and flushHeaders variants) *does* compress. So the cause sits on the App Router route-handler path (`send-response.js` → `pipeToNodeResponse(originalResponse)`) under Bun.
- **Node comparison impossible.** The app needs `bun:sqlite`, so `node server.js` answers 500 for data routes.
- **No config switch fixes it.** `compress` is already true.

### 1.2 Size and CPU (≥ 10 runs each, Bun zlib, warm)

| payload | identity | gzip-1 | gzip-5 | gzip-6 | br-4 | br-11 | zstd-3 |
|---|---|---|---|---|---|---|---|
| large first page (300 threads) | 860,918 | 80,762 (9.4 %) | **49,687 (5.8 %)** | 49,206 | 43,753 (5.1 %) | 34,823 | 45,554 |
| CPU compress p50 / p90 (ms) | – | 1.3 / 1.4 | **3.5 / 3.5** | 4.0 / 4.1 | 3.8 / 3.9 | **1,806 / 1,880** | 1.3 / 1.4 |
| client decompress p50 (ms) | – | 1.1 | 0.8 | 0.8 | 0.8 | 0.9 | 0.7 |
| small first page | 45,642 | 5,167 | 3,568 | 3,546 | 3,309 | 2,773 (70 ms) | 3,427 |
| `/auth/me` / `folders` | 2,376 / 1,031 | | 650 / 263 | | 624 / 245 | | |

- **br-11 is unusable on the fly** (1.8 s per response); gzip 5–6, br 4 and zstd 3 are all ≤ 4 ms.
- **The compressing proxy used little CPU:** 50 gzip responses (all JSON/HTML of a series) took 40 ms in total.
- **Caveat on ratios:** synthetic subjects and addresses repeat, so they compress about 17×. Real mail (varied names, snippets, Message-IDs) will compress less. A typical JSON list compresses 5–10×, which would still be about 90–170 KB instead of 861 KB.

### 1.3 First rows under throttling

**Setup.**
- Chromium CDP `Network.emulateNetworkConditions`, applied after the page load.
- Both arms ran through the same harness proxy on 127.0.0.1:3975: `ENC=none` passes everything through unchanged (today), `ENC=gzip` gzips uncompressed JSON/HTML at level 5 (≈ Caddy `encode gzip`).
- Warm, n = 10 per direction.

| profile | direction | first rows p50 / p90 (none → gzip) | settled p50 / p90 (none → gzip) | `threads` done p50 (none → gzip) |
|---|---|---|---|---|
| 20 Mbit/s, 40 ms RTT | small → **large** | **581 / 599 → 292 / 497** | 931 / 975 → 638 / 816 | 457 → 128 |
| 20 Mbit/s, 40 ms RTT | large → small | 189 / 208 → 196 / 314 | 435 / 533 → 439 / 550 | 67 → 51 |
| 5 Mbit/s, 80 ms RTT | small → **large** | **1,603 / 1,626 → 306 / 332** | 2,010 / 2,086 → 687 / 766 | 1,482 → 183 |
| 5 Mbit/s, 80 ms RTT | large → small | 268 / 290 → 232 / 239 | 647 / 699 → 545 / 636 | 163 → 95 |

Unthrottled loopback (no proxy) is 223 ms for small→large. Over a household Wi-Fi or mobile link, the uncompressed 861 KB page is the largest single item on the switch path. Gzip removes most of it.

### 1.4 Where to enable it

**(a) Caddy `encode` at go-live — recommended, do now (runbook edit, no app code).**
- Caddy already terminates TLS for `mails.monkeymed.de` (`briefs/go-live-runbook.md` §0, §2).
- Compression runs in Caddy's own process, not on Bun's event loop.
- Responses Next already gzipped (HTML, static) carry `Content-Encoding` and are left alone.
- The same Caddy also gives HTTP/2. That removes the HTTP/1.1 six-connection cap that the two SSE streams per tab hit in Spike A §4/§7 (GPT G13).

Sketch for the runbook's Caddyfile site block:

```caddyfile
mails.monkeymed.de {
	encode {
		gzip 5
		zstd
		minimum_length 1024
		# explicit list: never text/event-stream (SSE: /api/me/events, /imap/stream)
		match {
			header Content-Type application/json*
			header Content-Type text/html*
			header Content-Type text/css*
			header Content-Type application/javascript*
			header Content-Type image/svg+xml*
		}
	}
	reverse_proxy 127.0.0.1:3654
}
```

Downsides and checks:

- **SSE.** The match list excludes `text/event-stream`, so SSE frames are never buffered by a compressor. Go-live check: new mail and collab events still arrive live through Caddy (one test mail, observe the stream in DevTools).
- **BREACH-type length side channel.** It needs a secret and attacker-controlled input in the same compressed response, plus an attacker who can make the victim's browser send credentialed requests and watch their sizes. The session cookies are `SameSite=Lax` and `HttpOnly` (checked in the harness storage state), and JSON responses carry no CSRF tokens, so the risk is low. Do not add `encode` for any response that echoes a secret.
- **CPU.** ~3.5 ms per 861 KB page at gzip-5 (Bun/zlib; Go's gzip is the same order of magnitude), only on large lists.
- **The dev preview is not affected.** It runs through Tailscale Serve on 3790, so it stays uncompressed and is the slow case on mobile. Option (b) closes that gap if the preview should be fast on mobile before go-live.

**(b) App-level, only if Caddy is not used or the preview must be fast.**
- A helper such as `jsonResponseMaybeCompressed(request, body)` in `app/api/_helpers/response.ts`. It sets `Content-Encoding: gzip` and `Vary: Accept-Encoding` when the request accepts gzip and the body is ≥ 8 KB.
- Use it only in `app/api/accounts/[accountId]/threads/route.ts`, `app/api/messages/listMessagesHandler.ts` and the related/thread read.
- Downside: ~3.5 ms of compression per large page on the single Bun event loop (`CompressionStream` would stream it), plus double-compression avoidance once Caddy is added.
- After go-live unless the user asks for a faster mobile preview.

**(c) Fixing Next's own compression under Bun.**
- Root cause unknown (§1.1). It would be an upstream/Bun investigation with no clear end, so drop it.

## 2. Virtual counts → one counts endpoint (GPT G03, Muse M4)

### 2.1 What the 4 counts cost after D5

**Source.** `useSearchState.ts` ~l.208. The 4 requests are `GET …/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=<focused|todo|calendar|calendar,unread>&excludeFolderIds=…`.
- They run after a 160 ms debounce and only once `secondaryReadsReady` is true.
- `Promise.all` resolves them into **one** `setVirtualCounts`.

Baseline warm, pooled n = 30 per direction:

| direction | first rows p50 / p90 | counts start p50 | counts done (last of 4) p50 | count TTFB p50 / p90 | settled p50 / p90 |
|---|---|---|---|---|---|
| large → small | 155 / 251 | 286–334 | 320 | 18–22 / 23–39 | 368 / 494 |
| small → large | 223 / 291 | 338–389 | 427 | 55–64 / 76–97 | 560 / 618 |
| large → medium | 200 / 270 | 310–342 | 366 | 24–32 / 32–56 | 505 / 597 |
| medium → large | 220 / 309 | 336–369 | 431 | 50–66 / 74–88 | 548 / 627 |

- **Requests per switch:** 4, all after first rows in 100 % of runs, none aborted in warm single switches. In the rapid-switch series they are aborted 24–36 of 40 times when the user moves on (§4).
- **Server cost per request** (curl, sequential, warm, 10 runs after 2 warm-ups, TTFB p50 / p90 ms):

  | mailbox | focused | todo | calendar | calendar,unread | sum | trivial authorized route (`/topics`) |
  |---|---|---|---|---|---|---|
  | large 10k | 9.4 / 9.6 | 27.9 / 28.3 | 28.3 / 29.5 | 14.5 / 14.7 | **80** | 3.6 |
  | medium 2k | 7.8 / 8.8 | 9.9 / 10.6 | 9.8 / 10.0 | 7.6 / 8.0 | **35** | 3.5 |
  | small | 6.9 / 7.1 | 6.3 / 6.7 | 6.0 / 6.1 | 6.0 / 6.6 | **25** | 3.4 |

- **A/B "counts for free"** (`FAKE=badges=`): each count was answered from a cache in the browser, with no server work. First rows were 167 / 240 / 243 / 235 ms vs baseline 155 / 223 / 200 / 220 ms. Settled was 461–656 ms vs 368–560 ms.
  - Not better: the differences are within load noise and Playwright request interception (cache off, so more sender-icon requests: 22 vs 14 requests per switch).
  - The counts do not determine *settled*; topics/stats, recipient aliases and sender icons end later.

### 2.2 Is a counts-only endpoint worth it?

**Not for the switch.** It saves 3 requests, about 3 × 3.5 ms of auth/route floor and three `pageSize=1` item payloads with topic/collab enrichment.
- The bulk is the `todo` and `calendar` queries (~28 ms each on 10k). A merged endpoint only helps there if they become one SQL pass.
- There is a gain on the server under load: the counts re-run on every `folderCountsKey` / `syncCompletionVersion` change. Spike A measured ×2.5–3 under watcher contention.

**Recommendation: after go-live**, together with a single-pass count query.

Route sketch:
- `app/api/accounts/[accountId]/virtual-counts/route.ts`, `GET ?excludeFolderIds=…`.
- `requireActiveUserSession(request)` → `requireAccountContext(request, accountId, { minRole: "viewer" })` (same as the list) → `validateAccountFolders(accountId, excludedFolderIds)`.
- Then `countVirtualFolders({ accountId, viewerUserId: session.userId, excludedFolderIds })` returns `{ focused, todo, inviteTotal, inviteUnread }`. No items, groups or enrichment.
- Wrapped in `withAuthResponse`. `Cache-Control: no-store` as for other account reads.
- **DB:** new `countVirtualFolders` in `lib/db/messages/query.ts`, reusing the badge predicates of `listMessages`. Preferably one statement with `SUM(CASE …)` per badge over the same base `WHERE` (account, excluded folders, thread-level dedup as the list does).
- **Client:** `useSearchState.ts` replaces the four `fetchCount` calls with one fetch. The debounce and the D5 gate stay as they are.
- **Tests:**
  - viewer of another mailbox → 403;
  - `excludeFolderIds` containing a folder of another account → rejected as in the list;
  - result equal to the four list totals on the fixture.

## 3. IMAP consistency POST and IDLE stream (Grok I1, Muse M8 + M9)

### 3.1 Cost on the switch path after D5

| request | per switch | start p50 (ms after click) | TTFB p50 | relation to first rows |
|---|---|---|---|---|
| `POST …/folders/{new}:INBOX/consistency` | 1 | 118–201 | 12–32 (large 24–32) | starts when the first page settles, ~30–50 ms before the rows are in the DOM (D5 gate) |
| `GET …/{new}/imap/stream` (SSE) | 1 | 60–80 | 11–20 (small/medium), **63–67 (large)** | starts before first rows; `threads` ends at 104 ms (large) |
| old stream | closed by the client on the switch | – | – | no reopen for the old mailbox (Spike A: reopened in 100 % of switches) |

**A/B: hold `imap/stream` until first rows** (`HOLD=/imap/stream`, n = 10 per direction):

| direction | first rows p50 / p90: baseline (n = 30) → held | `threads` end p50 baseline → held |
|---|---|---|
| large → small | 155 / 251 → **157 / 167** | 23 → 30 |
| small → large | 223 / 291 → **220 / 263** | 104 → 112 |
| medium → large | 220 / 309 → **225 / 367** | 105 → 118 |
| large → medium | 200 / 270 → 300 / 575 | 63 → 100 |

- **No measurable first-rows gain.** The large→medium regression is likely noise plus the interception overhead (Playwright routing turns the cache off), not a real effect.
- **The stream never gated rows.** The client does not wait for the stream before the list, and on the server the stream's IMAP connect and IDLE run beside the `threads` read without lengthening it.
- **Consistent with Spike A §7.** With 50 ms IMAP latency, stream TTFB rose to 486–671 ms while first rows moved by only +45–63 ms.

### 3.2 Recommendation and risks

**Deferring the stream: drop.** No gain was measured. Its risks would be small but non-zero:
- **New mail missed:** mail arriving between the switch and a late stream open is still caught by the D5-deferred consistency POST (STATUS/fingerprint), so the risk is low.
- **Revocation:** unchanged. The stream route authorizes at open (`requireAccountContext(... minRole: "viewer")`) and closes on the auth stream (`app/api/accounts/[accountId]/imap/stream/route.ts` l.44, 92–145).

**Consistency POST:** already deferred by D5. Keep its fingerprints; nothing further.

**Keying the stream by account (M9):** after go-live, no first-rows effect.
- The stream URL is already per account, and the client already closes the old stream without reopening it.
- What remains per switch is one SSE request plus an IMAP IDLE login for the new mailbox. Under real TLS this costs about 0.5 s until live updates, but not until rows.
- Keeping up to 2–3 recently used streams open would make a back-switch "live" sooner. It costs one HTTP/1.1 connection each (critical until HTTP/2 via Caddy, §1.4) plus IMAP connections on the server.

## 4. Stale fetches after a switch (Grok A1, GPT G10)

### 4.1 Plain switches and switches with an open message

| series | n (warm) | old-mailbox requests started after the click | old requests in flight at the click | first rows p50 / p90 | old reader content visible after the switch |
|---|---|---|---|---|---|
| baseline (no message open) | 120 | **0** | 0 | see §2.1 | – |
| message opened and settled, then switch | 20 | 0 | 0 | 167 / 208 (l→s), 232 / 272 (s→l) | 0 / 20 |
| message opened, switch 30 ms later | 20 | 0 | 0 | **325 / 388** (l→s), **317 / 383** (s→l) | 0 / 20 |
| 20 Mbit/40 ms, opened and settled | 20 | 0 | 0 | 226 / 245, 585 / 738 | 0 / 20 |
| 20 Mbit/40 ms, switch 10 ms after opening | 20 | 0 | sender-icon 0.8–0.9 per switch (383 B, not aborted, ends 82–112 ms after the click) | **433 / 476**, 587 / 719 | 0 / 20 |

- **No message body to abort.** Opening a message in this build fires `threads/{id}/collab`, `thread/related` and a sender icon; the body comes with the list page. When the switch follows within 10–30 ms, collab and related never left the browser, and only the sender icon was in flight.
- **The slowdown after an open-then-switch is main-thread work.** Click → highlight was 225 ms vs 57 ms, and long tasks before first rows were 194 ms vs 106 ms (p50). This is the reader render for the just-opened message. Aborting fetches would not change it.
- **No correctness risk observed.** Old-mailbox text in `document.body` after the switch was 0 in 80 runs.

### 4.2 Rapid A → B → C (leave B 80 or 250 ms after clicking it)

`PRE=medium,<ms>`: an unmeasured click on the medium mailbox, then the measured switch to small or large. n = 10 per direction.

| leave B after | direction | first rows p50 / p90 | B's requests after the click (per switch; aborted/total) |
|---|---|---|---|
| 80 ms | B → small | 177 / 285 | counts 3.2 (24/32 aborted); topics/stats, recipient aliases 0.2 (0 aborted); topics, calendar, members, **consistency** 0.2 each (0 aborted); sender icon 0.8. B's `threads` was in flight in 1 of 10 runs and was aborted. |
| 80 ms | B → large | 218 / 302 | counts 4.0 (36/40 aborted); topics/stats, recipient aliases 0.8; topics, calendar, members, consistency 0.1 each |
| 250 ms | B → small | 214 / 253 | counts 3.6 (**0/36 aborted**); topics/stats, recipient aliases 0.8 |
| 250 ms | B → large | **303 / 327** (baseline medium→large 220 / 309) | counts 3.2 (8/32 aborted) + 0.8 in flight; topics/stats, recipient aliases 1.0 |

**Bytes:** all of B's stale responses are 33–335 B. The large old first page never repeats, because `threads` for B is aborted or already finished.

**Server work:** up to ~35 ms of count queries on the 2k mailbox, plus one consistency POST (IMAP STATUS) for B in about 10–20 % of these rapid switches.

**First rows:**
- **Leaving after 80 ms:** no measurable effect.
- **Leaving after 250 ms, B→large:** +83 ms p50 vs the plain medium→large baseline.
- **Attribution not isolated.** Candidates are B's stale counts and topics/stats competing with the new `threads` on the single server loop, and B's stream close.

**Why they still start.**
- `topics/stats` and `recipient-aliases` start 9–22 ms after the click.
- `activeAccountId` stays on B until `switch-account` and `folders` return (~10–20 ms), so B's `deferUntilIdle` / `secondaryReadsReady` callbacks can still fire in that window.
- The virtual counts are aborted only when their effect re-runs.

**Correctness:** no leak observed. Row counts after the switch were always the target's (16 for small, 19 for large). Topics and counts are stored keyed by `accountId` (`useTopics.ts` `storedTopics.accountId`, `setVirtualCounts({ accountId, … })`).

### 4.3 Recommendation

**Drop.** A1/G10, as proposed (abort the old body, refresh and folder fetches), has nothing left to act on after D4/D5 and the switch-2 commits.

**Optional, small, after go-live or as a P3 for the switch-2 follow-up: make `secondaryReadsReady` false while a switch is pending.** It only matters when clicking through mailboxes quickly (≤ 0–80 ms first-rows gain in the 250 ms case, plus less server work).
- `useAccountController.ts`: expose `switchPending` (it already counts `switchesInFlight`).
- `useSecondaryAccountReads.ts`: `ready = … && !switchPending`.
- `useTopics.ts` (`fetchTopicMessageCounts`) and `useRecipientAliases.ts` / its resource: pass an `AbortSignal` that the account-change cleanup aborts.
- The consistency effect in `useSyncController.ts` follows automatically through `secondaryReadsReady`.

## Appendix — method details (scratch, not kept)

**Server.**
- `.next/standalone/server.js` under `bun --bun`, `PORT=3970`, `NOCTUA_MAILBOX_WATCHER=1`.
- Process-only synthetic `.env` (`IMAP_CREDENTIALS_STORAGE=db`, random keys), data dir in the worktree's `.tmp`.
- Fixture: Spike A `fixture.ts` on 3971–3973 (small, medium, large). Seeded with Spike A `seed.ts`; every folder fully synced before measuring (`prime.mjs`).
- Port 3976 was briefly used for a `node server.js` comparison, which fails on `bun:sqlite`.

**Harness options added to Spike A `measure.mjs`:**
- `THROTTLE=<mbit>,<rtt>`: CDP `Network.emulateNetworkConditions` after the page load; upload = half of download.
- `HOLD=<regex>`: `page.route`, continue once the first-rows mark exists (max 3 s).
- `FAKE=<regex>`: fulfill from a per-URL cache of the first real response.
- `OPEN=settled|<ms>`: click a random one of the first 12 rows of the current mailbox, then wait.
- `PRE=<key>,<ms>`: unmeasured click on a third mailbox, then the measured switch.
- `inflightAtClick` now records the abort status, the end relative to the click and the bytes.

**Compressing proxy** (Bun, 127.0.0.1:3975 → 3970):
- Rewrites Origin, Referer and Host to the upstream origin.
- Upstream is fetched with `decompress: false`.
- `ENC=gzip`: `zlib.gzipSync(level 5)` on uncompressed `json` / `text/html` bodies ≥ 512 B.
- `ENC=none`: unchanged pass-through, streaming bodies, so SSE works.

**Compression bench:** `zlib.gzipSync` / `brotliCompressSync` / `zstdCompressSync` on the captured responses, 20 runs (br-11: 10) after 2 warm-ups.

**Load average per series** (before → after):

| series | load average |
|---|---|
| baseline | 18.4 → 12.9 / 7.8 → 8.0 / 8.4 → 4.9 |
| hold-stream | 8.0 → 9.0 |
| fake-counts | 9.0 → 8.4 |
| 20 Mbit/s gzip / none | 18.2 → 13.3 / 12.8 → 10.2 |
| 5 Mbit/s none / gzip | 9.9 → 12.2 / 12.2 → 8.1 |
| open | 6.3 → 12.7 |
| rapid (`PRE`) | 12.8 → 7.4 |
