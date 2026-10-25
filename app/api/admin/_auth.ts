import { NextResponse } from "next/server";
import { forwardAuthHeaders, requireActiveUserSession, type ActiveUserSession } from "@/lib/auth";
import { getUserById } from "@/lib/db";
import { resolveAccountRole } from "@/lib/accountAccess";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";

export async function requireAdminSessionOr403(request: Request): Promise<ActiveUserSession | NextResponse> {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "admin") {
    return forwardAuthHeaders(NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 }), session.responseHeaders);
  }
  return session;
}

/**
 * The route's mailbox, only when the admin is a member of it (owner or any role, resolved like
 * requireAccountContext). Unknown and foreign mailboxes are both null, answered with the same 404
 * (`adminAccountNotFound`), so the answer does not confirm that a mailbox exists.
 */
export async function resolveAdminMemberAccount(params: AccountRouteParams["params"], userId: string): Promise<string | null> {
  const accountId = await getAccountIdFromParams(params);
  return accountId && await resolveAccountRole(userId, accountId) ? accountId : null;
}

export function adminAccountNotFound() {
  return NextResponse.json({ ok: false, code: "account_not_found", message: "Account not found" }, { status: 404 });
}
