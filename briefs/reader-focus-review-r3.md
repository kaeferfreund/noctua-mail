# Reader focus — review round 3 (ccddc4d..e7d00ee)

**Verdict: PIN+fix.** All three r2 P2 findings are closed, and so are r2 P3s 1 and 3. I found no P1 and no P2. Four P3s remain; none of them blocks pinning.

- Reviewed commit: `e7d00ee132ddb8fd32a37e647ffd9151cfc6e8f4` (7 commits on ccddc4d).
- Baseline for comparison: ccddc4d, built from the same sources.
- Worktree `wt-review-collab`: not modified. `git status` is empty and HEAD is still e7d00ee.
- How I ran things:
  - All builds, servers and tests ran on `git archive` snapshots under `wt-review-collab/.tmp`, because the build rewrites the tracked `public/build-version.json`.
  - Production `next start`: e7d00ee on 3895, ccddc4d on 3896. Fixture: IMAP 3897, control 3898, SMTP 3899.
  - Data is synthetic only: `first@`/`second@example.test` and the `reader-review` seed, plus 65 "Review synthetic" messages and one 260-line message (126 INBOX messages).
  - The committed QA runner ran on 3895 with OS-assigned fixture ports.
- Every `bun test` / `test:ci` run used `env -u CLAUDECODE -u AGENT -u REPL_ID`.
- Evidence is in `briefs/reader-focus-regressions-r3/`: 14 PNGs (none over 300 KB), PDFs, JSON, logs and probe scripts (`scripts/*.ts.txt`).
- Load: 1.76 at the start (14:40 UTC), 14.25 at the end (15:22 UTC). The later rise came from other threads.

## Findings (all P3)

### P3-1 — Exit-focus target is keyed off `activeMessageId`, not the reader's message
- **Location:** `lib/ui/useReaderFocusPlacement.ts:11-12,23-24`, fed by `MailClient.tsx:2902` (`activeMessageId`). `activeMessageId` is set inside `startTransition`, and the row-click path doesn't set it to the opened message at all (`data-active` stays empty).
- **Reproduction:** `out-3895/exitfocus*.log`; it is the same sequence as the committed spec at `qa-reader-focus.spec.ts:115`.
  1. Enter on row 0, then Esc.
  2. Click row 1, Shift+Enter, then Esc.
  3. Repeat ×3.
- **Result:**

  | Build | Enter on row 0 | Click row 1 + Shift+Enter |
  | --- | --- | --- |
  | e7d00ee, Esc pressed immediately | focus on the list container (ASIDE) | focus on **row 0** while row 1 is selected (3/3) |
  | e7d00ee, 1.5 s before Esc | correct row | list container |
  | ccddc4d (needs 2 Esc) | correct row | list container |

  The committed spec shows the same outcome (`official/round2/reader-focus-escape-*.json`: `focus: "ASIDE"`, then `focus: imap-77d1…` for selected `imap-0830…`).
- **Assessment:**
  - Focus always stays in the list region, which meets the stated requirement. The variability is timing-dependent.
  - The wrong-row case only shows up with a very fast Esc. In that case Enter would reopen the previous message.
- **Fix:** Key the exit target off the reader's message (`activeMessage?.id`) instead of `activeMessageId`. Then tighten the spec, which today only asserts "focus is inside `#list`".

### P3-2 — Mutation guard waits indefinitely on a stalled non-JSON chunked body
- **Location:** `app/api/_helpers/requestOrigin.ts:35-37,53-56`.
- **What happens:**
  - For a same-origin request that isn't JSON, emptiness is decided by reading the first body chunk.
  - Through the Bun/Next adapter, a chunked request's first chunk is only delivered once a second chunk or the terminator arrives.
  - The guard runs before the session check on these routes.
