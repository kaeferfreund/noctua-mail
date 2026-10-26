import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { Message } from "@/lib/data";
import { saveMessageSource } from "@/lib/storage";
import { createCollabFixture } from "../../testThreadCollabHarness";
import { recordSpamDecision } from "./examples";
import { SPAM_MAX_ATTEMPTS } from "./queue";
import { loadSpamAdminSettings, saveMailboxSpamSettings, saveSpamAdminSettings } from "./settings";
import { isTrustCanary, evaluateSenderTrust } from "./senderProfile";
import { DAY, START, trustedInput, trustedProfile } from "./testProfiles";
import { assessSenderTrust } from "./anomaly";
import { EMPTY_STATIC_RULES } from "./staticRules";
import { existsSync } from "node:fs";
import { getDefaultAccountDbPath } from "@/lib/runtimePaths";
import { mockSpamModel } from "./testModel";
import type { SpamAdminSettings } from "./config";
import type { SpamServiceDeps } from "./service";

// The service with a mocked model and a recorded Junk move: no API call, no IMAP.
const { replaceSpamServiceDeps, runSpamSweep, runRescanSpamChecks, spamChecksIdle } = await import("./service");

const ADMIN = "spam-service-test";
const answer = (verdict: string, confidence: number) => JSON.stringify({ verdict, confidence, reasons: ["Synthetischer Grund"] });
let previousGlobal: SpamAdminSettings = {};

beforeAll(async () => {
  previousGlobal = await loadSpamAdminSettings();
  await saveSpamAdminSettings({ ...previousGlobal, enabled: true, threshold: 0.85 }, ADMIN);
});
afterAll(async () => {
  await saveSpamAdminSettings(previousGlobal, ADMIN);
});

