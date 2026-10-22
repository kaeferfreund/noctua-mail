import { test, expect } from "bun:test";
import { accountPrefsPatchSchema, stripPersonalSettings } from "./accountPrefs";
import type { AccountSettings } from "./data";
test("identity prefs validate sparse null/empty and bounded supported personal templates", () => {
  expect(accountPrefsPatchSchema.safeParse({ defaultIdentityId: null, signatureOverride: "", defaultSignatureId: "" }).success).toBe(true);
  for (const patch of [{ defaultIdentityId: "" }, { signatureOverride: "é".repeat(4097) }, { signatureOverride: "{{unknown.token}}" }, { signatureOverride: "{{user.name" }]) {
    expect(accountPrefsPatchSchema.safeParse(patch).success).toBe(false);
  }
  expect(accountPrefsPatchSchema.safeParse({ signatureOverride: "{{user.name}} {{user.email}} {{identity.displayName}} {{identity.email}}" }).success).toBe(true);
  const leaked = { defaultIdentityId: "private", signatureOverride: "private", signatures: [] } as AccountSettings;
  for (const teamDefaults of [true, false]) expect(stripPersonalSettings(leaked, teamDefaults)).toEqual({ signatures: [] });
});
