import { beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "./testDbHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { requireActiveUserSession } from "./auth";
import { mintMcpToken } from "./mcpAuth";
import { executeMcpHttpRequest, mailboxErrorCode } from "./mcpServer";
import { createSenderIdentity } from "./senderIdentities";
import { MailboxCredentialError } from "./mailboxCredentials";
import { saveSignatureTemplate } from "./signatureTemplateStore";
import { GET } from "../app/api/accounts/route";
import { parseDeepLink } from "./navigation/deepLinks";

const accountId = `mcp-signatures-${crypto.randomUUID()}`;
const account = identityTestAccount(accountId);
let fixture: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
let tokenRecord: Awaited<ReturnType<typeof mintMcpToken>>["tokenRecord"];
beforeAll(async () => {
  const db = await dbModulePromise;
  await db.upsertAccount(account);
  fixture = await createAuthenticatedTestSession(accountId);
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: fixture.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session missing");
  tokenRecord = (await mintMcpToken(session, accountId, "Synthetic full token", 3600, { mode: "full" })).tokenRecord;
});

type ToolResult = { isError?: boolean; content: { text: string }[]; structuredContent?: Record<string, unknown> & {
  signatures?: { id: string; name: string; body: string }[]; defaultSignatureId?: string; signature?: { id: string } } };
const tool = async (name: string, args: Record<string, unknown> = {}) => {
  // These cases exercise signatures and roles independently of the per-token call budget.
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: fixture.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session missing");
  const membership = fixture.master.prepare("SELECT role FROM user_accounts WHERE userId=? AND accountId=?").get(fixture.user.id, accountId) as { role: string };
  const callToken = membership.role === "viewer" ? tokenRecord :
    (await mintMcpToken(session, accountId, "Synthetic signature call", 3600, { mode: "full" })).tokenRecord;
  const response = await executeMcpHttpRequest({ body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, accountId, account, tokenRecord: callToken,
    authInfo: { token: "", clientId: "synthetic", scopes: ["manage"], extra: { userId: fixture.user.id } } });
  return (response.responses[0] as unknown as { result: ToolResult }).result;
};
const setRole = (role: string) => fixture.master.prepare("UPDATE user_accounts SET role=? WHERE userId=? AND accountId=?").run(role, fixture.user.id, accountId);
const uiSettings = async () => {
  const response = await GET(new Request("http://localhost:3000/api/accounts", { headers: fixture.jar.headers() }));
  return ((await response.json()) as { id: string; settings?: { signatures?: { id: string; name: string; body: string }[]; defaultSignatureId?: string } }[])
    .find(item => item.id === accountId)?.settings;
};

test("viewers list templates; editors cannot change them; managers save, set the default and delete", async () => {
  const created = await tool("save_signature_template", { name: "Team", body: "Regards\n{{user.name}} · {{identity.email}}" });
  expect(created.isError).not.toBe(true);
  const id = created.structuredContent!.signature!.id;
  const signaturesUrl = created.structuredContent!.url as string;
  expect(parseDeepLink(new URL(signaturesUrl).search)).toMatchObject({ accountId, settings: "signatures" });
  expect(created.content[0].text).toContain(`Open in Noctua Mail: ${signaturesUrl}`);
  expect(created.structuredContent!.signatures).toEqual([{ id, name: "Team", body: "Regards\n{{user.name}} · {{identity.email}}" }]);

  setRole("viewer");
  try {
    expect((await tool("list_signature_templates")).structuredContent).toMatchObject({ ok: true, signatures: [{ id, name: "Team" }] });
    setRole("editor");
    for (const [name, args] of [["save_signature_template", { name: "Editor", body: "x" }], ["delete_signature_template", { signatureId: id }],
      ["set_default_signature_template", { signatureId: id }]] as const) {
      const result = await tool(name, args);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Insufficient mailbox role");
    }
  } finally { setRole("manager"); }
  expect((await uiSettings())?.signatures).toEqual([{ id, name: "Team", body: "Regards\n{{user.name}} · {{identity.email}}" }]);

  const updated = await tool("save_signature_template", { signatureId: id, name: "Team", body: "Best\n{{user.email}}" });
  expect(updated.structuredContent!.signatures).toEqual([{ id, name: "Team", body: "Best\n{{user.email}}" }]);
  expect((await tool("save_signature_template", { signatureId: "missing", name: "X", body: "x" })).structuredContent).toMatchObject({ ok: false, code: "signature_not_found" });

  expect((await tool("set_default_signature_template", { signatureId: id })).structuredContent).toMatchObject({ ok: true, defaultSignatureId: id });
  expect((await uiSettings())?.defaultSignatureId).toBe(id);
  for (const signatureId of ["", "   "]) {
    expect((await tool("set_default_signature_template", { signatureId })).isError).toBe(true);
    expect((await uiSettings())?.defaultSignatureId).toBe(id);
  }
  expect((await tool("set_default_signature_template", { signatureId: null })).structuredContent!.defaultSignatureId).toBeUndefined();
  expect((await uiSettings())?.defaultSignatureId).toBe("");
  expect((await tool("set_default_signature_template", { signatureId: "missing" })).structuredContent).toMatchObject({ ok: false, code: "signature_not_found" });

  await tool("set_default_signature_template", { signatureId: id });
  const deleted = await tool("delete_signature_template", { signatureId: id });
  expect(deleted.structuredContent).toMatchObject({ ok: true, signatures: [] });
  expect(deleted.structuredContent!.defaultSignatureId).toBeUndefined();
  expect(await uiSettings()).toMatchObject({ signatures: [], defaultSignatureId: "" });
}, 20000);

test("invalid placeholders and in-use templates surface as tool errors and change nothing", async () => {
  const invalid = await tool("save_signature_template", { name: "Broken", body: "Hi {{user.phone}}" });
  expect(invalid.isError).toBe(true);
  expect(invalid.structuredContent).toMatchObject({ ok: false, code: "signature_template_invalid" });
  expect(invalid.content[0].text).toContain("{{user.phone}}");
  expect((await tool("save_signature_template", { name: "Large", body: "x".repeat(8193) })).structuredContent).toMatchObject({ ok: false, code: "signature_template_invalid" });

  const id = (await tool("save_signature_template", { name: "Used", body: "{{identity.displayName}}" })).structuredContent!.signature!.id;
  await createSenderIdentity(accountId, { email: "alias@example.test", displayName: "Alias", signatureId: id }, { userId: fixture.user.id }, fixture.master);
  const inUse = await tool("delete_signature_template", { signatureId: id });
  expect(inUse.isError).toBe(true);
  expect(inUse.structuredContent).toMatchObject({ ok: false, code: "signature_in_use" });
  expect((await tool("list_signature_templates")).structuredContent!.signatures!.map(item => item.id)).toContain(id);
  expect((await uiSettings())?.signatures?.map(item => item.id)).toContain(id);
}, 20000);

test("a concurrent mailbox change is reported as a retryable conflict, not a rejection", async () => {
  const before = (await tool("list_signature_templates")).structuredContent!.signatures!.length;
  // The authorize hook runs after the row snapshot; changing the row there mimics a concurrent settings save.
  const bump = { assertCurrent: () => { fixture.master.prepare("UPDATE accounts SET name=? WHERE id=?").run(`Renamed ${Date.now()}`, accountId); } };
  const attempt = saveSignatureTemplate(accountId, { name: "Raced", body: "Hi" }, { userId: fixture.user.id, beforeWrite: async () => bump as never });
  await expect(attempt).rejects.toBeInstanceOf(MailboxCredentialError);
  await expect(attempt).rejects.toMatchObject({ status: 409 });
  expect(mailboxErrorCode(409)).toBe("mailbox_conflict");
  expect(mailboxErrorCode(404)).toBe("account_not_found");
  expect(mailboxErrorCode(403)).toBe("forbidden");
  expect(mailboxErrorCode(400)).toBe("mailbox_update_rejected");
  expect((await tool("list_signature_templates")).structuredContent!.signatures!.length).toBe(before);
}, 20000);

test("result links use the canonical BETTER_AUTH_URL origin", async () => {
  const previous = { url: process.env.BETTER_AUTH_URL, rpId: process.env.PASSKEY_RP_ID };
  process.env.BETTER_AUTH_URL = "https://mail.example.test";
  process.env.PASSKEY_RP_ID = "mail.example.test";
  try {
    const listed = await tool("list_signature_templates");
    expect(listed.structuredContent!.url).toBe(`https://mail.example.test/?a=%7E${accountId}&settings=signatures`);
    expect((await tool("list_sender_identities")).structuredContent!.url).toStartWith("https://mail.example.test/?");
  } finally {
    process.env.BETTER_AUTH_URL = previous.url;
    process.env.PASSKEY_RP_ID = previous.rpId;
  }
});
