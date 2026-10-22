import { z } from "zod";
import type { AccountSettings } from "./data";
import { canonicalizeMailboxAddress } from "./senderIdentity";
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();
const senderKeySchema = z.string().transform((value, context) => {
  const key = canonicalizeMailboxAddress(value);
  if (key) return key;
  context.addIssue({ code: "custom", message: "Invalid sender mailbox" });
  return z.NEVER;
});
export const accountPrefsPatchSchema = z.object({
  layout: nullable(z.object({ defaultView: nullable(z.enum(["card", "table", "compact", "threads"])) }).strict()),
  appearance: nullable(z.object({ dateFormat: nullable(z.enum(["locale", "mdy", "dmy", "ymd"])), topicColorRows: nullable(z.boolean()), senderIcons: nullable(z.boolean()) }).strict()),
  calendar: nullable(z.object({ weekStartsOn: nullable(z.enum(["monday", "sunday"])) }).strict()),
  threading: nullable(z.object({ includeAcrossFolders: nullable(z.boolean()) }).strict()),
  defaultSignatureId: nullable(z.string().max(256)),
  remoteContent: nullable(z.object({ allowedSenders: nullable(z.record(senderKeySchema, z.boolean())) }).strict()),
  notifications: nullable(z.object({ newMail: nullable(z.boolean()) }).strict())
}).strict();
export function stripPersonalSettings(settings: AccountSettings | undefined, teamDefaults: boolean): AccountSettings | undefined {
  if (!settings || teamDefaults) return settings;
  const { layout: _l, appearance: _a, calendar: _c, threading: _t, defaultSignatureId: _s, notifications: _n, ...team } = settings;
  void _l; void _a; void _c; void _t; void _s; void _n;
  return team;
}
