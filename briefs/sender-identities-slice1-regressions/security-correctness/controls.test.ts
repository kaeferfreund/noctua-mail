import { test, expect, spyOn } from "bun:test";
const root = process.env.REVIEW_CHECKOUT ?? "/home/monkey/code/noctua-mail/wt-review-collab";
const { dbModulePromise } = await import(`${root}/lib/testDbHarness.ts`);
const db = await dbModulePromise;
const { getDb, getAccountDb } = await import(`${root}/lib/db/connection.ts`);
const { identityTestAccount } = await import(`${root}/lib/testFixtures/senderIdentities.ts`);
const { createAuthenticatedTestSession, createTestAuthHarness } = await import(`${root}/lib/testAuthHarness.ts`);
const { createSenderIdentity, updateSenderIdentity, createSenderIdentitySchema, updateSenderIdentitySchema } = await import(`${root}/lib/senderIdentities.ts`);
const collection = await import(`${root}/app/api/accounts/[accountId]/identities/route.ts`);
const item = await import(`${root}/app/api/accounts/[accountId]/identities/[identityId]/route.ts`);
const prefs = await import(`${root}/app/api/accounts/[accountId]/prefs/route.ts`);
const { normalizeIdentityEmail, getOwnAddresses } = await import(`${root}/lib/ownAddresses.ts`);
const { parseDeliveryMetadata } = await import(`${root}/lib/mail/imap/parser.ts`);
const params = (accountId: string, identityId?: string) => ({ params: Promise.resolve({ accountId, identityId }) });
const request = (auth: any, method: string, body?: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/synthetic", { method, headers: auth.jar.headers({ origin, "content-type": "application/json" }), body: body === undefined ? undefined : JSON.stringify(body) });
async function fixture() {
  const accountId = `review-control-${crypto.randomUUID()}`; await db.upsertAccount(identityTestAccount(accountId));
  const auth = await createAuthenticatedTestSession(accountId);
  const master = await getDb();
  const alias = await createSenderIdentity(accountId, { email: "alias@example.test", displayName: "Alias" }, { userId: auth.user.id }, master);
  return { accountId, auth, master, alias };
}
test("C1 viewer/editor and nonmember admin are denied all identity writes including recompute", async () => {
  const f = await fixture();
  const cases = [
    ["POST", collection.POST, { email: "denied@example.test", displayName: "Denied" }],
    ["PUT", collection.PUT, { recompute: true }],
    ["PATCH", item.PATCH, { displayName: "Denied" }],
    ["DELETE", item.DELETE, undefined]
  ] as const;
  const before = await db.listSenderIdentities(f.accountId);
  const spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("denied request spawned a worker"); });
  try {
    for (const role of ["viewer", "editor"]) {
      f.master.prepare("UPDATE user_accounts SET role=? WHERE userId=? AND accountId=?").run(role, f.auth.user.id, f.accountId);
      expect((await collection.GET(request(f.auth, "GET"), params(f.accountId))).status).toBe(200);
      for (const [method, handler, body] of cases) expect((await handler(request(f.auth, method, body), params(f.accountId, f.alias.id))).status).toBe(403);
    }
    const admin = await createAuthenticatedTestSession(undefined, "admin");
    expect((await collection.GET(request(admin, "GET"), params(f.accountId))).status).toBe(403);
    for (const [method, handler, body] of cases) expect((await handler(request(admin, method, body), params(f.accountId, f.alias.id))).status).toBe(403);
    expect(spawn).not.toHaveBeenCalled(); expect(await db.listSenderIdentities(f.accountId)).toEqual(before);
  } finally { spawn.mockRestore(); }
});
test("C2 cross-account ids fail lookup, disabled defaults fail, prefs are owner-only, and every mutation rejects foreign Origin", async () => {
  const f = await fixture(); const b = `review-control-${crypto.randomUUID()}`;
  await db.upsertAccount(identityTestAccount(b)); await f.auth.addMembership(f.auth.user.id, b, "manager");
  for (const handler of [item.PATCH, item.DELETE]) {
    const response = await handler(request(f.auth, handler === item.PATCH ? "PATCH" : "DELETE", handler === item.PATCH ? { displayName: "Foreign" } : undefined), params(b, f.alias.id));
    expect(response.status).toBe(404); expect(await response.json()).toMatchObject({ code: "identity_not_found" });
  }
  await updateSenderIdentity(f.accountId, f.alias.id, { enabled: false }, { userId: f.auth.user.id }, f.master);
  expect((await item.PATCH(request(f.auth, "PATCH", { isDefault: true }), params(f.accountId, f.alias.id))).status).toBe(409);
  for (const accountId of [f.accountId, b]) expect((await prefs.PUT(request(f.auth, "PUT", { defaultIdentityId: f.alias.id }), params(accountId))).status).toBe(400);
  const [primary] = (await db.listSenderIdentities(f.accountId)).filter((i: any) => i.isDefault);
  expect((await prefs.PUT(request(f.auth, "PUT", { defaultIdentityId: primary.id, signatureOverride: "Synthetic private" }), params(f.accountId))).status).toBe(200);
  const other = await createAuthenticatedTestSession(f.accountId);
  expect(await (await prefs.GET(request(other, "GET"), params(f.accountId))).json()).toEqual({ ok: true, prefs: {} });
  for (const [method, handler, body] of [
    ["POST", collection.POST, { email: "new@example.test", displayName: "New" }], ["PUT", collection.PUT, { recompute: true }],
    ["PATCH", item.PATCH, { enabled: true }], ["DELETE", item.DELETE, undefined], ["PUT", prefs.PUT, { signatureOverride: "No" }]
  ] as const) expect((await handler(request(f.auth, method, body, "https://foreign.example.test"), params(f.accountId, f.alias.id))).status).toBe(403);
});
test("C3 address normalization, IDN, bounded strings, injection rejection and audit field allowlist", async () => {
  expect(normalizeIdentityEmail(" Alias+Tag@BÜCHER.example ")).toBe("alias+tag@xn--bcher-kva.example");
  for (const email of ["Name <alias@example.test>", "a@example.test,b@example.test", "a@example.test\r\nBcc: b@example.test", "a@example.test\u0000", "unicodeé@example.test", `${"a".repeat(65)}@example.test`, "a..b@example.test", "a@bad..example"]) expect(createSenderIdentitySchema.safeParse({ email, displayName: "Synthetic" }).success).toBe(false);
  for (const key of ["displayName", "replyTo"]) {
    for (const value of ["Safe\r\nBcc: victim@example.test", "Safe\nInjected", "Safe\u0000"]) expect(createSenderIdentitySchema.safeParse({ email: "alias@example.test", displayName: "Synthetic", [key]: value }).success).toBe(false);
  }
  expect(createSenderIdentitySchema.safeParse({ email: "a@example.test", displayName: "x".repeat(257) }).success).toBe(false);
  expect(updateSenderIdentitySchema.safeParse({ signatureId: "x".repeat(257) }).success).toBe(false);
  expect(createSenderIdentitySchema.safeParse({ email: "a@example.test", displayName: 'A "quoted" name' }).success).toBe(true);
  expect(createSenderIdentitySchema.safeParse({ email: "a@example.test", displayName: "Synthetic", password: "synthetic-do-not-audit" }).success).toBe(false);
  const f = await fixture();
  await updateSenderIdentity(f.accountId, f.alias.id, { displayName: "Synthetic sensitive display", replyTo: "private@example.test" }, { userId: f.auth.user.id }, f.master);
  const audits = f.master.prepare("SELECT payload FROM admin_audit WHERE targetAccountId=? AND action LIKE 'identity.%'").all(f.accountId) as { payload: string }[];
  for (const row of audits) {
    const payload = JSON.parse(row.payload);
    expect(Object.keys(payload).every(key => ["identityId", "email", "changedFields", "oldDefaultId", "newDefaultId", "clientId"].includes(key))).toBe(true);
    expect(row.payload).not.toContain("Synthetic sensitive display"); expect(row.payload).not.toContain("private@example.test"); expect(row.payload).not.toContain("synthetic-do-not-audit");
  }
});
test("C4 folded/repeated/10KB/nonASCII/malformed header fuzz is bounded and cannot read body headers", () => {
  let seed = 0x5eed;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let n = 0; n < 80; n++) {
    let junk = ""; for (let i = 0; i < (n === 0 ? 10240 : 200); i++) junk += String.fromCharCode(32 + random() % 1000);
    const raw = `Delivered-To: Alias@example.test\r\nDelivered-To:\r\n primary@example.test\r\nX-Original-To: ${junk}\r\nX-Original-To: original@example.test\r\n\r\nDelivered-To: body@example.test`;
    const metadata = parseDeliveryMetadata(Buffer.from(raw));
    expect(metadata.deliveredTo).toEqual(["alias@example.test", "primary@example.test"]);
    expect(metadata.originalTo).toContain("original@example.test");
    for (const addresses of [metadata.deliveredTo, metadata.originalTo]) { expect(addresses!.length).toBeLessThanOrEqual(32); expect(addresses!.every(email => normalizeIdentityEmail(email) === email)).toBe(true); }
  }
  const metadata = parseDeliveryMetadata(Buffer.from(Array.from({ length: 100 }, (_, i) => `Delivered-To: a${i}@example.test`).join("\r\n")));
  expect(metadata.deliveredTo).toHaveLength(32);
  expect(parseDeliveryMetadata(undefined)).toEqual({});
});
test("C5 512 deterministic random identity sets obey all resolver tiers/defaults/draft restoration", async () => {
  const { resolveComposeIdentity } = await import(`${root}/lib/senderIdentitySelection.ts`);
  let seed = 0x53534;
  const random = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let round = 0; round < 512; round++) {
    const identities = Array.from({ length: 2 + random(8) }, (_, i) => ({ id: `i${i}`, accountId: i === 1 ? "foreign" : "a", email: `i${i}@example.test`, displayName: `i${i}`, enabled: i === 0 || random(3) > 0, isDefault: i === 0, createdBy: null, createdAt: 1, updatedAt: 1 }));
    const defaultIdentityId = random(3) === 0 ? "stale" : identities[random(identities.length)].id;
    const prefs = { defaultIdentityId };
    const modes = ["reply", "replyAll", "new", "forward"] as const;
    const mode = modes[random(modes.length)];
    const tiers = Array.from({ length: 6 }, () => identities.filter(() => random(3) === 0).map(identity => identity.email));
    const message = { from: tiers[0].join(", "), to: tiers[1].map(email => `"Synthetic" <${email}>`).join(", "), cc: tiers[2].join(", "), bcc: tiers[3].join(", "), originalTo: tiers[4], deliveredTo: tiers[5] };
    const candidates = identities.filter(i => i.accountId === "a" && i.enabled);
    const personal = candidates.find(i => i.id === defaultIdentityId);
    const fallback = personal ?? candidates.find(i => i.isDefault);
    const ranks = candidates.map(identity => {
      const tier = tiers.findIndex(addresses => addresses.includes(identity.email));
      return { identity, tier, pos: tier < 0 ? Infinity : tiers[tier].indexOf(identity.email) };
    }).filter(rank => rank.tier >= 0).sort((a, b) => a.tier - b.tier || Number(b.identity.id === personal?.id) - Number(a.identity.id === personal?.id) || Number(b.identity.isDefault) - Number(a.identity.isDefault) || a.pos - b.pos || a.identity.id.localeCompare(b.identity.id));
    const expected = mode.startsWith("reply") ? ranks[0]?.identity ?? fallback : fallback;
    const result = resolveComposeIdentity({ accountId: "a", identities: identities.slice().reverse(), prefs, mode, message });
    expect(result.identity?.id).toBe(expected?.id); expect(result.warnings.length).toBe(personal ? 0 : 1);
    const selected = identities[random(identities.length)];
    const draft = resolveComposeIdentity({ accountId: "a", identities, prefs, mode: "draft", message: { ...message, senderIdentityId: selected.id } });
    expect(draft.identity?.id).toBe(selected.accountId === "a" ? selected.id : undefined);
    expect(draft.unavailableIdentityId).toBe(selected.accountId === "a" && selected.enabled ? undefined : selected.id);
  }
});
test("C6 viewer MCP tokens see only documented message metadata and remain mailbox bound", async () => {
  const f = await fixture(); const accountId = f.accountId;
  const folderId = `${accountId}:INBOX`; await db.saveFoldersForAccount(accountId, [{ id: folderId, accountId, name: "INBOX", count: 0 }]);
  const message = { id: `m-${crypto.randomUUID()}`, messageId: `<${crypto.randomUUID()}@example.test>`, threadId: `t-${crypto.randomUUID()}`, accountId, folderId, from: "customer@example.test", to: "primary@example.test", subject: "Synthetic MCP", preview: "Synthetic", body: "Synthetic", date: new Date(1000).toISOString(), dateValue: 1000, deliveredTo: ["primary@example.test"], originalTo: ["alias@example.test"], senderIdentityId: "untrusted-draft-marker" };
  await db.upsertMessages(accountId, folderId, [message]);
  const { requireActiveUserSession } = await import(`${root}/lib/auth.ts`);
  const { mintMcpToken } = await import(`${root}/lib/mcpAuth.ts`);
  const { POST } = await import(`${root}/app/api/mcp/route.ts`);
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: f.auth.jar.headers() }));
  const minted = await mintMcpToken(session as any, accountId, "Synthetic", 3600);
  f.master.prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(f.auth.user.id, accountId);
  await db.mergeUserAccountPrefs(f.auth.user.id, accountId, { signatureOverride: "synthetic-private-signature" });
  const call = async (name: string, args: any) => (await POST(new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${minted.token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }))).json();
  const body = await call("search_messages", {});
  expect(body.result?.isError).not.toBe(true);
  expect(body.result.structuredContent.items[0]).toMatchObject({ deliveredTo: message.deliveredTo, originalTo: message.originalTo, senderIdentityId: message.senderIdentityId });
  const encoded = JSON.stringify(body); expect(encoded).not.toContain("smtp"); expect(encoded).not.toContain("imapPassword"); expect(encoded).not.toContain("synthetic-private-signature");
  const foreign = await call("search_messages", { accountId: "foreign-account" }); expect(foreign.result.isError).toBe(true); expect(foreign.result.content[0].text).toContain("bound to another mailbox");
  const denied = await call("flag_message", { messageId: message.id }); expect(denied.result.isError).toBe(true); expect(denied.result.content[0].text).toContain("Insufficient mailbox role");
});

