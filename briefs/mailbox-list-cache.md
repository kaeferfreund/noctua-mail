# Instant switch back to a visited mailbox (client list cache, stale-while-revalidate)

User 2026-10-23 ~19:35 UTC: "Wenn ich in eine Mailbox klicke, die schon mal geladen war, muss nochmal geladen werden — verwenden wir das Caching sinnvoll?" On the concern that caching can delay revocation: **"das ist egal"** (user decision: a short delay before revoked access takes effect in the UI is acceptable for this cache).

perf/mailbox-switch-2 is merged (stage 1af46a6). Worktree ROOT/wt-list-cache, branch feat/mailbox-list-cache from 1af46a6. `bun install` first. Ports 4070–4079. Note: feat/deep-links (fix round running) and perf/conversation-window (running) also touch MailClient.tsx — keep MailClient.tsx edits minimal; put the cache in its own module/hook.

## Today
useMessageData.ts (~107) clears the list on every query-key change (setMessages([]) …) and refetches page 1; no per-mailbox client cache. Server list query is already 23–50 ms (perf/switch-server-list); the visible wait is client round trips + render. Next.js server caching (use cache / Cache Components) does not apply: client SPA + per-user API routes; not in scope.

## Goal
Clicking a mailbox (and folder/view) visited earlier in this tab shows its last list immediately on the click, together with its folders and counts, then revalidates in the background and swaps in fresh data without flicker, keeping scroll position and selection where possible.

## Design constraints
- In-memory only (no IndexedDB/localStorage of mail data), bounded (e.g. last 8 account+folder+view keys, first page(s) only), cleared on logout, session change, account removal and on 401/403 from the revalidation (then normal fallback).
- Keyed strictly by accountId + folder + view/search key — never show A's data under B. Last click wins (A→B→A) must still hold; a late revalidation for B must not land after the user moved to C.
- Showing the cached list before the switch POST completes is allowed (user decision); the switch POST + revalidation still run and are authoritative.
- Cached rows that the fresh response no longer contains disappear; new rows appear; unread/flags/collab state from the fresh response win. No double reload (do not reintroduce the duplicate refresh removed by switch-2).
- Keep reader-focus paging, saved page size, keyboard nav, unread counts, collab state, German UI, 390 px.

## Done when
- bun check 0; lint 0 new on touched files; DOM tests: revisit shows cached rows synchronously, revalidation replaces them, A→B→A and A→B→C races, 403 on revalidation clears and falls back, logout clears; build OK.
- One quick sanity number (warm revisit click → rows visible); no harness work (user: no measuring obvious wins).
- Report ROOT/briefs/mailbox-list-cache-report.md. One review afterwards (correctness + the A/B isolation), then merge + preview.
