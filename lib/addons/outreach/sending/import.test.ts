import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { importContent } from "@/scripts/outreach-import-klaviyo-content";
import { initOutreachSchema } from "../db";
import { getSequence, getTemplate, listTemplates } from "./store";
import flow from "./fixtures/klaviyo-flow.json";
import templates from "./fixtures/klaviyo-templates.json";

test("imports Klaviyo content offline, follows the action chain, and upserts on rerun", () => {
  const db = initOutreachSchema(new Database(":memory:"));
  const accountId = "account";
  const options = { accountId, flow, templates };
  try {
    db.query(`INSERT INTO lists (accountId, id, name, externalId, createdAt, updatedAt)
      VALUES (?, 'list', 'Liste', 'exported-list', 0, 0)`).run(accountId);
    expect(importContent(db, options)).toEqual({ templates: 2, sequences: 1, steps: 2, written: false });
    expect(listTemplates(db, accountId)).toEqual([]);
    expect(db.query("SELECT id FROM sequences WHERE accountId = ?").all(accountId)).toEqual([]);
    expect(importContent(db, { ...options, write: true })).toMatchObject({ written: true });
    const rows = () => db.query("SELECT id FROM sequences WHERE accountId = ?").all(accountId);
    const sequence = getSequence(db, accountId, rows()[0].id);
    expect(sequence).toMatchObject({ status: "draft", name: "Begrüßung", triggerListId: "list", steps: [
      { delayMinutes: 120, previewText: "Willkommen" }, { delayMinutes: 4320, subject: "Mehr Infos" }
    ] });
    expect(getTemplate(db, accountId, sequence.steps[0].templateId!).html).toContain('href="{{ unsubscribe_url }}"');

    importContent(db, { ...options, write: true });
    expect(rows()).toEqual([{ id: sequence.id }]);
    expect(getSequence(db, accountId, sequence.id).steps.map(step => step.id)).toEqual(sequence.steps.map(step => step.id));
    expect(listTemplates(db, accountId)).toHaveLength(2);
    db.query("UPDATE sequences SET status = 'live' WHERE accountId = ? AND id = ?").run(accountId, sequence.id);
    expect(() => importContent(db, { ...options, write: true })).toThrow();
  } finally {
    db.close();
  }
});

test("rejects a missing trigger list without partially importing the templates", () => {
  const db = initOutreachSchema(new Database(":memory:"));
  try {
    expect(() => importContent(db, { accountId: "account", flow, templates, write: true })).toThrow("active imported list");
    expect(listTemplates(db, "account")).toEqual([]);
  } finally {
    db.close();
  }
});
