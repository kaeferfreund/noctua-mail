import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { claimSend, expandCampaign } from "./queue";
import { createQueueFixture, fixtureAccountId as accountId, fixtureStart as start } from "./queueTestFixture";

test("claiming from 1,000 queued rows stays fast and keeps the claim order", () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db, { sendRatePerMinute: 1_000 });
    for (let index = 0; index < 1_000; index += 1) f.addContact(`c${String(index).padStart(4, "0")}`);
    const campaign = f.campaign();
    expandCampaign(db, campaign, f.recipients.get(accountId)!, start);
    // Earlier due dates come first, then queue time, then id.
    db.query("UPDATE sends SET sendAt = ? WHERE accountId = ? AND contactId = 'c0999'").run(start - 1, accountId);
    const claims: string[] = [];
    const began = performance.now();
    for (let index = 0; index < 10; index += 1) claims.push(claimSend(db, accountId, "owner", start)!.contactId!);
    const elapsed = performance.now() - began;
    // The correlated subquery took about 0.7 s per claim at this size.
    expect(elapsed).toBeLessThan(500);
    const ids = (db.query(`SELECT contactId FROM sends WHERE accountId = ? AND status = 'sending' ORDER BY sendAt, queuedAt, id`)
      .all(accountId) as Array<{ contactId: string }>).map(row => row.contactId);
    expect(claims[0]).toBe("c0999");
    expect(new Set(claims)).toEqual(new Set(ids));
  } finally {
    db.close();
  }
});
