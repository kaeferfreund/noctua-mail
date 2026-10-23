import { assertServerRunning, isShuttingDown, onShutdown } from "./shutdown";
const key = Symbol.for("noctua.backgroundWork");
type Child = { pid: number; kill: (signal: NodeJS.Signals) => void; exited: Promise<number> };
type Entry = { name: string; stop: () => void; done: Promise<unknown> };
const host = globalThis as typeof globalThis & { [key]?: Set<Entry> };
const entries = host[key] ??= new Set<Entry>();
export { assertServerRunning };
export function trackBackgroundWork(name: string, done: Promise<unknown>, stop = () => {}) {
  const entry = { name, done, stop };
  entries.add(entry);
  void done.finally(() => entries.delete(entry)).catch(() => {});
  if (isShuttingDown()) stop();
}
export function trackWorker(child: Child) {
  trackBackgroundWork(`worker:${child.pid}`, child.exited, () => {
    try { child.kill("SIGTERM"); } catch { /* The exit promise remains authoritative. */ }
  });
  return child;
}
onShutdown("background:stop", "stop", () => { for (const entry of entries) entry.stop(); });
onShutdown("background:drain", "drain", async () => {
  // A pending admission/spawn can add a child while we are waiting.
  while (entries.size) {
    console.info("[shutdown] awaiting background work", [...entries].map(e => e.name));
    await Promise.allSettled([...entries].map(e => e.done));
  }
});
