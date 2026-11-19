import { z } from "zod";
import { EMAIL_CONSENTS, OPT_IN_MODES } from "../types";

export class ContactError extends Error {
  /** `details` are added to the JSON error body (for example `unsubscribedAt`). */
  constructor(message: string, public status = 400, public code?: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export function parseContactInput<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    throw new ContactError(typeof field === "string" && Object.hasOwn(shapeFields, field)
      ? `Invalid ${field}` : "Invalid request");
  }
  return parsed.data;
}

export const idSchema = z.string().trim().min(1).max(128);
export const emailSchema = z.string().trim().max(254).pipe(z.email()).refine(email => email.indexOf("@") <= 64)
  .transform(email => email.toLowerCase());
const nameSchema = z.string().trim().max(200);
const titleSchema = nameSchema.pipe(z.string().min(1));
const consentSourceSchema = z.string().trim().min(1).max(100);
const propertyKeySchema = z.string().min(1).max(100).refine(key => !["__proto__", "constructor", "prototype"].includes(key));
export const propertiesSchema = z.record(propertyKeySchema, z.union([z.string().max(1024), z.number(), z.boolean()]))
  .refine(properties => Object.keys(properties).length <= 50);

export const contactInput = z.strictObject({
  email: emailSchema,
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  properties: propertiesSchema.optional()
});

export const listInput = z.strictObject({
  name: titleSchema,
  description: z.string().trim().max(2000).optional(),
  optIn: z.enum(OPT_IN_MODES).optional()
});

export const subscriptionInput = z.strictObject({
  listId: idSchema,
  action: z.enum(["subscribe", "unsubscribe"]),
  consentSource: consentSourceSchema.optional(),
  confirmResubscribe: z.boolean().optional()
});

export const suppressionInput = z.strictObject({ suppressed: z.boolean() });

export const subscribeInput = contactInput.extend({
  listId: idSchema,
  consentAt: z.number().int().min(0).optional(),
  consentSource: consentSourceSchema.optional()
});

export const tokenInput = z.strictObject({
  name: titleSchema,
  listIds: z.array(idSchema).min(1).max(100).transform(ids => [...new Set(ids)])
});

export const contactFilters = z.strictObject({
  q: z.string().trim().max(254).optional(),
  listId: idSchema.optional(),
  consent: z.enum(EMAIL_CONSENTS).optional(),
  suppressed: z.boolean().optional(),
  page: z.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25)
});

const shapeFields = {
  ...subscribeInput.shape, ...listInput.shape, ...contactFilters.shape, ...tokenInput.shape, ...subscriptionInput.shape
};
