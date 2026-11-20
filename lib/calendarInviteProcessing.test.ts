import { describe, expect, test } from "bun:test";
import {
  collectCalendarInviteMutationGroups,
  inferCalendarInviteActionType,
  inferCalendarInviteMessageActionType
} from "./calendarInviteProcessing";

function makeIcs(lines: string[]) {
  return ["BEGIN:VCALENDAR", ...lines, "END:VCALENDAR"].join("\r\n");
}

describe("calendar invite action typing", () => {
  test("treats instance cancellation as a cancellation for message UI but update for processing", () => {
    const ics = makeIcs([
      "METHOD:CANCEL",
      "BEGIN:VEVENT",
      "UID:series-uid@example.test",
      "RECURRENCE-ID:20260608T100000Z",
      "DTSTART:20260608T100000Z",
      "DTEND:20260608T103000Z",
      "STATUS:CANCELLED",
      "SEQUENCE:7",
      "END:VEVENT"
    ]);

    const [group] = collectCalendarInviteMutationGroups(ics);
    expect(group?.hasCancellation).toBe(true);
    expect(inferCalendarInviteMessageActionType(group!)).toBe("cancellation");
    expect(inferCalendarInviteActionType(group!, { hasExistingEvent: true })).toBe("update");
  });
});

describe("collectCalendarInviteMutationGroups without UID", () => {
  test("keeps an appointment whose VEVENT carries no UID", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      "SUMMARY:Dental check-up",
      "DTSTART:20261105T083000",
      "DTEND:20261105T093000",
      "ORGANIZER:mailto:practice@example.test",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const groups = collectCalendarInviteMutationGroups(ics);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.eventUid).toStartWith("noctua-derived-");
    expect(groups[0]?.organizerEmails).toEqual(["practice@example.test"]);
    expect(groups[0]?.baseEvent?.start?.toISOString()).toBe("2026-11-05T07:30:00.000Z");
  });
});
