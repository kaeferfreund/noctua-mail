import { describe, expect, test } from "bun:test";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { buildImapMessageRowId } from "@/lib/messageIds";
import { COMPOSE_INVITE_HEADER, encodeComposeInviteHeader } from "@/lib/composeInviteMetadata";
import { saveMessageSource } from "@/lib/storage";
import { claimDueScheduledSends, getScheduledSend } from "@/lib/db";
import { SCHEDULED_SEND_MAX_AHEAD_MS } from "@/lib/scheduledSend";
import { GET, POST } from "./route";
import { POST as cancel } from "./[scheduleId]/cancel/route";
import { POST as discard } from "../[draftId]/discard/route";
import { POST as sendNow } from "../[draftId]/send/route";

const ORIGIN = "http://localhost:3000";

async function fixture() {
  const db = await dbModulePromise;
  const accountId = `scheduled-route-${crypto.randomUUID()}`;
  await db.upsertAccount(identityTestAccount(accountId));
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
    // No mailboxPath/imapUid: the discard route then never contacts an IMAP server.
    await db.upsertMessages(accountId, null, [{ id, messageId, threadId: messageId, accountId, folderId: `${accountId}:Drafts`, from,
      to: "recipient@example.test", subject: "Synthetic planned", body: "Synthetic body", preview: "", date: new Date().toISOString(),
      dateValue: Date.now(), flags: ["\\Draft"], senderIdentityId: identity.id, source: raw, ...overrides }]);
    await saveMessageSource(accountId, id, raw);
    return id;
  };
  const request = (method: string, body?: unknown, headers: Record<string, string> = {}, session = auth) =>
    new Request(`${ORIGIN}/api/accounts/${accountId}/drafts/scheduled`, {
      method, headers: session.jar.headers({ origin: ORIGIN, "content-type": "application/json", ...headers }),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  const params = (extra: Record<string, string> = {}) => ({ params: Promise.resolve({ accountId, ...extra }) });
  return { ...auth, db, accountId, seedDraft, request, params };
}

describe("scheduled send routes", () => {
  test("viewer is forbidden; member (editor) and manager schedule, list and cancel", async () => {
    const f = await fixture();
    const draftId = await f.seedDraft();
    const sendAt = Date.now() + 3_600_000;
    expect((await GET(new Request(ORIGIN), f.params())).status).toBe(401);
    await f.db.setUserAccountRole(f.user.id, f.accountId, "viewer", f.user.id);
    expect((await GET(f.request("GET"), f.params())).status).toBe(403);
    expect((await POST(f.request("POST", { draftId, sendAt }), f.params())).status).toBe(403);
    expect((await cancel(f.request("POST"), f.params({ scheduleId: "unknown" }))).status).toBe(403);
    for (const role of ["editor", "manager"] as const) {
      await f.db.setUserAccountRole(f.user.id, f.accountId, role, f.user.id);
      const created = await POST(f.request("POST", { draftId, sendAt }), f.params());
      expect(created.status).toBe(201);
      const { scheduledSend } = await created.json();
      expect(scheduledSend).toMatchObject({ draftId, sendAt, status: "queued", attempts: 0, scheduledByUserId: f.user.id });
      expect(scheduledSend.leaseOwner).toBeUndefined();
      const listed = await (await GET(f.request("GET"), f.params())).json();
      expect(listed.scheduledSends.map((row: { id: string }) => row.id)).toEqual([scheduledSend.id]);
      const cancelled = await cancel(f.request("POST"), f.params({ scheduleId: scheduledSend.id }));
      expect(cancelled.status).toBe(200);
      expect(await cancelled.json()).toEqual({ ok: true, draftId });
      expect((await cancel(f.request("POST"), f.params({ scheduleId: scheduledSend.id }))).status).toBe(404);
    }
    // A schedule of another mailbox is not addressable through this one.
    const other = await fixture();
    const foreign = await (await POST(other.request("POST", { draftId: await other.seedDraft(), sendAt }), other.params())).json();
    expect((await cancel(f.request("POST"), f.params({ scheduleId: foreign.scheduledSend.id }))).status).toBe(404);
  });

  test("validates origin, sendAt and the draft like a send", async () => {
    const f = await fixture();
    const draftId = await f.seedDraft();
    const future = Date.now() + 3_600_000;
    expect((await POST(f.request("POST", { draftId, sendAt: future }, { origin: "https://other.example.test" }), f.params())).status).toBe(403);
    for (const [sendAt, code] of [[Date.now() - 60_000, "send_at_past"], [Date.now() + SCHEDULED_SEND_MAX_AHEAD_MS + 60_000, "send_at_too_far"],
      ["2026-10-25T08:00", "send_at_invalid"]] as const) {
      const response = await POST(f.request("POST", { draftId, sendAt }), f.params());
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe(code);
    }
    expect((await POST(f.request("POST", { sendAt: future }), f.params())).status).toBe(400);
    expect((await POST(f.request("POST", { draftId: "imap-missing", sendAt: future }), f.params())).status).toBe(404);
    const received = await f.seedDraft({ flags: [] });
    expect((await POST(f.request("POST", { draftId: received, sendAt: future }), f.params())).status).toBe(403);
    const elsewhere = await f.seedDraft({ folderId: `${f.accountId}:INBOX` });
    expect((await POST(f.request("POST", { draftId: elsewhere, sendAt: future }), f.params())).status).toBe(409);
    // The draft send path relays no calendar invitation, so invitation drafts are refused.
    const invite = encodeComposeInviteHeader({ start: "2026-11-02T09:00", end: "2026-11-02T10:00", allDay: false, location: "Synthetic room" });
    const invitation = await f.seedDraft({}, [`${COMPOSE_INVITE_HEADER}: ${invite}`]);
    const refused = await POST(f.request("POST", { draftId: invitation, sendAt: future }), f.params());
    expect([refused.status, (await refused.json()).message]).toEqual([409, "Drafts with an event invitation cannot be scheduled."]);
    const noRecipient = await f.seedDraft({ to: "" });
    expect((await POST(f.request("POST", { draftId: noRecipient, sendAt: future }), f.params())).status).toBe(400);
    const [identity] = await f.db.listSenderIdentities(f.accountId);
    // A sender identity changed after saving: rejected like a send of that draft.
    f.master.prepare("UPDATE sender_identities SET displayName='Renamed Synthetic' WHERE id=?").run(identity.id);
    const changed = await POST(f.request("POST", { draftId, sendAt: future }), f.params());
    expect(changed.status).toBe(409);
    expect((await changed.json()).code).toBe("draft_identity_changed");
  });

  test("discard and 'Jetzt senden' close the schedule, and both wait while it is sending", async () => {
    const f = await fixture();
    const sendAt = Date.now() + 3_600_000;
    const discarded = await f.seedDraft();
    const first = (await (await POST(f.request("POST", { draftId: discarded, sendAt }), f.params())).json()).scheduledSend;
    expect((await discard(f.request("POST", {}), f.params({ draftId: discarded }))).status).toBe(200);
    expect(await getScheduledSend(first.id)).toMatchObject({ status: "cancelled", lastError: "discarded" });

    const busy = await f.seedDraft();
    const row = (await (await POST(f.request("POST", { draftId: busy, sendAt }), f.params())).json()).scheduledSend;
    const owner = `${process.pid}:${crypto.randomUUID()}`;
    expect((await claimDueScheduledSends(owner, sendAt, 1_000)).some(item => item.id === row.id)).toBe(true);
    expect((await sendNow(f.request("POST", {}), f.params({ draftId: busy }))).status).toBe(409);
    expect((await discard(f.request("POST", {}), f.params({ draftId: busy }))).status).toBe(409);
    expect((await cancel(f.request("POST"), f.params({ scheduleId: row.id }))).status).toBe(409);
    expect((await POST(f.request("POST", { draftId: busy, sendAt: sendAt + 60_000 }), f.params())).status).toBe(409);
    expect(await f.db.getMessageById(f.accountId, busy)).not.toBeNull();
  });
});
