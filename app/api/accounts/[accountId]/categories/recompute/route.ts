import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { handleRecomputeStartRequest } from "@/app/api/_helpers/recomputeJobs";
import { startCategoryRecomputeJob } from "@/lib/categoryRecomputeJobs";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const originError = await requireMutationSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  return handleRecomputeStartRequest(
    request,
    startCategoryRecomputeJob,
    "Failed to start category recompute.",
    { accountId }
  );
}
