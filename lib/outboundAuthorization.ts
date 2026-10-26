import { isScheduledSendAuthorization, type ScheduledSendAuthorization } from "./scheduledSend";
import { DraftSendError } from "./drafts";
import { NextResponse } from "next/server";
import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { forwardAuthHeaders } from "./auth";
import { assertStreamAuthorizedRow } from "./authStreams";
import { resolveAccountRoleRow } from "./db/accountAccess";
import { roleAtLeast } from "./accountAccess";
import { listSenderIdentityRows } from "./db/senderIdentities";
import { resolveMcpToolContext, resolveMcpToolContextRow } from "./mcpAuth";
import { SenderIdentityError } from "./senderIdentityError";
import type { Database } from "bun:sqlite";
import { getDb } from "./db/connection";
import type { AccountRole } from "./data";
import type { ResolvedSender } from "./sendIdentity";
import { collabActorFromSession, type CollabActor } from "./threadCollab";

/**
 * Request credentials, never the role/identity snapshot taken at entry. `scheduledByUserId`
 * is the server-side scheduled-send job acting for the user who planned the send: no session
 * exists then, so the user's live mailbox role (lib/db/accountAccess.ts) is the whole check.
 */
export type OutboundAuthorization = { request: Request } | { tokenId: string } | ScheduledSendAuthorization;
export type AuthorizedOutboundActor = CollabActor & { assertCurrent: (db: Database) => void };
export type OutboundWriteAuthorization = () => Promise<AuthorizedOutboundActor>;
export class OutboundAuthorizationError extends Error {
  constructor(readonly response: NextResponse) {
    super("Outbound authorization revoked");
  }
}

/**
 * Await to prepare a live actor, then consume assertCurrent synchronously with the
 * effect (or inside its write transaction). Repeat on every DB write retry.
 * Never call after SMTP acceptance. Identity and actor
 * checks share a final synchronous snapshot, using the existing session/token and
 * role policies rather than a second authorization policy.
 */
export async function authorizeOutbound(
  source: OutboundAuthorization,
  input: { accountId: string; minRole: AccountRole; identity?: ResolvedSender | string; purpose?: "draft" | "identity-management" }
): Promise<AuthorizedOutboundActor> {
  const checkIdentity = (db: Database) => {
    if (!input.identity) return;
    const selected = input.identity;
    const id = typeof selected === "string" ? selected : selected.id;
    const live = listSenderIdentityRows(db, input.accountId).find(row => row.id === id && row.accountId === input.accountId);
    if (!live?.enabled) throw new SenderIdentityError("identity_unavailable", 409, "Choose an enabled sender identity.");
    if (typeof selected !== "string" && (live.email !== selected.email || live.displayName !== selected.displayName || live.replyTo !== selected.replyTo)) {
      throw new SenderIdentityError("draft_identity_changed", 409, "Sender identity changed. Review From and save again.");
    }
  };
  if ("tokenId" in source) {
    // Default is transmission: future token callers must explicitly opt into a non-send purpose.
    const scope = input.purpose === "draft" ? "drafts" : input.purpose === "identity-management" ? "manage" : "send";
    const context = await resolveMcpToolContext(source.tokenId, input.accountId, input.minRole, checkIdentity, scope);
    return { userId: context.tokenRecord.createdByUserId, clientId: `mcp:${source.tokenId}`,
      assertCurrent: db => { resolveMcpToolContextRow(db, source.tokenId, input.accountId, input.minRole, checkIdentity, scope); } };
  }
  if ("scheduledByUserId" in source) {
    if (!isScheduledSendAuthorization(source)) {
      throw new OutboundAuthorizationError(NextResponse.json({ ok: false, message: "Invalid scheduler authorization" }, { status: 403 }));
    }
    const userId = source.scheduledByUserId;
    const assertCurrent = (db: Database) => {
      db.transaction(() => {
        const claim = db.query(`SELECT lastError FROM scheduled_sends
          WHERE id=? AND accountId=? AND userId=? AND status='sending' AND leaseOwner=?`)
          .get(source.scheduleId, input.accountId, userId, source.leaseOwner) as { lastError: string | null } | null;
        if (!claim) throw new DraftSendError(409, "Scheduler claim was lost.", "scheduled_send_claim_lost");
        if (claim.lastError === "security_revoked") throw new DraftSendError(409, "User security changed.", "scheduled_send_security_revoked");
        const role = resolveAccountRoleRow(db, userId, input.accountId);
        if (!role) throw new OutboundAuthorizationError(NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 }));
        if (!roleAtLeast(role, input.minRole)) {
          throw new OutboundAuthorizationError(NextResponse.json({ ok: false, message: "Insufficient mailbox role", requiredRole: input.minRole }, { status: 403 }));
        }
        checkIdentity(db);
      }).deferred();
    };
    assertCurrent(await getDb());
    return { userId, clientId: "scheduled-send", assertCurrent };
  }
  const context = await requireAccountContext(source.request, input.accountId, { minRole: input.minRole });
  if (context instanceof NextResponse) throw new OutboundAuthorizationError(context);
  const deny = (status: number, body: Record<string, unknown>) => new OutboundAuthorizationError(
    forwardAuthHeaders(NextResponse.json({ ok: false, ...body }, { status }), context.session.responseHeaders)
  );
  const assertCurrent = (db: Database) => {
    try {
      // The normal HTTP guard carries refresh/deletion headers. Its asynchronous
      // loaders are followed by the existing coherent session-liveness snapshot.
      assertStreamAuthorizedRow(db, context.session, db => {
        const role = resolveAccountRoleRow(db, context.userId, input.accountId);
        if (!role) throw deny(403, { message: "Forbidden" });
        if (!roleAtLeast(role, input.minRole)) throw deny(403, { message: "Insufficient mailbox role", requiredRole: input.minRole });
        checkIdentity(db);
      });
    } catch (error) {
      if (error instanceof OutboundAuthorizationError || error instanceof SenderIdentityError) throw error;
      if (error instanceof Error && error.message === "Stream authorization revoked") throw deny(401, { message: "Unauthorized" });
      throw error;
    }
  };
  assertCurrent(await getDb());
  return { ...collabActorFromSession(context.session, context.clientId), assertCurrent };
}

/** Capture DB preparation now; consume the returned assertion synchronously at the effect. */
export async function prepareOutboundAssertion(actor: AuthorizedOutboundActor): Promise<() => void> {
  const db = await getDb();
  return () => actor.assertCurrent(db);
}
