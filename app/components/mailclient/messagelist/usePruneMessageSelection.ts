import { useEffect } from "react";
import type React from "react";
import type { Message } from "@/lib/data";
import type { SelectionStore } from "./selectionStore";

/** Reconcile once messages leave the results, including topic suggestions. */
export function usePruneMessageSelection(
  messages: Message[],
  selectionStore: SelectionStore,
  lastSelectedIdRef: React.MutableRefObject<string | null>
) {
  useEffect(() => {
    const availableIds = new Set(messages.map((message) => message.id));
    const selectedIds = selectionStore.getIds();
    const remainingIds = new Set([...selectedIds].filter((id) => availableIds.has(id)));
    if (remainingIds.size !== selectedIds.size) {
      const activeId = selectionStore.getActiveId();
      selectionStore.setSelection(
        remainingIds,
        activeId && availableIds.has(activeId) ? activeId : null
      );
    }
    if (lastSelectedIdRef.current && !availableIds.has(lastSelectedIdRef.current)) {
      lastSelectedIdRef.current = null;
    }
  }, [messages, selectionStore, lastSelectedIdRef]);
}
