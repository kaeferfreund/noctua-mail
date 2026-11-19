import { rows } from "@/lib/addons/outreach/sending/sql";
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { closeOutreachDb, getOutreachDb, getOutreachDbPath, initOutreachSchema } from "@/lib/addons/outreach/db";
import { itemId, sequenceInput, templateInput, validated } from "@/lib/addons/outreach/sending/input";
import { assertDraft, getSequence, saveSequence, saveTemplate } from "@/lib/addons/outreach/sending/store";
import type { SequenceStepInput } from "@/lib/addons/outreach/types";

// A real export carries `null` for parts a template does not have (`text`, `amp`); null means absent.
const withoutNulls = (value: unknown) => value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).filter(([, field]) => field !== null)) : value;
const templateExport = z.object({
  data: z.array(z.object({ id: itemId, attributes: z.preprocess(withoutNulls, templateInput.pick({ name: true, html: true, text: true })) }))
});
const flowDefinition = z.object({
  entry_action_id: itemId,
  profile_filter: z.unknown().optional(),
  triggers: z.array(z.object({ id: itemId })).length(1),
  actions: z.array(z.object({
    id: itemId, type: z.string(), data: z.unknown(), links: z.object({ next: itemId.nullable().optional() })
  })).min(1)
});
const flowExport = z.object({
  data: z.object({
    id: itemId, attributes: z.object({ name: z.string(), definition: flowDefinition.optional() }), definition: flowDefinition.optional()
  })
});
const sendEmail = z.object({
  message: z.object({ id: itemId.optional(), name: z.string().nullish(), subject_line: z.string(), preview_text: z.string().nullish(), template_id: itemId,
    additional_filters: z.unknown().optional() })
});
const timeDelay = z.object({ value: z.number().nonnegative(), unit: z.string(),
  delay_until_time: z.unknown().optional(), delay_until_weekdays: z.unknown().optional() });
const units = new Map([["second", 1 / 60], ["minute", 1], ["hour", 60], ["day", 1440], ["week", 10080]]);

class ImportError extends Error {}

/** A real export carries unused restrictions and filters as null; empty strings, lists and objects mean the same. */
const configured = (value: unknown): boolean => Array.isArray(value) ? value.some(configured)
  : value !== null && typeof value === "object" ? Object.values(value).some(configured)
  : value !== null && value !== undefined && value !== "";

export function parseFlow(input: unknown) {
  const { data } = validated(flowExport, input);
  const definition = data.attributes.definition ?? data.definition;
  if (!definition) throw new ImportError("Flow export is missing its definition.");
  // Sequences cannot express these; importing without them would mail people the flow excludes.
  if (configured(definition.profile_filter)) throw new ImportError("Flow has a profile filter, which sequences do not support.");
  const actions = new Map(definition.actions.map(action => [action.id, action]));
  if (actions.size !== definition.actions.length) throw new ImportError("Flow has duplicate action ids.");
  const visited = new Set<string>();
  const steps: Array<{ actionId: string; templateExternalId: string; messageId?: string; fields: SequenceStepInput }> = [];
  let pendingDelay = 0;
  for (let id: string | null | undefined = definition.entry_action_id; id;) {
    const next = actions.get(id);
    if (!next || visited.has(id)) throw new ImportError("Flow action chain is missing an action or contains a loop.");
    visited.add(id);
    if (next.type === "time-delay") {
      const { value, unit, delay_until_time: time, delay_until_weekdays: weekdays } = validated(timeDelay, next.data);
      if (configured(time) || configured(weekdays)) {
        throw new ImportError("Flow delay waits for a time of day or weekday, which sequences do not support.");
      }
      const factor = units.get(unit.toLowerCase().replace(/s$/, ""));
      if (!factor) throw new ImportError("Unsupported Klaviyo delay unit.");
      pendingDelay += value * factor;
    } else if (next.type === "send-email") {
      if (!Number.isSafeInteger(pendingDelay)) throw new ImportError("Flow delay must resolve to whole minutes.");
      const { message } = validated(sendEmail, next.data);
      if (configured(message.additional_filters)) throw new ImportError("Flow email has additional filters, which sequences do not support.");
      steps.push({ actionId: next.id, templateExternalId: message.template_id, messageId: message.id,
        fields: { name: message.name ?? "", subject: message.subject_line, previewText: message.preview_text ?? "", delayMinutes: pendingDelay } });
      pendingDelay = 0;
    } else {
      throw new ImportError("Flow contains an unsupported action type.");
    }
    id = next.links.next;
  }
  if (visited.size !== actions.size || !steps.length) throw new ImportError("Expected one linear flow with at least one email.");
  return { id: data.id, name: data.attributes.name, triggerExternalId: definition.triggers[0].id, steps };
}

