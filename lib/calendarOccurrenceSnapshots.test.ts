import { describe, expect, test } from "bun:test";
import type { CalendarEvent, CalendarEventEmailSnapshotFields } from "./data";
import {
  compactOccurrenceSnapshots,
  expandOccurrenceSnapshots,
  selectCalendarEventEmailSnapshot,
  toCalendarEventResponse
} from "./calendarEventEmailSnapshot";
import { dbModulePromise } from "./testDbHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";

const body = "synthetic body ".repeat(20_000); // ~300 KB
const reschedule: CalendarEventEmailSnapshotFields = {
  sourceSubject: "Updated: synthetic series",
  sourceFromAddr: "organizer@example.test",
  sourceDateMs: 1_700_000_000_000,
  sourceBodyText: body,
  sourceBodyHtml: `<p>${body}</p>`
};
const other: CalendarEventEmailSnapshotFields = { sourceSubject: "Other mail", sourceBodyText: "short" };

function occurrenceMap(count: number) {
  const map: Record<string, CalendarEventEmailSnapshotFields> = {};
  for (let index = 0; index < count; index += 1) {
    map[String(1_800_000_000_000 + index * 86_400_000)] = reschedule;
  }
  return map;
}

describe("occurrence snapshot storage", () => {
  test("one email's snapshot is stored once for all occurrences it changed", () => {
    const compact = compactOccurrenceSnapshots({ ...occurrenceMap(200), "1": other })!;
    const serialized = JSON.stringify(compact);
    expect(serialized.length).toBeLessThan(2 * JSON.stringify(reschedule).length);
    const expanded = expandOccurrenceSnapshots(JSON.parse(serialized))!;
    expect(Object.keys(expanded)).toHaveLength(201);
    expect(expanded["1"]).toEqual(other);
    for (const key of Object.keys(occurrenceMap(200))) expect(expanded[key]).toEqual(reschedule);
  });

  test("equal snapshots parsed separately are also stored once", () => {
    const copies = JSON.parse(JSON.stringify(occurrenceMap(3))) as Record<string, CalendarEventEmailSnapshotFields>;
    expect(Object.values(compactOccurrenceSnapshots(copies)!).filter((value) => "sourceBodyText" in value)).toHaveLength(1);
  });

  test("rows in the old full form read unchanged and dangling references are dropped", () => {
    const legacy = { "10": reschedule, "20": other };
    expect(expandOccurrenceSnapshots(JSON.parse(JSON.stringify(legacy)))).toEqual(legacy);
    expect(expandOccurrenceSnapshots({ "10": { sameAs: "missing" }, "20": other })).toEqual({ "20": other });
    expect(expandOccurrenceSnapshots({ "10": { sameAs: "20" }, "20": { sameAs: "10" } })).toBeUndefined();
  });

  test("the response form is compact and still selects the occurrence snapshot", () => {
    const event = { occurrenceSnapshots: occurrenceMap(50), sourceSubject: "Series" } as Pick<
      CalendarEvent,
      "occurrenceSnapshots" | "sourceSubject"
    >;
    const wire = JSON.parse(JSON.stringify(toCalendarEventResponse(event)));
    expect(JSON.stringify(wire).length).toBeLessThan(2 * JSON.stringify(reschedule).length);
    const lastKey = Object.keys(occurrenceMap(50)).at(-1)!;
    expect(selectCalendarEventEmailSnapshot(wire, Number(lastKey)).sourceSubject).toBe(reschedule.sourceSubject);
    expect(selectCalendarEventEmailSnapshot(wire, 5).sourceSubject).toBe("Series");
  });

  test("the database column holds a single copy of the body", async () => {
    const api = await dbModulePromise;
    const accountId = `acc-snapshots-${crypto.randomUUID()}`;
    await api.upsertAccount(identityTestAccount(accountId));
    const event = await api.upsertCalendarEventByUid(accountId, {
      eventUid: `series-${crypto.randomUUID()}@example.test`,
      summary: "Synthetic series",
      startAtMs: 1_800_000_000_000,
      allDay: false,
      recurrenceRule: "FREQ=DAILY",
      sourceType: "email",
      occurrenceSnapshots: occurrenceMap(200)
    });
    const { getAccountDb } = await import("./db/connection");
    const db = await getAccountDb(accountId);
    const row = db
      .prepare("SELECT length(occurrenceSnapshots) AS size FROM calendar_events WHERE accountId = ? AND id = ?")
      .get(accountId, event.id) as { size: number };
    expect(row.size).toBeLessThan(2 * JSON.stringify(reschedule).length);
    const stored = await api.getCalendarEventById(accountId, event.id);
    expect(Object.keys(stored?.occurrenceSnapshots ?? {})).toHaveLength(200);
    expect(Object.values(stored?.occurrenceSnapshots ?? {})[199]).toEqual(reschedule);
  });
});
