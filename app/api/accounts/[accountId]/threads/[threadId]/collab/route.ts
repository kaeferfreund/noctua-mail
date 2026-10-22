import { getThreadCollabState, listThreadComments, listThreadActivity, listAccountMembers, updateThreadCollabState, ThreadCollabError, type ThreadCollabPatch } from "@/lib/threadCollab";
import { collabJson, threadResult, withThreadCollab, type ThreadRouteParams } from "@/app/api/_helpers/threadCollabContext";
export async function GET(request: Request, route: ThreadRouteParams) {
  return withThreadCollab(request, route, false, async (ctx, threadId) => {
    const [state, comments, activity, members] = await Promise.all([
      getThreadCollabState(ctx.accountId, threadId), listThreadComments(ctx.accountId, threadId),
      listThreadActivity(ctx.accountId, threadId), listAccountMembers(ctx.accountId)
    ]);
    return collabJson({ ok: true, state, comments, activity, members: members.filter(member => ctx.role === "manager" || !member.disabled) });
  });
}
export async function PATCH(request: Request, route: ThreadRouteParams) {
  return withThreadCollab(request, route, true, async (ctx, threadId) => {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      !Object.keys(body).length || Object.keys(body).some(key => !["status", "assigneeUserId"].includes(key)))
      throw new ThreadCollabError("Expected status or assigneeUserId", 400);
    const state = await updateThreadCollabState(ctx.accountId, threadId, body as ThreadCollabPatch, ctx.actor);
    return threadResult(state && { state });
  });
}
