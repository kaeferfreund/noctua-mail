import { expect, test } from "bun:test";
import { createTestAuthHarness } from "@/lib/testAuthHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { persistAccountRow } from "./db/rowParsers";
import { updateMailboxCredentials } from "@/lib/mailboxCredentials";
for (const [name, body] of [["unsupported placeholder", "{{user.title}}"], ["more than 8 KiB", "é".repeat(4097)]]) {
  test(`P2-C shared settings save rejects ${name}`, async () => {
    const f = await createTestAuthHarness();
    try {
      const user = await f.createUser(`manager-${crypto.randomUUID()}@example.test`);
      persistAccountRow(f.master, identityTestAccount("a", user.id));
      const result = await updateMailboxCredentials("a", {
        settings: { signatures: [{ id: "bad", name: "Synthetic invalid", body }], defaultSignatureId: "bad" }, teamDefaults: true
      }, { userId: user.id }, undefined, f.master).then(saved => ({ saved, error: null }), error => ({ saved: null, error }));
      expect(result.error).toMatchObject({ code: "signature_template_invalid", status: 400 });
    } finally { f.close(); }
  });
}

// Exercise the actual authenticated route as well as its settings-write service.
import { createAuthenticatedTestSession, TEST_BASE_URL } from "@/lib/testAuthHarness";
import { PUT as saveSettings } from "@/app/api/accounts/[accountId]/settings/route";
import { POST as createIdentity } from "@/app/api/accounts/[accountId]/identities/route";

test("P2-C authenticated shared signature route rejects unsupported placeholders", async () => {
  const f = await createAuthenticatedTestSession();
  const accountId = `probe-${crypto.randomUUID()}`;
  persistAccountRow(f.master, identityTestAccount(accountId, f.user.id));
  const response = await saveSettings(new Request(`${TEST_BASE_URL}/api/accounts/${accountId}/settings`, {
    method: "PUT", headers: f.jar.headers({origin:TEST_BASE_URL,"content-type":"application/json"}),
    body: JSON.stringify({settings:{signatures:[{id:"bad",name:"Synthetic invalid",body:"{{user.title}}"}], defaultSignatureId:"bad"},teamDefaults:true})
  }), {params:Promise.resolve({accountId})});
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "signature_template_invalid", placeholder: "{{user.title}}" });
});

test("server identity validation rejects display-name controls and Reply-To lists", async () => {
  const f = await createAuthenticatedTestSession();
  const accountId = `probe-${crypto.randomUUID()}`;
  persistAccountRow(f.master, identityTestAccount(accountId, f.user.id));
  for (const input of [
    {email:"alias@example.test",displayName:"Synthetic\r\nBcc: other@example.test"},
    {email:"alias@example.test",displayName:"Synthetic\u0001name"},
    {email:"alias@example.test",displayName:"Synthetic name",replyTo:"one@example.test,two@example.test"}
  ]) {
    const response = await createIdentity(new Request(`${TEST_BASE_URL}/api/accounts/${accountId}/identities`, {
      method:"POST",headers:f.jar.headers({origin:TEST_BASE_URL,"content-type":"application/json"}),body:JSON.stringify(input)
    }),{params:Promise.resolve({accountId})});
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({code:"invalid_identity"});
  }
});

// A pre-migration database may already contain a template the new validator rejects.
// Unrelated settings remain writable; consumption warns without mutating storage.
import { renderSignatureTemplate, resolveSignatureTemplate } from "./signatureTemplates";
for (const body of ["Legacy {{user.title}} / {{user.name}}", "é".repeat(4097)]) test("P2-C migration-safe stored invalid template remains usable: " + (body.startsWith("Legacy") ? "placeholder" : "UTF-8 size"), async () => {
  const f = await createTestAuthHarness();
  try {
    const user = await f.createUser(`legacy-${crypto.randomUUID()}@example.test`);
    const account = identityTestAccount("legacy", user.id);
    account.settings = { signatures: [{ id: "legacy", name: "Synthetic legacy", body }], defaultSignatureId: "legacy" };
    persistAccountRow(f.master, account);
    const saved = await updateMailboxCredentials("legacy", { settings: { threading: { includeAcrossFolders: true } } }, { userId: user.id }, undefined, f.master);
    expect(saved.settings?.signatures?.[0].body).toBe(body);
    const resolved = resolveSignatureTemplate(saved.settings, {});
    expect(resolved.warnings).toHaveLength(1);
    const rendered = renderSignatureTemplate(resolved.body, { name: "Synthetic Alex", email: "alex@example.test" });
    expect(rendered.text).not.toContain("{{user.title}}");
    expect(new TextEncoder().encode(resolved.body).length).toBeLessThanOrEqual(8192);
    if (body.startsWith("Legacy")) expect(rendered.text).toContain("Synthetic Alex");
  } finally { f.close(); }
});
