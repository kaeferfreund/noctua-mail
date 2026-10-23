import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { resetCategoryLinearModel } from "@/lib/db";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const originError = await requireMutationSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const access = await requireAccountContext(request, accountId, {
    minRole: "editor",
    missingAccountMessage: "Missing accountId"
  });
  if (access instanceof NextResponse) return access;
  return withAuthResponse(access, async () => {

    try {
      const model = await resetCategoryLinearModel(accountId);
      return NextResponse.json({
        ok: true,
        model: {
          version: model.version,
          examples: model.examples,
          updatedAt: model.updatedAt
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset categorization model";
      return NextResponse.json({ ok: false, message }, { status: 500 });
    }
  });
}
