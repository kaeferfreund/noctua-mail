import { addThreadComment, ThreadCollabError } from "@/lib/threadCollab";
import { threadResult, withThreadCollab, type ThreadRouteParams } from "@/app/api/_helpers/threadCollabContext";
export async function POST(request: Request, route: ThreadRouteParams) {
  return withThreadCollab(request, route, true, async (ctx, threadId) => {
    const payload = await request.json();
    if (!payload || typeof payload.body !== "string") throw new ThreadCollabError("Expected comment body", 400);
    return threadResult(await addThreadComment(ctx.accountId, threadId, payload.body, ctx.actor), 201);
  });
}
