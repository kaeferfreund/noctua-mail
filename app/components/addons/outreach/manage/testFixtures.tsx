import { useState } from "react";
import { Theme } from "@radix-ui/themes";
import type { AccountRole } from "@/lib/data";
import type { Campaign, CampaignReport, Contact, ContactDetail, ContactList, EmailTemplate, OutreachOverview, Sequence, SendStats, SendSummary } from "@/lib/addons/outreach/types";
import OutreachManage from "./OutreachManage";
import type { OutreachLocation } from "./location";

/** Synthetic data for DOM tests and screenshots of the newsletter area (addresses @example.test only). */
export const ACCOUNT_ID = "acc-synthetic";
const T0 = Date.UTC(2026, 10, 2, 9, 30);
const DAY = 86_400_000;

export function stats(partial: Partial<SendStats> = {}): SendStats {
  return { recipients: 0, queued: 0, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0, machineOpens: 0, ...partial };
}

export const LISTS: ContactList[] = [
  { id: "list-news", accountId: ACCOUNT_ID, name: "Newsletter", description: "Monatlicher Rundbrief", optIn: "double", memberCount: 412, createdAt: T0 - 300 * DAY, updatedAt: T0, archivedAt: null },
  { id: "list-beta", accountId: ACCOUNT_ID, name: "Beta-Tester", description: "", optIn: "single", memberCount: 56, createdAt: T0 - 200 * DAY, updatedAt: T0, archivedAt: null },
  { id: "list-old", accountId: ACCOUNT_ID, name: "Messe 2024", description: "", optIn: "single", memberCount: 0, createdAt: T0 - 600 * DAY, updatedAt: T0, archivedAt: T0 - 100 * DAY }
];

export function contact(index: number, partial: Partial<Contact> = {}): Contact {
  const names = [["Alex", "Beispiel"], ["Kim", "Muster"], ["Sam", "Probe"], ["Robin", "Test"], ["Jo", "Platzhalter"]];
  const [firstName, lastName] = names[index % names.length];
  return {
    id: `contact-${index}`, accountId: ACCOUNT_ID, email: `person${index}@example.test`, firstName, lastName, properties: {},
    emailConsent: "subscribed", consentAt: T0 - index * DAY, consentSource: "api", suppressedReason: null, suppressedAt: null,
    source: "api", createdAt: T0 - index * DAY, updatedAt: T0, ...partial
  };
}

export const CONTACTS: Contact[] = [
  contact(1), contact(2, { emailConsent: "unsubscribed" }), contact(3, { suppressedReason: "hard_bounce", suppressedAt: T0 - DAY }), contact(4), contact(5, { emailConsent: "never" })
];

export function sendSummary(index: number, partial: Partial<SendSummary> = {}): SendSummary {
  return {
    sendId: `send-${index}`, kind: "campaign", contactId: `contact-${index}`, recipients: `person${index}@example.test`, subject: "Neuigkeiten im November",
    status: "sent", error: null, sentAt: T0 + index * 60_000, campaignId: "camp-sent", sequenceId: null, opens: index % 3, clicks: index % 2, bounced: false, unsubscribed: false, ...partial
  };
}

export const CONTACT_DETAIL: ContactDetail = {
  ...contact(1, { properties: { plan: "pro", seats: 3 } }),
  lists: [
    { listId: "list-news", listName: "Newsletter", status: "subscribed", subscribedAt: T0 - 30 * DAY, unsubscribedAt: null },
    { listId: "list-beta", listName: "Beta-Tester", status: "unsubscribed", subscribedAt: T0 - 60 * DAY, unsubscribedAt: T0 - 10 * DAY }
  ],
  stats: stats({ recipients: 3, sent: 3, opened: 2, clicked: 1, machineOpens: 2 }),
  lastSends: [sendSummary(1), sendSummary(2, { subject: "Willkommen", kind: "sequence", campaignId: null, sequenceId: "seq-welcome" })]
};

const HTML = `<!doctype html><html><body style="font-family:sans-serif;margin:0;background:#f4f4f5">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="560" style="background:#fff;border-radius:8px;padding:24px"><tr><td>
<h1 style="font-size:22px;margin:0 0 12px">Hallo {{ first_name|default:"zusammen" }},</h1>
<p style="font-size:15px;line-height:1.5">hier sind die Neuigkeiten des Monats. Wir haben die Suche schneller gemacht und das Postfach aufgeräumt.</p>
<p><a href="https://www.example.test/neu" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Mehr erfahren</a></p>
<p style="font-size:12px;color:#71717a">{{ organization.name }} · {{ organization.full_address }}<br><a href="{{ unsubscribe_url }}">Abmelden</a></p>
</td></tr></table></td></tr></table></body></html>`;

