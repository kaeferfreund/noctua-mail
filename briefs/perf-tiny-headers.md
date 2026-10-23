# perf/tiny-headers — three small, free server wins

2026-10-23. Worktree `/home/monkey/code/noctua-mail/wt-perf-headers`, branch
`perf/tiny-headers`, based on `origin/integration/stage` `11dc3c5`, final tip
`7d31d6d`. Spec: `briefs/perf-backlog-rerank-r8.md` rank 12, with the
attachment ETag precedent in `briefs/perf-server-quickwins.md` item 4.

## Summary

`/api/version` reads `public/build-version.json` once per process instead of
on every poll; the response keeps `no-store`. Static public fonts and icons
get `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`
(bounded and revalidating, not `immutable` — the file names are not hashed).
The message-source route sends the attachment route's private mtime/size
ETag pattern (`private, max-age=86400`, `If-None-Match` → 304 before the
source is read or scrubbed). Four commits (three items plus a scoping fix
found by the first build), 8 new tests, no client, auth, DB, or mail code
touched.

One deviation from the brief budget: `bun run build` ran twice, not once.
The first build's route table exposed that `/icons/logo.svg` and
`/icons/badged/[size]` are dynamic deployment-label routes under the same
prefix as the static icons; the cache rule was narrowed (commit `7d31d6d`)
and rebuilt so the standalone proof covers the final config.

## Per item

### 1. Memoize the build-version file read — `68fecca`

