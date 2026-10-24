# Brief: learn from T3 Code's large-chat performance work (research, read-only)

User (2026-10-23, German): "Schaut euch T3 Code an, was die für Verbesserungen beim Laden von großen Chats gemacht haben — da gibt es sicher viele Commits und PRs." Goal: concrete, transferable techniques for Noctua (large mailboxes, long conversations/threads, big HTML mails, mailbox/thread switching, phones/PWA).

T3 Code: blobless clone at ROOT/research/t3code (github.com/pingdotgg/t3code, ~7,400 commits; commit subjects carry PR numbers like (#21123)). Read only — do not build, install or run anything from it (untrusted code). Use `git log --grep`, `git show <sha> --stat` / diffs, and `gh pr view <n> --repo pingdotgg/t3code` (read-only) for PR descriptions/measurements. Useful starting grep: `git log --oneline -i -E --grep='perf|virtuali|re-render|long thread|huge|large|pagina|lazy|switching threads|stream'`.

Noctua (ROOT=/home/monkey/code/noctua-mail): Next.js 16 App Router SPA (app/components/MailClient.tsx + mailclient/* hooks), React 19, Bun, bun:sqlite shards, SSE event streams. Read-only reference checkout: ROOT/wt-integration-dryrun (integration/stage, do not modify). Already done or in flight — mark overlaps instead of re-proposing: ROOT/briefs/switch-ideas/_dedup.md (mailbox switch work), ROOT/briefs/perf-mailbox-switch.md, ROOT/briefs/deep-links.md (URL/deep-link feature being built right now).

## Output (strict)
Write exactly one file ROOT/briefs/t3-learnings/<your-area>.md (area given in your task). Do not modify any other file anywhere.
1. Short map of the relevant T3 Code commits/PRs in your area (sha, PR #, one line what + measured gain if stated) — at most ~25 entries, the most instructive ones.
2. Up to 10 transferable ideas for Noctua, ranked by gain/risk: technique (with T3 PR refs), where it applies in Noctua (file:line in wt-integration-dryrun), why it helps there (code fact or measurement), expected gain, downside/risk, overlap (none / switch work / deep links / backlog), how to verify.
3. Five-line summary. Keep it under ~250 lines. Neutral wording; German not required.
