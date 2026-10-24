# Correctness, data-isolation and privacy re-check — integration/stage 6968b37

Reviewed 2026-10-23. Source: `6968b371` (Merge fix/qa-sweep3-r1 443198f), detached in `/home/monkey/code/noctua-mail/wt-security-rc`. Previous pass: `briefs/security-recheck-98b4301.md` (checklist, method and harnesses reused). Scope: `git log --first-parent 98b4301..6968b37`, which covers 11 merges plus the round-9 finish (`e70c30b` and the six `fix(integration)` commits before it). The diff touches 194 files (+8,430/−1,184). `package.json` gained two test scripts; `bun.lock` and dependencies are unchanged.

**Result:** no P0, P1 or P2 finding. Both previous P3 findings are fixed: the bodyless guard no longer buffers bodies (F1), and launcher redaction now covers non-canonical spellings (F2). The previous correctness item C-1 (unsent reply lost on a UI-language switch) is root-caused and fixed by `97dd982`. Two new **P3** items were recorded:

- N1: the message source now uses a 24 h private browser cache without revalidation.
- N2: a NUL byte in a search query causes an unhandled 500. This is pre-existing.

The required gates passed: security controls **156/156** (861 assertions) and HTML privacy **1 pass / 177 assertions**. Typecheck reports 0 errors in 1,292 files. Focused delta tests: 339 passed, 0 failed. These are local checks; they do not constitute go-live acceptance.

## Method and execution boundary

Read `AGENTS.md` (workspace and worktree), `briefs/_rules-common.md`, the 98b4301 report, `briefs/perf-tiny-headers.md`, `briefs/perf-mailbox-switch-server.md` and `briefs/perf-html-sanitize-review-r1.md`. The reviewer read the security-relevant diff of every merge personally; there was no fan-out. Reviewer probes were written under `.tmp/probes` and run with a probe-only bunfig, because `.tmp` is excluded from the default bunfig. They used the existing harnesses: `lib/testSharedShardHarness.ts`, `lib/testAuthHarness.ts` and `lib/testDbHarness.ts`.

All runtime data lived in disposable scratch directories. `ROOT/data/noctua-data-security-rc` was not needed. Principals, mailboxes, tokens and addresses were synthetic (`@example.test` / `.invalid`). The only fixed listeners were 3930/3931, used by the privacy test copy. No live preview, service, other worktree or data directory was touched. No tracked file was edited, and no commit, push, deploy or restart took place.

## Checklist from previous audits (regression status at 6968b37)

| Item and invariant | Probe | Observed | Verdict |
|---|---|---|---|
| 1a/1b. Auth, passkeys, TOTP, reset (raw/retired paths, foreign origin, setup-only sessions, one-use reset, MFA retained) | `tests/runTeamAuthSecurityControls.sh` | 156/156, 861 assertions (see Gates for the load-induced first attempt) | OK |
| 1c. Reset capabilities absent from launcher logs (prev. F2) | `lib/authRecoveryContext.test.ts`, `lib/server/standalone.test.ts`; reviewer matrix of 39 targets through the launcher's `redactedRequestUrl` logic | All six previously open spellings are redacted (`/reset-password/?token=`, upper case, `;a`, `%72`, `%3F`, `//`, `Reset-Password`). Also redacted: dot segments, `%253F`, `%2D`, `%2F`, NUL/CRLF suffixes, credentialed absolute form, nested `callbackURL`, `\`, trailing dot/space. Three spellings stay unredacted: em dash, fullwidth `ｒ`, `reset_password`. No router maps any of them to a reset route, and the app never issues them. | OK, prev. F2 closed |
| 2a–2c. Manager candidates, membership codes, admin ≠ membership, role-filtered DTOs | Security-controls suite; server routes unchanged in range | No regression | OK |
| 3a/3b. Collaboration scoped to live membership | Suite; `Collaboration.dom.test.tsx` | Assignee change is client-only (below) | OK |
| 4. Sender identities affect From only | Unchanged server paths; `signatureTemplates.test.ts` passes after the blank-body change | `replaceSignatureBlock` change is local to editor text; escaping unchanged | OK |
| 5. Composite shard keys / FTS isolation | Area B below | — | OK |
| 6a. HTML privacy | `htmlPrivacy.test.ts` (copy, ports 3930/3931) | 1 pass, 177 assertions | OK |
| 6b. Dependency floor | `bun.lock` unchanged since 98b4301 | Next 16.4.2, React 19.3.1, sharp 0.35.5 unchanged | OK (version level) |

## Changed surfaces

### A. Bodyless and mutation guards (feat/reader-focus; prev. F1)

