import { deleteThreadComment, ThreadCollabError } from "@/lib/threadCollab";
import { threadResult, withThreadCollab, type ThreadRouteParams } from "@/app/api/_helpers/threadCollabContext";
export async function DELETE(request: Request, route: ThreadRouteParams) {
  return withThreadCollab(request, route, true, async (ctx, threadId, params) => {
    if (typeof params.commentId !== "string" || !params.commentId) throw new ThreadCollabError("Missing commentId", 400);
    const result = await deleteThreadComment(ctx.accountId, threadId, params.commentId, ctx.actor, { allowAnyAuthor: ctx.role === "manager" });
    return threadResult(result && { state: result.state });
  });
}
