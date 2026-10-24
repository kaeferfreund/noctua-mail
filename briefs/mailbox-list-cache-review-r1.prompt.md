# Review: feat/mailbox-list-cache 9259644 (one round; correctness + mailbox isolation)

Read-only review of branch feat/mailbox-list-cache at 9259644 (on integration/stage 1af46a6; worktree ROOT/wt-list-cache — do not modify it, do not commit). For gates use a scratch copy under ROOT/wt-list-cache/.tmp/review-src (`git archive 9259644 | tar -x -C …`, `bun install`). Ports 4080–4089.
Brief: ROOT/briefs/mailbox-list-cache.md. Implementer report incl. 5 open points: ROOT/briefs/mailbox-list-cache-report.md.
User decisions: a short delay before revoked access takes effect is acceptable; no measuring of obvious wins.

Check:
1. Isolation: no path shows mailbox A's rows, folders, counts, topics or collab state under mailbox B (cache keys, every read re-checks the mailbox id; A→B→A, A→B→C, popstate-like rapid switches; switch failure; logout/session change; account removal).
2. Correctness: revalidation replaces cached rows (deleted/moved rows disappear, unread/flags/collab from fresh data win); local changes written back only after a successful same-view load; no double reload; reader-focus paging, saved page size, keyboard nav, selection; the page-2 → page-1 fix; open point 5 (401/403 now empties a non-cached list) — acceptable or a regression?
3. Merge with current integration/stage (merge-tree; other branches may have merged since 1af46a6) and focused DOM tests on the merged result.
Severity per ROOT/AGENTS.md rule 2; P3 list only. Output ROOT/briefs/mailbox-list-cache-review-r1.md with verdict MERGE / FIX. Rules: ROOT/briefs/_rules-common.md. Do not modify any files except the report and your scratch dir.
