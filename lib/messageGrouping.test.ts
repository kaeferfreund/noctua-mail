import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import {
  buildMessageGroupKey,
  createDisplayDayContext,
  buildTimeGroupKey,
  buildWeekGroupKey,
  buildInviteDeckGroupKeyFromBounds,
  DATE_GROUP_ORDER,
  INVITE_DECK_GROUP_BY,
  INVITE_DECK_GROUP_ORDER,
  sortGroupsForGroupBy
} from "./messageGrouping";
import { buildInviteDeckGroupKeyFromEvent } from "./inviteDeckGrouping";

function localDateMs(year: number, monthIndex: number, day: number, hour = 0) {
  // Fixtures represent Berlin wall time, independently of the test host zone.
  return new Date(`${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+01:00`).getTime();
}

describe("buildTimeGroupKey", () => {
  const nowMs = localDateMs(2026, 1, 28, 12);

  it("keeps invite deck grouped into UPCOMING and PAST", () => {
    expect(buildTimeGroupKey(localDateMs(2026, 1, 28, 9), INVITE_DECK_GROUP_BY, nowMs)).toBe(
      "UPCOMING"
    );
    expect(buildTimeGroupKey(localDateMs(2026, 2, 2, 9), INVITE_DECK_GROUP_BY, nowMs)).toBe(
      "UPCOMING"
    );
    expect(buildTimeGroupKey(localDateMs(2026, 1, 27, 23), INVITE_DECK_GROUP_BY, nowMs)).toBe(
      "PAST"
    );
  });

  it("keeps standard date grouping unchanged", () => {
    expect(buildTimeGroupKey(localDateMs(2026, 1, 28, 9), "date", nowMs)).toBe("Today");
    expect(buildTimeGroupKey(localDateMs(2026, 1, 27, 12), "date", nowMs)).toBe("Yesterday");
    expect(buildTimeGroupKey(localDateMs(2026, 1, 24, 12), "date", nowMs)).toBe("This Week");
    expect(buildTimeGroupKey(localDateMs(2026, 1, 10, 12), "date", nowMs)).toBe("Older");
  });
});

describe("buildMessageGroupKey", () => {
  const message = { dateValue: Date.UTC(2025, 11, 31, 22, 30), from: "Sender <sender@example.test>", folderId: "acc:INBOX" };

  it("derives the year in the display zone, from the thread date when given", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Berlin.
    expect(buildMessageGroupKey({ ...message, dateValue: Date.UTC(2025, 11, 31, 23, 30) }, "year")).toBe("2026");
    expect(buildMessageGroupKey(message, "year")).toBe("2025");
    expect(buildMessageGroupKey(message, "year", Date.UTC(2026, 0, 1, 12))).toBe("2026");
  });

  it("keeps non-date groupings independent of the date", () => {
    expect(buildMessageGroupKey(message, "domain")).toBe("example.test");
    expect(buildMessageGroupKey(message, "sender")).toBe("Sender <sender@example.test>");
    expect(buildMessageGroupKey(message, "folder")).toBe("acc:INBOX");
    expect(buildMessageGroupKey(message, "none")).toBe("All");
  });
});

describe("buildWeekGroupKey", () => {
  it("keeps the existing Monday-based week keys with Monday-based week numbering", () => {
    expect(buildWeekGroupKey(localDateMs(2026, 0, 1, 12))).toBe("2026-W00");
    expect(buildWeekGroupKey(localDateMs(2026, 0, 5, 12))).toBe("2026-W01");
    expect(buildWeekGroupKey(localDateMs(2025, 11, 31, 12))).toBe("2025-W52");
    expect(buildWeekGroupKey(localDateMs(2024, 5, 17, 12))).toBe("2024-W25");
    expect(buildWeekGroupKey(localDateMs(2024, 5, 23, 12))).toBe("2024-W25");
    expect(buildWeekGroupKey(localDateMs(2024, 5, 24, 12))).toBe("2024-W26");
  });
});

