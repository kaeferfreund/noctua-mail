import { okResponse } from "@/app/api/_helpers/response";
import { parsePushDeviceSettings } from "@/lib/push/settings";
import { deleteOwnPushSubscription, updatePushSubscriptionSettings } from "@/lib/push/subscriptions";
import { invalidPushBody, pushRoute, readPushBody, unknownPushDevice } from "../../_shared";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const { id } = await context.params;
  return pushRoute(request, "json", async (session) => {
    const body = await readPushBody(request);
    if (body instanceof Response) return body;
    const settings = Object.keys(body).length === 1 ? parsePushDeviceSettings(body.settings) : null;
    if (!settings) return invalidPushBody();
    const stored = await updatePushSubscriptionSettings(session.userId, id, settings);
    return stored ? okResponse({ settings: stored }) : unknownPushDevice();
  });
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  return pushRoute(request, "optional-json", async (session) =>
    await deleteOwnPushSubscription(session.userId, { id }) ? okResponse() : unknownPushDevice());
}
