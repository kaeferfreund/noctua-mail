import { z } from "zod";
import type { AccountSettings } from "./data";
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();
export const accountPrefsPatchSchema = z.object({
  layout: nullable(z.object({ defaultView: nullable(z.enum(["card", "table", "compact", "threads"])) }).strict()),
  appearance: nullable(z.object({ dateFormat: nullable(z.enum(["locale", "mdy", "dmy", "ymd"])), topicColorRows: nullable(z.boolean()), senderIcons: nullable(z.boolean()) }).strict()),
  calendar: nullable(z.object({ weekStartsOn: nullable(z.enum(["monday", "sunday"])) }).strict()),
  threading: nullable(z.object({ includeAcrossFolders: nullable(z.boolean()) }).strict()),
  defaultSignatureId: nullable(z.string().max(256)),
  defaultIdentityId: nullable(z.string().min(1).max(256)),
  signatureOverride: nullable(z.string().refine(value => new TextEncoder().encode(value).length <= 8192 &&
    !/\{\{|\}\}/.test(value.replace(/\{\{(?:user\.(?:name|email)|identity\.(?:displayName|email))\}\}/g, "")), "Invalid signature template")),
  notifications: nullable(z.object({ newMail: nullable(z.boolean()) }).strict())
}).strict();
export function stripPersonalSettings(settings: AccountSettings | undefined, teamDefaults: boolean): AccountSettings | undefined {
  if (!settings) return settings;
  const { defaultIdentityId: _identity, signatureOverride: _override, ...sharedSettings } = settings as AccountSettings & { defaultIdentityId?: unknown; signatureOverride?: unknown };
  void _identity; void _override;
  if (teamDefaults) return sharedSettings;
  const { layout: _l, appearance: _a, calendar: _c, threading: _t, defaultSignatureId: _s, notifications: _n, ...team } = sharedSettings;
  void _l; void _a; void _c; void _t; void _s; void _n;
  return team;
}
