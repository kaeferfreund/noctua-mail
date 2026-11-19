import { NextResponse } from "next/server";
import { forwardAuthHeaders } from "@/lib/auth";
import type { AccountRole } from "@/lib/data";
import { outreachAddonEnabled } from "@/lib/addons/outreach/config";
import { isOutreachEnabledForAccount } from "@/lib/addons/outreach/settings";
import { getAccountIdFromParams, requireAccountContext, type AccountContext, type AccountRouteParams } from "@/app/api/_helpers/accountContext";

export type { AccountRouteParams };

/** Flag off: every addon route (except `/status`) looks like it does not exist. */
export function outreachNotFound() {
  return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
}

/**
 * Entry check of every signed-in addon route under `accounts/[accountId]`: server flag (404),
 * session and mailbox role (401/403 as in the core routes), then the per-mailbox activation
 * (409 `outreach_disabled`). `allowDisabled` is only for the settings route that activates it.
 * Roles: viewer reads, editor edits contacts/templates/drafts and sends, manager changes
 * settings and API tokens. JSON writes must also pass `requireJsonSameOrigin`.
 */
export async function requireOutreachContext(
  request: Request,
  params: AccountRouteParams["params"],
  options: { minRole?: AccountRole; allowDisabled?: boolean } = {}
): Promise<AccountContext | NextResponse> {
  if (!outreachAddonEnabled()) return outreachNotFound();
  const accountId = await getAccountIdFromParams(params);
  const context = await requireAccountContext(request, accountId, { minRole: options.minRole });
  if (context instanceof NextResponse) return context;
  if (!options.allowDisabled && !(await isOutreachEnabledForAccount(context.accountId))) {
    return forwardAuthHeaders(NextResponse.json({ ok: false, code: "outreach_disabled", message: "The newsletter addon is not activated for this mailbox." }, { status: 409 }), context.session.responseHeaders);
  }
  return context;
}
