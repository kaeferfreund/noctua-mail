import { z } from "zod";

export const saveDraftSchema = z.object({
  accountId: z.string().optional(),
  identityId: z.string().min(1).max(256).optional(),
  draftId: z.string().min(1).nullable().optional(),
  to: z.string(), cc: z.string().optional(), bcc: z.string().optional(),
  subject: z.string(), text: z.string(), markdown: z.string().optional(), html: z.string().optional(),
  composeFormat: z.string().optional(), quotedHtmlEdited: z.boolean().optional(),
  inReplyTo: z.string().optional(), references: z.array(z.string()).optional(), xForwardedMessageId: z.string().optional(),
  invite: z.object({ start: z.string(), end: z.string(), allDay: z.boolean(), location: z.string().optional(), recurrenceRule: z.string().optional() }).strict().optional(),
  attachments: z.array(z.object({ id: z.string().optional(), size: z.number().optional(), url: z.string().optional(),
    loadStatus: z.enum(["loading", "error"]).optional(), filename: z.string(), contentType: z.string(), inline: z.boolean().optional(), cid: z.string().optional(), dataUrl: z.string().optional() }).strict()).optional()
}).strict();
