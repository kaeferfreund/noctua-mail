import { describe, expect, test } from "bun:test";
import { parseReviewedServerFlagItems, planServerFlagApply, serverFlagApplyRecords, type ServerFlagItem } from "./serverFlagBackfill";

const item = (id: string, overrides: Partial<ServerFlagItem> = {}): ServerFlagItem => ({
  accountId: "acc-a", id, messageId: `<${id}@example.test>`, from: `${id}@sender.example.test`, fromEmail: `${id}@sender.example.test`,
  subject: `Angebot ${id}`, date: "2026-01-01T00:00:00.000Z", dateValue: Date.parse("2026-01-01T00:00:00.000Z"), score: 7.1, senderUnflagged: 0, domainUnflagged: 0, decision: "move", reasons: [], ...overrides
});

describe("server-flag backfill plan", () => {
  test("only reviewed items still marked move count; deleting an entry keeps the mail", () => {
    const reviewed = parseReviewedServerFlagItems({ items: [
      item("m1"), item("m2", { decision: "flagged", reasons: ["flagged"] }), { id: "broken" }, item("m4")
    ] });
    expect(reviewed.map((entry) => entry.id)).toEqual(["m1", "m4"]);
    expect(() => parseReviewedServerFlagItems([item("m1")])).toThrow("--only must be");
  });

  test("moves what the current data still selects and reports the rest", () => {
    const reviewed = [item("m1"), item("m2"), item("m3"), item("m4"), item("m1")];
    const current = [
      item("m1"),
      item("m2", { decision: "answered", reasons: ["answered"] }),
      item("m4", { messageId: "<other@example.test>" })
    ];
    const plan = planServerFlagApply(reviewed, current);
    expect(plan.move.map((entry) => entry.id)).toEqual(["m1"]);
    expect(plan.nowExcluded.map((entry) => [entry.id, entry.reasons])).toEqual([["m2", ["answered"]]]);
    // m3 left the INBOX (moved or deleted), m4 is a different mail under the same row id.
    expect(plan.gone.map((entry) => entry.id)).toEqual(["m3", "m4"]);
  });

  test("apply records carry the backfill source and only move decisions", () => {
    expect(serverFlagApplyRecords([item("m1"), item("m2", { decision: "collab", reasons: ["collab"] })])).toEqual([{
      accountId: "acc-a", id: "m1", label: "ham", decision: "spam", source: "server-flag-backfill", confidence: null,
      subject: "Angebot m1", fromEmail: "m1@sender.example.test", mailboxPath: "INBOX", serverSpamFlag: true
    }]);
  });
});
