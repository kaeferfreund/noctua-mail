import { describe, expect, test } from "bun:test";
import { createSharedShardFixture } from "@/lib/testSharedShardHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { POST } from "./route";

const origin = "http://localhost:3000";

describe("calendar event POST in a shared shard", () => {
  test("an editor of mailbox A cannot overwrite mailbox B's event by its id", async () => {
    const { a, b } = await createSharedShardFixture();
    const user = await createAuthenticatedTestSession();
    await user.addMembership(user.user.id, a.accountId, "editor");
    const eventId = `cal-${crypto.randomUUID()}`;
    await b.api.upsertCalendarEvent(b.accountId, {
      id: eventId,
      accountId: b.accountId,
      eventUid: `${eventId}@example.test`,
      summary: "B private",
      startAtMs: Date.UTC(2026, 10, 2, 9, 0, 0),
      allDay: false,
      sourceType: "local",
      createdAtMs: 1,
      updatedAtMs: 1
    });

    const response = await POST(
      new Request(`${origin}/api/accounts/${a.accountId}/calendar/events`, {
        method: "POST",
        headers: user.jar.headers({ origin, "content-type": "application/json" }),
        body: JSON.stringify({ id: eventId, summary: "A takeover", startAtMs: Date.UTC(2026, 10, 3, 9, 0, 0) })
      }),
      { params: Promise.resolve({ accountId: a.accountId }) }
    );
    expect(response.status).toBe(404);
    expect((await b.api.getCalendarEventById(b.accountId, eventId))?.summary).toBe("B private");
    expect(await a.api.getCalendarEventById(a.accountId, eventId)).toBeNull();
  });
});
