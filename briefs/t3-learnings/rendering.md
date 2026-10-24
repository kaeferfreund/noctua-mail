# Rendering: lessons from T3 Code for Noctua

Research date: 2026-10-23. Read-only inspection of T3 Code at `5bb54a0f77` and Noctua `wt-integration-dryrun` at `34dd18e5`; GitHub PR descriptions fetched with `gh pr view`. No clone code, builds, installs, services or benchmarks were run. Numbers below are the PR authors' measurements, not independently reproduced results or predictions for Noctua.

## Relevant commits and PRs

| Commit | PR | Technique and evidence |
|---|---|---|
| `5cf140b0ee` | [commit](https://github.com/pingdotgg/t3code/commit/5cf140b0ee2d7320d101b082217a90afb7f230ce), no PR number in subject | Initial chat virtualization with TanStack Virtual; messages and work rows share the scroll container. Historical implementation, not today's list library. No measured gain stated. |
| `867cf4cf09` | [#1664](https://github.com/pingdotgg/t3code/pull/1664) | Shared renderer/height-estimator row model; width-scoped measurement keys; initial tree collapse state correct on first render. No timing result. |
| `19c1710a88` | [#9725](https://github.com/pingdotgg/t3code/pull/9725) | Incremental ordered entries and row reuse for text-only streaming updates. At 15,000 tool activities: 5.589 → 0.353 ms; source-function benchmark, not browser timing. |
| `aefef95ffc` | [#9909](https://github.com/pingdotgg/t3code/pull/9909) | Follow-up: a freshly rebuilt, equal revert-target Map defeated the row fast path in the real app. Reuse equal Maps; no new timing result. |
| `211618fd9f` | [#11169](https://github.com/pingdotgg/t3code/pull/11169) | Keep list mounted and retain up to 16 painted timelines. Cached switch 252.475 → 178.500 ms versus parent stack; blank switches 48/48 → 0/48. Production browser, two synthetic 400-message threads; no native-mobile claim. |
| `f17165a76b` | [#12144](https://github.com/pingdotgg/t3code/pull/12144) | Restore scoped row ID + intra-row offset and disclosure state; distinguish reading history from following the end. User navigation overrides restoration. No timing result. |
| `f6fa4776e7` | [#18077](https://github.com/pingdotgg/t3code/pull/18077) | Stable callbacks/props let timeline and composer skip panel-toggle renders. Production browser, 1,009 rows: total blocking time 3,332 → 1,114 ms across 54 gestures; median script/gesture 70.4 → 51.6 ms. Remaining forced-layout cost was separate. |
| `130f4a2457` | [#20814](https://github.com/pingdotgg/t3code/pull/20814) | Clock subscription in relative-time leaves; remove render-prop closure that rebuilt sortable props. Baseline: 232 renders for one minute tick with 11 rows; after measurement pending. |
| `489d08a054` | [#20837](https://github.com/pingdotgg/t3code/pull/20837) | Router selectors return primitive IDs, then construct stable route objects. Baseline: 177 thread-view renders in 40 idle seconds; after measurement pending. |
| `edb2155566` | [#20823](https://github.com/pingdotgg/t3code/pull/20823) | Select status/has-snapshot/count or related entities, not whole environment state; imperative subscriptions for effects. Initial remeasure 192 → 190 exposed another broad subscription, then fixed; final measurement pending. |
| `1d00edb23a` | [#20852](https://github.com/pingdotgg/t3code/pull/20852) | Markdown reads equality-preserving presentation/config slices; event handlers read connections when invoked. Baseline: 7,554 renders/20 s across reconnect/push activity; after measurement pending. |
| `ecb938da58` | [#20854](https://github.com/pingdotgg/t3code/pull/20854) | Remove provider status list from every row's context. Avatar leaves select name/icon; full data lives in open tooltips. Baseline: 818 renders for one status push; after measurement pending. |
| `4b1024dafe` | [#20860](https://github.com/pingdotgg/t3code/pull/20860) | Quiet thread shells stabilize chrome; visit-watermark work moves to a leaf; environment-list inputs also needed stable identities. Baseline: 1,942 renders/12 s; final measurement pending. |
| `91ec4bec2d` | [#21123](https://github.com/pingdotgg/t3code/pull/21123) | Put row context inside each virtual row so outgoing rows do not receive incoming-thread context before unmount. Production switch scenario, 2,662/149/45 messages: median renders 15,892 → 13,970 (−12%). |
| `1114c3815b` | [#21269](https://github.com/pingdotgg/t3code/pull/21269) | Bucket virtual row types by doubling text length. Long replies had poisoned type-average height estimates, causing measurement/mount cascades. Huge-history prepend: nested updates 20/5/20 → 2/2/2; regression test previously exceeded React's update-depth limit. |
| `f36dadb782` | [#21482](https://github.com/pingdotgg/t3code/pull/21482) | Flatten visible tree rows; virtualize large trees, observe ancestor viewport/resize, retain focused row outside window. Browser check: 16,185-file checkpoint, 33–44 mounted rows when expanded. |
| `178e2abce9` | [#21831](https://github.com/pingdotgg/t3code/pull/21831) | Virtualization threshold counts all visible rows, including directories. 1,000 collapsed folders: initial range 1,000 → 40 (−96%); calculated range, explicitly not measured DOM/timing. |
| `5a0d1594e8` | [#22730](https://github.com/pingdotgg/t3code/pull/22730) | Sidebar arranges quiet shells; each row subscribes to its own live shell. Dev browser, 9 rows, another thread streaming for 15 s: sidebar-component renders 286 → 27; Sidebar renders 7 → 0. |
| `83f118a4ac` | [#23117](https://github.com/pingdotgg/t3code/pull/23117) | Typed structural thread view excludes streaming text; live timeline/find subscribe separately. Long reply: total renders 3,493 → 3,204; ChatView 32 → 18. Short reply: ChatView 22 → 18. |
| `ee33c4c65d` | [#23124](https://github.com/pingdotgg/t3code/pull/23124) | Structural view also excludes visit timestamps; separate live fallback selector when shell absent. Additional 1–3 fewer ChatView renders/reply; total counts noisy, long-reply total increased. |

## What transfers, and what already exists

- Current T3 uses `@legendapp/list/react` in `apps/web/src/components/chat/MessagesTimeline.tsx:1111`, with stable row keys, type-specific estimates, memoized row rendering and explicit follow/restore modes. The earlier TanStack implementation is useful history, not a prescription to change Noctua's list library.
- Noctua already has a memoized, fixed-height `VirtualizedList` with binary-search offsets, overscan 8, rAF-coalesced scroll handling and no-op scroll-state equality: [VirtualizedList.tsx:13](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/messagelist/VirtualizedList.tsx:13). `MessageRow` has a custom memo comparator, and selection already has an external store. “Add virtualization/memo everywhere” would duplicate existing work.
- The reader differs: [ThreadView.tsx:69](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/message/ThreadView.tsx:69) maps all rendered thread messages to cards. Collapsed cards avoid expanded body rendering; a long expanded thread can still mount many HTML frames. [HtmlMessage.tsx:481](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/HtmlMessage.tsx:481) already memoizes paired sanitization independently of theme/zoom and exports a memoized component at line 767.
- Many T3 fixes depend on React Compiler caches. No `reactCompiler` configuration was found in Noctua's Next config/package manifest. Transfer subscription boundaries and identity contracts; use explicit memo/callback boundaries where required, not assumptions about T3's compiled output.
- Overlaps below use `briefs/switch-ideas/_dedup.md`, `briefs/perf-mailbox-switch.md` and `briefs/deep-links.md`. They describe reported work, not a new verification of those branches.

## Ranked ideas for Noctua (gain relative to effort/risk)

### 1. Move ticking relative-time labels out of MailClient

- **Technique / T3:** #20814 isolates clocks in labels; #20860 isolates a bookkeeping subscriber in a leaf. Subscribe where the changing value is displayed.
- **Where / fact:** [MailClient.tsx:1073](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/MailClient.tsx:1073) increments root state every second while `draftSavedAt` exists. The formatter reads `Date.now()` and is recreated at [line 1162](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/MailClient.tsx:1162), then goes to both a shell surface and compose at lines 5838/6004. This root update is intentional today, not a hypothetical subscription.
- **Expected gain:** Remove up to 60 timer-triggered MailClient render invocations/minute in that state, plus avoid prop churn below it. Descendant render/time savings need profiling; existing memo boundaries may already absorb part of the work.
- **Risk:** Low. Both saved-time displays must continue ticking and switch language correctly; update cadence can follow displayed seconds/minutes without changing the wording.
- **Overlap:** **none** in the supplied switch/deep-link briefs.
- **Verify:** Synthetic saved draft; record 65 s idle at desktop/390 px. Count MailClient/list/reader renders and long tasks; only time-label leaves should tick. Exercise save, close, reopen and locale change.

### 2. Flatten large suggestion sections into the virtual row model

- **Technique / T3:** #21482 and #21831 bound actual rendered descendants, rather than just the number of outer containers.
- **Where / fact:** [listModel.ts:484](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/messagelist/listModel.ts:484) puts an entire suggestion group into one `suggestion-section`. [MessageListRenderer.tsx:81](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/messagelist/MessageListRenderer.tsx:81) gives it cumulative height and maps every child at line 108. The virtualizer bounds sections, not rows inside an expanded section. Groups are collapsed by default, so the cost is conditional.
- **Expected gain:** For a large expanded group, mounted suggestion rows become proportional to viewport + overscan rather than group size. No quantified claim about typical household groups; first measure their sizes.
- **Risk:** Low–medium. Keep the visual section boundary, collapse defaults, selection/range order and reader navigation consistent. Prefer flattening into the existing scroller over adding a nested scrollbar.
- **Overlap:** **switch work (partial H)** for list-model files; this specific nested rendering escape is not named in H. Coordinate rather than duplicate its thread-forest work.
- **Verify:** Synthetic 1,000-row suggestion section: scroll top/middle/end, collapse/reopen, select a range, open reader and navigate. Mounted rows should stay bounded; counts/order and all items must remain reachable.

### 3. Give each reader card only its own changing state, then memoize it

- **Technique / T3:** #18077 stabilizes expensive child inputs; #20854 removes unrelated status from row context; #23117 separates live content from structural chrome.
- **Where / fact:** [ThreadView.tsx:77](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/message/ThreadView.tsx:77) spreads shared card props into every card. [ThreadMessageCard.tsx:88](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/message/ThreadMessageCard.tsx:88) accepts whole collapse/tab/font/zoom/translation maps and pending-action sets; the component at line 141 is not memoized. The parent builds a new message lookup and card-prop object at [MessageViewOrchestrator.tsx:756](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/message/MessageViewOrchestrator.tsx:756).
- **Expected gain:** Changing one message's zoom/tab/collapse/translation can render that card instead of all N cards; fewer header/address/attachment computations even where memoized HtmlMessage already skips sanitization.
- **Risk:** Medium. Pass per-message scalar/slice props and stable actions; preserve shared lookup identity when contents are unchanged. Avoid a comparator that ignores changing callbacks, permissions, remote-content policy or translated bodies.
- **Overlap:** **none** in supplied briefs; existing HtmlMessage memoization is already done and should be retained.
- **Verify:** 200-message thread; toggle one card/tab/zoom and update collaboration on a sibling. Profile card render counts and iframe navigation/sanitizer calls; unchanged bodies should not rebuild. Verify actions use current mailbox, role and message.

### 4. Return previous references for genuinely unchanged pushes/refetches

- **Technique / T3:** #9725/#9909 show why a single fresh equal Map can defeat an otherwise sound fast path; #20852/#22730 preserve equal selected objects/arrays before React schedules work.
- **Where / fact:** [folderStreamUpdates.ts:11](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/folderStreamUpdates.ts:11) always creates an array and copies a matched folder even for identical counts. [MailClient.tsx:2870](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/MailClient.tsx:2870) creates Maps, a messages array and copies messages for every matching collaboration summary. [useMessageData.ts:350](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/useMessageData.ts:350) replaces refreshed messages; [MessageRow.tsx:555](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/messagelist/MessageRow.tsx:555) explicitly depends on message reference equality.
- **Expected gain:** Repeated equal events become rendering no-ops; unchanged refreshed rows can retain memo eligibility. Gains depend on event repetition and loaded-row count; equality itself has a cost.
- **Risk:** Low for scalar folder counts, medium for message/collaboration reconciliation. Start with narrow display equality; preserve changed counts, permissions, assignment, attachments and authoritative invalidation signals. Do not mutate old objects or retain messages across accounts.
- **Overlap:** **backlog I** explicitly covers equal folder-status/collaboration publication; message-refetch reconciliation is an extension. Hand this evidence to that item rather than create a duplicate.
- **Verify:** Same payload twice must preserve array/element references; change one visible field and only that entity must change. Measure identical SSE bursts, one changed folder and a refreshed loaded list; cover revocation and move/delete updates.

### 5. Keep live sidebar counters/status out of unrelated panes

- **Technique / T3:** #20823 selects readiness/count primitives; #22730 keeps structural sidebar ordering separate from per-row live data; #20854 lets tooltip-only consumers mount on demand.
- **Where / fact:** [MailClient.tsx:2901](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/MailClient.tsx:2901) consumes mailbox summaries at the shell. [ShellSidebar.tsx:83](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/shell/ShellSidebar.tsx:83) rebuilds the summary lookup and all mailbox-row JSX. Folder tree rows receive the shared state bundle at [FolderTree.tsx:77](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/folder/FolderTree.tsx:77). Actual fan-out needs a browser profile.
- **Expected gain:** A count/progress update for mailbox A reaches A's relevant label/status, rather than triggering reconstruction of unrelated reader/list/sidebar elements. Structural changes such as sorting, membership and the selected mailbox still propagate.
- **Risk:** Medium. Use narrow selectors/leaf boundaries or existing external-store patterns, not an automatic state-library migration. Noctua's sorting/count semantics must stay live; T3 deliberately reduced activity-sort updates during streaming, a behavior change not automatically acceptable here.
- **Overlap:** **switch work A** already owns lazy menus, memo folder nodes and mailbox rows; **backlog I** covers no-op updates. The additional boundary is subscriber placement, to assess after those changes land.
- **Verify:** Stream synthetic count/progress changes for an inactive mailbox while reading a large thread. Record rendered components, not just commits; rename/membership/current-folder changes must still update promptly.

### 6. Make virtualization respond to pane geometry, not only window resize

- **Technique / T3:** #21482 observes ancestor geometry and computes ranges against the actual enclosing scroller; #1664 invalidates variable-height measurements when wrapping width changes.
- **Where / fact:** [VirtualizedList.tsx:39](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/messagelist/VirtualizedList.tsx:39) measures its list-relative origin and scroll-container height, but listens only to scroll/window resize. rAF coalescing and equality guards already exist. Reader-focus/mobile/pane changes can alter the element without a window resize; whether that currently leaves stale ranges needs reproduction.
- **Expected gain:** Correctly filled viewports after container-only resize and fewer missing/excess rows; modest timing gain, primarily robustness. Retain fixed-height arithmetic for the mail list.
- **Risk:** Low–medium. Observe only necessary container/origin changes, coalesce callbacks and avoid ResizeObserver feedback loops. A variable-height reader additionally needs width/font/zoom-aware measurement invalidation; don't invalidate fixed-height rows unnecessarily.
- **Overlap:** **none** explicitly; verify against the merged reader-focus/deep-link behavior before implementation.
- **Verify:** Change pane height/width without a window resize, toggle reader focus/sidebar, rotate a 390 px viewport and change zoom. Check filled viewport, total height, row IDs, callback frequency and forced-layout time.

### 7. Restore a message anchor and let user navigation cancel it

- **Technique / T3:** #12144 stores row ID, intra-row offset, fallback scroll offset, end-follow and disclosures in a bounded scoped cache. Current `useTimelinePositionRestore.ts:81–139` cancels on wheel/touch/pointer/scroll keys and reconciles against measured position for two stable frames.
- **Where / fact:** [MailClient.tsx:4758](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/MailClient.tsx:4758) locates a mounted message ref and scrolls it to start. It waits a collapse timeout plus rAF at line 4765; there is no equivalent measured row-anchor restoration in this path. [HtmlMessage.tsx:530](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/HtmlMessage.tsx:530) changes iframe height asynchronously, so a nominally finished navigation can still shift.
- **Expected gain:** Preserve reading position on Back/thread return and under body/image loading; avoid repeated corrective jumps. This is UX/scroll correctness, not a demonstrated CPU speedup.
- **Risk:** Medium. Scope by user/account/folder/thread, bound cache size, clear on logout/revocation. Explicit deep-link target wins over remembered position; wheel/touch/keyboard wins over pending restoration. Mail reading should normally keep the selected message visible, not inherit chat's automatic follow-newest policy.
- **Overlap:** **deep links**, directly; coordinate navigation ownership rather than implement a second restore effect. Mailbox-switch selection ordering remains authoritative.
- **Verify:** Open a long thread mid-history, switch away/back, Back/Forward, then delayed synthetic image/body resizing. Interrupt restore manually; ensure no later snap. Cover deleted/moved anchor, font/zoom change and account switch.

### 8. Virtualize long reader histories with measured bodies and pinned interaction rows

- **Technique / T3:** #1664/#21269 combine correct row models with realistic height classes; #21123 isolates row identity/context during switches; #21482 retains focus outside the visible window.
- **Where / fact:** [ThreadView.tsx:69](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/message/ThreadView.tsx:69) mounts all card wrappers. Expanded cards can render [HtmlMessage through ThreadMessageCard.tsx:384](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/message/ThreadMessageCard.tsx:384); each HTML document has its own parsing/layout, document scans and observers in [HtmlMessage.tsx:488](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/HtmlMessage.tsx:488). Existing fixed-height list virtualization cannot correctly size these bodies.
- **Expected gain:** For very long, expanded conversations, keep expensive cards/iframes proportional to viewport plus overscan and pinned rows. A single enormous HTML mail remains one expensive document: row virtualization does not reduce its internal DOM or sanitizer cost.
- **Risk:** High relative to the preceding changes; benchmark first, likely after go-live. Keep active compose, focused/selected text and open interaction rows mounted. Store card/disclosure state outside recycled rows. Measure iframe height changes; use separate collapsed/plain/HTML size classes and width/font/zoom scopes. Text-length buckets alone cannot predict table/image-heavy HTML. Preserve sanitization, CSP and remote-content policy; avoid slicing arbitrary HTML into “virtual paragraphs.”
- **Overlap:** **none** as an implementation in supplied briefs; depends on **deep links**/anchor work for offscreen targets. Do not replace the existing mail-list virtualizer as part of this.
- **Verify:** Synthetic 10/200/1,000-message threads with compact/full modes, plain text, long HTML and delayed images. Count mounted cards/frames, heap and long tasks; test prepend, deep-link jump, quote collapse, browser find/print, attachment actions and uninterrupted inline compose at desktop/390 px.

### 9. Flatten and virtualize folder trees only above a measured size threshold

- **Technique / T3:** #21482 flattens expanded nodes with depth, uses the outer viewport and pins focused rows; #21831 counts folder headers as real rows.
- **Where / fact:** [FolderTree.tsx:71](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/folder/FolderTree.tsx:71) maps roots; [FolderTreeNode.tsx:248](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/mailclient/folder/FolderTreeNode.tsx:248) recursively maps all expanded children. Collapsing removes descendants, but thousands of sibling folder headers remain thousands of rows.
- **Expected gain:** Large trees have bounded mounted rows and menus. Small household trees may gain little; T3's 250-row cutoff is evidence of a strategy, not a universal threshold to copy.
- **Risk:** Medium. Preserve nesting/search-visible ancestors, drag/drop targets, expand state, active/focused row and keyboard accessibility. One sidebar scroller should own the viewport. Count all flattened rows, not only leaves or expanded-folder children.
- **Overlap:** **switch work A**, partial: its memo/lazy-menu work should finish first; full tree virtualization is a separate large-tree option, not another fix round on that branch.
- **Verify:** 50-folder baseline and synthetic 1,000 sibling/10,000 nested folders; search, collapse all, scroll to final row, keyboard focus and drag/drop. Measure DOM rows, first paint and input delay; retain simple rendering if small-tree cost worsens.

### 10. Keep URL subscriptions primitive and avoid waking panes for unchanged navigation

- **Technique / T3:** #20837 selects route IDs rather than fresh objects; #20823 selects booleans/status rather than whole query state. #21123 warns that changing enclosing row context before list contents swap can also render outgoing content unnecessarily.
- **Where / fact:** [MailClient.tsx:4219](/home/monkey/code/noctua-mail/wt-integration-dryrun/app/components/MailClient.tsx:4219) currently reads URL params only on mount; the proposed live URL hook in `briefs/deep-links.md` will introduce ongoing navigation handling. This is a design constraint for new work, not an existing TanStack Router bug in Noctua.
- **Expected gain:** Unchanged history/search-param writes do not rebuild folder/list/reader props or trigger redundant loads. Actual account/folder/message navigation should still render and load as needed; no current timing estimate.
- **Risk:** Low–medium. Depend on normalized account/folder/message IDs and stable options; keep push/pop application idempotent and preserve “latest switch wins.” The exact T3 selector API is not portable to Next.js.
- **Overlap:** **deep links**. Include in that branch's existing focused verification rather than launch separate work.
- **Verify:** Repeated same-location replaceState and unrelated URL changes should cause no extra mailbox/list loads; Back/Forward and rapid A→B→A must reach the correct destination. Check old rows never acquire the new account's actions/permissions while retiring.

## Boundaries for applying the findings

T3's #11169 is evidence for keeping a list instance and scoped caches stable, not a reason to show outgoing mailbox data under an incoming mailbox header. Noctua's switch report explicitly fixes wrong-mailbox flashes; preserve that behavior. Cache display identity, action identity and authorization must agree, and cross-user/account reuse is inappropriate.

Prioritize the clock leaf, bounded suggestion children and reader-card inputs as independently measurable changes. Recheck overlaps after the existing switch branches merge. Neither a large atom-store rewrite, enabling React Compiler, nor a virtualizer dependency upgrade is justified by this read-only investigation alone. Do not treat baseline-only T3 audits as measured improvements, or render counts as equivalent to latency.

## Five-line summary

1. Noctua already virtualizes ordinary list rows; expanded suggestion groups and reader cards are the concrete remaining DOM-size boundaries.
2. The lowest-risk direct transfer is moving the once-per-second saved-draft clock from MailClient into time-label leaves.
3. Stable per-entity references, card-specific props and leaf subscriptions can prevent unrelated SSE/status changes from reaching expensive panes.
4. Huge-history scrolling requires scoped message anchors, cancellation and realistic measured heights; arbitrary HTML is less predictable than chat text.
5. Coordinate folder/sidebar and URL ideas with existing switch/deep-link work; profile long-reader virtualization separately before accepting its higher interaction risk.
