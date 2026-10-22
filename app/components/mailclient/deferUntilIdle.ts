/** Schedule secondary account reads at idle, with a bounded fallback for browsers without rIC. */
export function deferUntilIdle(task: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 1000);
  return () => window.clearTimeout(id);
}
