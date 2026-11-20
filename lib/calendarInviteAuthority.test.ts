import { describe, expect, test } from "bun:test";
import { parseIcsInvite } from "@/lib/calendar";
import {
  calendarInviteAuthorityFailure,
  inviteSenderAuthenticationResults,
  resolveCalendarEventOrganizerEmail
} from "@/lib/calendarInviteAuthority";

const existingEvent = {
  eventUid: "meeting-uid@example.test",
  organizer: "Alice <alice@example.test>",
  rawIcs: undefined
};
const group = { organizerEmails: ["alice@example.test"] };

function rawSource(headers: string[]) {
  return Buffer.from(
    [...headers, "From: alice@example.test", "Subject: Planning", "", "BEGIN:VCALENDAR", ""].join("\r\n"),
    "latin1"
  );
}

describe("inviteSenderAuthenticationResults", () => {
  test("reads the receiving server's Authentication-Results from the source head", () => {
    const source = rawSource([
      "Received: from out.example.test by mx.receiver.example; Tue, 1 Dec 2026 08:00:00 +0000",
      "Authentication-Results: mx.receiver.example; dkim=pass header.d=example.test"
    ]);
    expect(inviteSenderAuthenticationResults(source)).toEqual([
      "mx.receiver.example; dkim=pass header.d=example.test"
    ]);
  });

  test("ignores a block the sender wrote below the receiving server's Received line", () => {
    const source = rawSource([
      "Received: from out.example.test by mx.receiver.example; Tue, 1 Dec 2026 08:00:00 +0000",
      "Received: from attacker.example by out.example.test; Tue, 1 Dec 2026 07:59:00 +0000",
      "Authentication-Results: mx.receiver.example; dkim=pass header.d=example.test"
    ]);
    expect(inviteSenderAuthenticationResults(source)).toEqual([]);
  });

  test("no source means no confirmation", () => {
    expect(inviteSenderAuthenticationResults(undefined)).toEqual([]);
  });
});

describe("calendarInviteAuthorityFailure", () => {
  test("organizer From with DKIM for the organizer's domain may change the event", () => {
    expect(
      calendarInviteAuthorityFailure({
        existingEvent,
        group,
        senderAddress: "alice@example.test",
        senderAuthenticationResults: ["mx.receiver.example; dkim=pass header.d=example.test"]
      })
    ).toBeNull();
  });

  test("organizer From without SPF/DKIM confirmation is unverified", () => {
    expect(
      calendarInviteAuthorityFailure({ existingEvent, group, senderAddress: "alice@example.test" })
    ).toBe("sender_unverified");
    expect(
      calendarInviteAuthorityFailure({
        existingEvent,
        group,
        senderAddress: "alice@example.test",
        senderAuthenticationResults: ["mx.receiver.example; dkim=pass header.d=other.example"]
      })
    ).toBe("sender_unverified");
  });

  test("another sender stays an organizer mismatch even with valid DKIM", () => {
    expect(
      calendarInviteAuthorityFailure({
        existingEvent,
        group,
        senderAddress: "mallory@example.test",
        senderAuthenticationResults: ["mx.receiver.example; dkim=pass header.d=example.test"]
      })
    ).toBe("organizer_mismatch");
  });
});

describe("resolveCalendarEventOrganizerEmail without UID in the stored ICS", () => {
  const rawIcs = [
    "BEGIN:VCALENDAR",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    "SUMMARY:Dental check-up",
    "DTSTART:20261105T083000",
    "DTEND:20261105T093000",
    "ORGANIZER;CN=Practice:mailto:practice@example.test",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const derivedUid = parseIcsInvite(rawIcs).events[0]!.uid!;

  test("finds the organizer under the derived UID", () => {
    expect(
      resolveCalendarEventOrganizerEmail({ eventUid: derivedUid, rawIcs, organizer: "Practice" })
    ).toBe("practice@example.test");
  });

  test("the organizer check applies to the derived UID", () => {
    const event = { eventUid: derivedUid, rawIcs, organizer: "Practice" };
    const dkimPass = ["mx.example.test; dkim=pass header.d=example.test"];
    expect(
      calendarInviteAuthorityFailure({
        existingEvent: event,
        group: { organizerEmails: ["practice@example.test"] },
        senderAddress: "practice@example.test",
        senderAuthenticationResults: dkimPass
      })
    ).toBeNull();
    expect(
      calendarInviteAuthorityFailure({
        existingEvent: event,
        group: { organizerEmails: ["practice@example.test"] },
        senderAddress: "mallory@example.test",
        senderAuthenticationResults: dkimPass
      })
    ).toBe("organizer_mismatch");
  });
});
