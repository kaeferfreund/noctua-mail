import { NextResponse } from "next/server";
import { forwardAuthHeaders, requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { getAccountById } from "@/lib/serverDb";
import { collabActorFromSession, resolveAccountRole, roleAtLeast, ThreadCollabError } from "@/lib/threadCollab";
import type { AccountRole } from "@/lib/data";
import { requireJsonSameOrigin } from "./requestOrigin";
import type { AccountRouteParams } from "./accountContext";

// feat/team-auth Slice 3: replace this adapter with requireAccountContext(minRole).
export async function requireCollabAccountContext(request: Request, accountId: string, minRole: AccountRole = "viewer") {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  const fail = (message: string, status: number) => forwardAuthHeaders(NextResponse.json({ ok: false, message }, { status }), session.responseHeaders);
  if (!accountId) return fail("Missing accountId", 400);
  const role = await resolveAccountRole(session.userId, accountId);
  if (!role) return fail("Forbidden", 403);
  if (!roleAtLeast(role, minRole)) return fail("Insufficient mailbox role", 403);
  const account = await getAccountById(accountId);
  if (!account) return fail("Account not found", 404);
  const rawClientId = request.headers.get("x-noctua-client") ?? "";
  const clientId = /^[A-Za-z0-9_-]{1,64}$/.test(rawClientId) ? rawClientId : undefined;
  return { session, accountId, account, role, clientId, actor: collabActorFromSession(session, clientId) };
}
export type ThreadRouteParams = AccountRouteParams;
export type CollabContext = Exclude<Awaited<ReturnType<typeof requireCollabAccountContext>>, NextResponse>;
export function collabJson(value: unknown, status = 200) { return NextResponse.json(value, { status }); }
export async function withThreadCollab(request: Request, route: ThreadRouteParams, write: boolean,
  respond: (ctx: CollabContext, threadId: string, params: Record<string, string | string[] | undefined>) => Promise<NextResponse>) {
  const params = await route.params;
  const ctx = await requireCollabAccountContext(request, typeof params.accountId === "string" ? params.accountId : "", write ? "editor" : "viewer");
  if (ctx instanceof NextResponse) return ctx;
  return withAuthResponse(ctx, async () => {
    if (write) { const error = requireJsonSameOrigin(request); if (error) return error; }
    try {
      let threadId: string;
      try {
        // Next already decodes params. Use the raw URL segment when present so
        // Message-IDs containing literal percent escapes are decoded exactly once.
        const raw = new URL(request.url).pathname.match(/\/api\/accounts\/[^/]+\/threads\/([^/]+)/)?.[1];
        threadId = decodeURIComponent(raw ?? (typeof params.threadId === "string" ? params.threadId : ""));
      }
      catch { throw new ThreadCollabError("Invalid threadId", 400); }
      if (!threadId.trim()) throw new ThreadCollabError("Missing threadId", 400);
      return await respond(ctx, threadId, params);
    } catch (error) {
      if (error instanceof ThreadCollabError) return collabJson({ ok: false, message: error.message }, error.status);
      if (error instanceof SyntaxError) return collabJson({ ok: false, message: "Invalid JSON" }, 400);
      throw error;
    }
  });
}
export function threadResult<T>(result: T | null, status = 200) {
  if (result === null) throw new ThreadCollabError("Thread not found", 404);
  return collabJson({ ok: true, ...result }, status);
}
