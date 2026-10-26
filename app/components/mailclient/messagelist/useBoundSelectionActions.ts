import { useMemo } from "react";
import { bindSelectionActions, type SelectionActions, type SelectionActionTargets } from "./selectionActions";

/** Bind event targets without evaluating the live selection during render. */
export function useBoundSelectionActions(actions: SelectionActions, getTargets: () => SelectionActionTargets) {
  return useMemo(() => bindSelectionActions(actions, getTargets), [actions, getTargets]);
}
