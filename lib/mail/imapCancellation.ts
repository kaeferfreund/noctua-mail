import { AsyncLocalStorage } from "node:async_hooks";
import type { ImapFlow } from "imapflow";

export class PostSendTimeoutError extends Error {
  constructor() { super("Post-send IMAP deadline exceeded"); this.name = "PostSendTimeoutError"; }
}

// Request-local cancellation also reaches nested flag mutations and connection setup.
const cancellation = new AsyncLocalStorage<AbortSignal>();
export function throwIfImapCancelled() { cancellation.getStore()?.throwIfAborted(); }

export function bindImapCancellation(client: ImapFlow) {
  const signal = cancellation.getStore();
  const close = () => client.close(); // LOGOUT would queue behind the stalled command.
  if (signal?.aborted) { close(); signal.throwIfAborted(); }
  signal?.addEventListener("abort", close, { once: true });
  return () => signal?.removeEventListener("abort", close);
}

export function postSendDeadlineAt() {
  const configured = Number(process.env.NOCTUA_POST_SEND_TIMEOUT_MS);
  const timeout = Number.isFinite(configured) && configured > 0 ? configured : 30_000;
  return Date.now() + timeout;
}

/** One absolute budget, independent of socket activity. Never leaves an active IMAP client behind. */
export async function withImapDeadline<T>(deadlineAt: number, work: () => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const reason = new PostSendTimeoutError();
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) throw reason;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(reason); reject(reason); }, remaining);
  });
  try { return await Promise.race([cancellation.run(controller.signal, work), expired]); }
  finally { clearTimeout(timer); }
}

export function withImapCancellation<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  return cancellation.run(signal, work);
}