| Item and invariant | Probe | Observed | Verdict |
|---|---|---|---|
| A1. A bodyless reject never buffers the body (`app/api/_helpers/requestOrigin.ts:37`, `readAuthJson.ts:25`) | Reviewer: streamed 256×64 KiB through `requireBodylessSameOrigin`; committed `requestOrigin.test.ts`, which covers pre-session logout and admin passkey/session revoke | 400 `unexpected_body` after **1 chunk (65,536 B)** and the stream is cancelled. A declared `Content-Length` > 0 is rejected without reading. `Content-Length: abc` and empty chunks followed by 1 byte are both rejected. A stalled body is abandoned at the 10 s deadline. | OK, prev. F1 closed |
| A2. `requireMutationSameOrigin` became async; every caller awaits it | grep of all 28 guard call sites | Every async guard call is awaited. The remaining non-awaited calls are the synchronous `requireJsonSameOrigin`. Typecheck is clean. | OK |
| A3. CSRF/Origin behaviour unchanged | Reviewer matrix | Missing Origin and Referer → 403. Foreign Referer, `Origin: null`, trailing-slash or upper-case origin → 403. `Sec-Fetch-Site: cross-site` with a matching Origin → 403. Foreign Origin with JSON → 403. Same-origin Referer fallback passes. `application/x-www-form-urlencoded` and a non-empty `text/plain` (including JSON-looking text) → 400 `json_required`. A JSON body is passed through unread (0 chunks pulled). Empty non-JSON → passes. | OK |
| A4. Handlers that read optional JSON after the guard consumed an empty body | `syncJobs.ts:23`, `recomputeJobs.ts:33`, the alias/topic/event DELETE routes | All use `request.json().catch(() => null)`, so the result is an empty payload, not a 500. | OK |

### B. FTS search-driven candidates and German folding (perf/fts-search-driven, fix/fts-german-folding)

