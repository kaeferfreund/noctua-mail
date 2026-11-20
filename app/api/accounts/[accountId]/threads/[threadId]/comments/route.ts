import { addThreadComment, ThreadCollabError } from "@/lib/threadCollab";
import { threadResult, withThreadCollab, type ThreadRouteParams } from "@/app/api/_helpers/threadCollabContext";
import { readJsonBody } from "@/app/api/_helpers/readJsonBody";
export async function POST(request: Request, route: ThreadRouteParams) {
  return withThreadCollab(request, route, true, async (ctx, threadId) => {
    const json = await readJsonBody<any>(request);
    if (!json.ok) return json.response;
    const payload = json.value;
    if (!payload || typeof payload.body !== "string") throw new ThreadCollabError("Expected comment body", 400);
    return threadResult(await addThreadComment(ctx.accountId, threadId, payload.body, ctx.actor), 201);
  });
}
