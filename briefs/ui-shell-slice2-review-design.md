# Review of feat/ui-shell 9009bc5 — lens: design conformance + visual direction (Codex gpt-6.1-sol, 2026-10-22 ~09:55 UTC)

Finding 1 (high) is the §7.2 mobile layout: NOT a defect of slice 2, it is slice 3 (in progress). Ignore in the fix round.

2. **Medium — Reselecting a search scope changes the folder** — `app/components/shell/ShellSearch.tsx:149`. The replacement radio buttons call the scope handler even when already selected. Reproduced: clicking selected "Current folder" while viewing Projects switches to the saved Inbox; clicking selected "Everywhere" overwrites `lastFolderId` with `""`. Fix: return immediately when `nextScope === searchScope`; add coverage for reselecting both scopes.

3. **Medium — Combined filter popover can exceed the viewport** — `app/components/shell/ShellSearch.tsx:219`. The search-filter Popover combines every filter into content measuring 724px tall, with `max-height: none` and `overflow-y: visible`; cannot fit a 720px-high viewport. Fix: cap its height using `--radix-popover-content-available-height` and provide vertical scrolling without shrinking the filter rows.

4. **Medium — Topics heading falls below text contrast requirements** — `app/components/mailclient/folder/FolderTree.module.css:30`. The new `.panelTitle` opacity compounds with `.headerBtn`'s existing `0.7` opacity → effective opacity 0.49; the 12px heading has ≈3.08:1 contrast on the light sidebar. Fix: apply dimming once, preferably through `--muted-foreground`; remove the compounded opacity.

5. **Medium — Secondary retained buttons regain iris styling** — `app/globals.css:315` (deletion immediately before this rule). Removing the `.app-shell` neutral button overrides restores Radix's accent styling on retained secondary controls, e.g. `MessageViewPane.tsx:40` "Show JSON" renders with iris text, fill and border (browser-computed styles confirm). §7.1: accent limited to primary buttons, active sidebar indicator, focus rings, links, unread dots/badges, selected rows. Fix: preserve the neutral overrides under `[data-shell]`, or explicitly give secondary retained buttons neutral styling.

6. **Low — Dead authentication CSS remains despite documented removal** — `app/globals.css:315`, `doc/TEAM-INBOX.md:553`. Unused `.auth-overlay`, `.auth-modal`, `.auth-header`, `.auth-close`, `.auth-form`, `.auth-grid`, `.auth-error` remain; only `.auth-error-floating` is still used. Fix: remove the unused rules, keep the floating-error rule, correct the z-index comment.

7. **Low — D10 still names a different shadcn style** — `doc/TEAM-INBOX.md:46`. D10 says style `new-york`, §7.1 accepts `radix-nova` (matches components.json). Fix: update D10.

Verified correct (do not re-check): SidebarProvider vars, inset/offcanvas, 48px header, rounded white panel, pane frames, compact status bar; Compose + secondary sync button wired to syncAccount(undefined,"new"); mailbox partition/sort/domain grouping >6, avatars, e-mail tooltips; views/counts, collab slot, Topics, FolderTree DnD, NavUser footer; gray/iris tokens, legacy aliases, chart/sidebar tokens, APP_THEME_COLOR; contrast primary/white 5.37:1, muted/background 5.92:1 light / 9.55:1 dark, dark sidebar text 15.45:1; theme integration, detached-window hooks, portal Theme wrapper, z-index ladder, pane ids/persistence. 23 focused tests passed.
