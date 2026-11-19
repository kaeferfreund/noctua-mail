import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { itemId, validated } from "@/lib/addons/outreach/sending/input";
import { parseFlow } from "./outreach-import-klaviyo-content";

const fields = z.record(z.string(), z.unknown());
const reference = z.object({ id: itemId });
const resource = reference.extend({
  type: z.string(),
  attributes: fields,
  relationships: z.record(z.string(), z.object({ data: z.union([reference, z.array(reference), z.null()]).optional() })).optional()
});
const collection = z.object({ data: z.array(resource), included: z.array(resource).optional() });
const single = z.object({ data: resource, included: z.array(resource).optional() });
type Resource = z.infer<typeof resource>;

export type HistoryMessage =
  | { kind: "campaign"; campaignId: string; name: string; subject: string; html: string; text: string; hasTemplate: boolean }
  | { kind: "sequence"; flowId: string; subject: string; step?: { position: number; templateExternalId: string } };
export type HistoryEvent = {
  id: string; metric?: string; profileId?: string; messageId?: string; at: number; properties: Record<string, unknown>;
};
export type HistoryArchive = {
  profiles: Map<string, string>;
  messages: Map<string, HistoryMessage>;
  events: HistoryEvent[];
};

export function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function objectField(value: unknown) {
  return fields.safeParse(value).data ?? {};
}

function relatedIds(row: Resource, relationship: string): string[] {
  const data = row.relationships?.[relationship]?.data;
  return Array.isArray(data) ? data.map(ref => ref.id) : data ? [data.id] : [];
}

function read(dir: string, name: string, optional = false): unknown {
  try {
    return JSON.parse(readFileSync(join(dir, name + ".json"), "utf8"));
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function detail(dir: string, folder: string, id: string) {
  if (!/^[a-z0-9_-]+$/i.test(id)) throw new Error("Invalid archive file identifier");
  return read(dir, `${folder}/${id}`, true);
}

export function readKlaviyoHistoryArchive(dir: string): HistoryArchive {
  const metrics = new Map(validated(collection, read(dir, "metrics")).data.map(row => [row.id, stringField(row.attributes.name)]));
  const profiles = new Map(validated(collection, read(dir, "profiles")).data.map(row => [row.id, stringField(row.attributes.email)]));
  const events = validated(collection, read(dir, "events")).data.map(row => ({
    id: row.id,
    metric: metrics.get(relatedIds(row, "metric")[0]),
    profileId: relatedIds(row, "profile")[0],
    at: Date.parse(stringField(row.attributes.datetime)),
    properties: objectField(row.attributes.event_properties)
  }));

  const messages = new Map<string, HistoryMessage>();
  const add = (id: string, message: HistoryMessage) => {
    if (messages.has(id)) throw new Error("Duplicate archive message identifier");
    messages.set(id, message);
  };
  const campaigns = validated(collection, read(dir, "campaigns-email"));
  const campaignMessages = new Map<string, string[]>();
  for (const campaign of campaigns.data) {
    const ids = relatedIds(campaign, "campaign-messages");
    campaignMessages.set(campaign.id, ids);
    for (const id of ids) {
      const raw = detail(dir, "campaign-messages", id);
      const saved = raw === undefined ? undefined : validated(single, raw);
      if (saved && saved.data.id !== id) throw new Error("Campaign message identifier does not match");
      const included = campaigns.included ?? [];
      const message = saved?.data ?? included.find(row => row.type === "campaign-message" && row.id === id);
      const content = objectField(objectField(message?.attributes.definition).content);
      const templateId = message && relatedIds(message, "template")[0];
      const template = [...(saved?.included ?? []), ...included].find(row => row.type === "template" && row.id === templateId);
      add(id, { kind: "campaign", campaignId: campaign.id, name: stringField(campaign.attributes.name),
        subject: stringField(content.subject), html: stringField(template?.attributes.html),
        text: stringField(template?.attributes.text), hasTemplate: Boolean(template) });
    }
  }

  for (const flow of validated(collection, read(dir, "flows")).data) {
    const definition = detail(dir, "flows", flow.id) ?? { data: flow };
    const steps = flowSteps(definition, flow.id);
    const actions = detail(dir, "flow-actions", flow.id);
    if (actions === undefined) continue;
    for (const action of validated(collection, actions).data) {
      const raw = detail(dir, "flow-messages", action.id);
      if (raw === undefined) continue;
      for (const message of validated(collection, raw).data) {
        if (stringField(message.attributes.channel).toLowerCase() !== "email") continue;
        const fields = objectField(message.attributes.definition);
        const step = steps.get(action.id);
        add(message.id, { kind: "sequence", flowId: flow.id, subject: stringField(fields.subject_line),
          step: step && (!fields.id || fields.id === message.id) && (!step.messageId || step.messageId === message.id) ? step : undefined });
      }
    }
  }
  return { profiles, messages, events: events.map(event => {
    const id = stringField(event.properties.$message);
    const variants = campaignMessages.get(id);
    const variant = stringField(event.properties.$message_variation);
    // Campaign events may carry the parent campaign ID in $message. Use an explicit
    // variation or a single possible message. Never guess between A/B messages.
    const messageId = variants?.includes(variant) ? variant : variants?.length === 1 ? variants[0] : id;
    return { ...event, messageId: messageId || undefined };
  }) };
}

function flowSteps(definition: unknown, expectedId: string) {
  const steps = new Map<string, { position: number; templateExternalId: string; messageId?: string }>();
  let flow: ReturnType<typeof parseFlow>;
  try {
    flow = parseFlow(definition);
  } catch {
    // A definition the content importer cannot represent has no reliable sequence positions.
    return steps;
  }
  if (flow.id !== expectedId) throw new Error("Flow identifier does not match");
  flow.steps.forEach(({ actionId, templateExternalId, messageId }, position) => {
    steps.set(actionId, { position, templateExternalId, messageId });
  });
  return steps;
}
