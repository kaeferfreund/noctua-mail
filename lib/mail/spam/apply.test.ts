import { describe, expect, test } from "bun:test";
import { applySpamItems, parseSpamEvalRecords, selectSpamApplyItems, type SpamEvalRecord } from "./apply";

const record = (id: string, overrides: Partial<SpamEvalRecord> = {}): SpamEvalRecord => ({
  accountId: "acc-a", id, label: "ham", decision: "spam", source: "model", confidence: 0.95,
  subject: `Betreff ${id}`, fromEmail: `${id}@example.test`, mailboxPath: "INBOX", serverSpamFlag: false,
  ...overrides
});

describe("spam apply", () => {
  test("selects by label, decision and account, each message once", () => {
    const records = parseSpamEvalRecords({ items: [
      record("m1"),
      record("m2", { decision: "unsure" }),
      record("m3", { label: "spam" }),
      record("m4", { accountId: "acc-b" }),
      record("m1"),
      { id: "broken" }
    ] });
    expect(records).toHaveLength(5);
    expect(selectSpamApplyItems(records, { label: "ham", decision: "spam" }).map((item) => item.id)).toEqual(["m1", "m4"]);
    expect(selectSpamApplyItems(records, { label: "ham", decision: "spam", accountId: "acc-b" }).map((item) => item.id)).toEqual(["m4"]);
    expect(selectSpamApplyItems(records, { label: "ham", decision: "unsure" }).map((item) => item.id)).toEqual(["m2"]);
    expect(() => parseSpamEvalRecords({})).toThrow();
  });

  test("moves only rows still in the INBOX, sequentially, and keeps going after a failure", async () => {
    const rows: Record<string, { mailboxPath: string | null } | null> = {
      m1: { mailboxPath: "INBOX" }, m2: null, m3: { mailboxPath: "Junk" }, m4: { mailboxPath: "inbox" }, m5: { mailboxPath: "INBOX" }
    };
    const moved: string[] = [];
    const lines: string[] = [];
    let running = 0;
    const counts = await applySpamItems(["m1", "m2", "m3", "m4", "m5"].map((id) => record(id)), {
      dryRun: false,
      lookup: async (item) => rows[item.id],
      move: async (item) => {
        running += 1;
        expect(running).toBe(1);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running -= 1;
        if (item.id === "m5") throw new Error("IMAP down");
        moved.push(item.id);
        return "Junk";
      },
      log: (line) => lines.push(line)
    });
    expect(moved).toEqual(["m1", "m4"]);
    expect(counts).toEqual({ moved: 2, "would-move": 0, missing: 1, "not-in-inbox": 1, error: 1 });
    expect(lines).toEqual([
      "Betreff m1 — m1@example.test — moved → Junk",
      "Betreff m2 — m2@example.test — missing",
      "Betreff m3 — m3@example.test — not-in-inbox (Junk)",
      "Betreff m4 — m4@example.test — moved → Junk",
      "Betreff m5 — m5@example.test — error: IMAP down"
    ]);
  });

  test("dry run never calls move", async () => {
    let calls = 0;
    const counts = await applySpamItems([record("m1"), record("m2")], {
      dryRun: true,
      lookup: async (item) => (item.id === "m1" ? { mailboxPath: "INBOX" } : { mailboxPath: "Archiv" }),
      move: async () => { calls += 1; },
      log: () => {}
    });
    expect(calls).toBe(0);
    expect(counts).toMatchObject({ "would-move": 1, "not-in-inbox": 1, moved: 0 });
  });
});