test("C10 primary/enabled/disabled aliases agree across compose, drafts, thread markers, notifications, classifier, topics and calendar", async () => {
  const f = await fixture();
  const disabled = await createSenderIdentity(f.accountId, { email: "disabled@example.test", displayName: "Historical", enabled: false }, { userId: f.auth.user.id }, f.master);
  const account = (await db.getAccountById(f.accountId))!;
  const ownAddresses = getOwnAddresses(account);
  expect(ownAddresses).toEqual(["primary@example.test", "alias@example.test", "disabled@example.test"]);
  const { computeComposeInitState } = await import(`${root}/app/components/mailclient/composition/composeInitState.ts`);
  const { getMessageFromDisplay } = await import(`${root}/app/components/mailclient/messagelist/threadGroupUtils.ts`);
  const { planNewMailNotifications } = await import(`${root}/app/components/mailclient/syncNotificationFilter.ts`);
  const { classifyCategoryFromMetadata } = await import(`${root}/lib/mail/categorization/classifier.ts`);
  const { collectTopicSignalEntries } = await import(`${root}/lib/topicSignals.ts`);
  const { resolveCalendarParticipationFromPreview } = await import(`${root}/lib/calendarParticipation.ts`);
  const { buildDraftInputForMode } = await import(`${root}/lib/drafts.ts`);
  const folderId = `${f.accountId}:INBOX`; await db.saveFoldersForAccount(f.accountId, [{ id: folderId, accountId: f.accountId, name: "INBOX", count: 0 }]);
  for (const [index, email] of ownAddresses.entries()) {
    const message = { id: `m-${crypto.randomUUID()}`, messageId: `<${crypto.randomUUID()}@example.test>`, threadId: `t-${crypto.randomUUID()}`, accountId: f.accountId, folderId, from: `"Synthetic" <${email}>`, to: "primary@example.test, alias@example.test, disabled@example.test, customer@example.test", cc: "disabled@example.test, other@example.test", bcc: "alias@example.test", subject: "Synthetic", preview: "Synthetic", body: "Synthetic", date: new Date(1000).toISOString(), dateValue: 1000, imapUid: index + 1, mailboxPath: "INBOX" };
    const compose = computeComposeInitState("replyAll", message, false, { accountEmail: account.email, ownAddresses, accountDateFormat: "locale" }, { stripHtml: (v: string) => v, normalizeHtmlDerivedText: (v: string) => v });
    expect(compose.composeTo).toBe("customer@example.test"); expect(compose.composeCc).toBe("other@example.test");
    expect(getMessageFromDisplay(message.from, undefined, ownAddresses).isFromUser).toBe(true);
    expect(planNewMailNotifications({ items: [{ uid: 2, from: message.from }], lastNotifiedUid: 1, notifiedKeys: new Set(), isNotificationSuppressedFolder: () => false, accountEmail: ownAddresses }).dispatch.kind).toBe("none");
    expect(classifyCategoryFromMetadata({ from: { value: [{ address: email }] }, subject: "Synthetic" }, { context: { accountEmail: ownAddresses } }).signals).toContain("skip:sender-is-account");
    expect(collectTopicSignalEntries([{ fromEmail: email, to: message.to }], { excludeAccountEmail: ownAddresses })).toEqual([{ type: "recipient", value: "customer@example.test" }]);
    expect(resolveCalendarParticipationFromPreview({ attendeeDetails: [{ email, partstat: "ACCEPTED" }] }, ownAddresses)).toMatchObject({ myAttendeeEmail: email, myPartstat: "ACCEPTED" });
    await db.upsertMessages(f.accountId, folderId, [message]);
    const draft = await buildDraftInputForMode(account, f.accountId, { mode: "reply", messageId: message.id, text: "Synthetic" });
    expect(draft.to).toBe("customer@example.test");
  }
  const identities = await db.listSenderIdentities(f.accountId);
  const { resolveComposeIdentity } = await import(`${root}/lib/senderIdentitySelection.ts`);
  expect(resolveComposeIdentity({ accountId: f.accountId, identities, mode: "reply", message: { from: "customer@example.test", to: disabled.email } }).identity?.id).not.toBe(disabled.id);
});

test("C11 count observation: 65 configured identities are accepted; only per-field/address-list bounds exist", async () => {
  const f = await fixture();
  for (let index = 0; index < 63; index++) await createSenderIdentity(f.accountId, { email: `extra${index}@example.test`, displayName: "Synthetic" }, { userId: f.auth.user.id }, f.master);
  expect(await db.listSenderIdentities(f.accountId)).toHaveLength(65);
});
