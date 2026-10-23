# Performance backlog rerank on integration/stage 11dc3c5 (round 8)

## Summary

Read-only research on **11dc3c5** (`origin/integration/stage`, round-8 head), exclusively in `/home/monkey/code/noctua-mail/wt-perf-rerank2`, 2026-10-23 UTC. No tracked-file changes, commits, branches, pushes, PRs, or real mailbox reads. Exactly **one** `nice -n 10 bun run build` (exit 0). Bun 1.4.4 / Next 16.2.4 / React 19.2.5 / SQLite 3.53.4. All DB experiments used synthetic data under `/tmp/perf-rerank2/` with production writer guards intact. No HTTP server was started; startup analysis is source-derived (caveat below). Final `git status --short` is empty.

Top five, ordered by saving per risk:

1. **FTS-driven search candidate generation (still open, re-proven).** Real `listThreads` search `needle`: **81.03 ms**. Raw equivalent: current OR-scan shape **13.94 ms** vs FTS-driven join **0.21 ms**, same 28 ids. Estimate **10–60 ms** per search at 11k across selector + three count/group scans, which each repeat the FTS subquery. FTS v3 changed identity, not the search driver.
2. **Batch request-local account/identity/role/member presentation (still open).** `listAccessibleAccountsForUser`: **61 preparations / 3.62–3.75 ms** at 12 accounts; 12-account mailbox summary **157 prepares + 24 cached / 19.59 ms**; a one-account scoped event read still costs **69 prepares / 12.38 ms** because access metadata loads all accounts first. Estimate: ≤4 batched metadata statements; most of the repeated preparation/materialization disappears. No proven HTTP delta.
3. **Split `rrule` out of the eager mail path (new, cheap).** `0-2~3usm75doz.js` **57,208 raw / 16,969 gzip** is eager on `/` via module-level `import { RRule }` in `lib/calendar.ts`, pulled in by message-preview components that only need date formatting. Splitting recurrence helpers from formatters (or dynamic import at recurrence call sites) is a measured **~17 KB gzip** first-load candidate.
4. **i18n payload: full catalog inline on every page (new cost, partially regressing windows).** Root layout serializes the whole locale catalog into every response: `de.json` **49 KB raw / 13.2 KB gzip**, `en.json` **43 KB / 11.8 KB gzip**, plus eager `@formatjs` chunk **40,676 raw / 12,627 gzip**. Window routes regressed vs 435ba5d (compose **396.4 → 433.7 KB gzip**, message **420.4 → 460.5 KB**) while `/` improved. Namespace-scoped catalog delivery is the candidate; it overlaps i18n 3, so it is ranked here but must be scheduled with that owner.
5. **Resident sync worker (still open, cost grew).** Cold `import(syncOperation)` median **~328 ms** (5 fresh processes: 298–346 ms), up from **247.94 ms** at 435ba5d under comparable method (shared-box load differs; treat direction as indicative, not exact). Each folder job still spawns a fresh Bun child (`lib/syncJobs.ts:439`) and drains its IMAP pool. Saving per subsequent job: one graph import plus one IMAP login (unmeasured here).

Headline status: the six round-6/7 perf branches, retrieval statements, and FTS v3 all verified landed with before→now numbers below. The old top-5 from `perf-backlog-rerank.md` is **closed except its rank 11 (FTS-driven search) and rank 6b/8 server halves**, which are now ranks 1–2 here. No new eager-Markdown regression: the 44 KB parser chunk is out of first load again.

Regressions found: **(a)** window-route JS grew (i18n, see rank 4); **(b)** cold sync import grew ~248→~328 ms (indicative); **(c)** main-route JS still **68.7 KB gzip above** the startup-r2 low of 600.770 KB despite all lazy fixes landing — the remaining delta is collab/auth/i18n feature code, itemized below, not one broken boundary.

## Status of earlier items

Numbers are this run's synthetic measurements (same harnesses as `perf-backlog-rerank/`, adapted for FTS v3) vs the values recorded at 435ba5d. "Done" means the production code change is present at 11dc3c5 **and** the re-measured number moved as predicted.

