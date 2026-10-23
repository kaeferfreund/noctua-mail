import { expect, test } from "bun:test";
import { getMessageDateDisplay } from "../dateFormatting";
import { buildTimeGroupKey } from "../messageGrouping";
import { messageGroupLabel } from "@/app/components/mailclient/utils/messageHelpers";
import { groupItemsByRelativeTime } from "@/app/components/mailclient/utils/relativeTimeGroups";
import { formatByteSize } from "../ui/byteSize";
import { displayDayNumber, formatRelativeTime } from "./format";

test("list and reader formats use the resolved locale and Berlin, preserving explicit date order", () => {
  const value = Date.parse("2026-10-22T12:30:00Z");
  expect(getMessageDateDisplay(value, "opaque fallback", "locale", "de").text).toBe("22.10.2026, 14:30");
  expect(getMessageDateDisplay(value, "opaque fallback", "ymd", "de").text).toBe("2026-10-22 14:30");
  expect(getMessageDateDisplay(value, "opaque fallback", "mdy", "de").text).toContain("10/22/2026");
  expect(getMessageDateDisplay(NaN, "opaque fallback", "locale", "de").text).toBe("opaque fallback");
  expect(formatByteSize(5_500_000, "de")).toBe("5,5\u00a0MB");
  expect(formatByteSize(5_500_000, "en")).toBe("5.5 MB");
  expect(formatRelativeTime(-5, "minute", "de")).toBe("vor 5 Minuten");
});

test("calendar days and stable group identities survive Berlin midnight and both DST transitions", () => {
  for (const [now, target] of [
    ["2026-10-23T00:15:00+02:00", "2026-10-22T23:45:00+02:00"],
    ["2026-03-30T00:15:00+02:00", "2026-03-29T00:15:00+01:00"],
    ["2026-10-26T00:15:00+01:00", "2026-10-25T00:15:00+02:00"]
  ]) {
    const nowMs = Date.parse(now), targetMs = Date.parse(target);
    expect(displayDayNumber(nowMs) - displayDayNumber(targetMs)).toBe(1);
    const key = buildTimeGroupKey(targetMs, "date", nowMs);
    expect(key).toBe("Yesterday");
    expect(messageGroupLabel(key, "date", "de")).toBe("Gestern");
    expect(messageGroupLabel(key, "date", "en")).toBe("Yesterday");
    const groups = groupItemsByRelativeTime([nowMs], x => x, targetMs, "de");
    expect(groups[0]).toMatchObject({ key: "tomorrow", label: "Morgen" });
  }
  // User/protocol values remain opaque even when they resemble an app label.
  expect(messageGroupLabel("Today", "sender", "de")).toBe("Today");
  expect(messageGroupLabel("INBOX", "folder", "de")).toBe("INBOX");
});

test("SQLite week buckets display their actual Berlin start, including W00 and year edges", () => {
  for (const [key, de, en] of [
    ["2026-W42", "Ab 19. Okt. 2026", "From 19 Oct 2026"],
    ["2026-W00", "Ab 1. Jan. 2026", "From 1 Jan 2026"],
    ["2026-W01", "Ab 5. Jan. 2026", "From 5 Jan 2026"],
    ["2026-W52", "Ab 28. Dez. 2026", "From 28 Dec 2026"],
    ["2027-W00", "Ab 1. Jan. 2027", "From 1 Jan 2027"],
    ["2026-W12", "Ab 23. März 2026", "From 23 Mar 2026"],
    ["2026-W43", "Ab 26. Okt. 2026", "From 26 Oct 2026"]
  ]) {
    expect(messageGroupLabel(key, "week", "de")).toBe(de);
    expect(messageGroupLabel(key, "week", "en")).toBe(en);
  }
  expect(messageGroupLabel("2024-W00", "week", "de")).toBe("2024-W00"); // Jan 1 is Monday: no W00 bucket.
  expect(messageGroupLabel("2026-W53", "week", "de")).toBe("2026-W53");
  expect(messageGroupLabel("This Week", "date", "de")).toBe("Vor 2 bis 7 Tagen");
});
