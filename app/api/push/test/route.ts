import { errorResponse, okResponse } from "@/app/api/_helpers/response";
import { createRateLimiter } from "@/lib/rateLimit";
import { getPushNotifier } from "@/lib/push/send";
import { readPushConfig } from "@/lib/push/server";
import { invalidPushBody, pushNotConfigured, pushRoute, readPushBody, unknownPushDevice } from "../_shared";

const TEST_WINDOW_SECONDS = 10;
/** One test push per user every TEST_WINDOW_SECONDS: each call may wait on up to 20 push services. */
const testAttempts = createRateLimiter({ windowMs: TEST_WINDOW_SECONDS * 1000, max: 1 });

/** Sends a `test` notification to one own device (`{ id }`) or to all of them. */
export async function POST(request: Request) {
  return pushRoute(request, "optional-json", async (session) => {
    if (!readPushConfig()) return pushNotConfigured();
    const body = await readPushBody(request);
    if (body instanceof Response) return body;
    const keys = Object.keys(body);
    if (keys.some((key) => key !== "id") || (body.id !== undefined && (typeof body.id !== "string" || !body.id))) return invalidPushBody();
    if (testAttempts.isLimited(session.userId)) {
      const limited = errorResponse("Too many test notifications", 429);
      limited.headers.set("retry-after", String(TEST_WINDOW_SECONDS));
      return limited;
    }
    const result = await getPushNotifier().sendTest(session.userId, body.id as string | undefined);
    return result ? okResponse(result) : unknownPushDevice();
  });
}