/** v1 has no sequences.externalId. Derive a stable, account-scoped sequence id from the flow id. */
export function sequenceId(accountId: string, externalId: string) {
  return `seq_klaviyo_${createHash("sha256").update(JSON.stringify([accountId, externalId])).digest("hex")}`;
}

export function importContent(db: Database, options: { accountId: string; templates?: unknown; flow?: unknown; write?: boolean }) {
  const { accountId, write } = options;
  const templates = options.templates === undefined ? [] : validated(templateExport, options.templates).data;
  const flow = options.flow === undefined ? undefined : parseFlow(options.flow);
  if (new Set(templates.map(template => template.id)).size !== templates.length) throw new ImportError("Duplicate template ids in the export.");
  const apply = () => {
    const templateIds = new Map<string, string>();
    const byExternalId = rows<{ id: string; archivedAt: number | null }>(db, `SELECT id, archivedAt FROM templates
      WHERE accountId = ? AND externalId = ? ORDER BY createdAt, id LIMIT 2`);
    const existingTemplate = (externalId: string) => {
      const matches = byExternalId.all(accountId, externalId);
      if (matches.length > 1) throw new ImportError("Multiple templates match an external id.");
      if (matches[0]?.archivedAt != null) throw new ImportError("An imported template is archived.");
      return matches[0]?.id;
    };
    for (const template of templates) {
      const id = existingTemplate(template.id);
      const input = { name: template.attributes.name, html: template.attributes.html ?? "", text: template.attributes.text ?? "" };
      const saved = write ? saveTemplate(db, accountId, input, { id, externalId: template.id }) : null;
      templateIds.set(template.id, saved?.id ?? id ?? "tpl_dry_run");
    }
    if (flow) {
      const lists = rows<{ id: string }>(db, `SELECT id FROM lists
        WHERE accountId = ? AND externalId = ? AND archivedAt IS NULL LIMIT 2`).all(accountId, flow.triggerExternalId);
      if (lists.length !== 1) throw new ImportError("Flow trigger must match exactly one active imported list.");
      const id = sequenceId(accountId, flow.id);
      const existing = db.query("SELECT 1 FROM sequences WHERE accountId = ? AND id = ?").get(accountId, id)
        ? getSequence(db, accountId, id) : undefined;
      if (existing) assertDraft(existing);
      const steps = flow.steps.map(({ templateExternalId, fields }, position) => {
        const templateId = templateIds.get(templateExternalId) ?? existingTemplate(templateExternalId);
        if (!templateId) throw new ImportError("A flow email references a template absent from the import.");
        return { ...fields, id: existing?.steps[position]?.id, templateId };
      });
      const input = validated(sequenceInput, { name: flow.name, triggerListId: lists[0].id, steps });
      if (write) saveSequence(db, accountId, input, { id: existing?.id, newId: id });
    }
    return { templates: templates.length, sequences: Number(Boolean(flow)), steps: flow?.steps.length ?? 0, written: Boolean(write) };
  };
  const transaction = db.transaction(apply);
  return write ? transaction.immediate() : transaction.deferred();
}

async function main() {
  const { values } = parseArgs({ options: {
    account: { type: "string" }, templates: { type: "string" }, flow: { type: "string" }, write: { type: "boolean" }
  } });
  const accountId = validated(itemId, values.account);
  if (!values.templates && !values.flow) throw new ImportError("Specify --templates, --flow, or both.");
  const read = (path?: string): unknown => path ? JSON.parse(readFileSync(path, "utf8")) : undefined;
  const options = { accountId, templates: read(values.templates), flow: read(values.flow), write: values.write };
  const dbPath = getOutreachDbPath();
  const db = values.write ? await getOutreachDb() : existsSync(dbPath)
    ? new Database(dbPath, { readonly: true }) : initOutreachSchema(new Database(":memory:"));
  try {
    const result = importContent(db, options);
    console.info(`${result.written ? "Import" : "Dry run"}: ${result.templates} template(s), ${result.sequences} sequence(s), ${result.steps} step(s).`);
  } finally {
    if (values.write) closeOutreachDb();
    else db.close();
  }
}

if (import.meta.main) {
  try { await main(); }
  catch (error) {
    // Do not print export contents, paths, or SQLite error values.
    console.error(error instanceof ImportError ? error.message : "Could not import Klaviyo content.");
    process.exitCode = 1;
  }
}