| Item (prior rank) | Status | Before (435ba5d) → Now (11dc3c5) | Evidence |
|---|---|---|---|
| Flagged EXISTS selector (rerank 1) | **Done** `709aa48` | Selector 149.47 ms; whole `listThreads` **194.45 → 60.57 ms** | `query.ts:2439–2451` EXISTS ordering; EQP: `SEARCH mf USING idx_messages_account_flagged_thread`, temp sort remains. Residual 60 ms is member projection + counts + group counts, not the flagged join. |
| Collab Markdown viewer lazy (rerank 2) | **Done** `fc8883a` | Parser chunk eager 44,107 gzip → **not in any first-load list** (3 copies exist as async chunks) | `ThreadActivityPanel.tsx:8` imports `MarkdownPanel` from `RenderHelpers.tsx:12` (dynamic). |
| Scoped author normalization (rerank 3) | **Done** `6b670cb` | Public one-thread recompute **67.21 → 4.74 ms**; internal 0.88 → 0.95 ms | Same `recompute.ts` harness. Residual ~3.8 ms over internal is signal rebuild, acceptable. |
| Statement reuse: remap + stable loops (rerank 4) | **Done** `171b129` | Real remap 1k+1k **56.88 → 14.77 ms**, same counts/revisions | Production `remapThreadCollab`, rollback-isolated. Beats the earlier cached-experiment 16.88 ms. |
| Retrieval statements (round 7) | **Done** `64cdb64` | 5k stable reads reprepare 73.56 ms → reuse 21.62 ms (prior experiment); production now uses `db.query` at `retrieval.ts:30`,`:74` | Harness control this run: reprepare 70.85 ms vs reuse 25.41 ms (mechanism unchanged). |
| FTS row identity (rerank 5) | **Done** `3827447` v3 | 200 deletes by key 2,135.58 ms → production rowid path **5.52 ms**; key-scan counterfactual on v3 table 2,425.29 ms | `ftsIdentity.ts:70` integer delete; `perf-fts-identity-v3.md` reports upsert 29.187 → 0.231 ms on its fixture. |
| Settings modal lazy (external) | **Done** `ddf5406` | Static → `dynamic(ssr:false)` | `MailClient.tsx:297`. Byte effect folded into route totals below. |
| AdminPanel lazy, both sites (rerank 7a) | **Done** `db595c5` | Static both sites → dynamic both sites; `CreateMailbox` also dynamic | `MailClient.tsx:301`,`:305`; `ShellUserMenu.tsx:24`. |
| SecuritySettings lazy (rerank 7b) | **Open** | Still static `MailClient.tsx:40`; source 9,010 bytes | Estimated ≤3 KB gzip. Candidate rank 7 below. |
| Provisioning userId/state index (rerank 9) | **Done** `7f082aa` | 20k-history probe 1.191 ms → **0.01 ms**; accessible-accounts at 100 users/20k **22.22 → 4.98 ms** | EQP: `SEARCH … USING COVERING INDEX idx_user_provisioning_user_state`. Scratch index in harness now redundant (0.01 ms both). |
| Collab identity reuse (rerank 6a) | **Done (client half)** | `useThreadCollab` no longer fetches `/api/auth/me`; takes `currentUserId` option (`useThreadCollab.ts:78`,`:311`) | Members channel semantics retained per hook header spec. |
| Account presentation batching (rerank 6b) | **Open** | 61 prepares / 3.13 ms → **61 prepares / 3.62 ms** (unchanged structure) | Rank 2 below. |
| Summary/SSE dedup (rerank 8) | **Client done, server open** | Client: one canonical snapshot per connection, coalesced repair (`useMailboxSummaries.ts:17`); server summary still **157 prepares / 19.59 ms**, scoped event **69 / 12.38 ms** | Server half = rank 2. Do not re-propose the client half. |
| Resident sync worker (rerank 10) | **Open, cost up** | Cold import 247.94 → **~328 ms** median | Rank 5. |
| FTS-driven search (rerank 11) | **Open** | Search 80.36 → **81.03 ms**; raw 13.70→0.207 then, **13.94→0.21 now** | Rank 1. |
| Collab snapshot bounds/indexes (rerank 12) | **Open** | Snapshot **2.47 ms / 367,958 JSON bytes** (identical bytes); comments/activity EQP still `TEMP B-TREE FOR LAST TERM OF ORDER BY` | Rank 8. |
| Dual sanitize + prefs dedup (rerank 13) | **Open** | Both modes still computed pre-opt-in (`HtmlMessage.tsx:480–481`); prefs fetched per viewer (`useRemoteContent.ts:25`) | Parse bench under load 10.5 too noisy for a new claim (pair median 211 ms, range 65–783 ms — discarded as evidence). Rank 9, unchanged rationale. |
| Bulk-copy batching / Sent ingest (rerank 14) | **Open** | `completeSend.ts:83` still `syncImapMessage` FETCH+parse of just-appended Sent copy | Rank 10. Overlaps sender-identities. |
| Lighter sync parse (rerank 15) | **Open** | Full parse 10.54 ms then; **5.50 ms** now on same fixture (load differs; no regression claim) | Rank 11, deprioritized. |
| Tiny items (rerank 16) | **Open** | `/api/version` still `readFile`+parse per request (`route.ts:20–22`); no public font/icon cache rule in `next.config.ts` (only `/reset-password` no-store) | Rank 12. |
| Fork CI guards (rerank 17) | **Open** | No `github.repository` job guard in the three workflows (only image-name uses) | Rank 13. |
| Writer guards | **Keep, unchanged** | v3 installs 81 guards; `perf-writer-guards.md` conclusion stands | No re-proposal. |

