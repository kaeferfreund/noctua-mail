import type { AccountRole } from "@/lib/data";
import { mailboxErrorResponse } from "@/lib/mailboxFailure";
import { NextResponse } from "next/server";
import {
  MAIL_SERVER_UNREACHABLE_MESSAGE,
  describeImapError,
  getImapHttpError,
  isImapConnectFailure
} from "@/lib/mail/imapError";
import { getImapLogger } from "@/lib/mail/imapLogger";
import { errorResponse } from "./response";

export { MAIL_SERVER_UNREACHABLE_MESSAGE };

/**
 * Map a failed IMAP operation to a client-safe JSON response. Auth failures
 * return role-aware mailbox repair DTOs; connect failures
 * (tagged by `connectImapClientWithRetry`) become a 503 with a user-facing
 * message so transient outages don't surface as raw 500s — the underlying
 * error is logged server-side since the response body intentionally hides
 * it. Anything else returns null: the caller should rethrow so local
 * failures (DB reads, bugs) still surface as a 500 instead of being
 * misreported as an upstream outage.
 */
export async function imapUpstreamErrorResponse(
  error: unknown,
  context: { accountId: string; op: string; role?: AccountRole }
): Promise<NextResponse | null> {
  const imapHttpError = getImapHttpError(error);
  if (imapHttpError) {
    return mailboxErrorResponse(error, context.accountId, context.role);
  }
  if (!isImapConnectFailure(error)) return null;
  const logger = getImapLogger();
  if (logger !== false) {
    logger.warn?.(
      `[imap] ${context.op} unavailable account=${context.accountId} error=${describeImapError(error)}`
    );
  }
  return errorResponse(MAIL_SERVER_UNREACHABLE_MESSAGE, 503);
}
