import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { handleSyncStartRequest } from "@/app/api/_helpers/syncJobs";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const originError = requireMutationSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  return handleSyncStartRequest(request, { accountId });
}
