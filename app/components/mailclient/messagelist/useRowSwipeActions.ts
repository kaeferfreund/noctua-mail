import { useIsMobile } from "@/app/hooks/use-mobile";
import type { ListRowItem } from "./listModel";
import { getThreadRowDisplayMeta } from "./listInteractions";
import type { MessageListViewActions } from "./messageListViewTypes";
import type { RowSwipeActions } from "./SwipeableRow";

/**
 * Swipe actions for the phone list rows: the same delete and read toggle the
 * row's buttons and ⋮ menu run. Returns `undefined` outside the phone layout,
 * so desktop rows never swipe.
 */
export function useRowSwipeActions(
  actions: Pick<MessageListViewActions, "handleDeleteMessage" | "toggleRowRead">,
  pendingMessageActions: Set<string>
): ((item: ListRowItem) => RowSwipeActions) | undefined {
  const isMobile = useIsMobile();
  if (!isMobile) return undefined;
  const { handleDeleteMessage, toggleRowRead } = actions;
  return (item) => {
    const { message } = item;
    const { displaySeen } = getThreadRowDisplayMeta({ item });
    return {
      seen: displaySeen,
      disabled: pendingMessageActions.has(message.id),
      onDelete: () => handleDeleteMessage(message),
      onToggleRead: () => toggleRowRead(message, displaySeen)
    };
  };
}
