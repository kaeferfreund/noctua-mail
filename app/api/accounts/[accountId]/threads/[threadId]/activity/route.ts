import { listThreadActivity } from "@/lib/threadCollab";
import { collabJson, withThreadCollab, type ThreadRouteParams } from "@/app/api/_helpers/threadCollabContext";
export async function GET(request: Request, route: ThreadRouteParams) {
  return withThreadCollab(request, route, false, async (ctx, threadId) => {
    const raw = new URL(request.url).searchParams.get("limit");
    const activity = await listThreadActivity(ctx.accountId, threadId, { limit: raw === null ? 100 : Number(raw) });
    return collabJson({ ok: true, activity });
  });
}