`app/api/version/route.ts` now caches the file-read promise in module state
(`loadBuildVersionPayload`, with `resetBuildVersionPayloadCacheForTests`
following the repo's existing `…ForTests` reset naming). Concurrent first
polls share the one in-flight read. `GET` still returns
`Cache-Control: no-store, max-age=0` with `force-dynamic`, so HTTP caching is
unchanged; only the per-request `readFile` + `JSON.parse` disappears.

Freshness contract: `build-version.json` is written at build time
(`build-scripts/generateBuildVersion.ts`), and a deploy restarts the
process, so the first poll after a deploy reads the new file. **A file
changed without a process restart is not picked up** — this includes a
first-read failure (missing/unparseable file memoizes the env-label
fallback for the process lifetime). Stated in the route comment.

`public/runtime-config.js` is untouched by this item: it is generated per
start by `build-scripts/generateRuntimeConfig.ts`, loaded by `app/layout.tsx`
as a `beforeInteractive` script, and carries no cache rule (audit below).

Tests (`app/api/version/route.test.ts`, 3): a counting reader proves one
read across concurrent + sequential calls; after reset the reader runs
again (the restart analogue); `GET` keeps `no-store, max-age=0`.

### 2. Bounded cache headers for public fonts/icons — `b4004cb`, scoped by `7d31d6d`

`next.config.ts` `headers()` gains two rules, both
`public, max-age=86400, stale-while-revalidate=604800`:

- `/fonts/:path*` — `public/fonts/` holds only the Inter woff2 subsets (plus
  license/readme text); there are no app routes under `/fonts`.
- `/icons/:file(icon-\d+\.png|base\.svg)` — the static files in
  `public/icons/` only.

The icons rule was first committed as `/icons/:path*` and then narrowed:
`app/icons/logo.svg/route.ts` and `app/icons/badged/[size]/route.ts` are
`force-dynamic` routes that render the `APP_ENV_LABEL` ribbon at request
time and deliberately send `public, max-age=0, must-revalidate`
(`lib/ui/envIcon.tsx:27,113`, `app/icons/logo.svg/route.ts:63`). A `:path*`
rule would also have put a day of cache on the badged route's header-less
404 `Response`. The compiled manifest now reads
`^/icons(?:/(icon-\d+\.png|base\.svg))(?:/)?$`, which cannot match
`logo.svg` or `badged/…` (proven live below).

The pre-existing `/reset-password` rule (`no-store` + `Referrer-Policy:
no-referrer`) is byte-unchanged and first in the list. There is no other
global security-header rule in `next.config.ts`; CSP/nosniff live per-route
(message HTML, attachments, sender icon) and are untouched. The existing
security tests that exercise these surfaces stayed green:
`tests/teamAuthSecurityControls.test.ts` (asserts `config.headers()` contains
the exact `/reset-password` entry via `toContainEqual`),
`lib/messageHtmlRoute.test.ts`, and the attachment route tests.

Standalone serving: the launcher is Next standalone (`output: 'standalone'`,
`bun --bun server.js` from the packaged dir per `doc/DEPLOYMENT.md`), with
`public/` copied beside `server.js`. Next serves `public/` itself and
applies `headers()` matches to those files — proven against the packaged
build on port 3915 (verification section).

Tests (`next.config.test.ts`, 2): both cache rules present with the exact
value and no `immutable`; the `/reset-password` entry unchanged; no rule
mentions `runtime-config`; the rule set is exactly
`["/fonts/:path*", "/icons/:file(icon-\d+\.png|base\.svg)", "/reset-password"]`;
no bare `/icons/:path*`.

### 3. Private ETag/304 for the message source route — `4993566`

Target found by grep: `app/api/accounts/[accountId]/messages/[messageId]/source/route.ts`
(the only raw-source route; it returns the scrubbed source as JSON — there is
no `?preview` shell on it. The `?preview=1` HTML shell lives on the
attachment route and stays `no-store`; the message HTML route also stays
`no-store` + CSP.)

- The attachment route's validator helpers moved verbatim to
  `app/api/_helpers/etag.ts` (`entityTagForStat`, `ifNoneMatchMatches`);
  the attachment route re-exports them (`attachmentEntityTag` alias +
  `ifNoneMatchMatches`), so its tests and behavior are unchanged.
- `lib/storage.ts` gains `statMessageSource` mirroring `statAttachmentData`
  (same candidate-id lookup as `getMessageSource`).
- The source route stats the stored source file **after** session, account
  access, and message-ownership checks, and **before** reading or scrubbing
  it. A weak `If-None-Match` hit (exact, list, or `W/` prefix) returns
  `304` with `ETag` + `Cache-Control: private, max-age=86400`
  (`MESSAGE_SOURCE_CACHE_CONTROL`) and no body. A 200 carries the same
  headers; the scrubbed payload derives deterministically from the file, so
  the file's mtime/size tag validates it. The auth wrapper already lets a
  route-set `Cache-Control` win over the library `no-store`
  (`lib/auth.ts:34-36`, written for the attachment cache).
- DB-only fallback sources (`message.source`, no file) keep the previous
  uncached reply — no ETag is invented for bytes with no stat. 400/404 JSON
  gets no long cache (the forwarded library `no-store` applies), matching
  the attachment precedent.

Tests: `app/api/_helpers/etag.test.ts` (2: tag format, weak matching) and
one new source-route test (200 + exact `Cache-Control` + tag shape; 304 for
the tag and for `W/"stale", <etag>`; 200 for `"0-0"`; changed tag and body
after overwrite; 404 without the long cache or an ETag). The attachment
tests, including the shared-shard ownership-before-cache tests and the
uncacheable preview shell, pass unchanged against the extracted helper.

## Header audit (before → after, observed on the standalone build)

Before = `11dc3c5` config/behavior; after = live `curl -sI` responses from
the packaged standalone server on `127.0.0.1:3915` (this build). Rows marked
unchanged were observed live after the change and match their pre-change
definitions in source.

| Surface | Before | After (observed) |
| --- | --- | --- |
| `GET /fonts/InterVariable-latin.woff2` | Next public default (`public, max-age=0`, weak ETag) | `200`, `public, max-age=86400, stale-while-revalidate=604800`, `ETag: W/"19b80-…"`; `If-None-Match` → `304` |
| `GET /icons/icon-192.png`, `/icons/base.svg` | Next public default | `200`, same bounded cache as fonts |
| `GET /icons/logo.svg` (dynamic) | `public, max-age=0, must-revalidate` | unchanged (observed exact value) |
| `GET /icons/badged/192` (dynamic) | `public, max-age=0, must-revalidate` | unchanged (observed) |
| `GET /runtime-config.js` | Next public default | unchanged: `200`, `public, max-age=0` + ETag → revalidated every load |
| `GET /favicon.png` (control, no rule) | Next public default | unchanged: `public, max-age=0` |
| `GET /api/version` | `no-store, max-age=0`; file read + parse per request | header unchanged (observed); file read memoized per process |
| `GET /reset-password` | `Cache-Control: no-store`, `Referrer-Policy: no-referrer` | unchanged (observed both) |
| `GET …/messages/:id/source` 200 | forwarded library `no-store`, no ETag | `private, max-age=86400` + `ETag: "<mtimeMs hex>-<size hex>"`; match → `304` empty |
| `GET …/source` DB-only fallback / 404 | `no-store`, no ETag | unchanged (no ETag invented) |
| `GET …/source` unauthenticated | `401` + `no-store` | unchanged (observed live) |
| Attachment bytes | `private, max-age=86400` + ETag, 304 | unchanged (helper extraction only) |
| Attachment `?preview=1` shell | `no-store`, no ETag | unchanged (route test) |
| Message HTML route | `no-store`, CSP `messageHtmlCsp()`, `Referrer-Policy: no-referrer` | unchanged (not edited) |
| Attachment byte CSP/nosniff | `default-src 'none'`, `nosniff` | unchanged (not edited) |

No `immutable` anywhere; no new `public` cache on any authenticated or
label-dependent response.

## Verification

All commands from `/home/monkey/code/noctua-mail/wt-perf-headers`, prefixed
`nice -n 10`, `export TMPDIR=$PWD/.tmp/headers/tmp`. Baselines on `11dc3c5`
(as given): typecheck 0; lint 1 error (`useCalendarConflicts.ts:58`) + 25
warnings; `test:ci` 2804 unit + 462 DOM, 0 fail.

| Command | Result |
| --- | --- |
| `bun test app/api/version/route.test.ts` (pre-change) | fail (exports missing) → after: 3 pass |
| `bun test next.config.test.ts` (pre-change) | 2 fail → after (and after scoping): 2 pass |
| `bun test app/api/_helpers/etag.test.ts` + source + both attachment test files | 10 pass, 0 fail (83 expect) |
| `bun run typecheck` (final tree) | 0 errors, 1,199 files |
| `bun run lint` | exit 1: 1 error (`app/components/calendar/useCalendarConflicts.ts:58`, pre-existing) + 25 warnings — baseline exactly |
| Targeted `bunx eslint` on all 10 touched files | exit 0 |
| `bun run test:ci` (once, committed tree pre-scoping) | unit: **2811 pass, 1 fail** of 2812 [783s]; DOM (`bun run test:dom`, run separately because `&&` stopped): **460 pass, 2 fail** of 462 [117s] — see flakes below |
| Reruns of the 3 failures | `lib/authPolicyFlows.test.ts` alone: 20/20 pass [43s]; `lazyThreadActivityPanel` pass in pair rerun; `lazyAdmin.dom.test.tsx` alone: 9/9 pass [19s] |
| `bun run build` ×2 (see deviation) | exit 0 both; second build's `routes-manifest.json` carries the scoped icons regex |
| Standalone proof on 3915 | headers in audit table; font conditional GET → 304; server stopped by PID, port free |

The 8 new tests all passed inside the full unit run (2812 = 2804 baseline +
8). The 3 failures were timeouts in untouched areas under machine load
15–25 (other sessions): an auth-activation test at its 20 s limit
(20,076 ms), a collab DOM test at 5 s, and the lazy-admin idle-warm-up
scenario. Each passed when re-run in isolation, listed above. The full
suite was not re-run after the icons scoping commit (config + test strings
only); its 2 header tests, typecheck, targeted eslint, the rebuild, and the
live header proof cover that delta.

Standalone assembly/proof, exact shape: `rm -rf .next && bun run build`;
`bun --bun build-scripts/generateRuntimeConfig.ts`; copy `public/` →
`.next/standalone/public` and `.next/static` → `.next/standalone/.next/static`
(per `doc/DEPLOYMENT.md`); start from `.next/standalone` with
`PORT=3915 HOSTNAME=127.0.0.1
NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-headers`
and synthetic auth secrets; `curl -sI` probes as tabulated; `kill -TERM`
the recorded PID (2569627; clean `[shutdown] complete`, port free). One
mis-start without `PORT` exited immediately on `EADDRINUSE` for port 3000
(another session's server, untouched) before the correct start. The
generated `public/runtime-config.js` was deleted again afterward; tree
clean.

## Risks

- Version freshness is now process-scoped: a build-version file swapped
  without a restart (not a real deploy path — deploys restart) keeps the
  old label, and a file missing at first poll memoizes the env fallback.
- Font/icon files renamed or replaced in `public/` propagate within a day
  (`max-age=86400`), with SWR serving one stale copy while revalidating for
  up to a week in the worst case. The icons regex must be extended if a new
  static icon naming scheme appears (a missed file just keeps `max-age=0`).
- Same ETag caveat as attachments: a source rewrite preserving both size
  and `mtimeMs` keeps the old tag. The cache is `private`, so no shared
  cache can serve one user's source to another; ownership is checked
  before the stat/304, so a foreign tag cannot probe existence.
- Browser `fetch` for the source view now revalidates instead of always
  downloading; servers ignore the conditional headers harmlessly.

## Files touched

Commits: `68fecca` perf(version), `b4004cb` perf(config), `4993566`
perf(source), `7d31d6d` fix(config) — tip `7d31d6d752f59e7ef1507ed7cb619d4f661e596e`.

- `app/api/version/route.ts`, `app/api/version/route.test.ts` (new)
- `next.config.ts`, `next.config.test.ts` (new)
- `app/api/_helpers/etag.ts` (new), `app/api/_helpers/etag.test.ts` (new)
- `app/api/accounts/[accountId]/messages/[messageId]/source/route.ts` (+ test)
- `app/api/accounts/[accountId]/messages/[messageId]/attachments/[attachmentId]/route.ts` (helper extraction only)
- `lib/storage.ts` (`statMessageSource`)

## test:ci re-run at low load (2026-10-23 11:19-11:27 UTC)

Repeated `bun run test:ci` on 7d31d6d in wt-perf-headers with `nice -n 10` at load average 7-12: **2,812 unit + 462 DOM pass, 0 fail, exit 0**, no timeouts (log `/tmp/headers-testci-rerun.log`). The three timeouts of the first run were load-induced, as assumed.
