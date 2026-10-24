# Shorter deep links (user 2026-10-23 ~21:35 UTC: "die Direktlinks sind echt lang, bitte oid64 nehmen")

Worktree ROOT/wt-short-links, branch feat/short-deep-links (from integration/stage 56840ce). `bun install` first. Ports 4110–4119. Fast lane: self-check, no reviewer.
Interpretation of "oid64": encode the object ids base64url instead of hex, and drop redundant parts.

## Today (lib/navigation/deepLinks.ts, doc/DEEP-LINKS.md)
`/?accountId=acc-0357e6dc07a93be003c3321b&folderId=acc-0357e6dc07a93be003c3321b%3AINBOX&openMessageId=imap-4d2efbb6963d6825053ba2d5` ≈ 140 chars. Account ids are `acc-` + 24 hex (12 bytes); message ids `imap-` + 24 hex; folder ids repeat the account id (`<accountId>:<path>`).

## Scope update (user ~21:40): old links do not matter — no legacy parsing; keep only functional entry points (mailto handler, calendar import redirect, service-worker notifications via compact URLs).

## Do
- Compact form, e.g. `/?a=<acc64>&f=<folder>&m=<msg64>`: a/m = base64url (no padding) of the 12 id bytes when the id matches `<known prefix>-<24 hex>` (16 chars each); otherwise fall back to the raw id with a marker so any id still round-trips. f = folder path relative to the account (`INBOX`, percent-encoded only where needed), never repeating the account id. Short keys for the other params too where it helps (keep them readable: q, view, filter …).
- Serializer always writes the compact form; parser accepts compact AND all existing long/legacy params (accountId, folderId, openMessageId, messageId, scope, mailto, openCalendar, service-worker notification URLs in public/sw.js) — old bookmarks and notifications keep working. Copy link and the service worker produce compact links.
- No change to authorization: decoded ids go through the same membership checks as before.
- Update doc/DEEP-LINKS.md (scheme table + example before/after length).

## Done when
Unit tests: round trip for compact ids, non-matching ids fallback, legacy params, folder paths with spaces/umlauts/slashes; DOM tests for deep links still green (`bun run test:dom`); bun check 0; lint 0 new on touched files; build OK; the deep-link browser cases still pass. Commit; short report ROOT/briefs/short-deep-links-report.md with an example URL before/after. No push/merge/deploy. Rules: ROOT/briefs/_rules-common.md. Target ≤ 45 min.