- **Reproduction:** `out-3895/raw-socket-probes.txt`. Send a stalled chunked `text/plain` body (`3\r\nabc\r\n`, then nothing) with no cookie to `POST /threads/recompute`.
- **Result:**
  - e7d00ee: still open after 70 s.
  - ccddc4d: 400 at once.
  - Memory stays bounded (one chunk), and Content-Length requests are rejected at once.
  - The same open-ended wait already exists on ccddc4d for JSON routes that read the body before auth (`PUT /topics/x` with a stalled `{`: open after 30 s on both builds). So this is not a new class of exposure.
- **Optional hardening:** reject a non-JSON request that carries `Transfer-Encoding` without reading it. The production client never sends a chunked bodyless command.

### P3-3 — r2 P3-2 only partly addressed: evidence default still outside the checkout
- **Location:** `tests/browser/ui/qa-reader-focus.spec.ts:8-12`, `doc/SHELL.md:66-68`.
- **What changed:** the default is now `<parent of checkout>/briefs/reader-focus-evidence/latest`, so preserved rounds are no longer overwritten.
- **What remains:**
  - In any other layout (CI, a plain clone) the spec still writes outside the workspace.
  - The doc text describes the local `ROOT/wt-*` orchestration layout.
  - It differs from `qaRound2Session.evidencePath`, which defaults to `.tmp/qa-round2-evidence`.
- r2 asked for `.tmp/reader-focus-evidence`.

### P3-4 — QA fixture requirement undocumented; PNG history unchanged
- **Undocumented fixture:** `doc/SHELL.md:63-65` calls the spec "compatible with the existing synthetic QA fixture". Without `QA_ROUND2_FIXTURE=1`, 2 of 8 cases fail (`official/qa-reader-focus-attempt1-without-QA_ROUND2_FIXTURE.log`):
  - saved-preference paging: 1 page request instead of ≥ 2;
  - print: no "QA synthetic NNN" row.

  With `QA_ROUND2_FIXTURE=1` all 8 pass. The doc should name the variable.
- **PNG history (r2 P3-4, unchanged):** e9d2428 still carries 641,507 bytes of PNGs under `artifacts/reader-focus/`. Whether to squash is the integrator's call.

## Per-r2-finding result

| r2 finding | Result | Evidence |
| --- | --- | --- |
| P2-1 saved focus preference blocks infinite scroll | **Closed** | Focus preference with no message open: `33 of 126` → `126 of 126`, page requests 2–5, same as split. With a message open in focus: 0 list-page requests, so j/k does the paging. Committed case passes (pages 2, 3, 4). `out-3895/observations.json` → `infinite-scroll` |
| P2-2 two Esc after Enter/Shift+Enter | **Closed** | 14 entry runs (7 paths ×2): `escPresses` 1 (Button path 0); the Back tooltip is open on Enter/Shift+Enter; Back is focused on entry; scroll restored 600 → 600. ccddc4d still needs 2 (`exitfocus-base.log`). One-Esc DOM and Playwright cases pass |
| P2-3 bodyless command contract | **Closed** | Committed `qa-bodyless` matrix passes all 20 commands across the 19 guarded routes, plus the in-page calendar-event DELETE. Each command: bodyless 2xx, `text/plain` 400, form 400, foreign 403. UI callers, real requests (no content-type, no body): Trash permanent delete from the focus toolbar → 200 `{"action":"deleted"}`, message gone (404), focus moves on to the next message (`1/3` → `1/2`); detached-window Delete → 200 `moved`; message menu Re-Sync → 200. Calendar sync, model reset and topic/alias DELETE are covered by the HTTP matrix (client calls send no body). All 19 `requireMutationSameOrigin` call sites `await` it |
| P3-1 avatar initials in print | **Closed** | PDF text (pdfjs). ccddc4d: reply `… SR SR`, thread `MB` ×10. e7d00ee: 0 initials in reply/thread. Long message still 6 pages ending with the end marker. The draft is absent in both |
| P3-2 evidence path | **Partly** | see P3-3 |
| P3-3 focus drops to BODY after Delete/Undo | **Closed** | Focus at 1280 and 1024: after toolbar Delete → Back; after Undo → Back. Archive keeps focus on Archive, as in r2. `notices` |
| P3-4 PNG blobs in history | Unchanged | see P3-4 |