async function fixture(mailbox: { autoMove?: boolean; enabled?: boolean; threshold?: number } = {}) {
  const f = await createCollabFixture();
  const junkId = `${f.accountId}-junk`;
  await f.api.saveFoldersForAccount(f.accountId, [
    { id: f.folderId, accountId: f.accountId, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" },
    { id: junkId, accountId: f.accountId, name: "Junk", count: 0, unreadCount: 0, specialUse: "\\Junk" }
  ]);
  await saveMailboxSpamSettings(f.accountId, mailbox, ADMIN);
  let uid = 100;
  const mail = (overrides: Partial<Message> = {}) => f.message(`<${crypto.randomUUID()}@example.test>`, {
    from: "Prize Desk <winner@lottery.example.test>", subject: "Sie haben gewonnen", body: "Klicken Sie hier.",
    dateValue: Date.now() - 60_000, mailboxPath: "INBOX", imapUid: (uid += 1), ...overrides
  });
  const moved: string[] = [];
  const run = async (model: MockLanguageModelV4, overrides: Partial<SpamServiceDeps> = {}) => {
    const restore = replaceSpamServiceDeps({
      languageModel: () => model,
      moveToJunk: async ({ message }) => { moved.push(message.id); return undefined as never; },
      sleep: async () => {},
      ...overrides
    });
    try {
      await runSpamSweep(f.accountId);
      await spamChecksIdle();
    } finally { restore(); }
  };
  const row = (id: string) => f.db.prepare("SELECT spamVerdict, spamReasons, spamCheckedAt FROM messages WHERE accountId = ? AND id = ?")
    .get(f.accountId, id) as { spamVerdict: string | null; spamReasons: string | null; spamCheckedAt: number | null };
  return { ...f, junkId, mail, moved, run, row };
}

const failingModel = (error: () => unknown) => new MockLanguageModelV4({ doGenerate: async () => { throw error(); } });

describe("spam service sweep", () => {
  test("classifies unchecked INBOX mail of the window, marks above the threshold and moves it to Junk", async () => {
    const f = await fixture({ autoMove: true });
    const [fresh, old, junk] = await f.seed(f.mail(), f.mail({ dateValue: Date.now() - 5 * 24 * 60 * 60_000 }), f.mail({ folderId: f.junkId, mailboxPath: "Junk" }));
    const model = mockSpamModel(answer("spam", 0.95));
    await f.run(model);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(await f.api.getMessageById(f.accountId, fresh.id)).toMatchObject({ spamVerdict: "spam", spamConfidence: 0.95 });
    expect(f.moved).toEqual([fresh.id]);
    expect(f.row(old.id).spamCheckedAt).toBeNull();
    expect(f.row(junk.id).spamCheckedAt).toBeNull();
  });

  test("below the mailbox threshold the verdict is unsure and nothing moves; auto-move off never moves", async () => {
    const f = await fixture({ autoMove: true, threshold: 0.97 });
    const [below] = await f.seed(f.mail());
    await f.run(mockSpamModel(answer("spam", 0.95)));
    expect(f.row(below.id).spamVerdict).toBe("unsure");
    const g = await fixture({ autoMove: false });
    const [marked] = await g.seed(g.mail());
    await g.run(mockSpamModel(answer("spam", 0.99)));
    expect(g.row(marked.id).spamVerdict).toBe("spam");
    expect([...f.moved, ...g.moved]).toEqual([]);
  });

  test("a mailbox switched off is never swept", async () => {
    const f = await fixture({ enabled: false });
    const [mail] = await f.seed(f.mail());
    const model = mockSpamModel(answer("spam", 0.99));
    await f.run(model);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(f.row(mail.id).spamCheckedAt).toBeNull();
  });

  test("8-bit ISO-8859-1 sources reach the model decoded by their charset", async () => {
    const f = await fixture();
    const [mail] = await f.seed(f.mail({ from: "Kanzlei <post@kanzlei.example.test>", subject: "Termin" }));
    await saveMessageSource(f.accountId, mail.id, Buffer.concat([
      Buffer.from("From: Kanzlei <post@kanzlei.example.test>\r\nTo: team@example.test\r\nSubject: Termin\r\n"
        + "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=ISO-8859-1\r\nContent-Transfer-Encoding: 8bit\r\n\r\n", "ascii"),
      Buffer.from("Viele Grüße aus Köln, Ihre Kanzlei", "latin1")
    ]));
    const model = mockSpamModel(answer("ham", 0.9));
    await f.run(model);
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(prompt).toContain("Viele Grüße aus Köln");
    expect(prompt).not.toContain("\\ufffd");
  });
});

describe("spam service failures", () => {
  test("a rejected request is not retried, is stored as exhausted and is logged without the error text", async () => {
    const f = await fixture();
    const [mail] = await f.seed(f.mail());
    const leak = "Betreff: Geheime Rechnung";
    const model = failingModel(() => new APICallError({ message: `invalid x-api-key ${leak}`, url: "https://api.example.test", requestBodyValues: { leak }, statusCode: 401 }));
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      await f.run(model);
      const logged = warn.mock.calls.filter((call) => String(call[0]).includes("classification failed"));
      expect(logged).toEqual([["[spam] classification failed; message left unmarked", { accountId: f.accountId, error: "AI_APICallError", status: 401 }]]);
      expect(JSON.stringify(warn.mock.calls)).not.toContain("Geheime");
    } finally { warn.mockRestore(); }
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(f.row(mail.id)).toMatchObject({ spamVerdict: null, spamCheckedAt: null, spamReasons: JSON.stringify([`failed:${SPAM_MAX_ATTEMPTS}`]) });
    expect(await f.api.listUncheckedSpamMessages(f.accountId, f.folderId, 0, 10, SPAM_MAX_ATTEMPTS)).toEqual([]);
  });

  test("retryable errors use the attempt limit once, also across a restart", async () => {
    const f = await fixture();
    const [fresh, resumed] = await f.seed(f.mail(), f.mail());
    // Two attempts failed in an earlier process: one attempt is left.
    await f.api.recordSpamCheckFailure(f.accountId, resumed.id, SPAM_MAX_ATTEMPTS - 1);
    const model = failingModel(() => new APICallError({ message: "overloaded", url: "https://api.example.test", requestBodyValues: {}, statusCode: 529 }));
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try { await f.run(model); } finally { warn.mockRestore(); }
    expect(model.doGenerateCalls).toHaveLength(SPAM_MAX_ATTEMPTS + 1);
    for (const mail of [fresh, resumed]) expect(f.row(mail.id).spamReasons).toBe(JSON.stringify([`failed:${SPAM_MAX_ATTEMPTS}`]));
  });
});

