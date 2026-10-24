# App-level gzip for large API JSON (fast lane, user said "ja" 2026-10-23 ~20:10 UTC)

Worktree ROOT/wt-api-gzip, branch perf/api-json-gzip (from integration/stage f29fbd6). `bun install` first. Ports 4040–4049.
Background: ROOT/briefs/switch-ideas/V3-report.md §1 (API JSON goes out uncompressed although Next `compress` is on — App Router route-handler path under Bun; first page of a large mailbox 861 KB → ~50 KB gzip-5, ~3.5 ms CPU; first rows over 5 Mbit/s 1.6 s → 0.3 s). The preview runs through Tailscale Serve (no compression), the user wants it fast on the phone now. At go-live Caddy `encode` comes on top (it leaves already-encoded responses alone).

## Do
- One small helper (e.g. app/api/_helpers/compressedJson.ts): if the request's Accept-Encoding allows gzip and the serialized body is ≥ 8 KB, return the body gzip-compressed (level ~5; Bun.gzipSync or CompressionStream) with `Content-Encoding: gzip`, `Vary: Accept-Encoding`, correct Content-Type, no Content-Length mismatch; otherwise unchanged JSON. Keep existing headers (Cache-Control etc.).
- Use it for the large JSON reads: threads list route, messages list handler (app/api/messages/listMessagesHandler.ts), thread/related read, message detail; other large JSON GETs only if trivially the same pattern. Never for SSE (`text/event-stream`), never for responses echoing secrets/tokens, not for binary (attachments/source).
- Tests: helper unit tests (threshold, Accept-Encoding parsing incl. q=0, headers, round trip gunzip == original); one route test per touched route that a big response is gzipped and still parses in the client fetch path (apiFetch/fetch decode transparently).
- Measure: bytes + server time for the large-mailbox first page before/after on a production build (`bun run build`, standalone on your port), and confirm in a browser (Playwright) that the list renders and DevTools shows `content-encoding: gzip`.

## Done when
bun check 0; lint 0 new on touched files; focused tests green; build OK; commit on the branch; short report ROOT/briefs/api-json-gzip-report.md (bytes/time before/after, routes covered). No push/merge/deploy. Rules: ROOT/briefs/_rules-common.md. Target ≤ 45 min.