## Guard security matrix

Source: `out-389{5,6}/security-*.json` (node:http) and `raw-socket-probes.txt`. Session cookie present unless noted.

**Mutation guard** (`POST threads/recompute`, `DELETE topics/:missing`, `POST messages/:id/resync`):

| Request | e7d00ee | ccddc4d |
| --- | --- | --- |
| same-origin, no body | 202 / 404 / 200 | 400 json_required |
| Referer-only same-origin | accepted (same as no body) | 400 |
| same-origin `urlencoded` with an empty body | accepted (empty) | 400 |
| foreign Origin | 403 | 403 |
| no Origin and no Referer | 403 | 403 |
| `Origin: null` | 403 | 403 |
| same Origin + `Sec-Fetch-Site: cross-site` | 403 | 403 |
| Referer-only foreign | 403 | 403 |
| foreign form POST (empty), `text/plain`, multipart | 403 | 403 |
| same-origin `text/plain` / `urlencoded` / multipart, non-empty | 400 json_required | 400 json_required |
| `text/plain` carrying JSON text | 400 | 400 |
| `application/json` and `Application/JSON; charset=utf-8` | accepted, body left unread | accepted |
| declared CL 16 MiB `text/plain` | 400 in 2–3 ms (1 KiB sent) | 400 |
| chunked 16 MiB | 400 after 64–128 KiB sent | 400 after 64 KiB sent |
| HEAD | 405 | 405 |
| OPTIONS preflight | 204 | 204 |

**Bodyless guard** (`DELETE mcp-tokens/:missing`):

| Request | e7d00ee | ccddc4d |
| --- | --- | --- |
| no body | 404 | 404 |
| any body, including `{}` | 400 unexpected_body | 400 unexpected_body |
| declared CL 16 MiB | **400 in 4 ms** | **no response within 8 s** (waits for the body) |

**JSON guard** (`PUT topics/:missing`): identical on both builds. No body → 400 json_required; JSON → 404; foreign or null Origin → 403.

**`readAuthJson`:**

| Request | e7d00ee | ccddc4d |
| --- | --- | --- |
| switch-account, declared 16 MiB | 413 in 3 ms | no response within 8 s |
| switch-account, chunked 16 MiB | 413 after 128 KiB | 413 after 128 KiB |
| logout, chunked 16 MiB | 400 after 64 KiB, 3 ms | **400 after the full 16 MiB, 5213 ms** (security-recheck F1) |

F1 is fixed. The unit tests confirm one pulled chunk and cancellation, including logout and the admin passkey/session routes, before any session lookup.

**Better Auth (`/api/ba/sign-out`):** identical on both builds (415 for every foreign, null or no-Origin variant). No `app/api/ba/**` file is touched.

**Guard inventory:** comparing call sites at 11dc3c5 and e7d00ee (77 each) shows no lost guard: 47 json, 19 mutation (all now awaited), 7 bodyless. `lib/mutationOrigins.test.ts` passes.

## Regressions vs ccddc4d
- **Pixels:** split 1280 light and dark (list-only, list, reader, full), focus 1280 light and dark, and mobile 390 (list and reader) differ by **0 px**. The only exception is the status-bar clock (`15:04` vs `15:05`, box x 727–832, y 874–883; `png/statusbar-clock-*.png`).
- **Mobile:** with the focus preference saved at 390 px, the layout stays split with no toolbar and no overflow. Shift+Enter does nothing, and browser Back returns to the list.
- **Notices and Undo:** Undo is fully in view with the sidebar collapsed (1280: x 1173; 1024: x 917). Delete and Archive move on to the next row (`12/91` → `12/90`). Both Undos restore the message ("Message restored." / "Archive undone.").
- **j/k and the counter across 5-row pages:** `1/5+` … `20/20+`, then the page loads and the count continues `21/30+` … (requests for pages 2–6); k steps back `21`, `20`, `19`. A j pressed while a page is loading is ignored; that pending guard is unchanged code.
- **Dark mode:** focus-dark renders correctly (`png/head-focus-1280-dark-full.png`).
- **Exit placement:** see P3-1.

