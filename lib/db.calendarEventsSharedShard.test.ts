import { describe, expect, test } from "bun:test";
import type { CalendarEvent } from "./data";
import { createSharedShardFixture } from "./testSharedShardHarness";

function buildEvent(accountId: string, id: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    accountId,
    eventUid: `${id}@example.test`,
    summary: "Synthetic meeting",
    startAtMs: Date.UTC(2026, 10, 2, 9, 0, 0),
    endAtMs: Date.UTC(2026, 10, 2, 10, 0, 0),
    allDay: false,
    sourceType: "local",
    createdAtMs: 1,
    updatedAtMs: 1,
    ...overrides
  };
}

describe("calendar event writes in a legacy shared shard", () => {
  test("a write with another mailbox's event id fails and leaves that row untouched", async () => {
    const { a, b, db } = await createSharedShardFixture();
    const eventId = `cal-${crypto.randomUUID()}`;
    await b.api.upsertCalendarEvent(b.accountId, buildEvent(b.accountId, eventId, { summary: "B private" }));

    await expect(
      a.api.upsertCalendarEvent(a.accountId, buildEvent(a.accountId, eventId, { summary: "A takeover" }))
    ).rejects.toThrow("belongs to another mailbox");
    // Even a caller that hands over a mismatched accountId field cannot write
    // under the other mailbox's id.
    await expect(
      a.api.upsertCalendarEvent(a.accountId, buildEvent(b.accountId, eventId, { summary: "A takeover" }))
    ).rejects.toThrow("belongs to another mailbox");

    expect((await b.api.getCalendarEventById(b.accountId, eventId))?.summary).toBe("B private");
    expect(await a.api.getCalendarEventById(a.accountId, eventId)).toBeNull();
    expect(db.prepare("SELECT accountId FROM calendar_events WHERE id = ?").all(eventId)).toEqual([
      { accountId: b.accountId }
    ]);
  });

  test("an update of the mailbox's own event still works", async () => {
    const { a } = await createSharedShardFixture();
    const eventId = `cal-${crypto.randomUUID()}`;
    await a.api.upsertCalendarEvent(a.accountId, buildEvent(a.accountId, eventId, { summary: "First" }));
    await a.api.upsertCalendarEvent(a.accountId, buildEvent(a.accountId, eventId, { summary: "Second" }));
    expect((await a.api.getCalendarEventById(a.accountId, eventId))?.summary).toBe("Second");
  });

  test("a conflict record write cannot move another mailbox's conflict row", async () => {
    const { a, b, db } = await createSharedShardFixture();
    const eventId = `cal-${crypto.randomUUID()}`;
    const conflict = (accountId: string, localIcs: string) => ({
      eventId,
      accountId,
      eventUid: `${eventId}@example.test`,
      allDay: false,
      localIcs,
      remoteIcs: "REMOTE",
      detectedAtMs: 1000
    });
    await b.api.upsertCalendarEventConflict(b.accountId, conflict(b.accountId, "B-LOCAL"));
    await a.api.upsertCalendarEventConflict(a.accountId, conflict(a.accountId, "A-LOCAL"));

    expect((await b.api.getCalendarEventConflict(b.accountId, eventId))?.localIcs).toBe("B-LOCAL");
    expect(await a.api.getCalendarEventConflict(a.accountId, eventId)).toBeNull();
    expect(db.prepare("SELECT accountId FROM calendar_event_conflicts WHERE eventId = ?").all(eventId)).toEqual([
      { accountId: b.accountId }
    ]);
  });
});
