# App-level gzip for large API JSON — report

Branch `perf/api-json-gzip` in `wt-api-gzip`, commit **00b27cf** (based on integration/stage f29fbd6). 2026-10-23, ~20:00–20:20 UTC. Not pushed, merged or deployed.

## Change
- New helper `app/api/_helpers/compressedJson.ts`:
  - `compressedJsonResponse(request, body, init?)` is a drop-in for `NextResponse.json(body, init)`.
  - It serializes once. If the body is ≥ 8 KB **and** `Accept-Encoding` allows gzip, it sends a gzip body (`node:zlib` `gzipSync`, level 5) with `Content-Encoding: gzip`. Otherwise it sends the same JSON bytes unchanged.
  - Always sets `Content-Type: application/json` and appends `Vary: Accept-Encoding`. Keeps status and caller headers (Cache-Control etc.).
  - Sets no `Content-Length`; the runtime frames the body.
  - `acceptsGzip(header)` handles `gzip`/`x-gzip`, `*`, q-values (`q=0` means not acceptable), case and whitespace.
- Routes covered (success response only; error responses unchanged):

  | Route | File |
  |---|---|
  | threads list `GET /api/accounts/{id}/threads` | `app/api/accounts/[accountId]/threads/route.ts` |
  | messages list `GET …/messages`, plus search `GET …/search` (same handler) | `app/api/messages/listMessagesHandler.ts` |
  | related list `GET …/related` | `app/api/accounts/[accountId]/related/route.ts` |
  | thread messages `POST …/thread/related` | `app/api/accounts/[accountId]/thread/related/route.ts` |
  | message detail `GET …/messages/{messageId}` | `app/api/accounts/[accountId]/messages/[messageId]/route.ts` |

- Not covered, by design: SSE (`imap/stream`), `html`/`source`/attachments (not JSON or binary), auth/token routes, and small JSON (folders, counts, `auth/me`).
- If a proxy compresses as well (Caddy `encode` at go-live), it leaves responses that already carry `Content-Encoding` alone. So does Next's `compression` middleware, should it ever start applying.

## Measurement (production build)
Setup:
- `bun run build`; standalone assembled as in `ops/deploy-dev.sh`; `bun --bun server.js` on 127.0.0.1:4040.
- Scratch data dir under `wt-api-gzip/.tmp`, removed at the end.
- Synthetic mailbox of 10,000 messages / 4,000 threads (`example.test`), with pseudo-random German word subjects and previews.
- curl, warm, n = 20 alternating, host load average 4–7.
- **Before** = request with `Accept-Encoding: identity`. This sends the same bytes as the previous `NextResponse.json` path.
- **After** = `gzip, deflate, br, zstd`.

| First page `threads?page=1&pageSize=300` (750 items) | before | after |
|---|---|---|
| bytes on the wire | **684,888** | **57,049** (8.3 %, 12×) |
| total time, loopback, p50 / p90 | 42.1 / 47.5 ms | 46.3 / 53.3 ms |
| gzip-5 CPU for this payload (Bun, p50 / p90) | – | 4.4 / 4.5 ms |
| total time at 5 Mbit/s (`curl --limit-rate 625K`), p50 / p90, n = 5 | **1,043 / 1,052 ms** | **45 / 46 ms** |

Other routes on the same build:

| Route | before (bytes) | after (bytes) | Note |
|---|---|---|---|
| messages list, pageSize 200 | 181,783 | 15,785 | gzip |
| thread messages, 15 threads | 37,059 | 3,952 | gzip |
| related list | 1,093 | 1,093 | below 8 KB, unchanged |
| message detail | 854 | 854 | below 8 KB, unchanged |

- The synthetic message detail had an empty body. Large detail bodies are covered by the route test.
- Server cost is about +4 ms per large response. Over any real link, the saved transfer is far larger.
- Caveat: synthetic text repeats more than real mail, so real ratios will be lower (V3 report estimates 5–10× for typical JSON lists).

**Browser.**
- Playwright Chromium 1440×900 against the production build.
- CDP `Network.responseReceived` for `/api/accounts/gzip-large/threads` showed `content-encoding: gzip`, with `encodedDataLength` 57,410 bytes (the DevTools "transferred" value).
- The list rendered: "750 von 10.000", rows grouped by date.
- One unrelated error toast came from the synthetic account's IMAP port (nothing listening, `ECONNREFUSED`).

## Gates
- `bun check`: 0 errors.
- eslint on all 8 touched/new files: 0 errors, 0 warnings.
- Focused tests: all green, 0 fail, in two runs whose file sets overlap. Run 1: 39 tests in 4 files (new tests, threads route, folder-account). Run 2: 100 tests in 9 files (every test near the touched routes).
  - `compressedJson.test.ts` (5 tests): threshold by UTF-8 byte size; Accept-Encoding parsing including `q=0` and wildcards; header preservation incl. `Vary` merge; gunzip round-trip equals original; transparent decode through `Bun.serve` + `fetch`.
  - `compressedJsonRoutes.test.ts` (6 tests): one test per covered route asserts that a gzip client gets `content-encoding: gzip`, gunzipped JSON equals the identity response, and the identity response stays uncompressed. A further test decodes the threads route transparently through `fetch`.
  - The existing threads, messages, related, search and folder-account tests also pass.
- `bun run build`: OK.
- Full `test:ci` not run (per AGENTS.md rule 4, it runs on the stage head).
