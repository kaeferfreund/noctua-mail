import { z } from "zod";
import { getMessageTracking, listTrackingEvents, trackingEventFilters } from "../tracking";
import type { OutreachMcpHost } from "./index";

const id = z.string().trim().min(1).max(256);
const readOnly = { readOnlyHint: true, openWorldHint: false };

export function registerOutreachTrackingTools(host: OutreachMcpHost) {
  host.server.registerTool("get_message_tracking", {
    title: "Get e-mail tracking",
    description: "Get opens and clicks for an outbound e-mail. Provide one of sendId, the Noctua message row id (messageId), or a Noctua message link (url).",
    inputSchema: z.strictObject({ accountId: id.optional(), sendId: id.optional(), messageId: id.optional(), url: z.string().trim().min(1).max(4096).optional() }),
    annotations: readOnly
  }, async ({ accountId, sendId, messageId, url }) => {
    if ([sendId, messageId, url].filter(Boolean).length !== 1) throw new Error("Provide one of sendId, messageId or url.");
    const resolved = sendId ? null : await host.resolveMessage({ accountId, messageId, url });
    const account = await host.outreachAccount(resolved?.accountId ?? accountId, "viewer");
    const tracking = await getMessageTracking(account.accountId, { sendId, messageId: resolved?.message.messageId });
    return host.result(tracking ? `${tracking.opens} open(s), ${tracking.clicks} click(s).` : "No tracking found for this e-mail.",
      { ok: true, accountId: account.accountId, tracking });
  });

  host.server.registerTool("list_tracking_events", {
    title: "List e-mail tracking events",
    description: "List tracking events for a mailbox, optionally filtered by send, contact, campaign, sequence or event type. Pass nextBefore as before to get the next page.",
    inputSchema: z.strictObject({ accountId: id.optional(), ...trackingEventFilters }),
    annotations: readOnly
  }, async ({ accountId, ...filter }) => {
    const account = await host.outreachAccount(accountId, "viewer");
    const page = await listTrackingEvents(account.accountId, filter);
    return host.result(`${page.events.length} tracking event(s).`, { ...page, accountId: account.accountId });
  });
}
