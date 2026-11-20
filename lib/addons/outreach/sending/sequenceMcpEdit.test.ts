import { expect, test } from "bun:test";
import "@/lib/testDbHarness";
import type { Sequence } from "../types";
import { enroll } from "./queue";
import { mcpToken, outreachMailbox, withOutreachFlag } from "./mcpTestFixture";
import { getSequence, saveSequence } from "./store";

/** Editing a sequence over MCP: a draft is preparation, a live or paused sequence is mail that goes out (synthetic data only). */

const steps = [
  { name: "Start", subject: "Willkommen", html: "<p>Hallo {{ first_name }}, schön dass du da bist. Bis bald!</p>", text: "Hallo, schön dass du da bist.", delayMinutes: 0 },
  { name: "Tipps", subject: "Drei Tipps", html: "<p>Tipp eins. Tipp zwei. Tipp drei.</p>", delayMinutes: 1440 },
  { name: "Abschluss", subject: "Bis bald", html: "<p>Das war es.</p>", delayMinutes: 2880 }
];

/** The fixture mailbox with a three-step sequence, live, and its reader waiting for the first step. */
async function liveSequence() {
  const box = await outreachMailbox();
  const { db, accountId, listId, readerId } = box;
  const sequence = saveSequence(db, accountId, { name: "Serie", triggerListId: listId, steps });
  const full = await mcpToken(box, "full", "Voll");
  await full.call("set_sequence_status", { sequenceId: sequence.id, status: "live" });
  enroll(db, accountId, { listId, contactId: readerId, at: 1_000 });
  const read = () => getSequence(db, accountId, sequence.id);
  const enrollment = () => db.query("SELECT status, nextStepPosition, nextSendAt FROM sequence_enrollments WHERE accountId = ? AND sequenceId = ?")
    .get(accountId, sequence.id);
  return { box, full, sequenceId: sequence.id, read, enrollment };
}

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
  // A live step keeps a subject and a body.
  expect(await full.refusal("update_sequence_step", { ...guard, subject: " " })).toContain("Betreff und Nachricht");
  expect(read()).toEqual(before);

  const preview = await full.call("update_sequence_step", { ...guard, dryRun: true, subject: "Tipps für {{ vorname }}",
    replacements: [{ field: "html", find: "Tipp", replace: "Hinweis $& $1", replaceAll: true }] });
  expect(preview).toMatchObject({ saved: false, changed: ["subject", "html"], replacements: [{ field: "html", occurrences: 3 }],
    warnings: ["Unbekannter Platzhalter: vorname"], sequence: { updatedAt: before.updatedAt } });
  expect(read()).toEqual(before);

  const saved = await full.call("update_sequence_step", { ...guard, previewText: "Kurz und knapp",
    replacements: [{ field: "html", find: "Tipp zwei.", replace: "Tipp zwei, der wichtigste." }] });
  expect(saved).toMatchObject({ saved: true, changed: ["previewText", "html"], warnings: [], sequence: { status: "live" },
    step: { id: second.id, position: 1, delayMinutes: 1440, previewText: "Kurz und knapp" } });
  const after = read();
  expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
  expect((saved.sequence as Sequence).updatedAt).toBe(after.updatedAt);
  expect(after.steps[1]).toEqual({ ...second, previewText: "Kurz und knapp", html: "<p>Tipp eins. Tipp zwei, der wichtigste. Tipp drei.</p>" });
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
