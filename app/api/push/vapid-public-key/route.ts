import { okResponse, errorResponse } from "@/app/api/_helpers/response";
import { readPushConfig } from "@/lib/push/server";
import { pushRoute } from "../_shared";

export async function GET(request: Request) {
  return pushRoute(request, "none", async () => {
    const config = readPushConfig();
    return config ? okResponse({ publicKey: config.publicKey }) : errorResponse("Push notifications are not configured", 404);
  });
}
