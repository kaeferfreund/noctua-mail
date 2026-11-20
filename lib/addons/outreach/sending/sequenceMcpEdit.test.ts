import { expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import type { Sequence, SequenceStepInput } from "../types";
import { editSequence, editSequenceStep } from "./actions";
import { enroll, expandSequences } from "./queue";
import { mcpToken, outreachMailbox, withOutreachFlag } from "./mcpTestFixture";
import { getSequence, saveSequence, saveTemplate } from "./store";

/** Editing a sequence over MCP: a draft is preparation, a live or paused sequence is mail that goes out (synthetic data only). */

const steps = [
  { name: "Start", subject: "Willkommen", html: "<p>Hallo {{ first_name }}, schön dass du da bist. Bis bald!</p>", text: "Hallo, schön dass du da bist.", delayMinutes: 0 },
  { name: "Tipps", subject: "Drei Tipps", html: "<p>Tipp eins. Tipp zwei. Tipp drei.</p>", delayMinutes: 1440 },
  { name: "Abschluss", subject: "Bis bald", html: "<p>Das war es.</p>", delayMinutes: 2880 }
];

/**
 * The fixture mailbox with a three-step sequence, live, and its reader waiting for the first step. `templated` adds two
 * steps that take their content from a template: one enabled (filled in when the sequence went live), one disabled.
 */
async function liveSequence(options: { templated?: boolean } = {}) {
  const box = await outreachMailbox();
  const { db, accountId, listId, readerId } = box;
  const template = saveTemplate(db, accountId, { name: "Vorlage", subject: "Aus der Vorlage", html: "<p>Vorlagentext</p>" });
  const templated: SequenceStepInput[] = options.templated ? [
    { name: "Aus Vorlage", templateId: template.id, delayMinutes: 4320 },
    { name: "Später", templateId: template.id, enabled: false, delayMinutes: 5760 }
  ] : [];
  const sequence = saveSequence(db, accountId, { name: "Serie", triggerListId: listId, steps: [...steps, ...templated] });
  const full = await mcpToken(box, "full", "Voll");
  await full.call("set_sequence_status", { sequenceId: sequence.id, status: "live" });
  enroll(db, accountId, { listId, contactId: readerId, at: 1_000 });
  const read = () => getSequence(db, accountId, sequence.id);
  const enrollment = () => db.query("SELECT status, nextStepPosition, nextSendAt FROM sequence_enrollments WHERE accountId = ? AND sequenceId = ?")
    .get(accountId, sequence.id);
  return { box, full, sequenceId: sequence.id, templateId: template.id, read, enrollment };
}

/** The outreach database with `hook` run once right before the first write transaction starts, after every awaited check. */
function beforeWrite(db: Database, hook: () => void): Database {
  let done = false;
  return new Proxy(db, {
    get(target, key) {
      if (key === "transaction" && !done) {
        return (run: () => unknown) => {
          done = true;
          hook();
          return target.transaction(run);
        };
      }
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

/** A direct call of the edit actions as the token's MCP tools make it. */
const tokenActor = (accountId: string, token: Awaited<ReturnType<typeof mcpToken>>) =>
  ({ accountId, authorization: { tokenId: token.tokenRecord.id }, via: `mcp:Synthetic (…${token.tokenRecord.tokenSuffix})` });

test("a drafts token sees the edit tools, builds a draft sequence and reads it without the bodies", () => withOutreachFlag(async () => {
  const box = await outreachMailbox();
  const drafts = await mcpToken(box, "drafts");
  const tools = await drafts.tools();
  expect(tools).toEqual(expect.arrayContaining(["get_sequence", "get_sequence_step", "save_sequence", "update_sequence_step"]));
  expect(tools).not.toContain("set_sequence_status");

  const created = (await drafts.call("save_sequence", { name: "Entwurf", steps })).sequence as Sequence;
  expect(created).toMatchObject({ status: "draft", steps: [{ name: "Start", htmlLength: steps[0].html.length, textLength: steps[0].text!.length }, {}, {}] });
  expect(created.steps[0]).not.toHaveProperty("html");
  const [first] = created.steps;

  const edited = await drafts.call("update_sequence_step", { sequenceId: created.id, stepId: first.id, expectedUpdatedAt: created.updatedAt,
    subject: "Herzlich willkommen", replacements: [{ field: "html", find: "Bis bald!", replace: "Bis morgen!" }] });
  expect(edited).toMatchObject({ saved: true, changed: ["subject", "html"], replacements: [{ field: "html", occurrences: 1 }], warnings: [],
    sequence: { id: created.id, status: "draft" } });
  expect((edited.sequence as Sequence).updatedAt).toBeGreaterThan(created.updatedAt);

  const outline = (await drafts.call("get_sequence", { sequenceId: created.id })).sequence as Sequence;
  expect(outline.steps.map(step => "html" in step || "text" in step)).toEqual([false, false, false]);
  expect((await drafts.call("get_sequence", { sequenceId: created.id, includeBodies: true })).sequence)
    .toMatchObject({ steps: [{ html: steps[0].html.replace("Bis bald!", "Bis morgen!") }, { html: steps[1].html }, { html: steps[2].html }] });
  expect(await drafts.call("get_sequence_step", { sequenceId: created.id, stepId: first.id })).toMatchObject({
    sequence: { id: created.id, status: "draft", updatedAt: outline.updatedAt },
    step: { id: first.id, subject: "Herzlich willkommen", html: steps[0].html.replace("Bis bald!", "Bis morgen!"), text: steps[0].text }
  });
  expect(await drafts.refusal("get_sequence_step", { sequenceId: created.id, stepId: "stp_unknown" })).toContain("nicht gefunden");
}));

test("a drafts token cannot change a live or paused sequence, not even as a dry run", () => withOutreachFlag(async () => {
  const { box, full, sequenceId, read } = await liveSequence();
  const drafts = await mcpToken(box, "drafts", "Entwurf");
  for (const status of ["live", "paused"] as const) {
    if (status === "paused") await full.call("set_sequence_status", { sequenceId, status });
    const before = read();
    expect(before.status).toBe(status);
    const guard = { sequenceId, expectedUpdatedAt: before.updatedAt };
    for (const dryRun of [false, true]) {
      expect(await drafts.refusal("update_sequence_step", { ...guard, stepId: before.steps[0].id, subject: "Anders", dryRun })).toContain("send permission");
    }
    expect(await drafts.refusal("save_sequence", { ...guard, name: "Anders" })).toContain("send permission");
    expect(await drafts.refusal("save_sequence", { ...guard, steps: [] })).toContain("send permission");
    expect(read()).toEqual(before);
  }
}));

test("a full token changes one step of a live sequence against the version it read; the rest stays", () => withOutreachFlag(async () => {
  const { full, sequenceId, read, enrollment } = await liveSequence();
  const before = read();
  const waiting = enrollment();
  expect(waiting).toMatchObject({ status: "active", nextStepPosition: 0 });
  const [first, second] = before.steps;
  const edit = { sequenceId, stepId: second.id };

  // No version, an old version: nothing is written.
  expect(await full.refusal("save_sequence", { sequenceId, name: "Anders" })).toContain("expectedUpdatedAt");
  expect(await full.refusal("update_sequence_step", { ...edit, subject: "Anders" })).toContain("expectedUpdatedAt");
  expect(await full.refusal("update_sequence_step", { ...edit, expectedUpdatedAt: before.updatedAt - 1, subject: "Anders" })).toContain("inzwischen geändert");
  expect(await full.refusal("save_sequence", { sequenceId, expectedUpdatedAt: before.updatedAt - 1, name: "Anders" })).toContain("inzwischen geändert");

  // A replacement names its place exactly.
  const guard = { ...edit, expectedUpdatedAt: before.updatedAt };
  expect(await full.refusal("update_sequence_step", { ...guard, replacements: [{ field: "html", find: "Tipp vier", replace: "x" }] })).toContain("steht nicht in html");
  expect(await full.refusal("update_sequence_step", { ...guard, replacements: [{ field: "html", find: "Tipp", replace: "Hinweis" }] })).toContain("3-mal");
  // A replacement cannot grow a field past the limit of the field.
  expect(await full.refusal("update_sequence_step", { ...guard, replacements: [{ field: "subject", find: "Tipps", replace: "x".repeat(995) }] })).toContain("länger als 998");
  expect(await full.refusal("update_sequence_step", { ...guard, replacements: [{ field: "html", find: "Tipp", replace: "x".repeat(100_000), replaceAll: true },
    { field: "html", find: "x", replace: "y".repeat(100_000), replaceAll: true }] })).toContain("länger als 2000000");
  // A live step keeps a subject and a body.
  expect(await full.refusal("update_sequence_step", { ...guard, subject: " " })).toContain("Betreff und Nachricht");
  expect(read()).toEqual(before);

  const preview = await full.call("update_sequence_step", { ...guard, dryRun: true, subject: "Tipps für {{ vorname }}",
    replacements: [{ field: "html", find: "Tipp", replace: "Hinweis $& $1", replaceAll: true }] });
  expect(preview).toMatchObject({ saved: false, changed: ["subject", "html"], replacements: [{ field: "html", occurrences: 3 }],
    warnings: ["Unbekannter Platzhalter: vorname"], sequence: { updatedAt: before.updatedAt } });
  expect(read()).toEqual(before);

  // The replacement text is taken literally (`$&` is no pattern).
  const saved = await full.call("update_sequence_step", { ...guard, previewText: "Kurz und knapp",
    replacements: [{ field: "html", find: "Tipp zwei.", replace: "Tipp zwei, der wichtigste $& $1." }] });
  expect(saved).toMatchObject({ saved: true, changed: ["previewText", "html"], warnings: [], sequence: { status: "live" },
    step: { id: second.id, position: 1, delayMinutes: 1440, previewText: "Kurz und knapp" } });
  const after = read();
  expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
  expect((saved.sequence as Sequence).updatedAt).toBe(after.updatedAt);
  expect(after.steps[1]).toEqual({ ...second, previewText: "Kurz und knapp", html: "<p>Tipp eins. Tipp zwei, der wichtigste $& $1. Tipp drei.</p>" });
  expect([after.steps[0], after.steps[2]]).toEqual([first, before.steps[2]]);
  expect({ ...after, steps: [], updatedAt: 0 }).toEqual({ ...before, steps: [], updatedAt: 0 });
  expect(enrollment()).toEqual(waiting);

  // The version that was just replaced no longer writes; an edit that changes nothing writes nothing.
  expect(await full.refusal("update_sequence_step", { ...guard, subject: "Zu spät" })).toContain("inzwischen geändert");
  expect(await full.call("update_sequence_step", { ...edit, expectedUpdatedAt: after.updatedAt, subject: second.subject })).toMatchObject({ saved: false, changed: [] });
  expect(read()).toEqual(after);

  // The whole list with the version: a renamed sequence, steps untouched.
  const renamed = (await full.call("save_sequence", { sequenceId, expectedUpdatedAt: after.updatedAt, name: "Serie neu" })).sequence as Sequence;
  expect(renamed).toMatchObject({ name: "Serie neu", status: "live" });
  expect(read().steps).toEqual(after.steps);
}));

test("a replacement in a draft step that takes its content from a template says where the content is", () => withOutreachFlag(async () => {
  const box = await outreachMailbox();
  const drafts = await mcpToken(box, "drafts");
  const template = (await drafts.call("save_email_template", { name: "Vorlage", subject: "Aus der Vorlage", html: "<p>Vorlagentext</p>" })).template as { id: string };
  const sequence = (await drafts.call("save_sequence", { name: "Mit Vorlage", steps: [{ templateId: template.id }] })).sequence as Sequence;
  expect(await drafts.refusal("update_sequence_step", { sequenceId: sequence.id, stepId: sequence.steps[0].id, expectedUpdatedAt: sequence.updatedAt,
    replacements: [{ field: "html", find: "Vorlagentext", replace: "Neu" }] })).toContain("kommt aus der Vorlage");
}));

test("a step edit of a live sequence makes the token's creator the approver; a token whose user lost the editor role is refused", () => withOutreachFlag(async () => {
  const { box, sequenceId, read } = await liveSequence();
  const { accountId, editor } = box;
  const colleague = await createAuthenticatedTestSession(accountId);
  const assistant = await mcpToken({ accountId, editor: colleague }, "full", "Zweit");
  const before = read();
  expect(before).toMatchObject({ statusChangedByUserId: editor.user.id });
  const stepId = before.steps[1].id;

  await assistant.call("update_sequence_step", { sequenceId, stepId, expectedUpdatedAt: before.updatedAt, subject: "Neue Tipps" });
  const edited = read();
  expect(edited).toMatchObject({ status: "live", statusChangedByUserId: colleague.user.id,
    statusChangedVia: `mcp:Zweit (…${assistant.tokenRecord.tokenSuffix})`, steps: [{}, { subject: "Neue Tipps" }, {}] });

  colleague.master.prepare("UPDATE user_accounts SET role = 'viewer' WHERE userId = ? AND accountId = ?").run(colleague.user.id, accountId);
  const guard = { sequenceId, stepId, expectedUpdatedAt: edited.updatedAt };
  for (const dryRun of [false, true]) {
    expect(await assistant.refusal("update_sequence_step", { ...guard, subject: "Noch einmal", dryRun })).toContain("role");
  }
  expect(await assistant.refusal("save_sequence", { sequenceId, expectedUpdatedAt: edited.updatedAt, name: "Anders" })).toContain("role");
  expect(read()).toEqual(edited);
}));

test("a draft that goes live between the checks and the write is not edited", () => withOutreachFlag(async () => {
  const box = await outreachMailbox();
  const { db, accountId, sequence } = box;
  const actor = tokenActor(accountId, await mcpToken(box, "drafts"));
  const goesLive = () => beforeWrite(db, () => db.query("UPDATE sequences SET status = 'live' WHERE accountId = ? AND id = ?").run(accountId, sequence.id));

  await expect(editSequenceStep(goesLive(), actor, sequence.id, sequence.steps[0].id, { subject: "Untergeschoben" },
    { expectedUpdatedAt: sequence.updatedAt })).rejects.toMatchObject({ code: "sequence_changed" });
  expect(getSequence(db, accountId, sequence.id)).toEqual({ ...sequence, status: "live" });
  db.query("UPDATE sequences SET status = 'draft' WHERE accountId = ? AND id = ?").run(accountId, sequence.id);
  await expect(editSequence(goesLive(), actor, sequence.id, { steps: [{ id: sequence.steps[0].id, subject: "Untergeschoben" }] }))
    .rejects.toMatchObject({ code: "sequence_changed" });
  expect(getSequence(db, accountId, sequence.id)).toEqual({ ...sequence, status: "live" });
}));

test("a token narrowed or revoked between the checks and the write does not edit a live sequence", () => withOutreachFlag(async () => {
  for (const change of ["narrowed", "revoked"] as const) {
    const { box, sequenceId, read } = await liveSequence();
    const { accountId, editor } = box;
    const token = await mcpToken(box, "full", "Kurz");
    const before = read();
    const db = beforeWrite(box.db, () => {
      if (change === "narrowed") editor.master.prepare("UPDATE mcp_tokens SET scopes = ? WHERE id = ?").run(JSON.stringify(["read", "drafts"]), token.tokenRecord.id);
      else editor.master.prepare("DELETE FROM mcp_tokens WHERE id = ?").run(token.tokenRecord.id);
    });
    await expect(editSequenceStep(db, tokenActor(accountId, token), sequenceId, before.steps[1].id, { subject: "Zu spät" },
      { expectedUpdatedAt: before.updatedAt })).rejects.toThrow();
    expect(read()).toEqual(before);
  }
}));

test("checks run in order: the version, then the permission, then the step and its content", () => withOutreachFlag(async () => {
  const { box, full, sequenceId, read } = await liveSequence();
  const drafts = await mcpToken(box, "drafts", "Entwurf");
  const before = read();
  const stepId = before.steps[1].id;
  const stale = { sequenceId, expectedUpdatedAt: before.updatedAt - 1 };
  const current = { sequenceId, expectedUpdatedAt: before.updatedAt };

  // A stale version is the answer, whatever else is wrong with the edit; MCP clients see the code first.
  expect(await full.refusal("update_sequence_step", { ...stale, stepId, replacements: [{ field: "html", find: "fehlt", replace: "x" }] }))
    .toStartWith("sequence_changed: ");
  expect(await full.refusal("update_sequence_step", { ...stale, stepId: "stp_unknown", subject: "x" })).toStartWith("sequence_changed: ");
  expect(await full.refusal("save_sequence", { ...stale, name: "Anders" })).toStartWith("sequence_changed: ");
  // Then the permission: a token without send learns nothing about the step or its content.
  expect(await drafts.refusal("update_sequence_step", { ...current, stepId, subject: " " })).toContain("send permission");
  expect(await drafts.refusal("update_sequence_step", { ...current, stepId: "stp_unknown", subject: "x" })).toContain("send permission");
  expect(await drafts.refusal("save_sequence", { sequenceId, name: "Anders" })).toContain("send permission");
  expect(await full.refusal("save_sequence", { sequenceId, name: "Anders" })).toStartWith("expected_updated_at_required: ");
  // A step of another sequence is not found.
  expect(await full.refusal("update_sequence_step", { ...current, stepId: box.sequence.steps[0].id, subject: "x" })).toContain("nicht gefunden");
  expect(read()).toEqual(before);
}));

test("a live edit with a step list keeps an enabled step and renders each enabled step once", () => withOutreachFlag(async () => {
  const { box, full, sequenceId, read } = await liveSequence({ templated: true });
  const { db, accountId } = box;
  const actor = tokenActor(accountId, full);
  const before = read();
  const guard = { expectedUpdatedAt: before.updatedAt };

  // Every step disabled, or no step left: refused, nothing written.
  for (const steps of [before.steps.map(step => ({ id: step.id, enabled: false })), []]) {
    await expect(editSequence(db, actor, sequenceId, { steps }, guard)).rejects.toMatchObject({ message: "Aktiviere mindestens einen Schritt." });
    expect(read()).toEqual(before);
  }
  // The content checks of going live run on the stored step list.
  const emptied = before.steps.map((step, index) => index === 1 ? { id: step.id, subject: " " } : { id: step.id });
  await expect(editSequence(db, actor, sequenceId, { steps: emptied }, guard)).rejects.toMatchObject({ message: "Schritt 2 „Tipps“: Betreff und Nachricht sind erforderlich." });
  const unfilled = before.steps.map((step, index) => index === 1 ? { id: step.id, subject: "{{ typo }}" } : { id: step.id });
  await expect(editSequence(db, actor, sequenceId, { steps: unfilled }, guard)).rejects.toMatchObject({ code: "content_empty" });
  expect(read()).toEqual(before);

  // Each render of a step's content reads the organization once (`renderForContact`): one per enabled step.
  let renders = 0;
  const counting = new Proxy(db, {
    get(target, key) {
      if (key === "query") return (sql: string) => { if (sql.includes("FROM account_settings")) renders++; return target.query(sql); };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
  const saved = await editSequence(counting, actor, sequenceId, { name: "Serie neu", steps: before.steps.map(step => ({ id: step.id })) }, guard);
  expect(renders).toBe(before.steps.filter(step => step.enabled).length);
  expect(saved).toMatchObject({ name: "Serie neu", status: "live", steps: before.steps });
}));

test("a step edit leaves queued sends, template steps and the waiting contact alone; a queued send shows its step's new subject", () => withOutreachFlag(async () => {
  const { box, full, sequenceId, templateId, read, enrollment } = await liveSequence({ templated: true });
  const { db, accountId } = box;
  expandSequences(db, accountId, Date.now());
  const queued = () => db.query("SELECT sequenceStepId, subject, status, attempts, sendAt FROM sends WHERE accountId = ? AND sequenceId = ?")
    .all(accountId, sequenceId);
  const waiting = enrollment();
  const [first] = read().steps;
  const queuedBefore = queued();
  expect(queuedBefore).toEqual([{ sequenceStepId: first.id, subject: "Willkommen", status: "queued", attempts: 0, sendAt: 1_000 }]);
  // The template changes after going live: the enabled step keeps the content approved then, the disabled one stays empty.
  saveTemplate(db, accountId, { subject: "Vorlage neu", html: "<p>Neuer Vorlagentext</p>" }, { id: templateId });
  const before = read();
  expect(before.steps.slice(3)).toMatchObject([
    { templateId, enabled: true, subject: "Aus der Vorlage", html: "<p>Vorlagentext</p>" },
    { templateId, enabled: false, subject: "", html: "", text: "" }
  ]);

  const others = (sequence: Sequence) => sequence.steps.filter((_, index) => index !== 2);
  await full.call("update_sequence_step", { sequenceId, stepId: before.steps[2].id, expectedUpdatedAt: before.updatedAt, html: "<p>Das war es, danke.</p>" });
  const after = read();
  expect(after.steps[2].html).toBe("<p>Das war es, danke.</p>");
  expect(others(after)).toEqual(others(before));
  expect(queued()).toEqual(queuedBefore);
  expect(enrollment()).toEqual(waiting);

  // The step the contact waits for: its queued send, not attempted yet, shows the new subject as the reader will see it.
  await full.call("update_sequence_step", { sequenceId, stepId: first.id, expectedUpdatedAt: after.updatedAt, subject: "Willkommen {{ email }}" });
  expect(queued()).toEqual([{ ...queuedBefore[0], subject: "Willkommen reader@example.test" }]);
  expect(enrollment()).toEqual(waiting);

  // The whole list saved again: the disabled template step stays empty; enabled later it takes the template as it is then.
  const listed = read();
  await full.call("save_sequence", { sequenceId, expectedUpdatedAt: listed.updatedAt, steps: listed.steps.map(({ id }) => ({ id })) });
  expect(read().steps[4]).toMatchObject({ enabled: false, subject: "", html: "", templateId });
  saveTemplate(db, accountId, { subject: "Vorlage zwei", html: "<p>Zweiter Vorlagentext</p>" }, { id: templateId });
  const relisted = read();
  await full.call("save_sequence", { sequenceId, expectedUpdatedAt: relisted.updatedAt,
    steps: relisted.steps.map(({ id }, index) => index === 4 ? { id, enabled: true } : { id }) });
  expect(read().steps.slice(3)).toMatchObject([
    { subject: "Aus der Vorlage", html: "<p>Vorlagentext</p>" },
    { enabled: true, subject: "Vorlage zwei", html: "<p>Zweiter Vorlagentext</p>", templateId }
  ]);
}));

test("a step edit answers the content as it would be stored: normalized, filled from the template, checked like going live", () => withOutreachFlag(async () => {
  const { box, full, sequenceId, templateId, read } = await liveSequence({ templated: true });
  const before = read();
  const [first, second, , fromTemplate] = before.steps;
  const at = (stepId: string) => ({ sequenceId, stepId, expectedUpdatedAt: before.updatedAt });

  // The same placeholder in another spelling is no change, and `find` matches the stored spelling.
  expect(await full.call("update_sequence_step", { ...at(first.id), subject: "Willkommen", html: first.html.replace("{{ first_name }}", "{{first_name}}") }))
    .toMatchObject({ saved: false, changed: [] });
  expect(read()).toEqual(before);
  const preview = await full.call("update_sequence_step", { ...at(first.id), dryRun: true, subject: "Hallo {{first_name}} {% current_year %}",
    replacements: [{ field: "html", find: "{{ first_name }}", replace: "{{last_name}}" }] });
  expect(preview).toMatchObject({ saved: false, changed: ["subject", "html"],
    step: { subject: "Hallo {{ first_name }} {{ current_year }}", htmlLength: first.html.replace("first_name", "last_name").length } });

  // A cleared field of a template step is filled from the template as it is now; a refilled field equal to the stored one is no change.
  saveTemplate(box.db, box.accountId, { subject: "Vorlage neu" }, { id: templateId });
  const refilled = await full.call("update_sequence_step", { ...at(fromTemplate.id), expectedUpdatedAt: read().updatedAt, dryRun: true, subject: "", html: "" });
  expect(refilled).toMatchObject({ changed: ["subject"], step: { subject: "Vorlage neu", htmlLength: "<p>Vorlagentext</p>".length } });

  // The preview text is rendered for the warnings too.
  expect(await full.call("update_sequence_step", { ...at(second.id), expectedUpdatedAt: read().updatedAt, dryRun: true, previewText: "Kurz {{ vorname }}" }))
    .toMatchObject({ warnings: ["Unbekannter Platzhalter: vorname"] });

  // A subject or body that renders empty is refused, naming the step, also in a dry run.
  for (const dryRun of [false, true]) {
    expect(await full.refusal("update_sequence_step", { ...at(second.id), expectedUpdatedAt: read().updatedAt, subject: "{{ typo }}", dryRun }))
      .toStartWith("content_empty: Schritt 2 „Tipps“");
  }
  expect(await full.refusal("update_sequence_step", { ...at(second.id), expectedUpdatedAt: read().updatedAt, html: "{{ typo }}" }))
    .toStartWith("content_empty: Schritt 2");
  const unsent = saveSequence(box.db, box.accountId, { name: "Tippfehler", triggerListId: box.listId, steps: [{ name: "Erster", subject: "{{ typo }}", text: "Hallo" }] });
  expect(await full.refusal("set_sequence_status", { sequenceId: unsent.id, status: "live" })).toStartWith("content_empty: Schritt 1 „Erster“");
  expect(getSequence(box.db, box.accountId, unsent.id).status).toBe("draft");
}));

test("the template hint appears only when the searched field is empty and comes from the template", () => withOutreachFlag(async () => {
  const box = await outreachMailbox();
  const drafts = await mcpToken(box, "drafts");
  const template = saveTemplate(box.db, box.accountId, { name: "Vorlage", subject: "Aus der Vorlage", html: "<p>Vorlagentext</p>", text: "Vorlagentext" });
  const sequence = saveSequence(box.db, box.accountId, { name: "Mit Vorlage", steps: [{ templateId: template.id, html: "<p>Eigener Text</p>" }] });
  const at = { sequenceId: sequence.id, stepId: sequence.steps[0].id, expectedUpdatedAt: sequence.updatedAt };
  const hint = "kommt aus der Vorlage";
  // The step has its own HTML body, so the text body is its own (empty) too.
  expect(await drafts.refusal("update_sequence_step", { ...at, replacements: [{ field: "text", find: "Vorlagentext", replace: "x" }] })).not.toContain(hint);
  // The subject is empty and comes from the template.
  expect(await drafts.refusal("update_sequence_step", { ...at, replacements: [{ field: "subject", find: "Vorlage", replace: "x" }] })).toContain(hint);
  // The same call supplied the field.
  expect(await drafts.refusal("update_sequence_step", { ...at, subject: "Eigener Betreff", replacements: [{ field: "subject", find: "Vorlage", replace: "x" }] }))
    .not.toContain(hint);
}));

test("a drafts token edits an existing draft through save_sequence", () => withOutreachFlag(async () => {
  const box = await outreachMailbox();
  const drafts = await mcpToken(box, "drafts");
  const { sequence } = box;
  const saved = (await drafts.call("save_sequence", { sequenceId: sequence.id, name: "Willkommen neu",
    steps: [{ id: sequence.steps[0].id, subject: "Schritt eins" }, { subject: "Schritt zwei", text: "Noch etwas" }] })).sequence as Sequence;
  expect(saved).toMatchObject({ name: "Willkommen neu", status: "draft", statusChangedByUserId: null,
    steps: [{ id: sequence.steps[0].id, subject: "Schritt eins" }, { subject: "Schritt zwei" }] });
  expect(saved.updatedAt).toBeGreaterThan(sequence.updatedAt);
}));

test("a template edit after the review changes the version of the sequences that take content from it", () => withOutreachFlag(async () => {
  const box = await outreachMailbox();
  const drafts = await mcpToken(box, "drafts", "Entwurf");
  const full = await mcpToken(box, "full", "Voll");
  const template = (await drafts.call("save_email_template", { name: "Vorlage", subject: "Geprüft", html: "<p>Geprüft</p>" })).template as { id: string };
  const sequence = (await drafts.call("save_sequence", { name: "Mit Vorlage", triggerListId: box.listId, steps: [{ templateId: template.id }] })).sequence as Sequence;
  const own = getSequence(box.db, box.accountId, box.sequence.id);
  const version = () => getSequence(box.db, box.accountId, sequence.id).updatedAt;

  // A name change of the template changes no content.
  await drafts.call("save_email_template", { templateId: template.id, name: "Vorlage umbenannt" });
  expect(version()).toBe(sequence.updatedAt);
  await drafts.call("save_email_template", { templateId: template.id, html: "<p>Nicht geprüft</p>" });
  expect(version()).toBeGreaterThan(sequence.updatedAt);
  expect(getSequence(box.db, box.accountId, own.id)).toEqual(own);
  expect(await full.refusal("set_sequence_status", { sequenceId: sequence.id, status: "live", expectedUpdatedAt: sequence.updatedAt }))
    .toStartWith("sequence_changed: ");
  expect(getSequence(box.db, box.accountId, sequence.id).status).toBe("draft");
}));

test("a template content edit raises the version of every sequence with a step that references it, own content or not", () => withOutreachFlag(async () => {
  const box = await outreachMailbox();
  const { db, accountId, listId } = box;
  const full = await mcpToken(box, "full", "Voll");
  const template = saveTemplate(db, accountId, { name: "Vorlage", subject: "Betreff A", html: "<p>Vorlagentext A</p>" });
  // The step references the template but has its own subject and body: as stored it takes nothing from the template.
  const own = saveSequence(db, accountId, { name: "Eigener Inhalt", triggerListId: listId,
    steps: [{ templateId: template.id, subject: "Eigener Betreff", html: "<p>Eigener Text</p>" }] });
  await full.call("set_sequence_status", { sequenceId: own.id, status: "live" });
  const live = getSequence(db, accountId, own.id);
  const unrelated = getSequence(db, accountId, box.sequence.id);
  const edit = { sequenceId: live.id, stepId: live.steps[0].id, expectedUpdatedAt: live.updatedAt, subject: "" };

  // The dry run shows the template's subject A for the emptied field.
  expect(await full.call("update_sequence_step", { ...edit, dryRun: true })).toMatchObject({ saved: false, changed: ["subject"], step: { subject: "Betreff A" } });
  saveTemplate(db, accountId, { subject: "Betreff B" }, { id: template.id });
  const bumped = getSequence(db, accountId, live.id);
  expect(bumped.updatedAt).toBeGreaterThan(live.updatedAt);
  expect({ ...bumped, updatedAt: 0 }).toEqual({ ...live, updatedAt: 0 });
  expect(getSequence(db, accountId, unrelated.id)).toEqual(unrelated);
  // The real call with the version of the dry run would store B, which nobody reviewed: it is refused.
  expect(await full.refusal("update_sequence_step", edit)).toStartWith("sequence_changed: ");
  expect(await full.refusal("save_sequence", { sequenceId: live.id, expectedUpdatedAt: live.updatedAt, steps: [{ id: live.steps[0].id, subject: "" }] }))
    .toStartWith("sequence_changed: ");
  expect(getSequence(db, accountId, live.id)).toEqual(bumped);
}));

test("a value longer than its limit once the placeholders are written out is refused", () => withOutreachFlag(async () => {
  const box = await outreachMailbox();
  const drafts = await mcpToken(box, "drafts");
  const subject = `${"x".repeat(981)}{% unsubscribe %}`;
  expect(subject).toHaveLength(998);
  expect(await drafts.refusal("save_email_template", { name: "Lang", subject, html: "<p>Text</p>" }))
    .toStartWith("content_too_long: subject ist mit ausgeschriebenen Platzhaltern länger als 998 Zeichen.");
  expect(await drafts.refusal("save_sequence", { name: "Lang", steps: [{ subject, text: "Text" }] })).toStartWith("content_too_long: subject");
}));
