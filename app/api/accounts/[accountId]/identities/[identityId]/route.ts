import { NextResponse } from "next/server";
import { requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { updateSenderIdentity, SenderIdentityError } from "@/lib/senderIdentities";

async function mutate(request: Request, { params }: AccountRouteParams, disable: boolean) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const origin = requireJsonSameOrigin(request); if (origin) return origin;
    const { identityId } = await params;
    try {
      if (typeof identityId !== "string" || !identityId || identityId.length > 256) throw new SenderIdentityError("invalid_identity", 400, "Invalid identity id");
      const identity = await updateSenderIdentity(context.accountId, typeof identityId === "string" ? identityId : "",
        disable ? { enabled: false } : await request.json().catch(() => null), context);
      return NextResponse.json({ ok: true, identity });
    } catch (error) {
      if (error instanceof SenderIdentityError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
      throw error;
    }
  });
}
export async function PATCH(request: Request, params: AccountRouteParams) { return mutate(request, params, false); }
/** Historical recognition requires retaining the row. DELETE is a soft disable. */
export async function DELETE(request: Request, params: AccountRouteParams) { return mutate(request, params, true); }