## Measurements

### Client bundle (one production build)

Method identical to prior briefs: unique `firstLoadChunkPaths` from `.next/diagnostics/route-bundle-stats.json`, raw bytes summed, **gzip level 6 per asset, then sum**. CSS is the deduplicated `entryCSSFiles` union from each route's client-reference manifest. Decimal KB. Asset budgets, not transfer/LCP/hydration measurements. Build: compile 33.2 s, TypeScript 35.5 s, 31/31 pages, wall 73.0 s under `nice -n 10` (load 4.5→11.7 during build; timings are this-box observations, not lab numbers).

| Route | r2 gzip KB | 435ba5d gzip KB | Now chunks | Now raw KB | Now gzip KB | Δ vs 435ba5d | Now CSS raw / gzip KB |
|---|---:|---:|---:|---:|---:|---:|---|
| `/` | 600.770 | 694.060 | 26 | 2,207.028 | **669.487** | **−24.573 / −3.5%** | 913.382 / 121.424 |
| `/compose/window` | 375.044 | 396.370 | 19 | 1,418.354 | **433.720** | **+37.350 / +9.4%** | 908.048 / 120.409 |
| `/message/window` | 411.549 | 420.372 | 20 | 1,513.116 | **460.526** | **+40.154 / +9.6%** | 908.048 / 120.409 |
| `/calendar/window` | — | 366.471 | 19 | 1,247.909 | 374.915 | +8.444 / +2.3% | 908.048 / 120.409 |
| `/calendar/import` | — | 197.587 | 12 | 703.868 | 210.442 | +12.855 | (shared shell CSS) |
| `/reset-password` | — | 195.191 | 12 | 683.403 | 208.439 | +13.248 | (shared shell CSS) |
| `/_not-found` | — | 174.443 | 10 | 628.281 | 186.759 | +12.316 | (shared shell CSS) |

Interpretation. `/` improved because settings + admin + CreateMailbox + collab-viewer lazy boundaries removed more than i18n/collab-2b/sender-identities added. Every other route grew by roughly the i18n increment (formatjs 12.6 KB gzip + next-intl runtime + localized strings in shared chunks); windows got none of the lazy wins because settings/admin were never in their graphs. The inline catalog (~13 KB gzip in HTML/RSC) is **additional** to these JS totals on every route.

Largest eager `/` chunks:

| Asset | Raw / gzip KB | Contents |
|---|---:|---|
| `0h4t8iys.pj_t.js` | 496.136 / **143.975** | Main app aggregate (was 586.5/165.7 at 435ba5d — lazy splits shrank it ~90 KB raw) |
| `0ggw_r.w8rtd2.js` | 314.207 / **95.154** | HTML display sanitizer/parse5-8/entities (unchanged role) |
| `030lje4w49skv.js` | 226.465 / 71.591 | React DOM + Next runtime (shared all routes) |
| `08oifa2eo7hqr.js` | 150.200 / 45.671 | Radix/dialog/list aggregate |
| `11ue2jytkbcin.js` | 136.911 / 37.594 | Shared runtime (all routes) |
| `03qqh89wbt5rj.js` | 100.301 / 29.533 | Compose/controller aggregate (`/`, compose window) |
| `17202.ly6wn4z.js` | 98.553 / 30.620 | App + Lucide icons |
| `0vlok-zm8sd0d.js` | 71.513 / 22.364 | Radix primitives |
| `0-2~3usm75doz.js` | 57.208 / **16.969** | **rrule — eager via `lib/calendar.ts` (rank 3)** |
| `12z3bez7lh5mb.js` | 40.676 / **12.627** | **@formatjs (next-intl) — new in round 6–8 (rank 4)** |

Lazy boundaries verified in emitted output: Markdown parser groups (153,723 raw / ~44 KB gzip ×3 route copies), raw-HTML parse5-7 pipeline (182,633 / 59.2 KB ×2), UIW editor (875,701 / 305,567), Lexical (411,079 / 126,631), FullCalendar (264,810 / 77,897) — all `routes: []` (async only). Nothing static drags them back: no eager chunk fingerprints micromark/mdast/unified/Turndown. Remaining static heavyweights with conditional mounts: `SecuritySettings` (static import, rank 7).

