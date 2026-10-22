import type { AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { handleMailboxCredentialMutation } from "@/app/api/_helpers/mailboxPatch";
export async function POST(request: Request, { params }: AccountRouteParams) {
  return handleMailboxCredentialMutation(request, "relogin", params);
}
