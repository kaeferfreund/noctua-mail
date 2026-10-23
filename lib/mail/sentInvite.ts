import type { ResolvedSender } from "../sendIdentity";
import { randomUUID } from "crypto";
import type { Account, CalendarEvent, CalendarParticipationStatus } from "@/lib/data";
import type { ComposeInvitePayload } from "@/lib/composeInvite";
import { splitRecipientEntries } from "@/lib/recipientLists";
import { buildCalendarIcsFilename } from "@/lib/calendarIcs";
import { escapeIcsText, foldLine } from "@/lib/caldav/icsSerializer";

type InviteAttendee = {
  email: string;
  name?: string;
  role: "REQ-PARTICIPANT" | "OPT-PARTICIPANT";
  partstat?: CalendarParticipationStatus;
  rsvp?: boolean;
};

type SentInviteBuildInput = {
  account: Account;
  sender: ResolvedSender;
  invite: ComposeInvitePayload;
  subject: string;
  to: string;
  cc?: string;
  descriptionText: string;
};

type SentInviteBuildResult = {
  filename: string;
  ics: string;
  event: CalendarEvent;
};

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function parseRecipientEntry(entry: string) {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "").trim();
    const email = match[2].trim();
    if (!email) return null;
    return { name: name || undefined, email };
  }
  const emailMatch = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!emailMatch) return null;
  return { email: emailMatch[0], name: undefined };
}

function formatUtcDateTime(date: Date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}Z`;
}

function formatEventDate(value: number, allDay: boolean) {
  const date = new Date(value);
  if (allDay) {
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  return formatUtcDateTime(date);
}

function organizerLabel(sender: ResolvedSender) {
  const name = sender.displayName.trim();
  return name ? `${name} <${sender.email}>` : sender.email;
}

function normalizeInviteSummary(subject: string) {
  return subject.trim();
}

function serializeAttendees(attendees: InviteAttendee[]) {
  const labels = attendees.map((attendee) =>
    attendee.name?.trim() ? `${attendee.name.trim()} <${attendee.email}>` : attendee.email
  );
  return labels.length > 0 ? JSON.stringify(labels) : undefined;
}

function buildInviteAttendees(sender: ResolvedSender, to: string, cc?: string) {
  const accountEmail = normalizeEmail(sender.email);
  const attendeesByEmail = new Map<string, InviteAttendee>();
  const addEntries = (value: string | undefined, role: InviteAttendee["role"]) => {
    for (const entry of splitRecipientEntries(value)) {
      const parsed = parseRecipientEntry(entry);
      if (!parsed?.email) continue;
      const emailKey = normalizeEmail(parsed.email);
      if (!emailKey) continue;
      const existing = attendeesByEmail.get(emailKey);
      if (existing) {
        if (existing.role === "OPT-PARTICIPANT" && role === "REQ-PARTICIPANT") {
          existing.role = role;
        }
        if (!existing.name && parsed.name) {
          existing.name = parsed.name;
        }
        continue;
      }
      attendeesByEmail.set(emailKey, {
        email: parsed.email.trim(),
        name: parsed.name,
        role,
        rsvp: true
      });
    }
  };

  addEntries(to, "REQ-PARTICIPANT");
  addEntries(cc, "OPT-PARTICIPANT");

  const selfAttendee = attendeesByEmail.get(accountEmail);
  const onlySelfInvite = attendeesByEmail.size === 1 && Boolean(selfAttendee);
  if (selfAttendee) {
    selfAttendee.partstat = "ACCEPTED";
    selfAttendee.rsvp = false;
  }

  return {
    attendees: Array.from(attendeesByEmail.values()),
    selfAttendeeEmail: selfAttendee?.email,
    onlySelfInvite
  };
}

function buildInviteIcs(params: {
  uid: string;
  sender: ResolvedSender;
  invite: ComposeInvitePayload;
  summary: string;
  descriptionText: string;
  attendees: InviteAttendee[];
}) {
  const { uid, sender, invite, summary, descriptionText, attendees } = params;
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "METHOD:REQUEST",
    "PRODID:-//Noctua Mail//Sent Invite//EN",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${formatUtcDateTime(now)}`,
    invite.allDay
      ? `DTSTART;VALUE=DATE:${formatEventDate(invite.startAtMs, true)}`
      : `DTSTART:${formatEventDate(invite.startAtMs, false)}`
  ];

  if (typeof invite.endAtMs === "number" && Number.isFinite(invite.endAtMs)) {
    lines.push(
      invite.allDay
        ? `DTEND;VALUE=DATE:${formatEventDate(invite.endAtMs, true)}`
        : `DTEND:${formatEventDate(invite.endAtMs, false)}`
    );
  }

  lines.push(`SUMMARY:${escapeIcsText(summary)}`);
  if (descriptionText.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionText.trim())}`);
  }
  if (invite.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(invite.location.trim())}`);
  }
  if (invite.recurrenceRule?.trim()) {
    lines.push(`RRULE:${invite.recurrenceRule.trim().replace(/[\r\n]/g, "")}`);
  }
  lines.push(`ORGANIZER;CN=${escapeIcsText(sender.displayName.trim() || sender.email)}:mailto:${sender.email}`);
  attendees.forEach((attendee) => {
    const params = [
      `CN=${escapeIcsText(attendee.name?.trim() || attendee.email)}`,
      `ROLE=${attendee.role}`,
      `PARTSTAT=${attendee.partstat ?? "NEEDS-ACTION"}`,
      `RSVP=${attendee.rsvp === false ? "FALSE" : "TRUE"}`
    ];
    lines.push(`ATTENDEE;${params.join(";")}:mailto:${attendee.email}`);
  });
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n");
}

export function buildSentInvite(input: SentInviteBuildInput): SentInviteBuildResult {
  const { account, sender, invite, subject, to, cc, descriptionText } = input;
  const summary = normalizeInviteSummary(subject);
  const uid = `${randomUUID()}@${sender.email.split("@")[1] || "noctua.local"}`;
  const { attendees, selfAttendeeEmail, onlySelfInvite } = buildInviteAttendees(sender, to, cc);
  const ics = buildInviteIcs({
    uid,
    sender,
    invite,
    summary,
    descriptionText,
    attendees
  });
  const nowMs = Date.now();
  const event: CalendarEvent = {
    id: `cal-${randomUUID()}`,
    accountId: account.id,
    eventUid: uid,
    summary,
    description: descriptionText.trim() || undefined,
    location: invite.location?.trim() || undefined,
    startAtMs: invite.startAtMs,
    endAtMs: invite.endAtMs,
    allDay: invite.allDay,
    recurrenceRule: invite.recurrenceRule?.trim() || undefined,
    organizer: organizerLabel(sender),
    attendees: serializeAttendees(attendees),
    myAttendeeEmail: selfAttendeeEmail,
    myPartstat: selfAttendeeEmail ? "ACCEPTED" : undefined,
    replyRequested: onlySelfInvite ? false : attendees.length > 0 ? true : undefined,
    rawIcs: ics,
    sourceType: "sent-invite",
    createdAtMs: nowMs,
    updatedAtMs: nowMs
  };
  return {
    filename: buildCalendarIcsFilename(summary || uid),
    ics,
    event
  };
}
