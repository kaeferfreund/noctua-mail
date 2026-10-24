import { okResponse } from "@/app/api/_helpers/response";
import { getPushNotifier } from "@/lib/push/send";
import { readPushConfig } from "@/lib/push/server";
import { invalidPushBody, pushNotConfigured, pushRoute, readPushBody, unknownPushDevice } from "../_shared";

/** Sends a `test` notification to one own device (`{ id }`) or to all of them. */
export async function POST(request: Request) {
  return pushRoute(request, "optional-json", async (session) => {
    if (!readPushConfig()) return pushNotConfigured();
    const body = await readPushBody(request);
    if (body instanceof Response) return body;
    const keys = Object.keys(body);
    if (keys.some((key) => key !== "id") || (body.id !== undefined && (typeof body.id !== "string" || !body.id))) return invalidPushBody();
    const result = await getPushNotifier().sendTest(session.userId, body.id as string | undefined);
    return result ? okResponse(result) : unknownPushDevice();
  });
}
