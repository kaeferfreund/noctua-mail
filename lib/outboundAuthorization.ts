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

/** Request credentials, never the role/identity snapshot taken at entry. */
export type OutboundAuthorization = { request: Request } | { tokenId: string };
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
