import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { importContent } from "@/scripts/outreach-import-klaviyo-content";
import { initOutreachSchema } from "../db";
import { listTemplates } from "./store";
import flow from "./fixtures/klaviyo-flow.json";
import templates from "./fixtures/klaviyo-templates.json";

type Definition = typeof flow.data.attributes.definition & { profile_filter?: unknown };
type Action = { id: string; data: Record<string, unknown> };

/** The fixture flow with `change` applied to a copy of its definition. */
function variant(change: (definition: Definition, action: (id: string) => Action) => void) {
  const copy = structuredClone(flow);
  const definition = copy.data.attributes.definition as Definition;
  change(definition, id => definition.actions.find(action => action.id === id) as unknown as Action);
  return copy;
}

function importInto(input: unknown) {
  const db = initOutreachSchema(new Database(":memory:"));
  db.query(`INSERT INTO lists (accountId, id, name, externalId, createdAt, updatedAt)
    VALUES ('account', 'list', 'Liste', 'exported-list', 0, 0)`).run();
  try {
    let error: unknown;
    try { importContent(db, { accountId: "account", flow: input, templates, write: true }); } catch (caught) { error = caught; }
    const written = { templates: listTemplates(db, "account").length, sequences: db.query("SELECT id FROM sequences").all().length };
    return { error: error instanceof Error ? error.message : null, written };
  } finally {
    db.close();
  }
}

const filter = { condition_groups: [{ conditions: [{ type: "profile-property", property: "location.country", filter: { operator: "equals", value: "DE" } }] }] };

test("the flow import refuses delay restrictions and eligibility filters and writes nothing", () => {
  const cases: Array<[string, ReturnType<typeof variant>, string]> = [
    ["flow profile filter", variant(definition => { definition.profile_filter = filter; }), "profile filter"],
    ["delay until a time of day", variant((_definition, action) => { action("delay-next").data.delay_until_time = "09:00"; }), "time of day or weekday"],
    ["delay until weekdays", variant((_definition, action) => { action("delay-first").data.delay_until_weekdays = ["monday"]; }), "time of day or weekday"],
    ["message filter", variant((_definition, action) => {
      (action("email-last").data.message as Record<string, unknown>).additional_filters = filter;
    }), "additional filters"]
  ];
  for (const [label, input, message] of cases) {
    const result = importInto(input);
    expect([label, result.error]).toEqual([label, expect.stringContaining(message)]);
    expect([label, result.written]).toEqual([label, { templates: 0, sequences: 0 }]);
  }
});

test("null and empty restrictions, as a real export carries them, import as before", () => {
  const input = variant((definition, action) => {
    definition.profile_filter = null;
    Object.assign(action("delay-first").data, { delay_until_time: null, delay_until_weekdays: null });
    Object.assign(action("delay-next").data, { delay_until_time: "", delay_until_weekdays: [] });
    (action("email-first").data.message as Record<string, unknown>).additional_filters = null;
    (action("email-last").data.message as Record<string, unknown>).additional_filters = { condition_groups: [] };
  });
  expect(importInto(input)).toEqual({ error: null, written: { templates: 2, sequences: 1 } });
});
