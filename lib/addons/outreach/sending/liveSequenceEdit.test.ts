import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { TEST_BASE_URL, createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { requireActiveUserSession } from "@/lib/auth";
import { mintMcpToken } from "@/lib/mcpAuth";
import { authorizeOutbound, OutboundAuthorizationError } from "@/lib/outboundAuthorization";
import { PATCH as editSequenceRoute } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/[sequenceId]/route";
import { POST as setSequenceStatus } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/[sequenceId]/status/route";
import { getOutreachDb, initOutreachSchema } from "../db";
import { getOutreachSettings, saveOutreachSettings } from "../settings";
import { editSequence, editSequenceStep, setSequenceStatus as setSequenceStatusAction, type SendingActor } from "./actions";
import { enroll } from "./queue";
import { OutreachScheduler } from "./scheduler";
import { getSequence, saveSequence } from "./store";
import type { Sequence } from "../types";

/** Editing a live sequence is an approval of what it sends (synthetic data only). */

async function withFlag<T>(run: () => Promise<T>) {
  const previous = process.env.NOCTUA_ADDON_OUTREACH;
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  try { return await run(); } finally {
    if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH;
    else process.env.NOCTUA_ADDON_OUTREACH = previous;
  }
}

async function liveSequence() {
  const accountId = crypto.randomUUID();
  await (await dbModulePromise).upsertAccount(identityTestAccount(accountId));
  const approver = await createAuthenticatedTestSession();
  const editor = await createAuthenticatedTestSession();
  const viewer = await createAuthenticatedTestSession();
  await approver.addMembership(approver.user.id, accountId, "editor");
  await editor.addMembership(editor.user.id, accountId, "editor");
  await viewer.addMembership(viewer.user.id, accountId, "viewer");
  await saveOutreachSettings(accountId, { enabled: true, transport: "mailbox-smtp" }, approver.user.id);
  const db = await getOutreachDb();
  const listId = `${accountId}-list`;
  db.query("INSERT INTO lists (accountId, id, name, createdAt, updatedAt) VALUES (?, ?, 'Newsletter', 0, 0)").run(accountId, listId);
  const base = `${TEST_BASE_URL}/api/addons/outreach/accounts/${accountId}`;
  const request = (who: typeof editor, route: string, method: string, body: unknown) => new Request(`${base}/${route}`, {
    method, headers: who.jar.headers({ origin: TEST_BASE_URL, "content-type": "application/json" }), body: JSON.stringify(body)
  });
  const draft = saveSequence(db, accountId, { name: "Willkommen", triggerListId: listId, steps: [{ subject: "Hallo", text: "Geprüft" }] });
  const at = { params: Promise.resolve({ accountId, sequenceId: draft.id }) };
  const live = await setSequenceStatus(request(approver, `sequences/${draft.id}/status`, "POST",
    { status: "live", expectedUpdatedAt: draft.updatedAt }), at);
  expect(live.status).toBe(200);
  const sequence = getSequence(db, accountId, draft.id);
  expect(sequence).toMatchObject({ status: "live", statusChangedByUserId: approver.user.id, statusChangedVia: "app" });
  const edit = (who: typeof editor, body: unknown) => editSequenceRoute(request(who, `sequences/${draft.id}`, "PATCH", body), at);
  return { accountId, db, listId, approver, editor, viewer, sequence, edit };
}

const changedSteps = (sequence: { steps: { id: string }[] }) => ({ steps: [{ id: sequence.steps[0].id, subject: "Geändert", text: "Neuer Inhalt" }] });

test("an editor's edit of a live sequence records the editor as approver; a viewer is refused", () => withFlag(async () => {
  const { db, accountId, editor, viewer, sequence, edit } = await liveSequence();

  const refused = await edit(viewer, changedSteps(sequence));
  expect(refused.status).toBe(403);
  expect(getSequence(db, accountId, sequence.id)).toEqual(sequence);

  const saved = await edit(editor, changedSteps(sequence));
  expect(saved.status).toBe(200);
  expect(getSequence(db, accountId, sequence.id)).toMatchObject({
    status: "live", statusChangedByUserId: editor.user.id, statusChangedVia: "app",
    steps: [{ subject: "Geändert", text: "Neuer Inhalt" }]
  });
}));

test("an MCP token without the send scope cannot edit a live sequence but can still edit a draft", () => withFlag(async () => {
  const { db, accountId, listId, editor, sequence } = await liveSequence();
  const active = await requireActiveUserSession(new Request(TEST_BASE_URL, { headers: editor.jar.headers() }));
  if (active instanceof Response) throw new Error("Synthetic session missing");
  const { tokenRecord } = await mintMcpToken(active, accountId, "Synthetic token", 3600, { mode: "full" });
  // manage (save_sequence's tool scope) without send
  editor.master.prepare("UPDATE mcp_tokens SET scopes = ? WHERE id = ?").run(JSON.stringify(["read", "drafts", "manage"]), tokenRecord.id);
  const actor = { accountId, authorization: { tokenId: tokenRecord.id }, via: "mcp:Synthetic token" };

  await expect(editSequence(db, actor, sequence.id, changedSteps(sequence))).rejects.toThrow("Token has no send permission");
  expect(getSequence(db, accountId, sequence.id)).toEqual(sequence);
  const draft = saveSequence(db, accountId, { name: "Entwurf", triggerListId: listId, steps: [{ subject: "A", text: "B" }] });
  expect((await editSequence(db, actor, draft.id, { name: "Entwurf 2" })).name).toBe("Entwurf 2");

  editor.master.prepare("UPDATE mcp_tokens SET scopes = ? WHERE id = ?").run(JSON.stringify(["read", "drafts", "manage", "send"]), tokenRecord.id);
  await editSequence(db, actor, sequence.id, changedSteps(sequence), { expectedUpdatedAt: sequence.updatedAt });
  expect(getSequence(db, accountId, sequence.id)).toMatchObject({ statusChangedByUserId: editor.user.id, statusChangedVia: actor.via });
}));

/** Both edit paths (the whole sequence, one step) approve what they change. */
const edits: Array<[string, (db: Database, actor: SendingActor, sequence: Sequence) => Promise<unknown>]> = [
  ["the whole sequence", (db, actor, sequence) => editSequence(db, actor, sequence.id, changedSteps(sequence))],
  ["one step", (db, actor, sequence) => editSequenceStep(db, actor, sequence.id, sequence.steps[0].id, { subject: "Geändert", text: "Neuer Inhalt" }, {})]
];

test.each(edits)("sends of a live sequence edited through %s run under the editor and stop once the editor loses the role", (_path, edit) => withFlag(async () => {
  const { accountId, approver, editor } = await liveSequence();
  // A separate outreach database keeps the scheduler pass to this mailbox.
  const db = new Database(":memory:");
  try {
    initOutreachSchema(db);
    const settings = await getOutreachSettings(accountId);
    db.query("INSERT INTO account_settings (accountId, enabled, sendRatePerMinute, updatedAt) VALUES (?, 1, 0, ?)").run(accountId, settings.updatedAt);
    const listId = "list", contactId = "reader";
    db.query("INSERT INTO lists (accountId, id, name, createdAt, updatedAt) VALUES (?, ?, 'Newsletter', 0, 0)").run(accountId, listId);
    db.query(`INSERT INTO contacts (accountId, id, email, emailLower, emailConsent, consentAt, createdAt, updatedAt)
      VALUES (?, ?, 'reader@example.test', 'reader@example.test', 'subscribed', 1, 0, 0)`).run(accountId, contactId);
    db.query("INSERT INTO list_members (accountId, listId, contactId, status, subscribedAt) VALUES (?, ?, ?, 'subscribed', 1)")
      .run(accountId, listId, contactId);
    const actorOf = (who: typeof editor) => ({ accountId, via: "app", authorization: {
      request: new Request(`${TEST_BASE_URL}/api/addons/outreach/accounts/${accountId}`, { headers: who.jar.headers({ origin: TEST_BASE_URL }) })
    } });
    const draft = saveSequence(db, accountId, { name: "Willkommen", triggerListId: listId, steps: [{ subject: "Hallo", text: "Geprüft" }] });
    const sequence = await setSequenceStatusAction(db, actorOf(approver), draft.id, "live", draft.updatedAt);
    const now = Date.now();
    enroll(db, accountId, { listId, contactId, at: now - 60_000 });
    const attempts: { userId: string; subject: string; outcome: string }[] = [];
    const scheduler = new OutreachScheduler({
      db: async () => db, now: () => now, retention: async () => 0, settings: async () => settings,
      recipients: async () => [],
      // The real send path's authorization step (send.ts), without a transport.
      send: async input => {
        const userId = "scheduledByUserId" in input.authorization ? input.authorization.scheduledByUserId : "";
        try {
          await authorizeOutbound(input.authorization, { accountId, minRole: "editor" });
        } catch (error) {
          if (!(error instanceof OutboundAuthorizationError)) throw error;
          attempts.push({ userId, subject: input.content.subject, outcome: "permission_revoked" });
          return { status: "deferred", reason: "permission_revoked" };
        }
        attempts.push({ userId, subject: input.content.subject, outcome: "sent" });
        return { status: "sent", providerMessageId: "test-provider", messageId: "<test@example.test>", sentAt: now,
          recipients: "reader@example.test", subject: input.content.subject };
      }
    });
    const sends = () => db.query("SELECT userId, status FROM sends WHERE accountId = ? AND sequenceId = ?").all(accountId, sequence.id);

    // Queued under the earlier approver (send rate 0 holds it back), then edited by a collaborator.
    await scheduler.tick();
    expect(sends()).toEqual([{ userId: approver.user.id, status: "queued" }]);
    await edit(db, actorOf(editor), sequence);
    expect(getSequence(db, accountId, sequence.id).statusChangedByUserId).toBe(editor.user.id);

    editor.master.prepare("DELETE FROM user_accounts WHERE userId = ? AND accountId = ?").run(editor.user.id, accountId);
    db.query("UPDATE account_settings SET sendRatePerMinute = 30 WHERE accountId = ?").run(accountId);
    await scheduler.tick();
    // The approver still has the role; the edited content is never sent under it.
    expect(attempts).toEqual([{ userId: editor.user.id, subject: "Geändert", outcome: "permission_revoked" }]);
    expect(sends()).toEqual([{ userId: editor.user.id, status: "queued" }]);
  } finally {
    db.close();
  }
}));
