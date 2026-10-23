import { withImapCancellation } from "../mail/imapCancellation";
const key = Symbol.for("noctua.workerStop");
const host = globalThis as typeof globalThis & { [key]?: boolean };
let workerSignal: AbortSignal | undefined;
export const isWorkerStopping = () => host[key] === true;
export function workerSafePoint() { if (isWorkerStopping()) throw new Error("Worker stopped for server shutdown"); }

/** Preserve the normal retry delay, but cancel it when this worker is stopping. */
export function workerPause(ms: number) {
  return new Promise<void>((resolve, reject) => {
    const signal = workerSignal;
    if (signal?.aborted) { reject(signal.reason); return; }
    const done = () => { signal?.removeEventListener("abort", stop); resolve(); };
    const timer = setTimeout(done, ms);
    const stop = () => { clearTimeout(timer); reject(signal?.reason); };
    signal?.addEventListener("abort", stop, { once: true });
  });
}

/** A signal aborts network waits; synchronous immediate transactions finish first. */
export async function runWorker(work: () => Promise<void>) {
  const abort = new AbortController();
  workerSignal = abort.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (isWorkerStopping()) return;
    host[key] = true;
    abort.abort(new Error("Worker stopped for server shutdown"));
    timer = setTimeout(() => {
      console.info("[shutdown] worker deadline; unfinished work resumes from committed state");
      process.exit(0);
    }, 3500);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    await withImapCancellation(abort.signal, work);
  } catch (error) {
    if (!isWorkerStopping()) throw error;
  } finally {
    const { drainImapConnectionPool } = await import("../mail/imap/connectionPool");
    const { closeAllDbConnections } = await import("../db/connection");
    await drainImapConnectionPool();
    closeAllDbConnections();
    clearTimeout(timer);
    process.off("SIGTERM", stop);
    process.off("SIGINT", stop);
  }
  if (isWorkerStopping()) process.exit(0);
}