| Item and invariant | Probe | Observed | Verdict |
|---|---|---|---|
| B1. Candidate resolution is account-scoped (`lib/db/messages/query.ts:796-1094`) | Source review | FTS fetch filters on `accountId = ?` (UNINDEXED column). Attachment, id-LIKE and probe statements bind `accountId`. Candidates are applied as `m.id IN (…)` on a base `m.accountId = ?` (`:1457,1712,2359,2679`). The candidate set is per call and never cached across requests or accounts. | OK |
| B2. No cross-account leakage on a shared shard | Reviewer probe: A and B on one shard, both holding local id `dup-1`, plus a B-only row and a B attachment `geheim-bravo-übermaß.pdf`. A searched 41 queries through `listMessages` and `listThreads` in the driven and legacy paths: B tokens, B's accountId, `b-only`, umlaut and ß variants, and injection forms (`AND`/`OR`/`NOT`/`NEAR(...)`, `accountId:`, `messageId:`, `{accountId messageId}:`, `subject:`, quotes, `*`, `^`, `-`, `+`, parentheses, `%`, `_`, `' OR 1=1 --`) | No B content in any result. Driven and legacy output are byte-identical for all 82 calls. B never sees A-only tokens. | OK |
| B3. FTS query injection (keyword quoting) | Source `:475-500`; probe as above | User tokens become quoted strings or alphanumeric barewords. `AND`/`OR`/`NOT` are now quoted. Column filters come only from the field allowlist (`normalizeSearchFields`), so a user cannot target `accountId`/`messageId`. | OK |
| B4. Variant expansion is bounded and injection-safe (`searchSpellingVariants.ts`) | Source | At most 8 spellings per token, each passed through `buildFtsTokenQuery`. Attachment `LIKE` terms are bound parameters. | OK |
| B5. Fallback logs carry no query content | Probe with cap = 1 and a forced `fts_error` | Lines contain only the reason, a 12-hex SHA-256 of the account id, the cap, counts and the SQLite name/code/class. No tokens and no plain account id. | OK |
| B6. NUL in the query | Probe `a\u0000b` | Both paths throw `unterminated string`, giving an unhandled 500 from the messages route. Present in the legacy path before this range. | N2 (P3, correctness) |

### C. ETag/304 on message source and attachments (perf/tiny-headers)

| Item and invariant | Probe | Observed | Verdict |
|---|---|---|---|
| C1. 304 only after authorization; no cross-mailbox reuse (`source/route.ts:25-55`) | Reviewer route probe: mailboxes X and Y with the same local message id; user is a member of X only | Sending X's ETag to Y → 403. `If-None-Match: *` to Y → 403. Anonymous request with the ETag → 401. Session → `requireAccountContext(viewer)` → message lookup → stat → 304, in that order. ETag comes from the per-account file (`statMessageSource(accountId, …)`). Attachments use the extracted helper and keep the same order. | OK |
| C2. Caching is private | Same probe | `Cache-Control: private, max-age=86400`, an ETag, and Better Auth's `Pragma: no-cache`. No `public` or `immutable`. Fonts and static icons are `public` (no user data). | OK |
| C3. Cached authorized bytes are not reused without a server check | Header semantics | `max-age=86400` lets the browser serve the source JSON for up to 24 h without contacting the server: after logout, after membership revocation, or to another person using the same browser profile who requests the URL. The comment says "revalidated"; the header does not revalidate. Resync rewrites are also not seen for 24 h. | N1 (P3) |

### D. Build info, `/api/version`, status bar, UI branches

| Item and invariant | Probe | Observed | Verdict |
|---|---|---|---|
| D1. No secret or path disclosure (`lib/buildVersion.ts`, `app/api/version/route.ts`, `BuildInfo.tsx`) | Source; `ops/deploy-dev.sh:15-16`; route call | The payload is `{ok, buildVersionLabel}` (hash \| time), `no-store`. `getBuildInfo` exposes only the commit hash (from `git rev-parse HEAD`) and the ISO build time. No file paths or env values. The full hash now reaches the `/` RSC payload, also before login. The 12-character hash was already public. | OK (informational) |
| D2. Assignee picker shows no members beyond the mailbox (`AssigneeCombobox.tsx`) | Diff | Client-only: it filters the existing mailbox-scoped `members` prop and lists self first. No new fetch or data source. | OK |
| D3. status-bar-compact, sidebar-views-row, rrule-lazy, reader-focus UI, html-sanitize-single-pass, test-parallel-fixes | Diff scan; htmlPrivacy gate for the sanitizer | Client layout, i18n, lazy imports and test harness only. No route, auth or storage change except the guards in A. The sanitizer was confirmed by 177/177 privacy assertions. | OK |
| D4. Mailbox switch: no per-account route authorizes via the session's selected mailbox | `grep -rn activeAccountId app/api lib scripts` (tests excluded) | Only `lib/auth.ts` (carried, plus `ensureActiveAccountId`) and `lib/betterAuth.ts` (field, setter). `/api/auth/me` and `/api/calendar/import` use the selection. Import re-authorizes with `requireAccountContext(…, editor)` (`app/api/calendar/import/route.ts:47`). The claim in `perf-mailbox-switch-server.md` holds at 6968b37. | OK |
| D5. C-1 from 98b4301 (unsent reply lost on a language switch) | `97dd982` diff; `useAccountController.dom.test.tsx` | Root cause: the locale-bound translator in a `useCallback` dependency list re-ran the bootstrap. Fixed with a ref. DOM suite: 32 pass. The selector fix is in `2bb472f`. | Fixed (compiled auth browser suite not re-run here) |

## Findings

### N1 — P3 — Message source cached for 24 h without revalidation

**Location:** `app/api/accounts/[accountId]/messages/[messageId]/source/route.ts:12` (`MESSAGE_SOURCE_CACHE_CONTROL = "private, max-age=86400"`). The same pattern was already used for attachments (`attachments/[attachmentId]/route.ts:19`, which predates 98b4301).

**Invariant:** authorized mail content is served only after a live session and membership check. The route comment says "revalidated cache".

**Reproduction:**

1. Log in as a member of mailbox X and open a message's source view; the browser stores the 200 response.
2. Log out, or have a manager revoke the membership.
3. In the same browser profile, `fetch("/api/accounts/X/messages/<id>/source")` returns the cached JSON from the disk cache without a request to the server for up to 24 h. The server itself would answer 401/403; see C1.

**Scope:** the exposure is limited to content this browser profile already received. It is reachable only from the same profile and requires the exact URL. There is no cross-user server-side effect. P3 hardening.

**Smallest correction:** `Cache-Control: private, no-cache` together with the existing ETag. Every use then revalidates, which still yields 304 with no body read, but only after authorization. Apply the same to attachments. Optionally send `Clear-Site-Data: "cache"` on logout.

### N2 — P3 (correctness, pre-existing) — NUL byte in a search query gives a 500

**Location:** `lib/db/messages/query.ts:454` (`buildSearchTokens`) → `buildFtsTokenQuery`. FTS5 ends the quoted string at NUL.

**Reproduction:** `listMessages({accountId, query: "a\u0000b"})` throws `unterminated string` in both the driven and legacy paths. The messages route has no catch, so the user gets an unhandled 500. There is no data exposure, and the error text contains no query.

**Smallest correction:** strip C0 control characters from tokens in `buildSearchTokens`.

## Previous items: status

| Item | Status at 6968b37 |
|---|---|
| F1 (98b4301) bodyless guard buffers unbounded body (P3) | Fixed by `60e9a95`/`97eb6bc`: first chunk or declared length, 10 s deadline, stream cancelled |
| F2 (98b4301) non-canonical reset spellings in launcher logs (P3) | Fixed by fix/reset-log-redaction-r2 (`lib/authRecoveryContext.ts` normalization). The `next.config.ts:14` dev request-log ignore list is still canonical-only. It applies to dev logging only and is not part of the standalone launcher. |
| C-1 (98b4301) reply lost on UI-language switch | Fixed by `97dd982` and `2bb472f` |
| Optional: stale "Next 16.2.4" banner in `scripts/smokeTeamAuth.ts` | Not re-checked |

## Gates

| Gate | Result |
|---|---|
| Security controls `nice -n 15 bash tests/runTeamAuthSecurityControls.sh` | First attempt: exit 124 (runner's 240 s wall limit), 64 pass / 6 fail. All six failures were 10–20 s timeouts in `authLifetimeLock`/`teamAuthSlice5`, while the host load average was 38 on 12 cores from an unrelated project's test run. Focused rerun of those two files: **54/54**, 265 assertions. Full rerun: **156 passed, 0 failed, 861 assertions, 86.1 s, exit 0** |
| HTML privacy (`.tmp/privacy` copy, app 3930 / tracker 3931, Chromium) | **1 pass, 177 assertions**, 65.3 s, exit 0 |
| `bun run typecheck` | 0 errors, 1,292 files |
| Focused delta tests (ftsSearchDriven, searchSpellingVariants, authRecoveryContext, standalone, requestOrigin, readAuthJson, bodyLimit, etag, source route, attachment route, version route, next.config, buildVersion, db.sharedShard, signatureTemplates) | 285 pass, 0 fail, 2,080 assertions |
| `lib/db/ftsIdentity.test.ts` | 22 pass, 0 fail, 100 assertions |
| DOM: Collaboration, useAccountController | 32 pass, 0 fail, 209 assertions |
| Reviewer probes (FTS shared-shard, guard/redaction, ETag/version) | 6 pass, 0 fail, 97 assertions |

The following were not run in this pass: full `test:ci`, `test:stress`, lint, compiled build and smoke, compiled auth browser suite, watcher fixture, SMTP wire matrix.

## Still open before go-live

1. Optional P3 hardening: N1 (`private, no-cache` on source and attachments) and N2 (strip control characters from search tokens). Both go to `briefs/BACKLOG.md` under rule 2.
2. Run the complete `test:ci`, `test:stress` and lint on the release candidate. Run the compiled build, smoke and auth browser suite on the final build to confirm C-1 at browser level. Run the watcher fixture, SMTP wire matrix and bounded IMAP source probe once.
3. Validate on the deployment:
   - canonical TLS/DNS/RP, physical phone and PWA;
   - proxy header overwrite and **request body limits**: still the effective control for the remaining unbounded JSON reads after auth (C4 of 98b4301) and for Better Auth `/api/ba/*`;
   - listener isolation, global headers, telemetry off;
   - service umask and key custody.
4. Full coherent restore with synthetic mail per the FTS-v3 stopped-backup runbook, then `validateFtsIdentity`.
5. Aggregate full-source/MIME depth and worker memory/time limits with a bounded resource test.
6. Final-mount login response and timing comparison; all-public-passkey limiter coverage.

```json
{
  "status": "review_complete_with_open_items",
  "commit": "6968b371",
  "new_findings": { "P0": 0, "P1": 0, "P2": 0, "P3": 2 },
  "findings": [
    { "id": "N1", "severity": "P3", "item": "Message source served from 24 h private browser cache without revalidation (survives logout/revocation in same profile)", "location": "app/api/accounts/[accountId]/messages/[messageId]/source/route.ts:12" },
    { "id": "N2", "severity": "P3", "item": "NUL byte in search query -> FTS 'unterminated string' -> unhandled 500 (pre-existing)", "location": "lib/db/messages/query.ts:454" }
  ],
  "previous": { "F1": "fixed", "F2": "fixed", "C-1": "fixed (DOM level)" },
  "gates": {
    "security_controls_passed": 156, "security_controls_failed": 0, "security_controls_assertions": 861,
    "privacy_assertions": 177, "typecheck_errors": 0,
    "focused_tests_passed": 339, "focused_tests_failed": 0,
    "reviewer_probes_passed": 6,
    "test_ci": "not_run", "lint": "not_run", "build": "not_run", "auth_browser": "not_run"
  },
  "report_path": "/home/monkey/code/noctua-mail/briefs/security-recheck-6968b37.md",
  "tracked_files_modified": false, "commits_created": 0
}
```
