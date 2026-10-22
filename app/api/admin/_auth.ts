import { NextResponse } from "next/server";
import { forwardAuthHeaders, requireActiveUserSession, type ActiveUserSession } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export async function requireAdminSessionOr403(request: Request): Promise<ActiveUserSession | NextResponse> {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "admin") {
    return forwardAuthHeaders(NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 }), session.responseHeaders);
  }
  return session;
}
