# Upstream comparison: paulwellnerbou/noctua-mail vs. the fork

User request 2026-10-23 ~23:20 UTC: look at the upstream repo for improvements worth adopting.
Research task, READ-ONLY with respect to the fork: no changes in ROOT/repo or any ROOT/wt-* worktree, no commits, no cherry-picks. Rules: briefs/_rules-common.md.

## Setup
- Clone upstream fresh into ROOT/research/upstream-compare/upstream (`git clone https://github.com/paulwellnerbou/noctua-mail.git`), and the fork's integration/stage for comparison: `git clone --branch integration/stage https://github.com/kaeferfreund/noctua-mail.git ROOT/research/upstream-compare/fork` (read-only use). Do not add remotes to ROOT/repo.
- Fork point: the fork's `main` = upstream commit 0f40e022 ("Merge pull request #160 ... icon-button-tooltips"). Upstream main is currently 7a5895c5. The fork has diverged heavily since (team auth, shared mailboxes, roles, collaboration, German i18n, deep links, FTS v3, perf, MCP permission modes, deps wave: Next 16.4, imapflow 2 …). Fork context: ROOT/repo/doc/TEAM-INBOX.md, ROOT/briefs/STATUS.md (go-live cut list), ROOT/briefs/BACKLOG.md.

## Scope
1. List every upstream commit/PR after 0f40e022 (git log 0f40e022..upstream/main, group by PR/topic). For each topic: what it changes, which files, whether the fork already has an equivalent (check the fork clone, not memory), and a recommendation: ADOPT (cherry-pick feasible), ADAPT (re-implement in the fork's structure, estimate size), SKIP (superseded, conflicts with fork decisions, or not useful for a two-person household installation).
2. For ADOPT candidates: dry-run the cherry-pick in the research clone of the fork (`git cherry-pick -n` or `git apply --check`) to report conflict size. Do not push anything.
3. Also note upstream bug fixes relevant to areas the fork relies on (IMAP sync, MIME parsing, drafts/send, calendar, search), security fixes, and dependency/config improvements (next.config, Dockerfile, CI) — the fork is setting up its own CI and updating deps in parallel, so just flag overlaps.
4. Ranking: top 5 with the best value/effort for the go-live of the MailPlus replacement first, then the rest.

## Deliverables
Report briefs/upstream-compare-report.md (German, factual): overview table (topic, upstream commits, fork status, recommendation, effort), then details per ADOPT/ADAPT item with the cherry-pick dry-run result, then the SKIP list with one-line reasons. Remove the clones under ROOT/research/upstream-compare at the end (keep only the report). Do not modify any files outside ROOT/research/upstream-compare and the report path.
