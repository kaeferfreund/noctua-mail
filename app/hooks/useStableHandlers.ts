import { useLayoutEffect, useMemo, useRef } from "react";

// Handler signatures vary per key.
type Handlers = Record<string, (...args: any[]) => unknown>;

/**
 * Returns an object with the same keys whose functions keep their identity
 * across renders and always call the handler passed in the latest commit.
 * Memoized children (folder tree, mailbox rows) then skip re-renders caused
 * only by parents re-creating their callbacks. Event handlers only: the
 * wrappers must not be called during render. The key set must not change.
 */
export function useStableHandlers<T extends Handlers>(handlers: T): T {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const keys = Object.keys(handlers).join("\n");
  return useMemo(
    () =>
      Object.fromEntries(
        keys.split("\n").map((key) => [key, (...args: unknown[]) => latest.current[key](...args)])
      ) as T,
    [keys]
  );
}
