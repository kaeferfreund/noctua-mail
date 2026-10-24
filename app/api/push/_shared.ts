import { NextResponse } from "next/server";
import { readAuthJson } from "@/app/api/_helpers/readAuthJson";
import { requireJsonSameOrigin, requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { errorResponse } from "@/app/api/_helpers/response";
import { requireActiveUserSession, withAuthResponse, type ActiveUserSession } from "@/lib/auth";

/**
 * Shared shell of the /api/push routes (doc/PUSH-NOTIFICATIONS.md): any signed-in
 * member, no mailbox role. Mutations are same-origin; `json` requires a JSON
 * body, `optional-json` also accepts an empty one.
 */
export async function pushRoute(
  request: Request,
  body: "none" | "json" | "optional-json",
  handler: (session: ActiveUserSession) => Promise<Response>
): Promise<Response> {
  if (body !== "none") {
    const originError = body === "json" ? requireJsonSameOrigin(request) : await requireMutationSameOrigin(request);
    if (originError) return originError;
  }
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const response = await handler(session);
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}

/** The parsed JSON object, `{}` for an allowed empty body, or an error response. */
export async function readPushBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return {};
  const payload = await readAuthJson(request).catch(() => undefined);
  if (payload instanceof Response) return payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return invalidPushBody();
  return payload as Record<string, unknown>;
}

export function invalidPushBody() {
  return errorResponse("Invalid request body", 400);
}

export function pushNotConfigured() {
  return errorResponse("Push notifications are not configured", 503);
}

export function unknownPushDevice() {
  return errorResponse("Unknown device", 404);
}
