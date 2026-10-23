import { validateAccountFolders } from "@/app/api/_helpers/folderAccount";
import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getFolders, getLatestMessageUid, getMailboxState, hasPendingMovesForFolder } from "@/lib/db";
import { getImapMailboxStatus } from "@/lib/mail/imap";
import { mailboxPathFromFolderId } from "@/lib/mailboxPaths";
import { determineFolderConsistency } from "@/lib/syncPolicy";
import { logSyncPolicyCall } from "@/lib/syncPolicyLogging";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { imapUpstreamErrorResponse } from "@/app/api/_helpers/imapUpstreamError";

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; folderId?: string }>;
};

export async function handleFolderConsistencyRequest(
  request: Request,
  options?: { accountId?: string | null; folderId?: string | null }
) {
  const accountContext = await requireAccountContext(
    request,
    options?.accountId ?? "",
    {
      minRole: "viewer",
      missingAccountMessage: "Missing accountId"
    }
  );
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const { accountId, account, clientId } = accountContext;

    const folderId = options?.folderId ?? "";
    if (!folderId) {
      return NextResponse.json({ ok: false, message: "Missing folderId" }, { status: 400 });
    }

    const folderError = await validateAccountFolders(accountId, [folderId]);
    if (folderError) return folderError;
    const folder = (await getFolders(accountId)).find((item) => item.id === folderId);
    if (!folder) {
      return NextResponse.json({ ok: false, message: "Folder not found" }, { status: 404 });
    }

    const mailboxPath = mailboxPathFromFolderId(folderId, accountId);
    const currentLocalHighestUid = await getLatestMessageUid(accountId, mailboxPath);
    const currentMailboxState = await getMailboxState(accountId, folderId);
    const localCount = folder.count ?? 0;
    const hasPendingMoves = await hasPendingMovesForFolder(accountId, folderId);
    if (hasPendingMoves) {
      return NextResponse.json({
        ok: true,
        folderId,
        mailboxPath,
        needsRepair: false,
        recommendedMode: "none",
        reasons: [],
        local: {
          count: localCount,
          highestUid: currentLocalHighestUid,
          uidValidity: currentMailboxState?.uidValidity ?? null,
          highestModSeq: currentMailboxState?.highestModSeq ?? null,
          supportsQresync: currentMailboxState?.supportsQresync ?? null
        },
        remote: {
          count: null,
          uidNext: null,
          uidValidity: null,
          highestModSeq: null
        }
      });
    }

    // Only the remote status lookup talks to the mail server; keep the catch
    // narrow so local failures still surface as a 500.
    let remote: Awaited<ReturnType<typeof getImapMailboxStatus>>;
    try {
      remote = await getImapMailboxStatus(account, mailboxPath, clientId);
    } catch (error) {
      const response = await imapUpstreamErrorResponse(error, { role: accountContext.role,
        accountId,
        op: "folder.consistency"
      });
      if (response) return response;
      throw error;
    }
    const localHighestUid = currentLocalHighestUid;
    const mailboxState = currentMailboxState;
    const remoteCount = remote.messages;
    const policyInput = {
      remote: {
        count: remoteCount,
        uidNext: remote.uidNext,
        uidValidity: remote.uidValidity,
        highestModSeq: remote.highestModSeq
      },
      local: {
        count: localCount,
        highestUid: localHighestUid,
        uidValidity: mailboxState?.uidValidity ?? null,
        highestModSeq: mailboxState?.highestModSeq ?? null,
        supportsQresync: mailboxState?.supportsQresync ?? null
      }
    };
    const { needsRepair, recommendedMode, reasons } = determineFolderConsistency(policyInput);
    logSyncPolicyCall({
      caller: "folder-consistency-route",
      policy: "determineFolderConsistency",
      accountId,
      folderId,
      input: policyInput,
      decision: {
        needsRepair,
        recommendedMode,
        reasons
      }
    });

    return NextResponse.json({
      ok: true,
      folderId,
      mailboxPath,
      needsRepair,
      recommendedMode,
      reasons,
      local: {
        count: localCount,
        highestUid: localHighestUid,
        uidValidity: mailboxState?.uidValidity ?? null,
        highestModSeq: mailboxState?.highestModSeq ?? null,
        supportsQresync: mailboxState?.supportsQresync ?? null
      },
      remote: {
        count: remoteCount,
        uidNext: remote.uidNext,
        uidValidity: remote.uidValidity,
        highestModSeq: remote.highestModSeq
      }
    });
  });
}

export async function POST(request: Request, { params }: Params) {
  const originError = await requireMutationSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const { folderId: rawFolderId } = await params;
  const folderId = typeof rawFolderId === "string" ? rawFolderId.trim() : "";
  return handleFolderConsistencyRequest(request, { accountId, folderId });
}
