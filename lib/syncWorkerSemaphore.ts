export function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : fallback;
}

/** A timeout sends SIGKILL, then waits for confirmed exit before rejecting. */
export async function withSyncWorkerTimeout<T>(
  exited: Promise<T>, timeoutMs: number, kill: () => void
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    timer = setTimeout(() => {
      timedOut = true;
      try { kill(); } catch { /* still await confirmed exit */ }
    }, timeoutMs);
    const result = await exited;
    if (timedOut) throw new Error(`Sync worker timed out after ${timeoutMs / 1000}s; exit confirmed.`);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Pipes may remain open in descendants after exit; bound draining independently. */
export async function drainSyncWorkerOutput<T>(work: Promise<T>, cancel: () => void, timeoutMs = 2000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { cancel(); reject(new Error("Sync worker output drain timed out")); }, timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
