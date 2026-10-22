import { getRequestClientId } from "./clientId";
import { NextResponse } from "next/server";
import { forwardAuthHeaders, requireActiveUserSession, type ActiveUserSession } from "@/lib/auth";
import { getAccountById } from "@/lib/serverDb";
import { resolveAccountRole, roleAtLeast } from "@/lib/accountAccess";
import type { Account, AccountRole } from "@/lib/data";
import { errorResponse } from "./response";

export type AccountContext = {
  session: ActiveUserSession;
  userId: string;
  role: AccountRole;
  accountId: string;
  account: Account;
  clientId?: string;
};

type AccountRouteParamValue = string | string[] | undefined;

export type AccountRouteParams = {
  params: Promise<Record<string, AccountRouteParamValue>>;
};

function normalizeRouteParamValue(value: AccountRouteParamValue) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim().length > 0);
    return typeof first === "string" ? first.trim() : "";
  }
  return "";
}

export async function getAccountIdFromParams(
  paramsPromise: Promise<Record<string, AccountRouteParamValue>>
) {
  const params = await paramsPromise;
  // Route convention: all nested routes sit under `app/api/accounts/[accountId]/…`,
  // so `params.accountId` is the single source of truth for the outer segment.
  return normalizeRouteParamValue(params.accountId);
}

export async function requireAccountContext(
  request: Request,
  accountId: string,
  options?: {
    missingAccountMessage?: string;
    minRole?: AccountRole;
  }
): Promise<AccountContext | NextResponse> {
  if (!accountId) {
    return errorResponse(options?.missingAccountMessage ?? "Missing accountId", 400);
  }
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  const role = await resolveAccountRole(session.userId, accountId);
  if (!role) return forwardAuthHeaders(errorResponse("Forbidden", 403), session.responseHeaders);
  const requiredRole = options?.minRole ?? "viewer";
  if (!roleAtLeast(role, requiredRole)) return forwardAuthHeaders(NextResponse.json({ ok: false, message: "Insufficient mailbox role", requiredRole }, { status: 403 }), session.responseHeaders);
  const account = await getAccountById(accountId);
  if (!account) {
    return forwardAuthHeaders(errorResponse("Account not found", 404), session.responseHeaders);
  }
  const clientId = getRequestClientId(request);
  return { session, userId: session.userId, role, accountId, account, clientId };
}

export async function requireAccountContextFromParams(
  request: Request,
  paramsPromise: Promise<Record<string, AccountRouteParamValue>>,
  options?: {
    missingAccountMessage?: string;
    minRole?: AccountRole;
  }
) {
  const accountId = await getAccountIdFromParams(paramsPromise);
  return await requireAccountContext(request, accountId, options);
}
