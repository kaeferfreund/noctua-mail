import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getFolders } from "@/lib/db";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";

// Copy/move destinations require current editor access independently of selection.
export async function GET(request: Request, { params }: AccountRouteParams) {
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountId, { minRole: "editor" });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    return NextResponse.json(await getFolders(accountContext.accountId));
  });
}
