import { z } from "zod";
import { CONTENT_FIELDS, type ContentField } from "../types";

export class SendingError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) { super(message); }
}

export function validated<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const field = result.error.issues[0]?.path.join(".");
    throw new SendingError(400, field ? `Ungültiges Feld: ${field}` : "Ungültige Eingabe");
  }
  return result.data;
}

export const itemId = z.string().trim().min(1).max(256);
const name = z.string().trim().min(1).max(250);
/**
 * Longest value of each content field, in characters: checked on input and again on the value as stored, after the
 * placeholders are normalized (`normalizedContent` in `store.ts`), since normalizing can make a value longer.
 */
export const contentLimits: Readonly<Record<ContentField, number>> = { subject: 998, previewText: 998, html: 2_000_000, text: 2_000_000 };
const subject = z.string().max(contentLimits.subject);
const body = z.string().max(contentLimits.html);
const content = { subject: subject.optional(), previewText: subject.optional(), html: body.optional(), text: body.optional() };
export const templateInput = z.object({ name, ...content });
const audience = z.array(itemId).max(500).transform(ids => [...new Set(ids)]);
export const campaignInput = z.object({
  name, ...content, senderIdentityId: itemId.nullable().optional(), templateId: itemId.nullable().optional(),
  listIds: audience.optional(), excludedListIds: audience.optional(),
  trackOpens: z.boolean().optional(), trackClicks: z.boolean().optional()
}).partial();
const stepInput = z.object({
  id: itemId.optional(), name: z.string().trim().max(250).optional(), ...content, templateId: itemId.nullable().optional(),
  delayMinutes: z.number().int().min(0).max(525_600).optional(), enabled: z.boolean().optional()
});
export const sequenceInput = z.object({
  name, triggerListId: itemId.nullable().optional(), senderIdentityId: itemId.nullable().optional(),
  trackOpens: z.boolean().optional(), trackClicks: z.boolean().optional(), steps: z.array(stepInput).max(200).optional()
}).partial();
const version = z.number().int().nonnegative();
/** `expectedUpdatedAt` is the sequence's `updatedAt` the caller read; a token needs it for a sequence that is not a draft. */
export const sequenceEditInput = sequenceInput.extend({ expectedUpdatedAt: version.optional() });
const replacement = z.object({
  field: z.enum(CONTENT_FIELDS), find: z.string().min(1).max(100_000), replace: z.string().max(100_000),
  replaceAll: z.boolean().optional()
});
export const stepEditInput = z.object({
  name: z.string().trim().max(250).optional(), ...content, replacements: z.array(replacement).min(1).max(50).optional(),
  expectedUpdatedAt: version, dryRun: z.boolean().optional()
});
export const renderInput = z.object({ subject, html: body, text: body.optional(), contactId: itemId.optional() });
export const scheduleInput = z.object({ sendAt: z.number().int().nullable(), dryRun: z.boolean().optional(), expectedUpdatedAt: version.optional(),
  expectedContentVersion: z.string().max(128).optional() });
export const statusInput = z.object({ status: z.enum(["live", "paused"]), expectedUpdatedAt: version.optional() });
export const testInput = z.object({ to: z.email().max(254), contactId: itemId.optional() });