CSS/fonts. Global file `021~f7g5qg6by.css` 813,605 raw / 104,366 gzip; `@layer radix` spans **685,403 raw** (84.2% of the file; standalone gzip 80,937 — attribution estimate, not additive). Radix Themes removal is planned separately and not recommended here. Inter subsets intact: latin **105,344 bytes** on disk (103 KB listing), six files total 528 KB, only latin loads for Latin UI. No change since assets brief.

### Startup waterfall (source-derived; no runtime trace)

Caveat: no standalone server/browser trace was run in this task (the one-build budget went to bundle measurement; ports 3908+ unused). The sequence below is read from current source and the existing DOM regression tests; request counts are structural, latencies unmeasured.

1. `GET /api/auth/me` — sole bootstrap (`useAccountController.ts:136`). Returns user, sanitized accounts, persisted selection, security state. Server side still: session guard → `getUserById` again (`auth/me/route.ts:11`) → `ensureActiveAccountId` → `sanitizeAccountsForClient` rebuilds the account list (rank 2 applies here).
2. `GET /api/accounts/{id}/folders` — sequential after (1), only when a persisted selection exists (`:167`). `initialDataReady` flips after folders resolve.
3. First thread list — gated on `initialDataReady` + `activeAccountId` + folder selection effects in `MailClient.tsx`. This is **stage 3**: two sequential round trips must complete before the list request fires. Payload: library-level JSON 598,775 bytes for a 300-thread page before route slimming/enrichment (synthetic fixture; not an HTTP measurement).
4. Parallel/secondary, not blocking first paint of the list: mailbox summary snapshot (`/api/me/mailboxes/summary`, one canonical read per connection now), SSE `/api/me/events`, idle-deferred aliases/topic counts (retained from startup-r2), initial sync decision (may POST a sync job; list renders from DB meanwhile), CalDAV sync POST if configured (`MailClient.tsx:4423`, fires immediately on `initialDataReady` — competes for server CPU with stage 3 but does not block it client-side).

Net vs startup-r2: same 2-request bootstrap; collab no longer adds its own `/auth/me`; summary hook no longer double-GETs on open. The remaining structural cost is server-side work inside (1) and (4), i.e. rank 2.

### Server / SQLite (11k synthetic shard, same fixtures as 435ba5d run)

Fixture: 11,000 messages / 3,667 threads / 647 flagged, 3,900-char bodies, 12 accounts, 2 users (100-user/20k-history probe separate). Medians after one warmup; reps as in prior harnesses. Host load 1-min ranged ~4.5–10.5 across series (shared box); compare structures and orders of magnitude, not decimals.

| Workload | 435ba5d | Now | Note |
|---|---:|---:|---|
| `listThreads` default 300 | 194.45 ms | **60.57 ms** [58.71–65.17] | Flagged fix landed. JSON 598,775 B. |
| `listThreads` search `needle` | 80.36 ms | **81.03 ms** [80.82–82.01] | Unchanged driver; rank 1. |
| Raw FTS OR-scan vs driven | 13.70 / 0.207 ms | **13.94 / 0.21 ms** | Same 28 ids both shapes (asserted). |
| 200 FTS deletes (production path) | 2,135.58 ms (key) | **5.52 ms** (rowid) | v3. Key counterfactual now 2,425.29 ms. |
| Public recompute, 1 thread | 67.21 ms | **4.74 ms** | Scoped authors. |
| Collab remap 1k notes + 1k activities | 56.88 ms | **14.77 ms** | Statements hoisted. |
| Collab snapshot 1k comments | 2.25 ms / 367,958 B | **2.47 ms / 367,958 B** | Unbounded payload unchanged. |
| Accessible accounts 12/2 users | 3.13 ms / 61 prep | **3.62 ms / 61 prep** | Unchanged; rank 2. |
| Accessible accounts 12/100 users/20k | 22.22 ms | **4.98 ms** | Provisioning index landed. |
| Provisioning probe 20k | 1.191 ms | **0.01 ms** | Covering index in production. |
| Summary 12 populated | 17.44 ms / 157+24 | **19.59 ms / 157+24** | Server side unchanged. |
| Summary scoped 1 account | 10.38 ms / 69 | **12.38 ms / 69** | Loads all access metadata first. |
| 5k attachment reads reprepare/reuse | 73.56 / 21.62 ms | 70.85 / 25.41 ms | Mechanism control; production retrieval now cached. |
| Cold sync graph import (median of 5) | 247.94 ms | **~328 ms** [298–346] | Indicative regression (load differs). |
| Full MIME parse 294.7 KB source | 10.54 ms | 5.50 ms | No regression; loads differ. |
| Sanitize pair 54 KB HTML | 56.52 ms | discarded (range 65–783 ms @ load 10.5) | No new claim either way. |

