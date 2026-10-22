import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { handleRecomputeStartRequest } from "@/app/api/_helpers/recomputeJobs";
import { startThreadRecomputeJob } from "@/lib/threadRecomputeJobs";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const originError = requireMutationSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  return handleRecomputeStartRequest(
    request,
    startThreadRecomputeJob,
    "Failed to start thread recompute.",
    { accountId }
  );
}
