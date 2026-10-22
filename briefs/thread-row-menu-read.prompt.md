# Task thread-row-menu-read: read/unread on a collapsed thread row acts on the whole thread

Read `/home/monkey/code/noctua-mail/briefs/ui-polish-common.md` first (rules, synthetic dev fixture, screenshots, verification, final report).

- Worktree: `/home/monkey/code/noctua-mail/wt-thread-row-read`, branch `fix/thread-row-menu-read`, based on `polish/ui-bundle` `ba95105` (contains the unread ring, the header actions menu with its fix, and the shared `selectionActions`).
- Ports: app 3820, fixture IMAP 3821, control 3822, SMTP 3823. `.env.local` is prepared (own data dir).
- Scratch dir: `/tmp/thread-row-menu-read/`. Screenshots (optional): `/home/monkey/code/noctua-mail/briefs/thread-row-menu-read-screens/`.

## Decision by the user
On a collapsed thread row, "Mark as read" / "Mark as unread" from the row's ⋮ menu (and any other per-row read/unread entry point for that row, e.g. the single-row right-click menu if it has one) must act on the **whole thread**, exactly like the `r` / `u` keyboard shortcuts and the header actions menu already do. **Flag and To-Do stay per message** — do not change them.

## Current behaviour
- `app/components/mailclient/message/MessageMenu.tsx` (~line 300) builds the `markRead` item as `updateFlagState(message, "seen", !message.seen)` — only the row's representative message, and the label uses that message's own `seen`.
- The list renders the menu via `renderMessageMenu(message, origin)` (`app/components/MailClient.tsx` ~line 3653 → `app/components/mailclient/RenderHelpers.tsx`), called from `MessageCardList.tsx`, `MessageTable.tsx` and `MessageThreadList.tsx`.
- The unread ring of a collapsed thread row means "some message in the thread is unread" (`getThreadRowDisplayMeta` in `messagelist/listInteractions.ts`, `displaySeen`).
- Thread expansion for shortcuts/header menu: `selectionActions.ts` (`threadIds` via `getCollapsedRootThreadMessageIds` in `listSelection.ts`), and `selectionActions.markRead/markUnread` in `MailClient.tsx` (~line 3813).

## Wanted
1. For a collapsed thread root row in the list views (cards, table, thread list), the ⋮ menu item:
   - label follows the row's displayed state: thread has any unread message (ring shown) → "Mark as read" (marks every message of the thread read); all read → "Mark as unread" (marks every message of the thread unread, same as `u`);
   - goes through the same thread expansion and bulk update path as the shortcuts/header menu (reuse, do not duplicate the expansion logic).
2. Expanded thread rows, single (non-thread) rows, the reader's message card menu (`origin === "thread"`) and flat/non-thread views keep the current per-message behaviour.
3. Flag, To-Do, answered and every other menu item: unchanged.
4. Keep the menu cheap to render (it is rendered per row); compute the thread target ids lazily on click, not per render, if that is what the shortcuts do.

## Tests
Add tests that fail before and pass after: collapsed thread with mixed seen state → label "Mark as read", click marks all thread messages seen; all-read collapsed thread → "Mark as unread", click marks all unseen; expanded/single row → only that message; Flag on a collapsed row still only the representative message. Follow existing patterns (`selectionActions.test.ts`, `SelectionActionsMenu.dom.test.tsx`, `listBehavior.test.ts`, MessageMenu tests if any). A short browser check with the synthetic fixture (collapsed thread row → ⋮ → Mark as unread → ring appears, expand → all messages unread) is welcome.

## Hard constraints
Commit only on `fix/thread-row-menu-read` in `/home/monkey/code/noctua-mail/wt-thread-row-read` (new commit(s), no amend/rebase). Do NOT push, merge into other branches, open PRs, deploy, change credentials or run destructive git (reset --hard, force-push, branch deletion, bare git stash). No new dependencies, synthetic data only. Stop every server you started and delete `/tmp/thread-row-menu-read/` at the end. Finish with the final report from ui-polish-common.md (files changed, tests with counts, `bun check`/eslint/`test:ci`/build results, commit SHA, open questions).