describe("spam service \"Kein Spam\" roles", () => {
  test("an editor's mark is an example for the model, a manager's mark allowlists the sender", async () => {
    const f = await fixture();
    const roles: Record<string, "editor" | "manager"> = { "user-editor": "editor", "user-manager": "manager" };
    const accountRole = async (userId: string) => roles[userId] ?? null;
    const [earlier, next] = await f.seed(f.mail({ from: "news@shop.example.test", subject: "Angebot" }), f.mail({ from: "news@shop.example.test", subject: "Neues Angebot" }));
    await recordSpamDecision({ accountId: f.accountId, message: earlier, label: "ham", source: "not-spam", userId: "user-editor" });
    await f.api.saveSpamVerdict(f.accountId, earlier.id, { verdict: "ham", confidence: 1, reasons: [] });
    const model = mockSpamModel(answer("ham", 0.8));
    await f.run(model, { accountRole });
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain("[Kein Spam] Von: news@shop.example.test");
    expect(f.row(next.id).spamVerdict).toBe("ham");

    const [third] = await f.seed(f.mail({ from: "news@shop.example.test", subject: "Drittes Angebot" }));
    await recordSpamDecision({ accountId: f.accountId, message: next, label: "ham", source: "not-spam", userId: "user-manager" });
    await f.run(model, { accountRole });
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(await f.api.getMessageById(f.accountId, third.id)).toMatchObject({ spamVerdict: "ham", spamReasons: ["Absender wurde als „Kein Spam“ markiert"] });
  });
});


test("a queued rescan skips mail judged by the sweep meanwhile", async () => {
  const f = await fixture();
  const [message] = await f.seed(f.mail());
  await f.api.saveSpamVerdict(f.accountId, message.id, { verdict: "ham", confidence: 1, reasons: ["Synthetic sweep verdict"] });
  const model = mockSpamModel(answer("spam", 0.99));
  const restore = replaceSpamServiceDeps({ languageModel: () => model, sleep: async () => {} });
  try {
    await runRescanSpamChecks(f.accountId, [{ id: message.id }], { rescanJobId: crypto.randomUUID(), isCancelled: () => false, onProgress: () => {} });
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(f.row(message.id).spamVerdict).toBe("ham");
  } finally { restore(); }
});


test("a deleted mailbox rescan drops its jobs without retry sleeps or recreating the shard", async () => {
  const f = await fixture();
  const [message] = await f.seed(f.mail());
  await f.api.deleteAccountControlPlane(f.accountId);
  const sleeps: number[] = [];
  const restore = replaceSpamServiceDeps({ sleep: async ms => { sleeps.push(ms); } });
  try {
    await runRescanSpamChecks(f.accountId, [{ id: message.id }], {
      rescanJobId: crypto.randomUUID(), isCancelled: () => false, onProgress: () => {}
    });
    expect(sleeps).toEqual([]);
    expect(existsSync(getDefaultAccountDbPath(f.accountId))).toBe(false);
  } finally { restore(); }
});

