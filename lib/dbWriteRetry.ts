import { workerPause, workerSafePoint } from "./server/workerLifecycle";
type DbWriteRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Short acquisition collisions only; the normal five-attempt policy remains for DML/shard waits. */
  handshakeRetry?: (error: unknown) => boolean;
  /** Control-plane writes keep their normal pacing; recover brief collisions only before exhaustion. */
  handshakeRetryAfterCoarse?: boolean;
};

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 120;
const DEFAULT_MAX_DELAY_MS = 2_000;
const HANDSHAKE_FAST_RETRIES = 16;
const HANDSHAKE_BUDGET_MS = 2_160; // 1.8s existing backoff, including its +20% jitter.

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "";
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : String(code ?? "");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

function isDbLockedError(error: unknown) {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED") {
    return true;
  }
  return /database is locked|database table is locked|sqlite_busy|sqlite_locked/i.test(message);
}

function getErrorSummary(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: getErrorMessage(error),
    code: getErrorCode(error)
  };
}

export async function withDbWriteRetry<T>(
  operation: string,
  fn: () => Promise<T> | T,
  options: DbWriteRetryOptions = {}
) {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseDelayMs = Math.max(1, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS);
  const startedAt = Date.now();
  let retries = 0;

  let fastRetries = 0;
  let slowAttempt = 1;
  // At most 16 short retries, within the existing worst-case jittered 1.8s budget.
  const handshakeDeadline = startedAt + HANDSHAKE_BUDGET_MS;
  for (let attempt = 1; ; attempt += 1) {
    try {
      workerSafePoint();
      const result = await fn();
      if (retries > 0) {
        console.info("[db-write-retry] success", {
          operation,
          retries,
          elapsedMs: Date.now() - startedAt
        });
      }
      return result;
    } catch (error) {
      if (!isDbLockedError(error)) {
        throw error;
      }
      const handshake = options.handshakeRetry?.(error) ?? false;
      const fast = handshake && fastRetries < HANDSHAKE_FAST_RETRIES &&
        (!options.handshakeRetryAfterCoarse || slowAttempt === maxAttempts);
      if ((!fast && slowAttempt === maxAttempts) || (handshake && Date.now() >= handshakeDeadline)) {
        console.error("[db-write-retry] exhausted", {
          operation,
          retries,
          attempts: attempt,
          elapsedMs: Date.now() - startedAt,
          error: getErrorSummary(error)
        });
        throw error;
      }

      retries += 1;
      const maxForAttempt = fast ? Math.min(8, 2 ** fastRetries++)
        : Math.min(maxDelayMs, baseDelayMs * 2 ** (slowAttempt++ - 1));
      const jittered = Math.max(1, Math.round(maxForAttempt * (0.8 + Math.random() * 0.4)));
      const delayMs = handshake ? Math.min(jittered, Math.max(1, handshakeDeadline - Date.now())) : jittered;
      console.warn("[db-write-retry] retry", {
        operation,
        attempt,
        attempts: maxAttempts + (options.handshakeRetry ? HANDSHAKE_FAST_RETRIES : 0),
        delayMs,
        elapsedMs: Date.now() - startedAt,
        phase: handshake ? "handshake" : "write",
        policy: fast ? "short" : "coarse",
        error: getErrorSummary(error)
      });
      await workerPause(delayMs);
      if (handshake && Date.now() >= handshakeDeadline) {
        console.error("[db-write-retry] exhausted", {
          operation,
          retries,
          attempts: attempt,
          elapsedMs: Date.now() - startedAt,
          error: getErrorSummary(error)
        });
        throw error;
      }
    }
  }
}
