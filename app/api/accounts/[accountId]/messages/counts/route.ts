import { NextResponse } from "next/server";
import { getAccountIdFromParams, requireAccountContext, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { validateAccountFolders } from "@/app/api/_helpers/folderAccount";
import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { countMessagesByBadgeSets } from "@/lib/db";

/** Enough for the virtual folders; bounds the counting work of one request. */
const MAX_BADGE_SETS = 8;

/**
 * GET ?set=focused&set=calendar,unread&excludeFolderIds=a,b → `{ ok, counts }`,
 * one total per `set` (badges joined by commas) over the whole mailbox, equal
 * to the `total` of the message list with those badges. Counts only: no rows,
 * groups or enrichment, so the virtual-folder badges stay cheap.
 */
export async function GET(request: Request, { params }: AccountRouteParams) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accountId = await getAccountIdFromParams(params);
    if (!accountId) {
      return NextResponse.json({ ok: false, message: "Missing accountId" }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const badgeSets = searchParams.getAll("set").map((set) => set.split(",").map((badge) => badge.trim()).filter(Boolean));
    if (badgeSets.length === 0 || badgeSets.length > MAX_BADGE_SETS) {
      return NextResponse.json({ ok: false, message: `Expected 1 to ${MAX_BADGE_SETS} badge sets` }, { status: 400 });
    }
    const excludedFolderIds = (searchParams.get("excludeFolderIds") ?? "")
      .split(",").map((value) => value.trim()).filter(Boolean);
    const access = await requireAccountContext(request, accountId, { minRole: "viewer" });
    if (access instanceof NextResponse) return access;
    const folderError = await validateAccountFolders(accountId, excludedFolderIds);
    if (folderError) return folderError;
    const counts = await countMessagesByBadgeSets({ accountId, badgeSets, viewerUserId: session.userId, excludedFolderIds });
    return NextResponse.json({ ok: true, counts }, { headers: { "Cache-Control": "no-store" } });
  });
}
