import { validateAccountFolders } from "@/app/api/_helpers/folderAccount";
import { formatEnvelopeAddresses, resolveMessageSenderKey } from "@/lib/mail/imap/parser";
import type { ImapEnvelope } from "@/lib/mail/imap/_shared";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getLatestMessageUid } from "@/lib/db";
import { getImapLogger, logImapOp } from "@/lib/mail/imapLogger";
import {
  acquirePooledImapClient,
  releasePooledImapClient
} from "@/lib/mail/imap/connectionPool";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { imapUpstreamErrorResponse } from "@/app/api/_helpers/imapUpstreamError";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const { searchParams } = new URL(request.url);
  const accountIdParam = await getAccountIdFromParams(params);
  const requestedMailbox = searchParams.get("mailbox") ?? "INBOX";
  const sinceUidNextParam = searchParams.get("sinceUidNext");
  const sinceUidNext = sinceUidNextParam ? Number(sinceUidNextParam) : null;
  const accountContext = await requireAccountContext(request, accountIdParam, {
    minRole: "viewer",
    missingAccountMessage: "Missing accountId"
  });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const { accountId, account, clientId } = accountContext;

    const folderId = searchParams.get("folderId");
    // `mailbox` is a raw IMAP path, never an account-prefixed folder ID.
    // Validate it by its canonical folder ID, including the default INBOX.
    const folderError = await validateAccountFolders(accountId,
      [folderId, `${accountId}:${requestedMailbox}`]);
    if (folderError) return folderError;
    const mailbox = requestedMailbox;
    const logContext = { accountId, clientId };

    try {
      const client = await acquirePooledImapClient(account, logContext);
      let pooledClientOk = true;
      try {
        const mailboxInfo = await logImapOp(
          "mailboxOpen",
          { mailbox, accountId, clientId },
          () => client.mailboxOpen(mailbox, { readOnly: true })
        );
        const uidNext = mailboxInfo?.uidNext ?? 0;
        if (sinceUidNext !== null && !Number.isNaN(sinceUidNext) && uidNext <= sinceUidNext) {
          return NextResponse.json({ ok: true, uidNext, messages: [] });
        }
        const latestUid = await getLatestMessageUid(accountId, mailbox);
        const startUid =
          typeof sinceUidNext === "number" && !Number.isNaN(sinceUidNext)
            ? sinceUidNext
            : typeof latestUid === "number"
              ? latestUid + 1
              : Math.max(1, uidNext ? uidNext - 50 : 1);
        if (uidNext === 0) {
          return NextResponse.json({ ok: true, uidNext, messages: [] });
        }
        const messages: Array<{
          uid: number;
          subject: string;
          from: string;
          senderKey: string | null;
          date?: string | null;
          messageId?: string | null;
        }> = [];

        if (uidNext >= startUid) {
          const rangeStart = Math.max(1, startUid);
          const range = { uid: `${rangeStart}:*` };
          const start = Date.now();
          let count = 0;
          for await (const message of client.fetch(range, { envelope: true, uid: true })) {
            const env = message.envelope as ImapEnvelope | undefined;
            messages.push({
              uid: message.uid,
              subject: env?.subject ?? "(no subject)",
              from: formatEnvelopeAddresses(env?.from),
              senderKey: resolveMessageSenderKey(env, new Map()),
              date: env?.date ? env.date.toISOString() : null,
              messageId: env?.messageId ?? null
            });
            count += 1;
          }
          const logger = getImapLogger();
          if (logger !== false) {
            logger.info?.({
              op: "fetch",
              mailbox,
              range: range.uid,
              count,
              ms: Date.now() - start
            });
          }
        }

        return NextResponse.json({ ok: true, uidNext, messages });
      } catch (err) {
        pooledClientOk = false;
        throw err;
      } finally {
        releasePooledImapClient(account, client, logContext, { evict: !pooledClientOk });
      }
    } catch (error) {
      const response = await imapUpstreamErrorResponse(error, { role: accountContext.role, accountId, op: "imap.poll" });
      if (response) return response;
      throw error;
    }
  });
}
