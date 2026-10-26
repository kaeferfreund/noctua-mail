import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import type { Message } from "@/lib/data";
import { saveMessageSource } from "@/lib/storage";
import { createCollabFixture } from "../../testThreadCollabHarness";
import type { SpamAdminSettings } from "./config";
import { loadSpamAdminSettings, saveMailboxSpamSettings, saveSpamAdminSettings } from "./settings";
import { mockSpamModel } from "./testModel";
import type { SpamRescanDeps } from "./rescan";
import { EMPTY_STATIC_RULES } from "./staticRules";
import { EMPTY_SPAM_USAGE } from "./usage";

// Real shard and master DB, mocked model and IMAP move: no API call, no mail server.
const { replaceSpamServiceDeps } = await import("./service");
const rescan = await import("./rescan");
const { getDb } = await import("@/lib/db/connection");

const ADMIN = "spam-rescan-test-admin";
const DAY = 24 * 60 * 60_000;
const answer = (verdict: string, confidence: number) => JSON.stringify({ verdict, confidence, reasons: ["Synthetischer Grund"] });
let previousGlobal: SpamAdminSettings = {};
const previousKey = process.env.ANTHROPIC_API_KEY;

beforeAll(async () => {
  previousGlobal = await loadSpamAdminSettings();
  await saveSpamAdminSettings({ ...previousGlobal, enabled: true, threshold: 0.85 }, ADMIN);
  // Only for the availability check: the model itself is mocked.
  process.env.ANTHROPIC_API_KEY = "synthetic-test-key";
});
afterAll(async () => {
  await saveSpamAdminSettings(previousGlobal, ADMIN);
  if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = previousKey;
});

