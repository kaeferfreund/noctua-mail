import { describe, expect, it } from "bun:test";
import { mergeSequenceForm, type SequenceForm, type StepForm } from "./sequenceMerge";

const step = (id: string, patch: Partial<StepForm> = {}): StepForm => ({
  key: id, id, delayMinutes: 1440, name: `Schritt ${id}`, subject: `Betreff ${id}`, previewText: "", templateId: null, html: "<p>Hallo</p>", text: "", enabled: true, ...patch
});
const BASE: SequenceForm = {
  name: "Willkommen", triggerListId: "list-news", senderIdentityId: null, trackOpens: true, trackClicks: true,
  steps: [step("s1", { delayMinutes: 0 }), step("s2"), step("s3")]
};
const withStep = (form: SequenceForm, id: string, patch: Partial<StepForm>): SequenceForm =>
  ({ ...form, steps: form.steps.map(entry => entry.id === id ? { ...entry, ...patch } : entry) });
const merge = (mine: SequenceForm, theirs: SequenceForm) => {
  const result = mergeSequenceForm(BASE, mine, theirs);
  if (!result.ok) throw new Error("expected a merge");
  return result;
};

describe("mergeSequenceForm", () => {
  it("takes their value for a field I did not change", () => {
    const result = merge(BASE, { ...withStep(BASE, "s2", { subject: "Neu von MCP" }), trackClicks: false });
    expect(result.form.steps[1].subject).toBe("Neu von MCP");
    expect(result.form.trackClicks).toBe(false);
    expect(result.conflicts).toEqual([]);
  });

  it("keeps my value for a field I changed and theirs for another field", () => {
    const mine = { ...withStep(BASE, "s1", { name: "Begrüßung" }), name: "Willkommen neu" };
    const theirs = withStep(BASE, "s3", { html: "<p>Anders</p>" });
    const result = merge(mine, theirs);
    expect(result.form.name).toBe("Willkommen neu");
    expect(result.form.steps[0].name).toBe("Begrüßung");
    expect(result.form.steps[2].html).toBe("<p>Anders</p>");
    expect(result.conflicts).toEqual([]);
  });

  it("keeps mine for a field changed on both sides and lists it", () => {
    const mine = { ...withStep(BASE, "s2", { subject: "Meiner", delayMinutes: 60 }), senderIdentityId: "id-1" };
    const theirs = { ...withStep(BASE, "s2", { subject: "Deiner", delayMinutes: 60 }), senderIdentityId: "id-2" };
    const result = merge(mine, theirs);
    expect(result.form.steps[1].subject).toBe("Meiner");
    expect(result.form.senderIdentityId).toBe("id-1");
    // The same change on both sides is no conflict.
    expect(result.form.steps[1].delayMinutes).toBe(60);
    expect(result.conflicts).toEqual([{ stepIndex: null, field: "senderIdentityId" }, { stepIndex: 1, field: "subject" }]);
  });

  it("keeps steps I added, removed and moved while their step list is unchanged", () => {
    const added: StepForm = { ...step("x"), key: "new:1", id: undefined, name: "Nachfass" };
    // Mine: s3 first, s1 removed, a new step at the end; s2 edited by them.
    const mine: SequenceForm = { ...BASE, steps: [BASE.steps[2], BASE.steps[1], added] };
    const theirs = withStep(BASE, "s2", { name: "Tipps neu" });
    const result = merge(mine, theirs);
    expect(result.form.steps.map(entry => entry.id ?? entry.key)).toEqual(["s3", "s2", "new:1"]);
    expect(result.form.steps[1].name).toBe("Tipps neu");
    expect(result.form.steps[2]).toEqual(added);
    // Theirs changed a step I removed: it stays removed.
    expect(mergeSequenceForm(BASE, mine, withStep(BASE, "s1", { subject: "Weg" }))).toMatchObject({ ok: true, form: { steps: [{ id: "s3" }, { id: "s2" }, { key: "new:1" }] } });
  });

  it("reports a changed structure when they added, removed or moved a step", () => {
    const mine = withStep(BASE, "s1", { subject: "Meiner" });
    const added = { ...BASE, steps: [...BASE.steps, step("s4")] };
    const removed = { ...BASE, steps: BASE.steps.slice(1) };
    const moved = { ...BASE, steps: [BASE.steps[1], BASE.steps[0], BASE.steps[2]] };
    for (const theirs of [added, removed, moved]) {
      expect(mergeSequenceForm(BASE, mine, theirs)).toEqual({ ok: false, reason: "structureChanged" });
    }
  });
});
