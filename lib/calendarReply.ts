import type { ResolvedSender } from "./sendIdentity";
import { SenderIdentityError } from "./senderIdentityError";
import type {
  Account,
  CalendarEvent,
  CalendarParticipationScope,
  CalendarParticipationStatus
} from "./data";
import { collectCalendarInviteMutationGroups } from "./calendarInviteProcessing";
import { findCalendarAttendeeForEmail } from "./calendarParticipation";

const REPLYABLE_PARTSTAT = new Set<CalendarParticipationStatus>(["ACCEPTED", "DECLINED", "TENTATIVE"]);

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let index = 75;
  while (index < line.length) {
    chunks.push(` ${line.slice(index, index + 74)}`);
    index += 74;
  }
  return chunks.join("\r\n");
}

function formatUtcDateTime(value: Date) {
  return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}T${String(value.getUTCHours()).padStart(2, "0")}${String(value.getUTCMinutes()).padStart(2, "0")}${String(value.getUTCSeconds()).padStart(2, "0")}Z`;
}

function formatEventDate(value: number, allDay: boolean) {
  const date = new Date(value);
  if (allDay) {
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  return formatUtcDateTime(date);
}

function buildReplySubject(partstat: CalendarParticipationStatus, summary: string) {
  const trimmedSummary = summary.trim() || "Calendar Event";
  if (partstat === "ACCEPTED") return `Accepted: ${trimmedSummary}`;
  if (partstat === "DECLINED") return `Declined: ${trimmedSummary}`;
  return `Tentative: ${trimmedSummary}`;
}

function buildReplyText(sender: ResolvedSender, partstat: CalendarParticipationStatus, summary: string) {
  const actor = sender.displayName.trim() || sender.email;
  if (partstat === "ACCEPTED") {
    return `${actor} accepted the invitation "${summary}".`;
  }
  if (partstat === "DECLINED") {
    return `${actor} declined the invitation "${summary}".`;
  }
  return `${actor} tentatively accepted the invitation "${summary}".`;
}

export function buildCalendarReplyPayload(
  account: Account,
  event: CalendarEvent,
  partstat: CalendarParticipationStatus,
  options?: {
    sender?: ResolvedSender;
    scope?: CalendarParticipationScope;
    occurrenceStartAtMs?: number;
  }
) {
  if (!REPLYABLE_PARTSTAT.has(partstat)) {
    throw new Error("Unsupported participation status.");
  }
  if (!event.rawIcs?.trim()) {
    throw new Error("This event does not include the original ICS source.");
  }

  const group = collectCalendarInviteMutationGroups(event.rawIcs).find(
    (item) => item.eventUid.trim().toLowerCase() === event.eventUid.trim().toLowerCase()
  );
  const baseEvent = group?.baseEvent;
  const organizerEmail = baseEvent?.organizerEmail?.trim();
  if (!organizerEmail) {
    throw new Error("Missing organizer email in calendar invite.");
  }

  const attendeeEmail = event.myAttendeeEmail?.trim();
  if (!attendeeEmail || (options?.sender && options.sender.email !== attendeeEmail.toLowerCase())) {
    throw new SenderIdentityError("identity_unavailable", 409, "The invitation attendee has no matching enabled sender identity.");
  }
  const attendee = findCalendarAttendeeForEmail(baseEvent?.attendeeDetails, attendeeEmail);
  if (!attendee) throw new SenderIdentityError("identity_unavailable", 409, "The invitation no longer contains this attendee.");
  const sender = options?.sender ?? { id: "", email: attendeeEmail, displayName: account.name };

  const summary = event.summary.trim() || baseEvent?.summary?.trim() || "Calendar Event";
  const now = new Date();
  const scope = options?.scope ?? "series";
  const occurrenceStartAtMs =
    scope === "occurrence" && Number.isFinite(options?.occurrenceStartAtMs)
      ? Number(options?.occurrenceStartAtMs)
      : undefined;
  const dtstartAtMs = occurrenceStartAtMs ?? event.startAtMs;
  const lines = [
    "BEGIN:VCALENDAR",
    "METHOD:REPLY",
    "PRODID:-//Noctua Mail//Calendar RSVP//EN",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.eventUid)}`,
    `DTSTAMP:${formatUtcDateTime(now)}`,
    event.allDay
      ? `DTSTART;VALUE=DATE:${formatEventDate(dtstartAtMs, true)}`
      : `DTSTART:${formatEventDate(dtstartAtMs, false)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `ORGANIZER:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${escapeIcsText(attendee?.name?.trim() || sender.displayName || attendeeEmail)};PARTSTAT=${partstat};RSVP=FALSE:mailto:${attendeeEmail}`
  ];
  if (occurrenceStartAtMs !== undefined) {
    lines.push(
      event.allDay
        ? `RECURRENCE-ID;VALUE=DATE:${formatEventDate(occurrenceStartAtMs, true)}`
        : `RECURRENCE-ID:${formatEventDate(occurrenceStartAtMs, false)}`
    );
  }
  if (typeof baseEvent?.sequence === "number" && Number.isFinite(baseEvent.sequence)) {
    lines.push(`SEQUENCE:${baseEvent.sequence}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  return {
    to: organizerEmail,
    subject: buildReplySubject(partstat, summary),
    text: buildReplyText(sender, partstat, summary),
    ics: lines.map(foldLine).join("\r\n"),
    attendeeEmail
  };
}
