import { useLayoutEffect, useRef } from "react";

/**
 * Ref that holds the value of the latest commit. It is written in a layout
 * effect, so async continuations (awaited fetches, timers) that resume after a
 * commit never see the previous value; renders React discards never leak into
 * it. Read it in callbacks, not during render.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
