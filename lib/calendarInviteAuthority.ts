import type { CalendarEvent } from "@/lib/data";
import { parseIcsInvite } from "@/lib/calendar";
import {
  normalizeCalendarInviteAddress,
  type CalendarInviteMutationGroup
} from "@/lib/calendarInviteProcessing";
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
 * The From address is not authenticated, so this binds a change to the
 * organizer the event already has; it does not prove who sent the mail.
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
  ownAddresses?: OwnAddressInput;
};

export function isCalendarInviteFromEventOrganizer({
  existingEvent,
  group,
  senderAddress,
  ownAddresses
}: CalendarInviteAuthorityInput): boolean {
  const organizer = resolveCalendarEventOrganizerEmail(existingEvent);
  if (!organizer) return false;
  if (ownAddressList(ownAddresses).includes(organizer)) return false;
  if (group.organizerEmails.length !== 1 || group.organizerEmails[0] !== organizer) return false;
  const senders = parseAddressEmails(senderAddress);
  return senders.length === 1 && senders[0] === organizer;
}