Checked and closed, no new hot spot: duplicate detection (indexed lookups from sqlite-stage remain; upsert duplicate purge uses the shared integer FTS delete), suggestions batch (retained), collab list enrichment (batched by 400, PK-supported), sender-identity reads on list path (two `sender_identities` prepares per `listThreads` captured in plans — small, indexed; `USE TEMP B-TREE FOR ORDER BY` on tiny per-account cardinality, not worth an index), writer-guard cost (81 v3 guards; prior anatomy unchanged — bulk-flag trigger overhead is the known residual, recommendation remains keep).

New/remaining server observations: **(i)** every search executes the FTS subquery in selector + thread count + message count + group counts (4× `SCAN message_fts_v3 VIRTUAL TABLE` + bloom filters in captured plans) — rank 1 must cover all four, not just the selector. **(ii)** `listThreads` residual 60.57 ms: member projection scans `idx_messages_account_date` with two correlated attachment subqueries per row, plus mailbox-wide date-group counts — the deferred one-row-per-thread/group-count contract item, still not recommended as a quick win. **(iii)** i18n server cost: catalogs are statically imported (`lib/i18n/translator.ts:2–3`) and `getMessages` is a map lookup behind React `cache()` — no per-request file/parse cost found; the cost is payload, not CPU. **(iv)** Auth session checks: no new per-request scan found beyond the known presentation fanout; Better Auth userId indexes intact.

### Build / test pipeline (this box, `nice -n 10`, shared load)

| Command | Wall | Result |
|---|---:|---|
| `bun run typecheck` (`bun check`) | **0.6 s** | 0 errors, 1,194 files |
| `bun run lint` | **49.4 s** | Baseline 1 error / 25 warnings (unchanged; error is pre-existing `react-hooks/set-state-in-effect`) |
| `bun run test:ci` (serial unit + DOM) | **409.1 s** shell wall; Bun reports unit 335.50 s + DOM 73.05 s | **2,804 unit + 462 DOM pass, 0 fail** (304 + 58 files) |
| Probe: `bun test --parallel=4` (unit only) | **122.0 s** | **2,804 pass, 0 fail**, one run |
| `bun run build` | **73.0 s** | Exit 0 (above) |

The architecture brief's "keep tests serial" predates Bun 1.4.4's `--parallel` (worker processes, `--isolate` implied). One green parallel run at **2.7× faster** is evidence for a trial, not for flipping CI blind: order-dependence is exactly what `test:stress` (`--randomize --rerun-each=3`) exists to catch, and parallel workers change shared-fixture/port assumptions. Recommendation at rank 6 with a stress-parity gate. Note: the parallel probe left test artifact dirs (`undefined/boundary-smtp-*`) in the worktree — some SMTP-boundary tests resolve paths from an env var that parallel workers apparently unset; that must be fixed before adoption (cleaned up here; tracked tree untouched). Lint at 49.4 s is ESLint-flat-config-bound; no safe quick win identified that keeps the same rule set (cache flag is a candidate only if CI caches between runs — unverified, listed as estimate under rank 6).

## Ranked recommendations

Ranked by saving per risk. **M** = measured this run, **E** = estimate, **S** = structural (request/query count). Overlap tags use the current ownership map from the task: **SI2–3** (`messages/*.json`, `PreferencesTabContent.tsx`, `lib/mail/resyncMessage*`, `lib/senderIdentity*`), **Collab UI**, **i18n 3**, **Umbau** (react-hooks cleanup in `MailClient.tsx`). Explicitly not recommended (per task): removing Radix Themes, switching bundlers, `reactCompiler`/`cacheComponents`, `PRAGMA optimize`/`ANALYZE`.

