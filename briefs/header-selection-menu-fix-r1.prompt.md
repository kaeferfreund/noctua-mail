# Task header-selection-menu-fix-r1: two review findings in the header actions menu

Read `/home/monkey/code/noctua-mail/briefs/ui-polish-common.md` first (rules, synthetic dev fixture, screenshots, verification, final report). Then read `/home/monkey/code/noctua-mail/briefs/header-selection-menu.prompt.md` for the original feature brief.

- Worktree: `/home/monkey/code/noctua-mail/wt-header-menu`, branch `feat/header-selection-menu` at `f527fc1` (on `0ffd80a`). Commit your fix on this branch as a new commit (no amend, no rebase).
- Ports: app 3812, fixture IMAP 3813, control 3814, SMTP 3815.
- Scratch dir: `/tmp/header-selection-menu-fix-r1/`. Screenshots (only if you take any): `/home/monkey/code/noctua-mail/briefs/header-selection-menu-fix-r1-screens/`.

## Background
`f527fc1` introduced one action set, `selectionActions` in `app/components/MailClient.tsx` (~line 3813), used by the keyboard shortcuts, the right-click bulk menu and the new header menu. Each action gets `{ ids, threadIds }`: `ids` = the selection, else the open message; `threadIds` = the same with each collapsed thread row expanded to all messages of its thread (see `app/components/mailclient/messagelist/selectionActions.ts`). A code review found the two defects below; both are verified against the code.

## Fix 1 — deleting a multi-selection silently deletes hidden thread messages
`remove` sends a single id through `handleDeleteMessage` (which asks before deleting the thread behind a collapsed row, see `allowThreadDeletion` in `app/components/mailclient/useMessageDeleteActions.ts`), but a multi-selection goes straight to `handleDeleteMessagesByIds(threadIds)`. That path only confirms for linked calendar items. Before `f527fc1` the multi-delete (keyboard and right-click menu) deleted only the selected rows (`ids`); now it also deletes every hidden message of each selected collapsed thread without asking.

Scenario: Ctrl/Cmd-click a collapsed 3-message thread row plus one other row, press Delete (or header menu → Delete) → 4 messages go to Trash, no confirmation. In Trash the same path deletes permanently.

Wanted: when `threadIds` contains messages that are not visible as selected rows (i.e. the expansion added hidden thread messages), ask first, with the same dialog style and wording family the single collapsed-thread delete uses, stating how many messages/threads will be deleted. Cancel deletes nothing. Confirm deletes `threadIds` through the existing bulk path (keep the calendar-link confirmation, the delete transaction, Undo notice and selection clearing as they are). When nothing hidden is added, behaviour stays as now (no extra dialog). Keyboard Delete, right-click menu and header menu must behave identically (they share `selectionActions`).

## Fix 2 — Archive leaves a stale selection behind
`archive` loops `handleArchiveMessage` per target; neither it nor `handleArchiveMessage` (`app/components/mailclient/useMessageMutations.ts`) touches the selection. Delete clears it (`clearSelectionWhenActiveRemains`).

Scenario: checkbox-select two Inbox messages, header menu → Archive → both rows disappear, but the header still shows "2 selected" and stays enabled; any next action resolves no targets and silently does nothing, and the stale ids also win over the open-message fallback.

Wanted: after a bulk archive the selection no longer contains the archived messages (header count drops, menu disabled if nothing is left to act on); if the open message was archived, behave like the single-message archive does today. Then check the other paths that make messages leave the list — Move to folder, Move to… dialog, Move to account, Add topic in topic mode if applicable — and make them consistent (selection cleared or pruned once the messages are gone). Prefer one small shared helper over per-action copies. Do not change what Copy to account does to the selection unless it is clearly wrong.

## Out of scope (do not change)
- Flag and To-Do act on `ids`, not on the expanded thread. That matches the keyboard shortcuts and is a pending product decision.
- The header menu is disabled when no selection exists and `activeMessageId` is empty even if the reader still shows a message after a folder switch. Leave as is.
- No changes to the unread ring, list layout, fonts or anything outside the selection/delete/archive paths.

## Tests
Add tests that fail before your change and pass after: at least (a) multi-selection containing a collapsed thread → confirmation requested, cancel deletes nothing, confirm deletes the full thread set; multi-selection of plain rows → no extra dialog; (b) bulk archive → selection pruned/cleared and header count updated. Use the existing patterns in `selectionActions.test.ts`, `SelectionActionsMenu.dom.test.tsx` and the delete-action tests. A short browser check against the synthetic fixture (select collapsed thread + row → Delete → dialog; select 2 → Archive → header shows no selection) is welcome but optional.

## Hard constraints
Commit only on `feat/header-selection-menu` in `/home/monkey/code/noctua-mail/wt-header-menu`. Do NOT push, merge into other branches, open PRs, deploy, change credentials or run destructive git (reset --hard, force-push, branch deletion, bare git stash). No new dependencies, synthetic data only. Stop every server you started and delete `/tmp/header-selection-menu-fix-r1/` at the end. Finish with the final report from ui-polish-common.md (files changed, tests with counts, `bun check`/eslint/`test:ci`/build results, commit SHA, open questions).
