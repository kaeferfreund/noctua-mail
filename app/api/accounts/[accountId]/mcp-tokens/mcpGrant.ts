import { NextResponse } from "next/server";
import type { ActiveUserSession } from "@/lib/auth";
import { AuthPolicyError } from "@/lib/authPolicy";
import { consumeMcpCreateGrant } from "@/lib/mcpAuth";

/** Spends the `mcp.create` grant from `x-noctua-reauth`; a response means the factor proof failed. */
export async function requireMcpGrant(session: ActiveUserSession, request: Request): Promise<NextResponse | null> {
  try { await consumeMcpCreateGrant(session, request.headers.get("x-noctua-reauth")); return null; }
  catch (error) {
    if (!(error instanceof AuthPolicyError)) throw error;
    return NextResponse.json({ ok: false, code: error.code, message: "Fresh verification required" }, { status: error.status, headers: { "cache-control": "no-store" } });
  }
}
