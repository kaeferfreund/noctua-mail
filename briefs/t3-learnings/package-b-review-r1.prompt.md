# Review: perf/conversation-window 91ba9ce (one round; API contract + correctness)

Read-only review of branch perf/conversation-window (5 commits on b9ff511 + merge of integration/stage 1af46a6 by the orchestrator = 91ba9ce, conflict in the list-completion effect resolved by keeping both; worktree ROOT/wt-conversation-window — do not modify it, do not commit). For gates use a scratch copy under ROOT/wt-conversation-window/.tmp/review-src (`git archive 91ba9ce | tar -x -C …`, `bun install`). Ports 4090–4099.
Brief: ROOT/briefs/t3-learnings/package-b.md. Implementer report incl. open points: ROOT/briefs/t3-learnings/package-b-report.md.

Check:
1. API: /thread/related headers-only option + window/cursors (bounds, no gaps/duplicates, equal dates, placeholders), authorization by path account id + membership unchanged, account isolation, folder exclusion; message detail `stored/empty/missing` content state; existing callers (default full response) unchanged.
2. Reader: body on expand, selected + newest unread expanded, older/newer loading, deep link / openMessageId and search hit to an old message open an anchor window; reply/forward quoting and print with not-yet-loaded bodies; translation, remote-content blocking, collab notes/assignment; resync only for `missing`; abort/latest-wins on fast thread switching; body cache (200) cleared on account switch/logout — no body of mailbox A shown under B.
3. UI: take screenshots of a long conversation with the load buttons at desktop 1440 and 390 px (dark + light) with synthetic data; German labels; flag layout breakage as P2.
4. Merge resolution in MailClient.tsx list-completion effect (AbortController + clearThreadRelatedMessages); merge-tree vs current integration/stage; focused tests.
Severity per ROOT/AGENTS.md rule 2; P3 list only. Output ROOT/briefs/t3-learnings/package-b-review-r1.md with verdict MERGE / FIX. Rules: ROOT/briefs/_rules-common.md. Do not modify any files except the report, screenshots under ROOT/briefs/t3-learnings/package-b-evidence/ and your scratch dir.
