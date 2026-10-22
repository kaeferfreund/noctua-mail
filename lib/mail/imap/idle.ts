import { ImapFlow } from "imapflow";
import type { Account } from "@/lib/data";
import {
  bindImapClientError, buildImapFlowOptions, connectImapClientWithRetry,
  type ImapClientLogContext
} from "@/lib/mail/imapClientOptions";

/** Shared connection policy for the browser stream and the process watcher. */
export async function connectIdleImapClient(
  account: Account,
  context: ImapClientLogContext,
  options: { singleAttempt?: boolean; signal?: AbortSignal } = {}
) {
  let current: ImapFlow | undefined;
  const close = () => current?.close();
  options.signal?.throwIfAborted();
  options.signal?.addEventListener("abort", close, { once: true });
  try {
    const client = await connectImapClientWithRetry({
      account,
      logContext: context,
      connectOp: "imap.connect",
      maxAttempts: options.singleAttempt ? 1 : undefined,
      createClient: () => {
        options.signal?.throwIfAborted();
        current = new ImapFlow(buildImapFlowOptions(account, {
          maxIdleTime: 10 * 60 * 1000, qresync: true, disableAutoIdle: true
        }, context));
        bindImapClientError(current, context);
        return current;
      }
    });
    options.signal?.throwIfAborted();
    return client;
  } catch (error) {
    close();
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", close);
  }
}

/** IMAPFlow renews IDLE at maxIdleTime. A close/error always terminates this loop. */
export async function runImapIdleLoop(client: ImapFlow, signal?: AbortSignal) {
  let closed = false;
  let failure: Error | undefined;
  const onClose = () => { closed = true; };
  const onError = (error: Error) => { failure = error; closed = true; client.close(); };
  const onAbort = () => { closed = true; client.close(); };
  client.on("close", onClose);
  client.on("error", onError);
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    signal?.throwIfAborted();
    while (!closed && client.usable) await client.idle();
    if (failure) throw failure;
  } finally {
    client.off("close", onClose);
    client.off("error", onError);
    signal?.removeEventListener("abort", onAbort);
  }
}
