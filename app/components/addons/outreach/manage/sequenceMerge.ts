/** A step while it is edited: `key` identifies it in the UI, `id` only once the server stored it. */
export type StepForm = { key: string; id?: string; delayMinutes: number; name: string; subject: string; previewText: string; templateId: string | null; html: string; text: string; enabled: boolean };
export type SequenceForm = { name: string; triggerListId: string | null; senderIdentityId: string | null; trackOpens: boolean; trackClicks: boolean; steps: StepForm[] };

export const SEQUENCE_FIELDS = ["name", "triggerListId", "senderIdentityId", "trackOpens", "trackClicks"] as const;
export const STEP_FIELDS = ["name", "delayMinutes", "subject", "previewText", "templateId", "html", "text", "enabled"] as const;

/** A field changed in the form and, to another value, in the stored version; the merge kept the form's value. */
export type MergeConflict =
  | { stepIndex: null; field: (typeof SEQUENCE_FIELDS)[number] }
  | { stepIndex: number; field: (typeof STEP_FIELDS)[number] };

export type SequenceMerge =
  | { ok: true; form: SequenceForm; conflicts: MergeConflict[] }
  /** Steps were added, removed or moved in the stored version: no field can be matched safely. */
  | { ok: false; reason: "structureChanged" };

/** Three-way pick: an unchanged field takes theirs, a changed one keeps mine; both changed (differently) is a conflict. */
function pick<T>(base: T, mine: T, theirs: T): { value: T; conflict: boolean } {
  if (mine === base) return { value: theirs, conflict: false };
  return { value: mine, conflict: theirs !== base && theirs !== mine };
}

/**
 * Merges the form (`mine`) onto a version stored elsewhere since it was loaded (`theirs`), both measured
 * against what the form was loaded from (`base`). Steps are matched by id. Steps added, removed or moved in
 * the form stay as long as the stored version kept the base's step ids in the base's order.
 */
export function mergeSequenceForm(base: SequenceForm, mine: SequenceForm, theirs: SequenceForm): SequenceMerge {
  const ids = (form: SequenceForm) => form.steps.map(step => step.id ?? "").join("\n");
  if (ids(theirs) !== ids(base)) return { ok: false, reason: "structureChanged" };
  const conflicts: MergeConflict[] = [];
  const merged = { ...mine };
  for (const field of SEQUENCE_FIELDS) {
    const result = pick<SequenceForm[typeof field]>(base[field], mine[field], theirs[field]);
    (merged as Record<string, unknown>)[field] = result.value;
    if (result.conflict) conflicts.push({ stepIndex: null, field });
  }
  merged.steps = mine.steps.map((step, stepIndex) => {
    const baseStep = step.id ? base.steps.find(entry => entry.id === step.id) : undefined;
    const theirStep = step.id ? theirs.steps.find(entry => entry.id === step.id) : undefined;
    // A step added in the form has nothing to merge with.
    if (!baseStep || !theirStep) return step;
    const next = { ...step };
    for (const field of STEP_FIELDS) {
      const result = pick<StepForm[typeof field]>(baseStep[field], step[field], theirStep[field]);
      (next as Record<string, unknown>)[field] = result.value;
      if (result.conflict) conflicts.push({ stepIndex, field });
    }
    return next;
  });
  return { ok: true, form: merged, conflicts };
}