describe("createDisplayDayContext", () => {
  afterEach(() => setSystemTime());

  it("yields the uncached group keys across midnight, both DST changes and LMT dates (frozen clock)", () => {
    const hour = 3_600_000;
    // Berlin wall-clock midnights and DST switches (29 Mar / 25 Oct 2026), plus pre-1893 local mean time.
    const anchors = [
      Date.UTC(2026, 2, 28, 23), Date.UTC(2026, 2, 29, 0, 59, 59, 999), Date.UTC(2026, 2, 29, 1), Date.UTC(2026, 2, 29, 22),
      Date.UTC(2026, 9, 24, 22), Date.UTC(2026, 9, 25, 0, 59, 59, 999), Date.UTC(2026, 9, 25, 1), Date.UTC(2026, 9, 25, 23),
      Date.UTC(2026, 9, 26, 22, 59, 59, 999), Date.UTC(2026, 9, 26, 23), Date.UTC(1880, 5, 1, 23, 6, 31), Date.UTC(1880, 5, 1, 23, 6, 32)
    ];
    const values = anchors.flatMap(anchor => [-8 * 24, -24, -2, -1, 0, 1, 2, 24, 7 * 24].map(offset => anchor + offset * hour))
      .concat(anchors, anchors.map(anchor => anchor - 1));
    const groupings = ["date", INVITE_DECK_GROUP_BY, "week", "year", "sender"];
    const message = { dateValue: 0, from: "Sender <sender@example.test>", folderId: "acc:INBOX" };
    let compared = 0;
    for (const nowMs of anchors.slice(0, 10)) {
      setSystemTime(new Date(nowMs));
      const days = createDisplayDayContext();
      expect(days.nowMs).toBe(nowMs);
      for (const groupBy of groupings) {
        for (const value of values) {
          // Twice: the second call is served by the memo.
          for (let pass = 0; pass < 2; pass++) {
            expect(buildMessageGroupKey({ ...message, dateValue: value }, groupBy, undefined, days))
              .toBe(buildMessageGroupKey({ ...message, dateValue: value }, groupBy));
            expect(buildMessageGroupKey(message, groupBy, value, days)).toBe(buildMessageGroupKey(message, groupBy, value));
            compared += 2;
          }
        }
      }
    }
    expect(compared).toBe(10 * groupings.length * values.length * 4);
  });

  it("keeps one clock reading for the whole list", () => {
    const beforeMidnight = Date.UTC(2026, 9, 26, 22, 59, 59, 999);
    setSystemTime(new Date(beforeMidnight));
    const days = createDisplayDayContext();
    setSystemTime(new Date(beforeMidnight + 1));
    const message = { dateValue: beforeMidnight, from: "", folderId: "" };
    expect(buildMessageGroupKey(message, "date")).toBe("Yesterday");
    expect(buildMessageGroupKey(message, "date", undefined, days)).toBe("Today");
  });
});

describe("sortGroupsForGroupBy", () => {
  it("sorts invite deck buckets as UPCOMING then PAST", () => {
    const groups = sortGroupsForGroupBy(
      [{ key: "PAST" }, { key: "UPCOMING" }],
      INVITE_DECK_GROUP_BY
    );
    expect(groups.map((group) => group.key)).toEqual([...INVITE_DECK_GROUP_ORDER]);
  });

  it("sorts standard date buckets with the existing order", () => {
    const groups = sortGroupsForGroupBy(
      [{ key: "Older" }, { key: "Today" }, { key: "This Week" }, { key: "Yesterday" }],
      "date"
    );
    expect(groups.map((group) => group.key)).toEqual([...DATE_GROUP_ORDER]);
  });
});

describe("buildInviteDeckGroupKeyFromEvent", () => {
  const nowMs = localDateMs(2026, 1, 28, 12);

  it("treats recurring events with future instances as UPCOMING", () => {
    expect(
      buildInviteDeckGroupKeyFromEvent(
        {
          eventStartAtMs: localDateMs(2026, 1, 1, 9),
          eventEndAtMs: localDateMs(2026, 1, 1, 10),
          recurrenceRule: "FREQ=WEEKLY"
        },
        nowMs
      )
    ).toBe("UPCOMING");
  });

  it("treats in-progress events as UPCOMING", () => {
    expect(
      buildInviteDeckGroupKeyFromEvent(
        {
          eventStartAtMs: localDateMs(2026, 1, 28, 11),
          eventEndAtMs: localDateMs(2026, 1, 28, 13)
        },
        nowMs
      )
    ).toBe("UPCOMING");
  });

  it("treats ended one-off events as PAST", () => {
    expect(
      buildInviteDeckGroupKeyFromEvent(
        {
          eventStartAtMs: localDateMs(2026, 1, 27, 9),
          eventEndAtMs: localDateMs(2026, 1, 27, 10)
        },
        nowMs
      )
    ).toBe("PAST");
  });
});

describe("buildInviteDeckGroupKeyFromBounds", () => {
  const nowMs = localDateMs(2026, 1, 28, 12);

  it("treats bounded events ending in the past as PAST", () => {
    expect(
      buildInviteDeckGroupKeyFromBounds(
        {
          eventFirstStartAtMs: localDateMs(2026, 1, 27, 9),
          eventLastEndAtMs: localDateMs(2026, 1, 27, 10)
        },
        nowMs
      )
    ).toBe("PAST");
  });

  it("treats unbounded events as UPCOMING", () => {
    expect(
      buildInviteDeckGroupKeyFromBounds(
        {
          eventFirstStartAtMs: localDateMs(2026, 1, 1, 9),
          eventLastEndAtMs: null
        },
        nowMs
      )
    ).toBe("UPCOMING");
  });
});