async function fixture() {
  const f = await createCollabFixture();
  const junkId = `${f.accountId}-junk`;
  await f.api.saveFoldersForAccount(f.accountId, [
    { id: f.folderId, accountId: f.accountId, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" },
    { id: junkId, accountId: f.accountId, name: "Junk", count: 0, unreadCount: 0, specialUse: "\\Junk" }
  ]);
  await saveMailboxSpamSettings(f.accountId, { autoMove: true }, ADMIN);
  let uid = 500;
  const mail = (overrides: Partial<Message> = {}) => f.message(`<${crypto.randomUUID()}@example.test>`, {
    from: "Newsletter <news@shop.example.test>", subject: "Neuigkeiten", body: "Synthetischer Text.",
    dateValue: Date.now() - 10 * DAY, mailboxPath: "INBOX", imapUid: (uid += 1), ...overrides
  });
  /** A mail with a stored source carrying the receiving server's spam flag. */
  const flagged = async (sender: string, overrides: Partial<Message> = {}) => {
    const [message] = await f.seed(mail({ from: `Gewinnspiel <${sender}>`, subject: `Gewinn für ${sender}`, hasSource: true, ...overrides }));
    await saveMessageSource(f.accountId, message.id, `From: Gewinnspiel <${sender}>\r\nTo: team@example.test\r\nSubject: Gewinn\r\n`
      + `X-Spam-Flag: YES\r\nX-Spam-Score: 9.4\r\n\r\nSynthetischer Text.\r\n`);
    return message;
  };
  const moved: string[] = [];
  const model = mockSpamModel(() => answer("spam", 0.95));
  const run = async <T>(work: () => Promise<T>, overrides: Partial<SpamRescanDeps> = {}) => {
    const restoreService = replaceSpamServiceDeps({ languageModel: () => model, sleep: async () => {},
      moveToJunk: async () => { throw new Error("the rescan must never auto-move"); } });
    const restore = rescan.replaceSpamRescanDeps({
      loadStaticRules: async () => EMPTY_STATIC_RULES,
      moveToJunk: async ({ message }) => {
        moved.push(message.id);
        await f.db.prepare("UPDATE messages SET folderId = ?, mailboxPath = 'Junk' WHERE accountId = ? AND id = ?").run(junkId, f.accountId, message.id);
        return { junkFolderId: junkId, junkMailbox: "Junk", flags: [], previousMessageId: message.id, messageId: message.id };
      },
      ...overrides
    });
    try {
      const result = await work();
      await rescan.spamRescansIdle();
      return result;
    } finally { restore(); restoreService(); }
  };
  return { ...f, junkId, mail, flagged, moved, model, run };
}

describe("admin INBOX rescan", () => {
  test("lists server-flagged and model-marked mail of the range, moves nothing, then moves the reviewed selection", async () => {
    const f = await fixture();
    const selected = await f.flagged("winner@lottery.invalid");
    const answered = await f.flagged("prize@lottery.invalid", { answered: true });
    const outside = await f.flagged("old@lottery.invalid", { dateValue: Date.now() - 40 * DAY });
    // Household domains (example.test) would keep their senders' mail: the flagged senders use another one.
    const [unchecked, judged] = await f.seed(f.mail({ subject: "Ungeprüft" }), f.mail({ subject: "Schon geprüft" }));
    await f.api.saveSpamVerdict(f.accountId, judged.id, { verdict: "ham", confidence: 0.9, reasons: [] });

    const preview = await rescan.previewSpamRescan(f.accountId, "30d");
    // Four unchecked rows in the range (two flagged, one plain, the answered flagged one); the 40-day-old mail is outside.
    expect(preview).toMatchObject({ period: "30d", inboxRows: 4, unchecked: 3, modelLimit: 3, modelBlocked: null, hasJunkFolder: true });

    const job = await f.run(() => rescan.startSpamRescan({ accountId: f.accountId, period: "30d", withModel: true, modelLimit: preview.modelLimit, userId: ADMIN }));
    expect(job.status).toBe("running");
    const state = await rescan.loadSpamRescanState(f.accountId);
    // The answered flagged mail goes to the model like any unchecked row, but its mark does not list it.
    expect(state.job).toMatchObject({ id: job.id, status: "ready", phase: null, counts: {
      inboxRows: 4, serverFlagged: 2, serverFlagSelected: 1, serverFlagExcluded: { answered: 1 }, modelChecked: 2, modelCalls: 2, classifierMarked: 1, items: 2
    } });
    expect(state.items.map((item) => [item.id, item.stage]).sort()).toEqual([[selected.id, "server-flag"], [unchecked.id, "classifier"]].sort());
    expect(state.items.find((item) => item.id === selected.id)).toMatchObject({ score: 9.4, reasons: [], moveStatus: null });
    expect(state.items.find((item) => item.id === unchecked.id)).toMatchObject({ score: 0.95, reasons: ["Synthetischer Grund"] });
    expect(state.items.some((item) => [outside.id, judged.id, answered.id].includes(item.id))).toBe(false);
    // The selected server-flagged mail never went to the model; the already judged one neither.
    expect(f.model.doGenerateCalls).toHaveLength(2);
    expect(f.moved).toEqual([]);

    // The admin deselects one and moves the other.
    expect(await f.run(() => rescan.startSpamRescanMove({ accountId: f.accountId, jobId: job.id, ids: [selected.id], userId: ADMIN }))).toBe(1);
    expect(f.moved).toEqual([selected.id]);
    let after = await rescan.loadSpamRescanState(f.accountId);
    expect(after.job).toMatchObject({ status: "ready", counts: { moved: 1, gone: 0, changed: 0, errors: 0 } });
    expect(after.items.find((item) => item.id === unchecked.id)?.moveStatus).toBeNull();
    const examples = f.db.prepare("SELECT messageId, source, createdAt, decidedByUserId FROM spam_examples WHERE accountId = ?").all(f.accountId);
    expect(examples).toEqual([{ messageId: selected.id, source: "rescan", createdAt: selected.dateValue, decidedByUserId: ADMIN }]);

    // Resumable: moved items are not selected again, mail moved elsewhere meanwhile is skipped and reported.
    await f.db.prepare("UPDATE messages SET folderId = ?, mailboxPath = 'Junk' WHERE accountId = ? AND id = ?").run(f.junkId, f.accountId, unchecked.id);
    expect(await f.run(() => rescan.startSpamRescanMove({ accountId: f.accountId, jobId: job.id, ids: [selected.id, unchecked.id], userId: ADMIN }))).toBe(1);
    expect(f.moved).toEqual([selected.id]);
    after = await rescan.loadSpamRescanState(f.accountId);
    expect(after.job?.counts).toMatchObject({ moved: 1, gone: 1, errors: 0 });
    expect(after.items.find((item) => item.id === unchecked.id)?.moveStatus).toBe("gone");

    const audit = (await getDb()).prepare("SELECT action, payload FROM admin_audit WHERE targetAccountId = ? AND action LIKE 'spam_rescan.%' ORDER BY createdAt").all(f.accountId) as Array<{ action: string; payload: string }>;
    expect(audit.map((entry) => [entry.action, JSON.parse(entry.payload)])).toEqual([
      ["spam_rescan.start", { jobId: job.id, period: "30d", withModel: true, modelLimit: 3, inboxRows: 4 }],
      ["spam_rescan.move", { jobId: job.id, selected: 1, listed: 2 }],
      ["spam_rescan.move", { jobId: job.id, selected: 1, listed: 2 }]
    ]);
  });

  test("the model step is optional, capped at the count shown, and blocked while detection is off", async () => {
    const f = await fixture();
    await f.seed(f.mail({ subject: "A" }), f.mail({ subject: "B" }), f.mail({ subject: "C" }));
    await f.run(() => rescan.startSpamRescan({ accountId: f.accountId, period: "all", withModel: false, modelLimit: 0, userId: ADMIN }));
    expect(f.model.doGenerateCalls).toHaveLength(0);
    expect((await rescan.loadSpamRescanState(f.accountId)).job?.counts).toMatchObject({ inboxRows: 3, serverFlagged: 0, items: 0 });

    await f.run(() => rescan.startSpamRescan({ accountId: f.accountId, period: "all", withModel: true, modelLimit: 1, userId: ADMIN }));
    expect(f.model.doGenerateCalls).toHaveLength(1);
    expect((await rescan.loadSpamRescanState(f.accountId)).job?.counts).toMatchObject({ modelChecked: 1, modelCalls: 1 });

    await saveMailboxSpamSettings(f.accountId, { enabled: false }, ADMIN);
    expect((await rescan.previewSpamRescan(f.accountId, "all")).modelBlocked).toBe("mailbox-off");
    await expect(rescan.startSpamRescan({ accountId: f.accountId, period: "all", withModel: true, modelLimit: 2, userId: ADMIN }))
      .rejects.toMatchObject({ code: "model_unavailable" });
  });

  test("one running job per mailbox, a cancel stops the model step, and an interrupted job reads as cancelled", async () => {
    const f = await fixture();
    await f.seed(f.mail({ subject: "A" }), f.mail({ subject: "B" }), f.mail({ subject: "C" }), f.mail({ subject: "D" }));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const checked: string[] = [];
    await f.run(async () => {
      const job = await rescan.startSpamRescan({ accountId: f.accountId, period: "all", withModel: true, modelLimit: 4, userId: ADMIN });
      await expect(rescan.startSpamRescan({ accountId: f.accountId, period: "all", withModel: false, modelLimit: 0, userId: ADMIN }))
        .rejects.toMatchObject({ name: "SpamRescanBusyError" });
      while (!checked.length) await new Promise((resolve) => setTimeout(resolve, 5));
      expect(await rescan.cancelSpamRescan(f.accountId)).toBe(true);
      release();
      return job;
    }, {
      runChecks: async (_accountId, candidates, options) => {
        for (const candidate of candidates) {
          if (options.isCancelled()) break;
          checked.push(candidate.id);
          await gate;
        }
        return { ...EMPTY_SPAM_USAGE, calls: checked.length };
      }
    });
    expect(checked).toHaveLength(1);
    expect((await rescan.loadSpamRescanState(f.accountId)).job).toMatchObject({ status: "cancelled", error: null });

    // A row another (stopped) process left running is reported as interrupted.
    const master = await getDb();
    master.prepare("UPDATE spam_rescan_jobs SET status = 'running', ownerInstance = 'stopped-process', error = NULL WHERE accountId = ?").run(f.accountId);
    expect((await rescan.loadSpamRescanState(f.accountId)).job).toMatchObject({ status: "cancelled", error: "interrupted" });
    expect(await rescan.listSpamRescanActivity(ADMIN)).not.toContainEqual(expect.objectContaining({ accountId: f.accountId }));
  });

  test("the server-flag phase counts the whole INBOX it reads, the model limit follows the live count", async () => {
    const f = await fixture();
    await f.seed(f.mail({ subject: "Im Zeitraum" }), f.mail({ subject: "Älter", dateValue: Date.now() - 90 * DAY }));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await f.run(async () => {
      // The admin saw 50 (stale count); one unchecked row is in the range now.
      const job = await rescan.startSpamRescan({ accountId: f.accountId, period: "30d", withModel: true, modelLimit: 50, userId: ADMIN });
      expect(job).toMatchObject({ modelLimit: 1, counts: { inboxRows: 1 } });
      // The first progress write is asynchronous; it lands before the gated scan reads anything.
      for (let tries = 0; tries < 200 && (await rescan.loadSpamRescanState(f.accountId)).job?.total !== 2; tries += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect((await rescan.loadSpamRescanState(f.accountId)).job).toMatchObject({ status: "running", phase: "server-flag", total: 2 });
      release();
    }, { loadStaticRules: async () => { await gate; return EMPTY_STATIC_RULES; } });
    expect(f.model.doGenerateCalls).toHaveLength(1);
  });

  test("the move result counts errors from the items: a later run keeps earlier errors, a retry clears them", async () => {
    const f = await fixture();
    const [broken, fine, later] = await f.seed(f.mail({ subject: "Kaputt" }), f.mail({ subject: "Gut" }), f.mail({ subject: "Später" }));
    const job = await f.run(() => rescan.startSpamRescan({ accountId: f.accountId, period: "30d", withModel: true, modelLimit: 3, userId: ADMIN }));
    let failing = true;
    const imapMove: SpamRescanDeps["moveToJunk"] = async ({ message }) => {
      if (failing && message.id === broken.id) throw new Error("IMAP down");
      await f.db.prepare("UPDATE messages SET folderId = ?, mailboxPath = 'Junk' WHERE accountId = ? AND id = ?").run(f.junkId, f.accountId, message.id);
      return { junkFolderId: f.junkId, junkMailbox: "Junk", flags: [], previousMessageId: message.id, messageId: message.id };
    };
    const moveIds = (ids: string[]) => f.run(() => rescan.startSpamRescanMove({ accountId: f.accountId, jobId: job.id, ids, userId: ADMIN }), { moveToJunk: imapMove });
    const counts = async () => (await rescan.loadSpamRescanState(f.accountId)).job?.counts;
    await moveIds([broken.id, fine.id]);
    expect(await counts()).toMatchObject({ moved: 1, errors: 1 });
    await moveIds([later.id]);
    expect(await counts()).toMatchObject({ moved: 2, errors: 1 });
    failing = false;
    await moveIds([broken.id]);
    expect(await counts()).toMatchObject({ moved: 3, gone: 0, changed: 0, errors: 0 });
  });

  test("moving a job scanned by an earlier process is not reset by reconcile", async () => {
    const f = await fixture();
    const [first, second] = await f.seed(f.mail({ subject: "Eins" }), f.mail({ subject: "Zwei" }));
    const job = await f.run(() => rescan.startSpamRescan({ accountId: f.accountId, period: "30d", withModel: true, modelLimit: 2, userId: ADMIN }));
    const master = await getDb();
    // The scan ran before a restart: its row carries the stopped process's id.
    master.prepare("UPDATE spam_rescan_jobs SET ownerInstance = 'stopped-process' WHERE id = ?").run(job.id);
    const other = await fixture();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let moving!: () => void;
    const started = new Promise<void>((resolve) => { moving = resolve; });
    const moved: string[] = [];
    await f.run(async () => {
      expect(await rescan.startSpamRescanMove({ accountId: f.accountId, jobId: job.id, ids: [first.id, second.id], userId: ADMIN })).toBe(2);
      await started;
      // A job another process left running makes the next read reconcile; the running move must survive it.
      master.prepare(`INSERT INTO spam_rescan_jobs (id, accountId, status, period, withModel, modelLimit, ownerInstance, createdByUserId, createdAt, updatedAt)
        VALUES (?, ?, 'running', 'all', 0, 0, 'stopped-process', ?, ?, ?)`).run(crypto.randomUUID(), other.accountId, ADMIN, Date.now(), Date.now());
      expect((await rescan.loadSpamRescanState(other.accountId)).job).toMatchObject({ status: "cancelled", error: "interrupted" });
      expect((await rescan.loadSpamRescanState(f.accountId)).job).toMatchObject({ status: "moving", error: null });
      await expect(rescan.startSpamRescanMove({ accountId: f.accountId, jobId: job.id, ids: [first.id, second.id], userId: ADMIN }))
        .rejects.toMatchObject({ name: "SpamRescanBusyError" });
      release();
    }, {
      moveToJunk: async ({ message }) => {
        moved.push(message.id);
        moving();
        await gate;
        await f.db.prepare("UPDATE messages SET folderId = ?, mailboxPath = 'Junk' WHERE accountId = ? AND id = ?").run(f.junkId, f.accountId, message.id);
        return { junkFolderId: f.junkId, junkMailbox: "Junk", flags: [], previousMessageId: message.id, messageId: message.id };
      }
    });
    expect(moved.sort()).toEqual([first.id, second.id].sort());
    const state = await rescan.loadSpamRescanState(f.accountId);
    expect(state.job).toMatchObject({ status: "ready", error: null, counts: { moved: 2, gone: 0, changed: 0, errors: 0 } });
    expect(state.items.map((item) => item.moveStatus)).toEqual(["moved", "moved"]);
  });

  test("deleting the mailbox removes its rescan rows (they name senders and subjects)", async () => {
    const f = await fixture();
    await f.flagged("winner@lottery.invalid");
    const job = await f.run(() => rescan.startSpamRescan({ accountId: f.accountId, period: "all", withModel: false, modelLimit: 0, userId: ADMIN }));
    const master = await getDb();
    const count = (table: string, column: string, value: string) => (master.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`).get(value) as { n: number }).n;
    expect(count("spam_rescan_items", "jobId", job.id)).toBe(1);
    expect(await f.api.deleteAccountControlPlane(f.accountId)).toBe(true);
    expect(count("spam_rescan_jobs", "accountId", f.accountId)).toBe(0);
    expect(count("spam_rescan_items", "jobId", job.id)).toBe(0);
  });

  test("mail that changed after the scan stays in the INBOX", async () => {
    const f = await fixture();
    const [first, second] = await f.seed(f.mail({ subject: "Eins" }), f.mail({ subject: "Zwei" }));
    const job = await f.run(() => rescan.startSpamRescan({ accountId: f.accountId, period: "30d", withModel: true, modelLimit: 2, userId: ADMIN }));
    // A user marked one „Kein Spam“ and flagged the other meanwhile.
    await f.api.saveSpamVerdict(f.accountId, first.id, { verdict: "ham", confidence: 1, reasons: [] });
    await f.db.prepare("UPDATE messages SET flagged = 1 WHERE accountId = ? AND id = ?").run(f.accountId, second.id);
    await f.run(() => rescan.startSpamRescanMove({ accountId: f.accountId, jobId: job.id, ids: [first.id, second.id], userId: ADMIN }));
    expect(f.moved).toEqual([]);
    const state = await rescan.loadSpamRescanState(f.accountId);
    expect(state.job?.counts).toMatchObject({ moved: 0, changed: 2 });
    expect(state.items.map((item) => item.moveStatus)).toEqual(["changed", "changed"]);
  });
});


test("protected hits before the cap do not hide older movable hits or truncation", async () => {
  const f = await fixture();
  const now = Date.now();
  const insert = f.db.prepare(`INSERT INTO messages(id,accountId,folderId,threadId,subject,fromAddr,toAddr,preview,body,date,dateValue,spamVerdict,spamCheckedAt,flagged,flags)
    VALUES(?,?,?,'synthetic-thread','','','','','','',?,'spam',?, ?, ?)`);
  f.db.transaction(() => {
    for (let index = 0; index < 5001; index++) insert.run(`protected-${index}`, f.accountId, f.folderId, now, now, 1, '["NONJUNK"]');
    for (let index = 0; index < 5001; index++) insert.run(`movable-${index}`, f.accountId, f.folderId, now - 1000, now, 0, '[]');
  })();
  await f.run(() => rescan.startSpamRescan({ accountId: f.accountId, period: "all", withModel: true, modelLimit: 0, userId: ADMIN }));
  const state = await rescan.loadSpamRescanState(f.accountId);
  expect(state.items).toHaveLength(5000);
  expect(state.items.every(item => item.id.startsWith("movable-"))).toBe(true);
  expect(state.job?.counts.truncated).toBe(true);
});


test("a failed example write after a successful move leaves the item moved", async () => {
  const f = await fixture();
  const [message] = await f.seed(f.mail());
  const job = await f.run(() => rescan.startSpamRescan({ accountId: f.accountId, period: "all", withModel: true, modelLimit: 1, userId: ADMIN }));
  f.db.exec("CREATE TRIGGER synthetic_example_failure BEFORE INSERT ON spam_examples BEGIN SELECT RAISE(ABORT,'synthetic example failure'); END");
  try {
    await f.run(() => rescan.startSpamRescanMove({ accountId: f.accountId, jobId: job.id, ids: [message.id], userId: ADMIN }));
    const state = await rescan.loadSpamRescanState(f.accountId);
    expect(state.items.find(item => item.id === message.id)?.moveStatus).toBe("moved");
    expect(state.job?.counts).toMatchObject({ moved: 1, errors: 0 });
    expect(await f.run(() => rescan.startSpamRescanMove({ accountId: f.accountId, jobId: job.id, ids: [message.id], userId: ADMIN }))).toBe(0);
    expect(f.moved).toEqual([message.id]);
  } finally { f.db.exec("DROP TRIGGER synthetic_example_failure"); }
});


test("stage B applies static rules without a model and leaves other mail unchecked", async () => {
  const f = await fixture();
  const [denied, undecided] = await f.seed(f.mail({ from: "Blocked <blocked@lottery.invalid>" }), f.mail({ from: "Unknown <unknown@lottery.invalid>" }));
  const previous = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const restoreService = replaceSpamServiceDeps({ languageModel: () => { throw new Error("static-only must not load a model"); } });
  const restoreRescan = rescan.replaceSpamRescanDeps({ loadStaticRules: async () => EMPTY_STATIC_RULES });
  try {
    const restoreRules = replaceSpamServiceDeps({ loadStaticRules: async () => ({ ...EMPTY_STATIC_RULES,
      deny: [{ type: "address", value: "blocked@lottery.invalid", safe: true }] }) });
    try {
      await rescan.startSpamRescan({ accountId: f.accountId, period: "all", withModel: true, modelLimit: 2, userId: ADMIN });
      await rescan.spamRescansIdle();
      const state = await rescan.loadSpamRescanState(f.accountId);
      expect(state.job?.counts).toMatchObject({ modelBlocked: "missing-key", modelChecked: 2, modelCalls: 0 });
      expect(state.items.map(item => item.id)).toEqual([denied.id]);
      expect((await f.api.getMessageById(f.accountId, undecided.id))?.spamVerdict).toBeUndefined();
    } finally { restoreRules(); }
  } finally {
    restoreRescan(); restoreService();
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previous;
  }
});


test("stage B pages only to the remaining room after stage A, with one truncation lookahead", async () => {
  const f = await fixture();
  await f.flagged("first@lottery.invalid");
  await f.flagged("second@lottery.invalid");
  const now = Date.now();
  const insert = f.db.prepare(`INSERT INTO messages(id,accountId,folderId,threadId,subject,fromAddr,toAddr,preview,body,date,dateValue,spamVerdict,spamCheckedAt,flags)
    VALUES(?,?,?,'synthetic-thread','','','','','','',?,'spam',?,'[]')`);
  f.db.transaction(() => {
    for (let index = 0; index < 5001; index++) insert.run(`marked-${index}`, f.accountId, f.folderId, now, now);
  })();
  const prepare = spyOn(f.db, "prepare");
  try {
    await f.run(() => rescan.startSpamRescan({ accountId: f.accountId, period: "all", withModel: true, modelLimit: 0, userId: ADMIN }));
    const state = await rescan.loadSpamRescanState(f.accountId);
    expect(state.items).toHaveLength(5000);
    expect(state.job?.counts).toMatchObject({ serverFlagSelected: 2, classifierMarked: 4998, items: 5000, truncated: true });
    const pages = prepare.mock.calls.filter(([sql]) => String(sql).includes("spamVerdict = 'spam' AND folderId"));
    expect(pages).toHaveLength(10);
    expect(state.items.filter(item => item.stage === "classifier")).toHaveLength(4998);
  } finally { prepare.mockRestore(); }
});
