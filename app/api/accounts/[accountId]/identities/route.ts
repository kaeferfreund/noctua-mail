import { NextResponse } from "next/server";
import { requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { listSenderIdentities, getUserAccountPrefs } from "@/lib/serverDb";
import { createSenderIdentityWithRecompute, SenderIdentityError } from "@/lib/senderIdentities";
import { getOwnAddresses } from "@/lib/ownAddresses";
import { startIdentityRecomputeJob, getIdentityRecomputeJob } from "@/lib/threadRecomputeJobs";
import { resolveComposeIdentity } from "@/lib/senderIdentitySelection";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "viewer" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const identities = await listSenderIdentities(context.accountId);
    const prefs = await getUserAccountPrefs(context.userId, context.accountId);
    const resolved = resolveComposeIdentity({ accountId: context.accountId, identities, prefs });
    return NextResponse.json({ ok: true, identities,
      defaultIdentityId: identities.find(identity => identity.isDefault)?.id,
      effectiveDefaultIdentityId: resolved.identity?.id,
      ownAddresses: getOwnAddresses(context.account, identities), warnings: resolved.warnings,
      recomputeJob: getIdentityRecomputeJob(context.accountId) });
  });
}
export async function POST(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const origin = requireJsonSameOrigin(request); if (origin) return origin;
    try {
      const { identity, recomputeJob } = await createSenderIdentityWithRecompute(context.accountId, await request.json().catch(() => null), context);
      return NextResponse.json({ ok: true, identity, recomputeJob }, { status: 201 });
    } catch (error) {
      if (error instanceof SenderIdentityError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
      throw error;
    }
  });
}

/** Retry only the derived identity signals; configuration remains committed. */
export async function PUT(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const origin = requireJsonSameOrigin(request); if (origin) return origin;
    const payload = await request.json().catch(() => null);
    if (!payload || Object.keys(payload).length !== 1 || payload.recompute !== true) return NextResponse.json({ ok: false, code: "invalid_identity", message: "Expected {recompute:true}" }, { status: 400 });
    return NextResponse.json({ ok: true, recomputeJob: startIdentityRecomputeJob(context.accountId) }, { status: 202 });
  });
}