| Rank | Item; saving | Files | Overlap | Risk | Verification |
|---|---|---|---|---|---|
| **1** | FTS-driven search candidates in selector **and** thread/message/group counts; union explicit id-substring + attachment-name paths to preserve semantics. **M raw 13.94 → 0.21 ms** (28 ids); **E 10–60 ms** per 11k search across 4 repeated FTS scans; baseline real search **81.03 ms** | `lib/db/messages/query.ts`; `lib/search*` only if parser interface changes | Free. No schema change needed (v3 identity exists) | Med–high: Message-ID substring, attachment-only hits, multi-token AND, counts/groups parity | Differential fixtures vs current results incl. id substrings, Unicode/prefix, attachment names; EQP every selector/count/group; 11k bench. Never ANALYZE. |
| **2** | Batch request-local account/identity/role/member presentation; reuse `ensureActiveAccountId` selection in `/auth/me` instead of rebuilding; skip unchanged session UPDATE; narrow scoped summary events to the scoped account's metadata. **M 61 prep/3.62 ms**, summary **157/19.59 ms**, scoped **69/12.38 ms**; **E ≤4 metadata statements**, most repeated prep/materialization gone | `lib/accountAccess.ts`, `lib/db/accounts.ts`, `lib/db/users.ts`, `lib/accountPresentation.ts`, `lib/auth.ts`, `app/api/auth/me/route.ts`, `lib/mailboxSummary.ts` | **SI2–3 only if** a sender-identities batch seam is edited — prefer consuming existing rows. Collab UI consumes summaries; coordinate event-shape changes | Med–high: live disable/revoke, owner role, member counts, DTO sanitization, session cookies. No cross-request auth cache | Same DTO/role/counts incl. revoked-mid-read, disabled users, MFA-restricted; SQL-count instrumentation; keep final transactional authorization + 5 s liveness |
| **3** | Defer `rrule`: split recurrence helpers out of `lib/calendar.ts` formatting surface (or dynamic-import at `reminderRecurrence` call sites). **M 57,208 raw / 16,969 gzip eager** | `lib/calendar.ts`, `lib/reminderRecurrence.ts`, importers in `mailclient/message/CalendarEventPreview.tsx`, `mailclient/utils/calendarReminders.ts`, `mailclient/status/UpcomingStatusPopover.tsx` | Free (not in SI/collab/i18n lists). Touches mailclient components but not `MailClient.tsx` hooks — no Umbau conflict expected; confirm import-only diff | Low–med: recurrence summary/next-occurrence must not flash wrong/empty states | Production build: rrule factory absent from `/` first load; calendar preview/upcoming/reminder UI parity incl. recurring invites |
| **4** | Namespace-scope i18n catalog delivery (per-surface message splitting or lazy locale chunks) instead of whole-catalog inline in root layout. **M catalog 13.2 KB gzip (de) inline every page + formatjs 12,627 gzip eager**; **E 5–13 KB gzip/page** depending on split granularity; window routes +37–40 KB gzip is the regression this addresses | `app/layout.tsx`, `app/components/i18n/I18nProvider.tsx`, `i18n/request.ts`, `lib/i18n/translator.ts`, `messages/*.json` (structure only) | **i18n 3 + SI2–3** (`messages/*.json` owned) — schedule with those owners; do not start unilaterally | Med: missing-key fallbacks, locale switch, SSR/CSR catalog parity | Catalog parity tests; per-route HTML/RSC byte diff; locale-switch e2e; no-key-missing console errors |
| **5** | Resident sync worker (one long-lived Bun child, stdin job protocol), then load only the target account. **M avoid ~328 ms graph import** per subsequent job; IMAP login saving unmeasured | `lib/syncJobs.ts`, `lib/workers/runSyncJob.ts`, worker protocol, `lib/syncOperation.ts` | Free core; touches nothing in SI/collab/i18n/Umbau | High: leases/cancellation/wedges/credential staleness/confirmed exit | Multi-account queue, crash/kill/timeout, lease recovery, standalone worker build; latency over many 1-message jobs |
| **6** | Trial `bun test --parallel` for unit suite behind parity gates. **M 335.5 → 122.0 s (2.7×), 2,804 pass once**; lint `--cache` **E only** if CI persists cache | `package.json` scripts (trial script first, e.g. `test:parallel-probe`), SMTP-boundary test path resolution | Free. **Umbau** owns `MailClient.tsx` hooks only — no conflict | Med: hidden shared-state/port coupling; one green run is not proof | Gate: `test:stress` green under parallel config ×3 seeds, no worktree artifacts (`undefined/` bug fixed), DOM suite decision separate. Keep serial `test:ci` until gates pass — do not weaken the gate |
| **7** | `SecuritySettings` dynamic boundary. **E ≤3 KB gzip** (source 9,010 B; shared ReauthDialog stays) | `app/components/MailClient.tsx:40` import + mount site | **Umbau** (same file, hooks cleanup) — coordinate or let Umbau fold it in | Med: TOTP/passkey/reauth continuation flows | Open security from all entry states; failed-chunk retry; eager-membership check in next build |
| **8** | Collab snapshot bounds + visited-cache limit; optional `(accountId,threadId,createdAt,id)` partial indexes. **M 367,958 B / 1k notes**; index alone previously 1.48 → 0.907 ms (not re-measured; EQP still shows temp sort) | `lib/db/threadCollab.ts`, `lib/threadCollab.ts`, collab route, `app/hooks/useThreadCollab.ts`; indexes in `lib/db/schema.ts` | **Collab UI** owns the hook/panel surface — joint task | High for pagination/revision protocol; low for indexes alone | Equal timestamps, deletions, presence changes at equal revision, cache reset per session/account; preserve hook acceptance spec |
| **9** | Single-normalization dual-policy HTML sanitize + shared account-pref resource. Saving unmeasured this run (bench discarded); prior pair 56.52 ms/54 KB stands as the only number | `app/components/HtmlMessage.tsx`, `app/hooks/useRemoteContent.ts`, `lib/html/sanitize.ts` | Free now (was R5); not in current owned lists | High: remote-content consent/detection/CSP correctness | Security fixtures both modes; blocked-before-opt-in proof; quiet-box timing (load <2) |
| **10** | Bulk-copy hydration batch; optional Sent local-ingest (avoid FETCH+parse of just-appended copy). **S ~3 DTO queries/copied message**; Sent **E one FETCH + ~5–10 ms parse** | Copy route + retrieval batch helper; `lib/mail/completeSend.ts` | **SI2–3** (send path, `resyncMessage*` adjacency) | Med–high: APPEND ambiguity, id reconciliation, no SMTP retry on accepted send | Copy 1/100, missing parts, cross-account same ids; send-warning semantics parity |
| **11** | Lighter sync MIME parse — deprioritized: full parse now 5.50 ms on the fixture; only pursue with metadata-parity proof. **E fraction of ~5 ms/message** | `lib/mail/imap/sync.ts`, `lib/mail/categorization/classifier.ts` | **SI2–3** adjacency via identity semantics | High: cid/calendar/attachment metadata parity | Multipart/nested/cid/calendar corpus diff, end-to-end ingest timing |
| **12** | Tiny items: memoize build-version file read in-process (keep no-store); bounded cache headers for public fonts/icons in `next.config.ts`; source-preview ETag. **S small** | `app/api/version/route.ts`, `next.config.ts`, source route | Free | Low: version freshness after deploy (process restart covers it), stale public assets | 304/rewrite tests; header audit incl. `runtime-config.js` staying revalidated |
| **13** | Fork-only CI job guards. **S avoids wrong-repo CI/deploy runs**; no app latency effect | `.github/workflows/{build-and-push,deploy-dev,deploy-prod}.yml` | Free | Low–med: intended upstream dispatch behavior | Workflow syntax + repo-expression matrix review; no deploy run |

