# Task draft: perf/thread-collapse-first-commit

Status: DRAFT, assigned to the deps thread by the Umbau thread on 2026-10-23. Start only after `feat/reader-focus` is merged into `origin/integration/stage` (round 10). Base: the stage head at that moment.

## Problem (from `briefs/perf-html-sanitize-spike.md`, "Thread open")
Opening a thread whose messages are already loaded renders every sibling expanded in the first commit. The selection batch (`MailClient.tsx`, around line 2660 on 0ac6cfa) only sets `pendingSelectionCollapseMessageId`; the siblings collapse later in a parent `useEffect` (`MessageViewOrchestrator.tsx`, around lines 610–630 on 0ac6cfa), after the children have rendered and run their own effects. An N-message thread pays N `/prefs` GETs and 2N sanitize passes and throws N−1 GETs and 2(N−1) passes away; about 100 ms per 4-message thread with 54 KB mails.
Line numbers will have moved: reader-focus changes selection and focus logic in `MailClient.tsx` and `MessageViewOrchestrator.tsx`. Re-locate the code on the new base first.

## Fix
Derive the collapse state during render, or set the collapse map in the same batch as the selection. Keep the explicit-selection semantics and the `supportsThreads === false` branch.

## Mandatory proof (Umbau conditions)
- In-repo DOM test based on `briefs/perf-html-sanitize/prefsCount.dom.test.tsx` (real `ThreadView` → `ThreadMessageCard` → `HtmlMessage` stack): for N = 4, exactly 1 `/prefs` GET and 2 sanitize passes for the expanded message in the first commit.
- One live check: production build, a thread with 4 messages, network requests counted with Playwright.
- Unchanged and green: the existing thread tests for auto-expand of the newest/unread message, j/k navigation, and deep-link to a message inside a thread.
- `bun run typecheck`, `bun run lint`, `bun run test:ci`, `bun run test:stress`.

## Isolation and model
Worktree `/home/monkey/code/noctua-mail/wt-perf-thread-collapse`, branch `perf/thread-collapse-first-commit`; own data dir; ports from this thread's range; `claude-cargnel` / `claude-opus-5-5` / `{"effort":"high","fastMode":false}`; commits on the branch only, never push or merge. Review by the Umbau thread.
