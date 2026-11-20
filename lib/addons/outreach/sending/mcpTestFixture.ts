import { TEST_BASE_URL, createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { requireActiveUserSession } from "@/lib/auth";
import { mintMcpToken } from "@/lib/mcpAuth";
import type { McpPermissionMode } from "@/lib/mcpPermissions";
import { executeMcpHttpRequest } from "@/lib/mcpServer";
import { getOutreachDb } from "../db";
import { saveOutreachSettings } from "../settings";
import { saveCampaign, saveSequence } from "./store";

export async function withOutreachFlag<T>(run: () => Promise<T>) {
  const previous = process.env.NOCTUA_ADDON_OUTREACH;
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  try { return await run(); } finally {
    if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH;
    else process.env.NOCTUA_ADDON_OUTREACH = previous;
  }
}

/** A mailbox with the addon on, one list with one subscribed reader, a campaign draft and a sequence draft (synthetic data only). */
export async function outreachMailbox() {
  const accountId = crypto.randomUUID();
  await (await dbModulePromise).upsertAccount(identityTestAccount(accountId));
  const editor = await createAuthenticatedTestSession(accountId);
  await saveOutreachSettings(accountId, { enabled: true, transport: "mailbox-smtp" }, editor.user.id);
  const db = await getOutreachDb();
  const listId = `${accountId}-list`;
  const readerId = `${accountId}-reader`;
  db.query("INSERT INTO lists (accountId, id, name, createdAt, updatedAt) VALUES (?, ?, 'Newsletter', 0, 0)").run(accountId, listId);
  db.query(`INSERT INTO contacts (accountId, id, email, emailLower, emailConsent, consentAt, createdAt, updatedAt)
    VALUES (?, ?, 'reader@example.test', 'reader@example.test', 'subscribed', 1, 0, 0)`).run(accountId, readerId);
  db.query("INSERT INTO list_members (accountId, listId, contactId, status, subscribedAt) VALUES (?, ?, ?, 'subscribed', 1)")
    .run(accountId, listId, readerId);
  const campaign = saveCampaign(db, accountId, editor.user.id, { name: "Rundbrief", subject: "Betreff", html: "<p>Hallo</p>", listIds: [listId] });
  const sequence = saveSequence(db, accountId, { name: "Willkommen", triggerListId: listId, steps: [{ subject: "Schritt", text: "Hallo" }] });
  return { accountId, editor, db, listId, readerId, campaign, sequence };
}

type ToolOutcome = { isError?: boolean; content: Array<{ text?: string }>; structuredContent: Record<string, unknown> };

/** An MCP token of the mailbox's editor in the given mode, with the real server behind `call`, `refusal` and `tools`. */
export async function mcpToken({ accountId, editor }: Pick<Awaited<ReturnType<typeof outreachMailbox>>, "accountId" | "editor">,
  mode: McpPermissionMode, label = "Assistent") {
  const session = await requireActiveUserSession(new Request(TEST_BASE_URL, { headers: editor.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session missing");
  const { tokenRecord } = await mintMcpToken(session, accountId, label, 3600, { mode, accountIds: [accountId] });
  const request = async (method: string, params: Record<string, unknown>) => {
    const response = await executeMcpHttpRequest({ body: { jsonrpc: "2.0", id: 1, method, params },
      accountId, account: identityTestAccount(accountId), tokenRecord,
      authInfo: { token: "", clientId: "synthetic", scopes: ["send", "manage"], extra: { userId: "untrusted-synthetic" } } });
    return response.responses[0] as unknown as { result?: Record<string, unknown>; error?: { message: string } };
  };
  const outcome = async (name: string, args: Record<string, unknown>) => {
    const response = await request("tools/call", { name, arguments: { accountId, ...args } });
    return response.result as ToolOutcome | undefined ?? { isError: true, content: [{ text: response.error?.message }], structuredContent: {} };
  };
  return {
    tokenRecord,
    /** The tool's structured answer; throws when the tool refuses. */
    async call(name: string, args: Record<string, unknown> = {}) {
      const result = await outcome(name, args);
      if (result.isError) throw new Error(JSON.stringify(result.content));
      return result.structuredContent;
    },
    /** The message of a refused call; throws when the tool answers. */
    async refusal(name: string, args: Record<string, unknown> = {}) {
      const result = await outcome(name, args);
      if (!result.isError) throw new Error(`${name} was not refused`);
      return result.content.map(part => part.text ?? "").join(" ");
    },
    async tools() {
      return (((await request("tools/list", {})).result?.tools ?? []) as Array<{ name: string }>).map(tool => tool.name);
    }
  };
}
