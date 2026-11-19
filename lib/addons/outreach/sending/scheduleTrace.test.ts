import { expect, test } from "bun:test";
import { TEST_BASE_URL, createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { requireActiveUserSession } from "@/lib/auth";
import { mintMcpToken } from "@/lib/mcpAuth";
import { executeMcpHttpRequest } from "@/lib/mcpServer";
import { deleteMcpToken } from "@/lib/db";
import { GET as listCampaigns } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/route";
import { GET as getCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/[campaignId]/route";
import { POST as scheduleCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/[campaignId]/schedule/route";
import { GET as listSequences } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/route";
import { GET as getSequence } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/[sequenceId]/route";
import { POST as setSequenceStatus } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/[sequenceId]/status/route";
import { getOutreachDb } from "../db";
import { saveOutreachSettings } from "../settings";
import { outreachViaMcp, parseOutreachVia } from "../via";
import { saveCampaign, saveSequence } from "./store";

/** Decision AE: scheduled work keeps running after a token is revoked, but records where it came from (synthetic data only). */

async function withFlag<T>(run: () => Promise<T>) {
  const previous = process.env.NOCTUA_ADDON_OUTREACH;
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  try { return await run(); } finally {
    if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH;
    else process.env.NOCTUA_ADDON_OUTREACH = previous;
  }
}

/** A mailbox with the addon on, one list with one subscribed reader, a campaign draft and a sequence draft. */
async function mailbox() {
  const accountId = crypto.randomUUID();
  await (await dbModulePromise).upsertAccount(identityTestAccount(accountId));
  const editor = await createAuthenticatedTestSession(accountId);
  await saveOutreachSettings(accountId, { enabled: true, transport: "mailbox-smtp" }, editor.user.id);
  const db = await getOutreachDb();
  db.query("INSERT INTO lists (accountId, id, name, createdAt, updatedAt) VALUES (?, ?, 'Newsletter', 0, 0)").run(accountId, `${accountId}-list`);
  db.query(`INSERT INTO contacts (accountId, id, email, emailLower, emailConsent, consentAt, createdAt, updatedAt)
    VALUES (?, ?, 'reader@example.test', 'reader@example.test', 'subscribed', 1, 0, 0)`).run(accountId, `${accountId}-reader`);
  db.query("INSERT INTO list_members (accountId, listId, contactId, status, subscribedAt) VALUES (?, ?, ?, 'subscribed', 1)")
    .run(accountId, `${accountId}-list`, `${accountId}-reader`);
  const campaign = saveCampaign(db, accountId, editor.user.id, { name: "Rundbrief", subject: "Betreff", html: "<p>Hallo</p>", listIds: [`${accountId}-list`] });
  const sequence = saveSequence(db, accountId, { name: "Willkommen", triggerListId: `${accountId}-list`, steps: [{ subject: "Schritt", text: "Hallo" }] });
  return { accountId, editor, db, campaign, sequence };
}

test("AE: through the app, scheduling and going live record the user and 'app'; REST lists and reads it", () => withFlag(async () => {
  const { accountId, editor, campaign, sequence } = await mailbox();
  const base = `${TEST_BASE_URL}/api/addons/outreach/accounts/${accountId}`;
  const request = (route: string, method = "GET", body?: unknown) => new Request(`${base}/${route}`, {
    method, headers: editor.jar.headers({ origin: TEST_BASE_URL, ...(body === undefined ? {} : { "content-type": "application/json" }) }),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const campaignAt = { params: Promise.resolve({ accountId, campaignId: campaign.id }) };
  const sequenceAt = { params: Promise.resolve({ accountId, sequenceId: sequence.id }) };
  const draft = await (await getCampaign(request(`campaigns/${campaign.id}`), campaignAt)).json();
  expect(draft.campaign).toMatchObject({ scheduledByUserId: null, scheduledVia: null });

  const scheduled = await (await scheduleCampaign(request(`campaigns/${campaign.id}/schedule`, "POST", { sendAt: null }), campaignAt)).json();
  const trace = { scheduledByUserId: editor.user.id, scheduledVia: "app" };
  expect(scheduled).toMatchObject({ ok: true, campaign: { status: "scheduled", ...trace } });
  expect((await (await getCampaign(request(`campaigns/${campaign.id}`), campaignAt)).json()).campaign).toMatchObject(trace);
  const listed = await (await listCampaigns(request("campaigns"), { params: Promise.resolve({ accountId }) })).json();
  expect(listed.campaigns.find((item: { id: string }) => item.id === campaign.id)).toMatchObject(trace);

  const live = await (await setSequenceStatus(request(`sequences/${sequence.id}/status`, "POST", { status: "live" }), sequenceAt)).json();
  const sequenceTrace = { statusChangedByUserId: editor.user.id, statusChangedVia: "app" };
  expect(live).toMatchObject({ ok: true, sequence: { status: "live", ...sequenceTrace } });
  expect((await (await getSequence(request(`sequences/${sequence.id}`), sequenceAt)).json()).sequence).toMatchObject(sequenceTrace);
  const sequences = await (await listSequences(request("sequences"), { params: Promise.resolve({ accountId }) })).json();
  expect(sequences.sequences.find((item: { id: string }) => item.id === sequence.id)).toMatchObject(sequenceTrace);
}));

test("AE: through an MCP token, the token's label and suffix are recorded and stay after the token is deleted", () => withFlag(async () => {
  const { accountId, editor, db, campaign, sequence } = await mailbox();
  const session = await requireActiveUserSession(new Request(TEST_BASE_URL, { headers: editor.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session missing");
  const { tokenRecord } = await mintMcpToken(session, accountId, "Assistent", 3600, { mode: "full", accountIds: [accountId] });
  const call = async (name: string, args: Record<string, unknown>) => {
    const response = await executeMcpHttpRequest({ body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
      accountId, account: identityTestAccount(accountId), tokenRecord,
      authInfo: { token: "", clientId: "synthetic", scopes: ["send", "manage"], extra: { userId: "untrusted-synthetic" } } });
    const result = (response.responses[0] as unknown as { result: { isError?: boolean; content: unknown; structuredContent: Record<string, unknown> } }).result;
    if (result.isError) throw new Error(JSON.stringify(result.content));
    return result.structuredContent;
  };
  const via = `mcp:Assistent (…${tokenRecord.tokenSuffix})`;
  expect(await call("schedule_campaign", { accountId, campaignId: campaign.id, sendAt: null }))
    .toMatchObject({ campaign: { status: "scheduled", scheduledByUserId: editor.user.id, scheduledVia: via } });
  expect(await call("set_sequence_status", { accountId, sequenceId: sequence.id, status: "live" }))
    .toMatchObject({ sequence: { status: "live", statusChangedByUserId: editor.user.id, statusChangedVia: via } });
  expect(await call("get_campaign", { accountId, campaignId: campaign.id })).toMatchObject({ campaign: { scheduledVia: via } });
  expect((await call("list_campaigns", { accountId })).campaigns).toContainEqual(expect.objectContaining({ id: campaign.id, scheduledVia: via }));
  expect(await call("get_sequence", { accountId, sequenceId: sequence.id })).toMatchObject({ sequence: { statusChangedVia: via } });
  expect((await call("list_sequences", { accountId })).sequences).toContainEqual(expect.objectContaining({ id: sequence.id, statusChangedVia: via }));

  // Revoking the token ends its calls, not the work it scheduled; the trace stays readable.
  expect(await deleteMcpToken(accountId, tokenRecord.id)).toBe(true);
  expect(db.query("SELECT status, scheduledVia FROM campaigns WHERE accountId = ? AND id = ?").get(accountId, campaign.id))
    .toEqual({ status: "scheduled", scheduledVia: via });
  expect(db.query("SELECT status, statusChangedVia FROM sequences WHERE accountId = ? AND id = ?").get(accountId, sequence.id))
    .toEqual({ status: "live", statusChangedVia: via });
}));

test("AE: the MCP trace is a capped snapshot that parses back", () => {
  expect(parseOutreachVia("app")).toEqual({ kind: "app" });
  expect(parseOutreachVia(outreachViaMcp("Assistent", "a1b2"))).toEqual({ kind: "mcp", label: "Assistent", suffix: "a1b2" });
  expect(parseOutreachVia(outreachViaMcp("Bot (alt)", "a1b2"))).toEqual({ kind: "mcp", label: "Bot (alt)", suffix: "a1b2" });
  const long = outreachViaMcp("x".repeat(500), "s".repeat(50));
  expect(long.length).toBeLessThanOrEqual(100);
  expect(parseOutreachVia(long)).toMatchObject({ kind: "mcp", label: "x".repeat(80) });
  expect(outreachViaMcp("Zeile\neins", "a1b2")).toBe("mcp:Zeile eins (…a1b2)");
  for (const value of [null, undefined, "", "mcp:", "other"]) expect(parseOutreachVia(value)).toBeNull();
});