export const TEMPLATE: EmailTemplate = {
  id: "tpl-news", accountId: ACCOUNT_ID, name: "Rundbrief", subject: "Neuigkeiten im November", previewText: "Was sich diesen Monat getan hat",
  html: HTML, text: "", createdAt: T0 - 90 * DAY, updatedAt: T0 - 2 * DAY, archivedAt: null
};

export const DRAFT: Campaign = {
  id: "camp-draft", accountId: ACCOUNT_ID, name: "Rundbrief Dezember", subject: "Neuigkeiten im Dezember", previewText: "Kurz vor Jahresende",
  senderIdentityId: null, templateId: null, html: HTML, text: "", listIds: ["list-news"], excludedListIds: [], status: "draft",
  trackOpens: true, trackClicks: true, sendAt: null, startedAt: null, finishedAt: null, createdAt: T0, updatedAt: T0 + DAY
};

export const SENT: Campaign = {
  ...DRAFT, id: "camp-sent", name: "Rundbrief November", subject: "Neuigkeiten im November", status: "sent", listIds: ["list-news", "list-beta"],
  sendAt: T0, startedAt: T0, finishedAt: T0 + 3_600_000, updatedAt: T0 + 3_600_000
};

export const SENT_STATS = stats({ recipients: 455, sent: 455, opened: 201, clicked: 38, bounced: 6, unsubscribed: 3, machineOpens: 119 });

export const REPORT: CampaignReport = {
  ok: true,
  campaign: { ...SENT, stats: SENT_STATS },
  stats: SENT_STATS,
  links: [{ url: "https://www.example.test/neu", clicks: 44, uniqueClicks: 31 }, { url: "https://www.example.test/preise", clicks: 9, uniqueClicks: 7 }],
  recipients: [1, 2, 3, 4, 5, 6].map(index => sendSummary(index, index === 4 ? { bounced: true, opens: 0, clicks: 0 } : index === 6 ? { unsubscribed: true } : {})),
  nextCursor: "cursor-2"
};

export const OVERVIEW: OutreachOverview = {
  ok: true, contacts: 512, subscribed: 468, lists: 4, campaigns: 6, sequencesLive: 1,
  last30Days: stats({ recipients: 520, sent: 520, opened: 236, clicked: 44, bounced: 7, unsubscribed: 4, machineOpens: 131 })
};

export const SEQUENCE: Sequence = {
  id: "seq-welcome", accountId: ACCOUNT_ID, name: "Willkommensserie", triggerListId: "list-news", senderIdentityId: null, status: "live",
  trackOpens: true, trackClicks: true, createdAt: T0 - 200 * DAY, updatedAt: T0,
  steps: [
    { id: "step-1", position: 0, delayMinutes: 0, name: "Willkommen", subject: "Willkommen an Bord", previewText: "", templateId: null, html: HTML, text: "", enabled: true },
    { id: "step-2", position: 1, delayMinutes: 1440, name: "Tipps", subject: "Drei Tipps für den Start", previewText: "", templateId: null, html: HTML, text: "", enabled: true },
    { id: "step-3", position: 2, delayMinutes: 2880, name: "Funktionen", subject: "Was noch geht", previewText: "", templateId: null, html: HTML, text: "", enabled: true },
    { id: "step-4", position: 3, delayMinutes: 2880, name: "Feedback", subject: "Wie gefällt es dir?", previewText: "", templateId: null, html: HTML, text: "", enabled: false }
  ]
};

/** One JSON answer; errors use the addon's `{ok:false, message, code?}` shape. */
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export type Call = { method: string; path: string; query: URLSearchParams; body: unknown };
export type Handler = (call: Call) => Response | Promise<Response> | undefined;

/**
 * A fetch stub that answers the addon routes from `handlers` first, then from synthetic
 * defaults. Every request is recorded in `calls`.
 */
export function stubFetch(handlers: Handler[] = []) {
  const calls: Call[] = [];
  const base = `/api/addons/outreach/accounts/${ACCOUNT_ID}/`;
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
    const call: Call = { method, path, query: url.searchParams, body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    for (const handler of handlers) {
      const response = await handler(call);
      if (response) return response;
    }
    return defaults(call);
  };
  return { calls, fetchImpl };
}

