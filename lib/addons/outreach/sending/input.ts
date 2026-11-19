import { z } from "zod";

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
const subject = z.string().max(998);
const body = z.string().max(2_000_000);
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
export const renderInput = z.object({ subject, html: body, text: body.optional(), contactId: itemId.optional() });
export const scheduleInput = z.object({ sendAt: z.number().int().nullable(), dryRun: z.boolean().optional() });
export const statusInput = z.object({ status: z.enum(["live", "paused"]) });
export const testInput = z.object({ to: z.email().max(254), contactId: itemId.optional() });
