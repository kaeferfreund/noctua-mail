# Package B — measure first: how expensive is opening a long conversation? (read-only)

Checkout ROOT/wt-measure-threads (detached at integration/stage f29fbd6; scratch only, no commits). `bun install` first. Ports 4060–4069.
Background: ROOT/briefs/t3-learnings/_dedup.md cluster L; data-loading.md §1–4, §8; rendering.md §8. Today opening a conversation calls /api/accounts/[accountId]/thread/related (no limit, full bodies + HTML, enrichment for every related message), may POST /resync first (useThreadContent.ts ~172), and the reader maps every card (ThreadView.tsx).

## Measure (synthetic data only, production build on your port, warm, ≥ 10 runs, p50/p90)
Conversations of 5, 20, 50, 200 messages (mix of plain text and large HTML newsletters, some with attachments):
1. Server: /thread/related time and bytes (and gzipped bytes) per size.
2. Client: click → first message visible, → all cards rendered, main-thread long tasks, iframe count, JS heap after open; desktop and 390 px (CPU throttle 4× for the phone case).
3. How often the /resync POST runs on a normal open, and what it costs.
4. Prototype estimate (no product commit): headers-only window (e.g. selected message ± 10 + newest) with bodies on expand — patch in scratch, measure the same numbers.
Also report what realistic household conversation lengths are likely (look at the synthetic fixture and say what you assume).

## Output
ROOT/briefs/t3-learnings/package-b-measure.md is this brief; write results to ROOT/briefs/t3-learnings/package-b-measure-report.md: tables, where the time goes, expected gain of the window design per size, risks (deep links to old messages, search hits, print, reply quoting, collab notes), and a recommendation (do now / after go-live / not worth it) with a rough effort. Leave the checkout clean. Rules: ROOT/briefs/_rules-common.md. Do not modify any file except the report. Target ≤ 75 min.
