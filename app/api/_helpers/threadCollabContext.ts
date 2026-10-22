import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { collabActorFromSession, ThreadCollabError } from "@/lib/threadCollab";
import type { AccountRole } from "@/lib/data";
import { requireJsonSameOrigin, requireBodylessSameOrigin } from "./requestOrigin";
import { requireAccountContext, type AccountRouteParams } from "./accountContext";

// Collaboration adds actor metadata to the canonical team-auth guard.
export async function requireCollabAccountContext(request: Request, accountId: string, minRole: AccountRole = "viewer") {
  const context = await requireAccountContext(request, accountId, { minRole });
  if (context instanceof NextResponse) return context;
  return { ...context, actor: collabActorFromSession(context.session, context.clientId) };
}
export type ThreadRouteParams = AccountRouteParams;
export type CollabContext = Exclude<Awaited<ReturnType<typeof requireCollabAccountContext>>, NextResponse>;
export function collabJson(value: unknown, status = 200) { return NextResponse.json(value, { status }); }
export async function withThreadCollab(request: Request, route: ThreadRouteParams, write: boolean | "bodyless",
  respond: (ctx: CollabContext, threadId: string, params: Record<string, string | string[] | undefined>) => Promise<NextResponse>) {
  const params = await route.params;
  const ctx = await requireCollabAccountContext(request, typeof params.accountId === "string" ? params.accountId : "", write ? "editor" : "viewer");
  if (ctx instanceof NextResponse) return ctx;
  return withAuthResponse(ctx, async () => {
    if (write) {
      const error = write === "bodyless" ? await requireBodylessSameOrigin(request) : requireJsonSameOrigin(request);
      if (error) return error;
    }
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
