import { assertStreamAuthorized, type AuthStreamIdentity } from "@/lib/authStreams";
import type { AccountRole } from "@/lib/data";
import { getImapHttpError } from "@/lib/mail/imapError";
import { mailboxFailureDto } from "@/lib/mailboxFailure";

/**
 * SSE writer of the mailbox stream. Every event is re-authorized and enqueued inside the final auth DB snapshot;
 * a revoked stream receives nothing and is closed. Error events carry only the mailbox failure DTO.
 */
export function createStreamEventSender(options: {
  identity: AuthStreamIdentity;
  accountId: string;
  role: AccountRole;
  controller: Pick<ReadableStreamDefaultController<Uint8Array>, "enqueue">;
  isStopped: () => boolean;
  close: () => void;
}) {
  const { identity, accountId, role, controller, isStopped, close } = options;
  const encoder = new TextEncoder();
  return async (event: string, data: unknown) => {
    if (isStopped()) return;
    try {
      const safeData = event === "error" ? getImapHttpError(data) ? await mailboxFailureDto(accountId, role) : { accountId, message: "Mailbox unavailable" } : data;
      await assertStreamAuthorized(identity, () => {
        if (isStopped()) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(safeData)}\n\n`));
      });
    } catch { close(); }
  };
}