test("rules-only rescans persist only allowlist/static decisions and leave trusted/canary profiles unchanged", async () => {
  const f = await fixture();
  const now = Date.now();
  const offset = now - (START + 61 * DAY);
  const profile = trustedProfile(25, 60, {
    senderKey: "notify@service.example.invalid", fromDomain: "service.example.invalid",
    dkimDomains: ["service.example.invalid"], linkHosts: ["app.service.example.invalid"], messageIdDomain: "example.invalid"
  });
  profile.firstSeenAt += offset;
  profile.lastSeenAt += offset;
  expect(evaluateSenderTrust(profile, now).trusted).toBe(true);
  // Use the fixture's own recipient while retaining all other known sender features.
  const input: typeof trustedInput = {
    ...trustedInput, from: "Service <notify@service.example.invalid>", fromEmail: "notify@service.example.invalid", to: f.account.email,
    messageId: "<abc@mail.service.example.invalid>", listId: "<builds.service.example.invalid>", linkDomains: ["app.service.example.invalid"],
    authenticationResults: ["mx.example.test; spf=pass smtp.mailfrom=bounce.service.example.invalid; dkim=pass header.d=service.example.invalid"]
  };
  expect(await assessSenderTrust(input, { ownAddresses: new Set([f.account.email]), loadProfile: async () => profile, canaryKey: "plain", now }))
    .toMatchObject({ kind: "skip" });
  await f.api.replaceSenderProfiles(f.accountId, [profile]);
  const ids = Array.from({ length: 2000 }, (_, index) => `${f.accountId}-trusted-${index}`);
  const plainId = ids.find(id => !isTrustCanary(id))!;
  const canaryId = ids.find(id => isTrustCanary(id))!;
  const [plain, canary, allowed, denied, own] = await f.seed(
    f.mail({ id: plainId, from: input.from, to: input.to, subject: input.subject, messageId: input.messageId ?? undefined }),
    f.mail({ id: canaryId, from: input.from, to: input.to, subject: input.subject, messageId: input.messageId ?? undefined }),
    f.mail({ from: "allowed@rules.invalid" }), f.mail({ from: "denied@rules.invalid" }), f.mail({ from: f.account.email })
  );
  const before = await f.api.getSenderProfile(f.accountId, profile.senderKey);
  const model = mockSpamModel(answer("ham", 0.99));
  const restore = replaceSpamServiceDeps({
    languageModel: () => model, sleep: async () => {},
    readSource: async (_accountId, id) => [plainId, canaryId].includes(id) ? Buffer.from(
      `From: ${input.from}\r\nTo: ${input.to}\r\nSubject: ${input.subject}\r\nMessage-ID: ${input.messageId}\r\n`
      + `List-Id: ${input.listId}\r\nAuthentication-Results: ${input.authenticationResults[0]}\r\n\r\n${input.text}`) : id === own.id
        ? Buffer.from(`From: ${f.account.email}\r\nTo: ${f.account.email}\r\nAuthentication-Results: mx.example.test; dkim=pass header.d=example.test\r\n\r\nSynthetic message`) : null,
    loadStaticRules: async () => ({ ...EMPTY_STATIC_RULES,
      allow: [{ type: "address", value: "allowed@rules.invalid", safe: true }],
      deny: [{ type: "address", value: "denied@rules.invalid", safe: true }] })
  });
  try {
    const options = { rescanJobId: crypto.randomUUID(), isCancelled: () => false, onProgress: () => {} };
    await runRescanSpamChecks(f.accountId, [plain, canary, allowed, denied, own], { ...options, staticOnly: true });
    for (const mail of [plain, canary]) expect(f.row(mail.id)).toMatchObject({ spamVerdict: null, spamCheckedAt: null });
    expect(await f.api.getSenderProfile(f.accountId, profile.senderKey)).toEqual(before);
    expect(f.row(allowed.id).spamVerdict).toBe("ham");
    expect(f.row(denied.id).spamVerdict).toBe("spam");
    expect(f.row(own.id).spamVerdict).toBe("ham");
    expect(model.doGenerateCalls).toHaveLength(0);
    await runRescanSpamChecks(f.accountId, [plain, canary], options);
    expect(f.row(plain.id).spamVerdict).toBe("ham");
    expect(f.row(canary.id).spamVerdict).toBe("ham");
    expect(model.doGenerateCalls).toHaveLength(1);
  } finally { restore(); }
});
