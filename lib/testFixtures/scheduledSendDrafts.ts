import { dbModulePromise } from "../testDbHarness";
import { createAuthenticatedTestSession } from "../testAuthHarness";
import { identityTestAccount } from "./senderIdentities";
import { buildImapMessageRowId } from "../messageIds";
import { saveMessageSource } from "../storage";
import type { Account } from "../data";

export const SCHEDULED_SEND_TEST_ORIGIN = "http://localhost:3000";

/** A synthetic mailbox with Drafts folder, an MFA session and sendable drafts (scheduled-send route tests). */
export async function createScheduledSendFixture(overrides: Partial<Account> = {}) {
  const db = await dbModulePromise;
  const accountId = `scheduled-route-${crypto.randomUUID()}`;
  await db.upsertAccount({ ...identityTestAccount(accountId), ...overrides });
  await db.saveFoldersForAccount(accountId, ["INBOX", "Drafts"].map(name => ({ id: `${accountId}:${name}`, accountId, name, count: 0,
    specialUse: name === "INBOX" ? "\\Inbox" : "\\Drafts" })));
  const auth = await createAuthenticatedTestSession(accountId);
  const [identity] = await db.listSenderIdentities(accountId);
  const seedDraft = async (overrides: Record<string, unknown> = {}, extraHeaders: string[] = []) => {
    const messageId = `<synthetic-${crypto.randomUUID()}@example.test>`;
    const id = buildImapMessageRowId(messageId);
    const from = `${identity.displayName} <${identity.email}>`;
    const raw = [`From: ${from}`, "To: recipient@example.test", `Message-ID: ${messageId}`, `X-Noctua-Identity-Id: ${identity.id}`,
      ...extraHeaders, "Subject: Synthetic planned", "", "Synthetic body"].join("\r\n");
    // No mailboxPath/imapUid by default: discarding then never contacts an IMAP server.
    await db.upsertMessages(accountId, null, [{ id, messageId, threadId: messageId, accountId, folderId: `${accountId}:Drafts`, from,
      to: "recipient@example.test", subject: "Synthetic planned", body: "Synthetic body", preview: "", date: new Date().toISOString(),
      dateValue: Date.now(), flags: ["\\Draft"], senderIdentityId: identity.id, source: raw, ...overrides }]);
    await saveMessageSource(accountId, id, raw);
    return id;
  };
  const request = (method: string, body?: unknown, headers: Record<string, string> = {}, session = auth, path = "/drafts/scheduled") =>
    new Request(`${SCHEDULED_SEND_TEST_ORIGIN}/api/accounts/${accountId}${path}`, {
      method, headers: session.jar.headers({ origin: SCHEDULED_SEND_TEST_ORIGIN, "content-type": "application/json", ...headers }),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  const params = (extra: Record<string, string> = {}) => ({ params: Promise.resolve({ accountId, ...extra }) });
  return { ...auth, db, accountId, identity, seedDraft, request, params };
}
