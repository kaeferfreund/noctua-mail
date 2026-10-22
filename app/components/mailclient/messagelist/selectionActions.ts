import type { Message } from "@/lib/data";
import type { VisibleMessageEntry } from "./listModel";
import { getCollapsedRootThreadMessageIds } from "./listSelection";

/**
 * The messages a selection action hits. `ids` is the selection, or the active
 * message when nothing is selected. `threadIds` adds every message of a
 * selected collapsed thread, whose row stands for the whole conversation.
 * Per-message toggles (flag, to-do) and the single-message delete, which
 * resolves threads itself, use `ids`; everything else uses `threadIds`.
 */
export type SelectionActionTargets = {
  ids: string[];
  threadIds: string[];
};

export function resolveSelectionActionTargets(params: {
  selectedIds: Iterable<string>;
  activeMessageId: string | null;
  visibleMessages: VisibleMessageEntry[];
  collapsedThreads: Record<string, boolean>;
  threadScopeMessages: Message[];
  supportsThreads: boolean;
}): SelectionActionTargets {
  const { selectedIds, activeMessageId, ...threadContext } = params;
  const selected = Array.from(selectedIds);
  const ids = selected.length > 0 ? selected : activeMessageId ? [activeMessageId] : [];
  const threadIds =
    getCollapsedRootThreadMessageIds({ selectedIds: ids, ...threadContext }) ?? ids;
  return { ids, threadIds };
}

/**
 * One implementation per action, shared by the keyboard shortcuts, the
 * right-click bulk menu and the header's selection menu, so they can never
 * disagree about what an action does or which messages it hits.
 */
export type SelectionActions = {
  markRead: (targets: SelectionActionTargets) => void;
  markUnread: (targets: SelectionActionTargets) => void;
  toggleFlag: (targets: SelectionActionTargets) => void;
  toggleTodo: (targets: SelectionActionTargets) => void;
  moveToFolder: (targets: SelectionActionTargets, folderId: string) => void;
  moveToOther: (targets: SelectionActionTargets) => void;
  addTopic: (targets: SelectionActionTargets, topicId: string) => void;
  archive: (targets: SelectionActionTargets) => void;
  remove: (targets: SelectionActionTargets) => void;
  copyToAccount: (targets: SelectionActionTargets) => void;
  moveToAccount: (targets: SelectionActionTargets) => void;
};

/** Menu callbacks; the menus never see message ids. */
export type BulkActionMenuActions = {
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onToggleFlag: () => void;
  onToggleTodo: () => void;
  onMoveToFolder: (folderId: string) => void;
  onMoveToOther: () => void;
  onAddTopic: (topicId: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onCopyToAccount: () => void;
  onMoveToAccount: () => void;
};

/**
 * Binds the shared actions to a menu. Targets resolve when an item is chosen,
 * not when the menu renders, so the header menu always acts on the current
 * selection.
 */
export function bindSelectionActions(
  actions: SelectionActions,
  getTargets: () => SelectionActionTargets
): BulkActionMenuActions {
  // Menu items call their handler with the select event; only the item's own
  // argument (a folder or topic id) reaches the action.
  const run = (action: (targets: SelectionActionTargets) => void) => {
    const targets = getTargets();
    if (targets.ids.length > 0) action(targets);
  };
  return {
    onMarkRead: () => run(actions.markRead),
    onMarkUnread: () => run(actions.markUnread),
    onToggleFlag: () => run(actions.toggleFlag),
    onToggleTodo: () => run(actions.toggleTodo),
    onMoveToFolder: (folderId) => run((targets) => actions.moveToFolder(targets, folderId)),
    onMoveToOther: () => run(actions.moveToOther),
    onAddTopic: (topicId) => run((targets) => actions.addTopic(targets, topicId)),
    onArchive: () => run(actions.archive),
    onDelete: () => run(actions.remove),
    onCopyToAccount: () => run(actions.copyToAccount),
    onMoveToAccount: () => run(actions.moveToAccount)
  };
}

export type RowReadAction = {
  seen: boolean;
  onSelect: () => void;
};

/** A collapsed row uses its displayed state; targets expand only on selection. */
export function bindRowReadAction(
  messageId: string,
  seen: boolean,
  actions: Pick<SelectionActions, "markRead" | "markUnread">,
  getTargets: (ids: Iterable<string>) => SelectionActionTargets
): RowReadAction {
  return {
    seen,
    onSelect: () => {
      const targets = getTargets([messageId]);
      if (seen) actions.markUnread(targets);
      else actions.markRead(targets);
    }
  };
}
