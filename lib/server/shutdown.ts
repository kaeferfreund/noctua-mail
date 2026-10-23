export type ShutdownPhase = "stop" | "drain" | "close";
type Hook = { name: string; phase: ShutdownPhase; run: () => void | Promise<void> };
type Dependencies = {
  exit: (code: number) => void;
  log: (message: string, details: unknown) => void;
  deadlineMs: number;
};

/** No async transaction is interrupted: deadline callbacks run between JS turns. */
export function createShutdownCoordinator(deps: Dependencies) {
  const hooks = new Set<Hook>();
  const pending = new Set<string>();
  let stopping = false;
  let task: Promise<void> | undefined;
  let exited = false;
  const finish = () => { if (!exited) { exited = true; deps.exit(0); } };
  return {
    get stopping() { return stopping; },
    add(hook: Hook) { hooks.add(hook); return () => { hooks.delete(hook); }; },
    shutdown(signal: string): Promise<void> {
      if (task) return task;
      stopping = true;
      // Defer execution one microtask so reentrant calls see this same promise.
      task = Promise.resolve().then(async () => {
        deps.log("[shutdown] starting", { signal, hooks: [...hooks].map(h => h.name) });
        let deadlineReached!: () => void;
        const deadline = new Promise<void>(resolve => { deadlineReached = resolve; });
        const timer = setTimeout(() => {
          deps.log("[shutdown] deadline", { unfinished: [...pending] });
          finish();
          deadlineReached();
        }, deps.deadlineMs);
        try {
          const draining = (async () => {
            for (const phase of ["stop", "drain", "close"] as const) {
              if (exited) break;
              await Promise.all([...hooks].filter(h => h.phase === phase).map(async hook => {
                pending.add(hook.name);
                try { await hook.run(); }
                catch (error) { deps.log("[shutdown] hook failed", { name: hook.name, error: String(error) }); }
                finally { pending.delete(hook.name); }
              }));
            }
            if (!exited) { deps.log("[shutdown] complete", {}); finish(); }
          })();
          await Promise.race([draining, deadline]);
        } finally { clearTimeout(timer); }
      });
      return task;
    }
  };
}
const key = Symbol.for("noctua.shutdown");
type Runtime = { coordinator: ReturnType<typeof createShutdownCoordinator>; registered: boolean };
const host = globalThis as typeof globalThis & { [key]?: Runtime };
const state = host[key] ??= { coordinator: createShutdownCoordinator({
  exit: code => process.exit(code), deadlineMs: 4000,
  log: (message, details) => console.info(message, details)
}), registered: false };
export const isShuttingDown = () => state.coordinator.stopping;
export function assertServerRunning() { if (isShuttingDown()) throw new Error("Server is shutting down"); }
export function onShutdown(name: string, phase: ShutdownPhase, run: Hook["run"]) {
  return state.coordinator.add({ name, phase, run });
}
export function installShutdownCoordinator() {
  if (state.registered) return;
  state.registered = true;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => { void state.coordinator.shutdown(signal); });
  }
}