## Gates

| Gate | Result |
| --- | --- |
| `bun run typecheck` | exit 0, 0 errors / 1,209 files |
| `bun run lint` | exit 1, 1 error + 24 warnings; the finding set and messages are **identical to ccddc4d** (0 new). The error is the existing `useCalendarConflicts.ts` one |
| `test:ci` | exit 0. Server **2811 pass / 0 fail** (306 files, 15,380 assertions, 428.8 s). DOM **488 pass / 0 fail** (60 files, 2,776 assertions, 64.5 s) |
| Focused server suites (requestOrigin, readAuthJson, auth bodyLimit, mutationOrigins, catalogs) | 127/127 |
| Focused DOM suites (6, ×3) | 51/51 each run |
| `bun run build` | exit 0 for e7d00ee and for ccddc4d |
| Playwright `qa-reader-focus` (round2 config, production build on 3895, `QA_ROUND2_FIXTURE=1`) | **8 passed (2.3 m)**. Without the fixture: 6 passed, 2 failed (P3-4) |
| Playwright `qa-bodyless` | **1 passed (19.8 s)** |

## Merge-tree (`git merge-tree --write-tree <ref> e7d00ee`)

| Ref | Result | Conflicts |
| --- | --- | --- |
| origin/integration/stage 11dc3c5 | clean (tree ace6d0e) | — |
| 98b4301 (round-9 candidate) | conflict | `MailClient.tsx` (import hunk), `lazyAdmin.dom.test.tsx` (Retry hunk), `playwright.qa-round2.config.ts` (testMatch) |
| local integration/stage **6e4bbcb** (contains 97dd982, 2bb472f, 34a5263) | conflict | the same 3 files, with byte-identical hunk bodies |
| feat/build-info **b4d963f** (local, still in progress) | conflict | the same 3 files, same hunks |
| fix/sidebar-views-row (local) | conflict | same as 98b4301 |
| origin/feat/status-bar-compact a864dfc | conflict | `AppShell.tsx` (toolbar/indicators hunk), `doc/SHELL.md` (add/add) |

- fix/sidebar-views-row currently points at 98b4301 itself and has no commits of its own.
- Neither origin/fix/sidebar-views-row nor origin/feat/build-info exists, so I merged the local refs.
- build-info's changes to `MailClient.tsx` and `messages/*.json` merge automatically.
- In every case the implementer's per-hunk notes (`reader-focus-evidence/r3/merge-resolution-notes.txt`) are correct and complete.
- **Scratch merges with the notes applied:**
  - integration/stage 6e4bbcb: typecheck 0 / 1,258 files; focused DOM 51/51; server 131/131.
  - build-info b4d963f: typecheck 0 / 1,261 files; DOM 56/56 (including BuildInfo); server 131/131.
  - No merged tree has a non-awaited `requireMutationSameOrigin` or `requireBodylessSameOrigin` call.
  - For a864dfc, the AppShell hunk matches the note: keep the reader-focus toolbar condition, which already uses the effective layout (`MailClient.tsx:5719`), and take compact's `indicators={statusBar}`.

## Cleanup
- Tracked files are unchanged; HEAD is e7d00ee and `git status` is empty.
- I stopped only my own processes, by PID: harness 3801707 and server groups 3801779/3801870. The QA-runner servers stopped themselves. Ports 3895–3899 are free.
- Scratch `wt-review-collab/.tmp` is removed: snapshots, node_modules, `.next` and scratch merges.