## Studied and not worth doing

- **Re-litigating closed items:** flagged selector, collab viewer, scoped authors, remap/retrieval statements, FTS identity, provisioning index, settings/admin lazy — all verified landed above. Do not re-open.
- **Writer-guard tuning / removal:** keep 81 v3 guards (`perf-writer-guards.md`). Rank 1–2 remove far more writer-hold time than guard micro-tuning ever showed.
- **`PRAGMA optimize` / `ANALYZE`:** excluded by task and by the known `from:` plan regression. Not run anywhere in this study.
- **One-row-per-thread list contract / body-table split / contentless FTS:** still the largest structural storage items (FTS content copy persists in v3 by design), but high contract/migration cost. Rank 1 first; revisit storage only with a dedicated design.
- **Global `db.prepare` → `db.query` conversion:** cached query is already used where stable; dynamic shapes make a blanket change harmful. The 70.85 vs 25.41 ms control measures the mechanism, not a remaining production loop — retrieval/remap/topics were the loops and they are done.
- **More indexes by EQP pattern-matching:** sender-identity temp sort (tiny cardinality), collab PK/assignee/status, auth userId indexes all adequate. Only rank 8's optional ordering indexes have a measured (small) case.
- **Radix Themes removal, bundler switch, reactCompiler/cacheComponents:** excluded by task. Radix remains 685 KB raw CSS — the largest single payload — owned by its separate plan.
- **Long-lived session/role/credential caches:** rank 2 is request-local batching only; cross-request authorization caching trades revocation correctness for milliseconds.
- **Moving sync into the Next event loop / sharing sqlite handles across processes:** loses isolation; rank 5 keeps the process boundary.
- **Flipping CI to parallel tests immediately:** one green probe + a real artifact-path bug found = trial with stress gates (rank 6), not a switch.

## Methodology

Cwd for all commands: `/home/monkey/code/noctua-mail/wt-perf-rerank2` @ `11dc3c5`. Prior briefs read from `/home/monkey/code/noctua-mail/briefs/`. No other `wt-*` or `repo` tree entered. No server started (ports 3908–3919 unused — startup section is source-derived by design choice within the one-build budget; a runtime trace remains a valid follow-up for rank 2 verification). `.env.local` (empty `data/noctua-data-perf-rerank2`) untouched; all synthetic DBs under `/tmp/perf-rerank2/data` (deleted after use, ~154 MB).