function defaults({ method, path }: Call): Response {
  if (method !== "GET") return json({ ok: true });
  if (path === "overview") return json(OVERVIEW);
  if (path === "lists") return json({ ok: true, lists: LISTS });
  if (path === "templates") return json({ ok: true, templates: [TEMPLATE].map(({ html: _html, text: _text, ...summary }) => summary) });
  if (path === `templates/${TEMPLATE.id}`) return json({ ok: true, template: TEMPLATE });
  if (path === "contacts") return json({ ok: true, contacts: CONTACTS, total: 512, page: 1, pageSize: 50 });
  if (path === `contacts/${CONTACT_DETAIL.id}`) return json({ ok: true, contact: CONTACT_DETAIL });
  if (path === "tracking/events") {
    return json({ ok: true, nextBefore: null, events: [
      { id: 3, sendId: "send-1", contactId: "contact-1", type: "click", at: T0 + 7_200_000, ip: null, ipTruncated: true, country: "DE", region: "Bayern", city: "München", userAgent: null, clientName: "Firefox", clientOs: "Linux", clientType: "browser", machine: false, url: "https://www.example.test/neu" },
      { id: 2, sendId: "send-1", contactId: "contact-1", type: "open", at: T0 + 3_600_000, ip: null, ipTruncated: true, country: "DE", region: null, city: "München", userAgent: null, clientName: "Thunderbird", clientOs: "Linux", clientType: "mail-client", machine: false, url: null },
      { id: 1, sendId: "send-1", contactId: "contact-1", type: "open", at: T0 + 5_000, ip: null, ipTruncated: true, country: null, region: null, city: null, userAgent: null, clientName: "Apple Mail", clientOs: "iOS", clientType: "proxy", machine: true, url: null }
    ] });
  }
  if (path === "campaigns") {
    return json({ ok: true, campaigns: [
      { ...SENT, stats: SENT_STATS },
      { ...DRAFT, stats: stats() },
      { ...SENT, id: "camp-old", name: "Sommeraktion", finishedAt: SENT.finishedAt! - 120 * DAY, sendAt: SENT.sendAt! - 120 * DAY, stats: stats({ recipients: 430, sent: 430, opened: 170, clicked: 21, bounced: 4 }) }
    ].map(({ html: _html, text: _text, ...rest }) => rest) });
  }
  if (path === `campaigns/${DRAFT.id}`) return json({ ok: true, campaign: DRAFT });
  if (path === `campaigns/${SENT.id}`) return json({ ok: true, campaign: SENT });
  if (path === `campaigns/${SENT.id}/report`) return json(REPORT);
  if (path === "sequences") {
    const { steps, ...rest } = SEQUENCE;
    return json({ ok: true, sequences: [{ ...rest, stepCount: steps.length, activeEnrollments: 23, stats: stats({ recipients: 310, sent: 310, opened: 180, clicked: 41, bounced: 2, unsubscribed: 5, machineOpens: 77 }) }] });
  }
  if (path === `sequences/${SEQUENCE.id}`) return json({ ok: true, sequence: SEQUENCE });
  if (path === `sequences/${SEQUENCE.id}/report`) {
    const { steps, ...rest } = SEQUENCE;
    return json({ ok: true, sequence: { ...rest, stepCount: steps.length, activeEnrollments: 23, stats: stats() }, enrollments: { active: 23, completed: 266, cancelled: 21 },
      steps: steps.map((step, index) => ({ stepId: step.id, position: step.position, name: step.name, stats: stats({ recipients: 120 - index * 30, sent: 120 - index * 30, opened: 70 - index * 15, clicked: 15 - index * 3, bounced: 1, unsubscribed: index, machineOpens: 25 }) })) });
  }
  if (path === `/api/accounts/${ACCOUNT_ID}/identities`) {
    return json({ ok: true, identities: [{ id: "id-1", accountId: ACCOUNT_ID, email: "news@example.test", displayName: "Beispiel GmbH", isDefault: true, enabled: true, createdBy: null, createdAt: T0, updatedAt: T0 }] });
  }
  return json({ ok: false, message: "Not found" }, 404);
}

/** The area with in-memory navigation, as the page wires it. */
export function ManageHarness({ role = "editor", initial = { section: "overview" }, fetchImpl, onNavigate }: {
  role?: AccountRole; initial?: OutreachLocation; fetchImpl: ReturnType<typeof stubFetch>["fetchImpl"]; onNavigate?: (location: OutreachLocation) => void;
}) {
  const [location, setLocation] = useState<OutreachLocation>(initial);
  return (
    <Theme>
      <OutreachManage accountId={ACCOUNT_ID} accountLabel="news@example.test" role={role} location={location} mailHref="/"
        onLocationChange={next => { onNavigate?.(next); setLocation(next); }} fetchImpl={fetchImpl} />
    </Theme>
  );
}
