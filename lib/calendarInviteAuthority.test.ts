import { describe, expect, test } from "bun:test";
import {
  calendarInviteAuthorityFailure,
  inviteSenderAuthenticationResults
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