Exact commands (heavy ones under `nice -n 10`):

```sh
# pipeline timings
bun run typecheck                      # 0.6 s
bun run lint                           # 49.4 s
bun run build                          # 73.0 s — the ONE production build (.next absent beforehand)
bun run test:ci                        # 409.1 s shell wall
bun test --timeout 20000 --parallel=4  # 122.0 s probe (unit only)

# bundle (harness copied from briefs/perf-backlog-rerank/measure.cjs, output path retargeted)
bun /tmp/perf-rerank2/measure.cjs > bundle-summary.json

# SQLite (prior harnesses, root/data retargeted; sql.ts FTS seeding rewritten for v3 identity allocation)
bun --tsconfig-override tsconfig.json /tmp/perf-rerank2/sql.ts
bun --tsconfig-override tsconfig.json /tmp/perf-rerank2/fts-existing.ts   # table renamed to message_fts_v3
bun --tsconfig-override tsconfig.json /tmp/perf-rerank2/recompute.ts
bun --tsconfig-override tsconfig.json /tmp/perf-rerank2/summary.ts
bun --tsconfig-override tsconfig.json /tmp/perf-rerank2/parse.ts         # results discarded (load)
bun --tsconfig-override tsconfig.json /tmp/perf-rerank2/remap.ts         # new minimal script, production remap
for i in 1..5: bun --tsconfig-override tsconfig.json /tmp/perf-rerank2/cold.ts
rm -rf /tmp/perf-rerank2/data wt-perf-rerank2/undefined   # scratch + parallel-test artifacts
git status --short   # empty
```

Controls: real production schema via `getDb`/`getAccountDb` (v3 shape, guards installed); FTS rows seeded through `message_fts_identity` allocation + explicit-rowid insert (the production write shape); selector/search/remap comparisons assert identical rows/counts/revisions; write benches rollback-isolated. Medians after one warmup (SQL 7, remap 7-of-8, FTS delete 5-of-6, provisioning 21, cold 5 fresh processes). Shared-box load 1-min ~4.5–11.7 across the session — cross-run comparisons vs 435ba5d are structural/order-of-magnitude, and the two load-sensitive series (sanitize pair, cold import delta) are labelled as such instead of being silently averaged.

## Files inspected

Briefs: `perf-backlog-rerank.md` (+ harness dir), `perf-client-bundle.md`, `perf-client-startup.md`, `perf-client-startup-r2.md`, `perf-client-assets.md`, `perf-server-runtime.md`, `perf-server-quickwins.md`, `perf-sqlite.md`, `perf-sqlite-stage.md`, `perf-writer-guards.md`, `perf-fts-identity-v3.md`, `arch-tech-debt.md` (skimmed summaries beyond the sections cited).

Source (11dc3c5): `AGENTS.md`, `package.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css` (font faces), `app/components/MailClient.tsx` (dynamic imports, mount effects), `app/components/mailclient/useAccountController.ts`, `RenderHelpers.tsx`, `app/components/collab/ThreadActivityPanel.tsx`, `app/components/shell/ShellUserMenu.tsx`, `app/components/HtmlMessage.tsx`, `app/components/i18n/I18nProvider.tsx`, `app/hooks/useThreadCollab.ts`, `useMailboxSummaries.ts`, `useRemoteContent.ts`, `app/api/auth/me/route.ts`, `app/api/version/route.ts`, `i18n/request.ts`, `lib/i18n/translator.ts`, `messages/{de,en}.json` (sizes), `lib/db/messages/query.ts`, `retrieval.ts`, `upsert.ts` (duplicate purge), `lib/db/ftsIdentity.ts`, `shardFormat.ts`, `threads.ts`, `authPolicy.ts`, `lib/mailboxSummary.ts`, `lib/syncJobs.ts`, `lib/mail/completeSend.ts`, `lib/calendar.ts` + `lib/reminderRecurrence.ts` importers, `.github/workflows/*.yml`.

Harness + raw results: `briefs/perf-backlog-rerank-r8/` (`measure.cjs`, `sql.ts`, `fts-existing.ts`, `recompute.ts`, `summary.ts`, `parse.ts`, `remap.ts`, `cold.ts`, `bundle-summary.json`, `bundle-detail.json`, `sql-results.json`, `fts-existing-results.json`, `recompute-results.json`, `summary-results.json`, `parse-results.json`, `remap-results.json`, `build.log`, `lint.log`, `typecheck.log`, `test-ci.log`, `test-parallel.log`).


