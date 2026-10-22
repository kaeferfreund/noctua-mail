import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getFolders } from "@/lib/db";
import {
  getAccountIdFromParams,
  requireOwnedAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";

// Folder listing for an owned account used as a copy/move destination. Unlike
// `/folders`, this authorizes any account the user owns, not only the active
// one, so the cross-account destination picker can enumerate target folders.
export async function GET(request: Request, { params }: AccountRouteParams) {
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireOwnedAccountContext(request, accountId);
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    return NextResponse.json(await getFolders(accountContext.accountId));
  });
}
