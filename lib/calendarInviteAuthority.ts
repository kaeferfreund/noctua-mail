import type { CalendarEvent } from "@/lib/data";
import { parseIcsInvite } from "@/lib/calendar";
import {
  normalizeCalendarInviteAddress,
  type CalendarInviteMutationGroup,
  type CalendarInviteUnprocessedReason
} from "@/lib/calendarInviteProcessing";
import { senderAuthPassed } from "@/lib/mail/spam/allowlist";
import { parseHeaderBlock, receivingAuthenticationResults } from "@/lib/mail/spam/input";
import {
  ownAddressList,
  parseAddressEmails,
  type OwnAddressInput
} from "@/lib/ownAddresses";

/**
 * Who may change or cancel an existing calendar event through incoming mail.
 *
 * Automatic invite processing matches events by UID, and a UID is known to
 * every attendee of a meeting. Only the event's organizer may update or
 * cancel it: the stored organizer, the ORGANIZER of every VEVENT in the
 * incoming group and the mail's From address must be the same single
 * address, and that address must not be one of the mailbox's own addresses
 * (an event the mailbox organizes is never changed by incoming mail).
 * Events without a known organizer (local events, CalDAV events without an
 * ORGANIZER) cannot be changed by mail at all. A user who opens the mail and
 * presses "Process" applies it on purpose; that path skips this check.
 *
 * The From header alone is not authenticated. Automatic processing therefore
 * also requires the receiving server's Authentication-Results to show SPF or
 * DKIM passing for the organizer's domain (the strict spam-allowlist rule,
 * senderAuthPassed). Without that confirmation, including mail without any
 * Authentication-Results, the invite stays unprocessed ("sender_unverified")
 * and the user can apply it manually.
 */

/** The organizer address of a stored event, from its ICS or its organizer label. */
export function resolveCalendarEventOrganizerEmail(
  event: Pick<CalendarEvent, "eventUid" | "rawIcs" | "organizer">
): string | null {
  if (event.rawIcs?.trim()) {
    const uid = event.eventUid.trim().toLowerCase();
    const matching = parseIcsInvite(event.rawIcs).events.filter(
      (candidate) => candidate.uid?.trim().toLowerCase() === uid
    );
    const base = matching.find((candidate) => !candidate.recurrenceId) ?? matching[0];
    const fromIcs = normalizeCalendarInviteAddress(base?.organizerEmail);
    if (fromIcs) return fromIcs;
  }
  const fromLabel = parseAddressEmails(event.organizer);
  return fromLabel.length === 1 ? fromLabel[0] : null;
}

export type CalendarInviteAuthorityInput = {
  existingEvent: Pick<CalendarEvent, "eventUid" | "rawIcs" | "organizer">;
  group: Pick<CalendarInviteMutationGroup, "organizerEmails">;
  senderAddress?: string | null;
  /**
   * The receiving server's Authentication-Results of the mail
   * (inviteSenderAuthenticationResults). Missing or empty means unconfirmed.
   */
  senderAuthenticationResults?: readonly string[] | null;
  ownAddresses?: OwnAddressInput;
};

/** Why incoming mail may not change `existingEvent` automatically; null when it may. */
export function calendarInviteAuthorityFailure({
  existingEvent,
  group,
  senderAddress,
  senderAuthenticationResults,
  ownAddresses
}: CalendarInviteAuthorityInput): CalendarInviteUnprocessedReason | null {
  const organizer = resolveCalendarEventOrganizerEmail(existingEvent);
  if (!organizer) return "organizer_mismatch";
  if (ownAddressList(ownAddresses).includes(organizer)) return "organizer_mismatch";
  if (group.organizerEmails.length !== 1 || group.organizerEmails[0] !== organizer) return "organizer_mismatch";
  const senders = parseAddressEmails(senderAddress);
  if (senders.length !== 1 || senders[0] !== organizer) return "organizer_mismatch";
  const domain = organizer.slice(organizer.lastIndexOf("@") + 1);
  if (!senderAuthPassed({ authenticationResults: [...(senderAuthenticationResults ?? [])] }, domain)) {
    return "sender_unverified";
  }
  return null;
}

export function isCalendarInviteFromEventOrganizer(input: CalendarInviteAuthorityInput): boolean {
  return calendarInviteAuthorityFailure(input) === null;
}

const SOURCE_HEAD_LIMIT = 64 * 1024;

/**
 * The receiving server's Authentication-Results from a raw RFC 822 source
 * (only its header block is read), as the spam allowlist reads them.
 */
export function inviteSenderAuthenticationResults(source: string | Buffer | null | undefined): string[] {
  if (!source) return [];
  const head = typeof source === "string"
    ? source.slice(0, SOURCE_HEAD_LIMIT)
    : source.subarray(0, SOURCE_HEAD_LIMIT).toString("latin1");
  const end = head.search(/\r?\n\r?\n/);
  return receivingAuthenticationResults(parseHeaderBlock(end >= 0 ? head.slice(0, end) : head));
}
