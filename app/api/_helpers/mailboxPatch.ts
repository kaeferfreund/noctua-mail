import { SenderIdentityError } from "@/lib/senderIdentities";
import { NextResponse } from "next/server";
import { requireAccountContext, getAccountIdFromParams, type AccountContext, type AccountRouteParams } from "./accountContext";
import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { requireJsonSameOrigin } from "./requestOrigin";
import { getAccountOwnAddresses, getAccountById } from "@/lib/serverDb";
import { accountIdFromEmail } from "@/lib/accountId";
import { updateMailboxCredentials, MailboxCredentialError, type MailboxPatch, type CredentialVerification } from "@/lib/mailboxCredentials";
import { sanitizeAccountForClient } from "@/lib/accountPresentation";
import { listAccountMembers } from "@/lib/accountAccess";
export async function applyMailboxPatch(context: AccountContext, patch: MailboxPatch, verification?: CredentialVerification) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  try {
    const account = await updateMailboxCredentials(context.accountId, patch, { userId: context.userId, clientId: context.clientId }, verification);
    return NextResponse.json(sanitizeAccountForClient({ ...account, ownAddresses: await getAccountOwnAddresses(context.accountId) }, { role: context.role, viewerUserId: context.userId, memberCount: (await listAccountMembers(context.accountId)).length }));
  } catch (error) {
    if (error instanceof SenderIdentityError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    if (error instanceof MailboxCredentialError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    throw error;
  }
}

/** Shared HTTP entry logic with an explicit verification seam for protocol tests. */
export async function handleMailboxCredentialMutation(
  request: Request, mode: "put" | "relogin" | "post-existing",
  params?: AccountRouteParams["params"],
  verification?: CredentialVerification
) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const origin = requireJsonSameOrigin(request); if (origin) return origin;
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
    let accountId: string;
    if (mode === "post-existing") {
      if (typeof payload.email !== "string" || !payload.email.trim()) return NextResponse.json({ ok: false, message: "Email address is required" }, { status: 400 });
      accountId = typeof payload.id === "string" ? payload.id : accountIdFromEmail(payload.email);
      if (!await getAccountById(accountId)) return NextResponse.json({ ok: false, code: "auth_integration_pending" }, { status: 503 });
    } else accountId = params ? await getAccountIdFromParams(params) : "";
    const context = await requireAccountContext(request, accountId, { minRole: "manager" });
    if (context instanceof NextResponse) return context;
    let patch = payload;
    if (mode === "relogin") {
      const password = payload.password ?? payload.imap?.password;
      if (typeof password !== "string" || !password.trim()) return NextResponse.json({ ok: false, message: "Password required" }, { status: 400 });
      patch = { imap: { password, ...(typeof payload.imap?.user === "string" ? { user: payload.imap.user } : {}) } };
    }
    return applyMailboxPatch(context, patch, verification);
  });
}
