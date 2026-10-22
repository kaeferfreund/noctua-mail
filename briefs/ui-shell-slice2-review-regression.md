# Review of feat/ui-shell 9009bc5 — lens: regressions + accessibility (Codex gpt-6.1-sol, 2026-10-22 ~09:54 UTC)

Reviewed in detached worktree wt-review-shell @9009bc5 (slice 2 only; slice 3 = mobile was not part of this review).

1. **Medium — Filter options extend beyond the viewport.** `app/components/shell/ShellSearch.tsx:219`
   At 1280×720, the production component renders a 724px-tall popover, placing "AI Modified" below the viewport. Its computed `max-height` is `none` and overflow is `visible`; the page's `overflow: hidden` prevents scrolling to it. **Fix:** constrain the popover to `--radix-popover-content-available-height` and enable vertical scrolling.

2. **Medium — Reselecting the current search scope changes folder state.** `app/components/shell/ShellSearch.tsx:149`
   Start in Archive, select Everywhere, then click the already-selected Everywhere row. Because `activeFolderId` is now empty, the handler overwrites `lastFolderId` with `""`; selecting Current folder subsequently opens the first folder instead of Archive. The former Radix RadioGroup only invoked its change handler when the value changed. **Fix:** return immediately when `nextScope === searchScope`, and add a regression test.

3. **Medium — Bold also toggles the sidebar in composers.** `app/components/shell/AppShell.tsx:58`
   Press Ctrl/Cmd+B in an inline composer. `ComposeOrchestrator` is AppShell's sibling and portals its editor into the reader, so React events follow the orchestrator's ancestry and bypass this guard; SidebarProvider's window listener consequently toggles the sidebar. Modal compose also sits outside the guard. A DOM reproduction recorded one sidebar toggle and zero guard calls. **Fix:** exclude editable targets in SidebarProvider's window handler itself, covering both composer modes.

4. **Medium — Search filters expose incomplete menu semantics.** `app/components/shell/ShellSearch.tsx:75`
   FilterRow assigns `menuitemradio` and `menuitemcheckbox` roles to ordinary buttons inside a popover dialog, without a menu owner or menu keyboard navigation. Browser verification confirmed ArrowDown leaves focus unchanged; scope and category radios also lack separate semantic groups. **Fix:** use native checkbox/radio controls with labelled groups inside the popover, or restore complete Radix menu primitives.

5. **Medium — Custom focus indicators have insufficient contrast.** `app/globals.css:93`
   Keyboard focus on the new shell uses iris-8 while generated controls suppress native outlines. From the installed Radix scales, opaque iris-8 measures 2.46:1 against white, 2.33:1 against the light sidebar, and approximately 2.95:1 against the dark card; controls using `ring-ring/50` reduce contrast further. **Fix:** use opaque focus colours achieving at least 3:1 against their adjacent surfaces, and verify the rendered indicators rather than only primary-button text contrast.

6. **Low — The shell introduces nested main landmarks.** `app/components/shell/AppShell.tsx:72`
   RootLayout already renders `<main>{children}</main>`, and SidebarInset renders another `<main>` inside it. **Fix:** retain one main landmark by changing one wrapper to a non-landmark element.

Checks: `bun run test:ci` passed incl. 19 DOM tests; tsc 151 errors excluding bun:test (baseline). Live login inspection blocked by a stale Next dev lock; browser findings used the production ShellSearch component and compiled CSS in memory.

Verified as correct (do not re-check): account switching, drafts, `syncAccount(undefined,"new")`; every previous search field/badge option incl. participant/sender exclusivity and exclusive categories; virtual-view counts, topic actions, folder DnD, context-menu handlers; virtualization scrolling element and list-width observer cleanup; calendar mounting preserves list/reader DOM identity; pane IDs + storage; compose modes, send-race tests, status panels, notices, settings, developer tools, logout; sidebar Sheet nested Theme; AppShell TooltipProvider; detached renderers follow document theme; Inter injection, 100dvh; primary/white 5.37:1, gray text and active-mailbox text > 4.5:1.
