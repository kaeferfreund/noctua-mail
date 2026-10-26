import { useLayoutEffect, type RefObject } from "react";

/** Publish async mirrors only for renders React has committed. */
export function useCommittedRef<T>(targetRef: RefObject<T>, value: T) {
  useLayoutEffect(() => { targetRef.current = value; });
}
