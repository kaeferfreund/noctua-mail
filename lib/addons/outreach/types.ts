/**
 * Shared contract of the outreach addon: the shapes that cross a boundary (REST, MCP, or
 * between the addon's areas). Pure types and constants only — this file is imported by
 * client components, so it must not import server code.
 *
 * REST base: `/api/addons/outreach/accounts/{accountId}` (see doc/ADDON-OUTREACH.md).
 * Every success body is `{ ok: true, ... }`, every error `{ ok: false, message, code? }`.
 * Times are epoch milliseconds.
 */

// ---------------------------------------------------------------- settings / status

export const OUTREACH_TRANSPORTS = ["ses", "mailbox-smtp"] as const;
export type OutreachTransport = (typeof OUTREACH_TRANSPORTS)[number];

export type OutreachAccountSettings = {
  accountId: string;
  enabled: boolean;
  transport: OutreachTransport;
  /** Sender identity of the mailbox used for campaigns and sequences unless one is set there. */
  senderIdentityId: string | null;
  /** 1:1 mails: tracking switch in compose preselected. */
  trackMailDefault: boolean;
  ipRetentionDays: number;
  sendRatePerMinute: number;
  /** Fill `{{ organization.name }}` / `{{ organization.full_address }}` (imprint in the mail footer). */
  organizationName: string;
  organizationAddress: string;
  updatedAt: number | null;
};

export type OutreachSettingsPatch = Partial<Omit<OutreachAccountSettings, "accountId" | "updatedAt">>;

/** `GET /api/addons/outreach/status` — the only addon route that answers when the flag is off. */
export type OutreachStatusResponse = {
  ok: true;
  /** Server flag `NOCTUA_ADDON_OUTREACH`. */
  available: boolean;
  /** Mailboxes of the signed-in user for which the addon is activated. */
  accounts: Array<{ accountId: string; enabled: boolean; trackMailDefault: boolean }>;
  /** Whether SES is configured on the server (region and credentials present). */
  sesConfigured: boolean;
  /** Whether a public origin for tracking links is configured. */
  trackingConfigured: boolean;
};

// ---------------------------------------------------------------- tracking

export const TRACKING_EVENT_TYPES = ["open", "click", "unsubscribe", "delivered", "bounce", "complaint"] as const;
export type TrackingEventType = (typeof TRACKING_EVENT_TYPES)[number];
export const TRACKING_CLIENT_TYPES = ["browser", "mobile", "mail-client", "proxy", "bot", "unknown"] as const;
export type TrackingClientType = (typeof TRACKING_CLIENT_TYPES)[number];

export type TrackingEvent = {
  id: number;
  sendId: string | null;
  contactId: string | null;
  type: TrackingEventType;
  at: number;
  /** Full address inside the retention window, afterwards truncated (/24 or /48); null when unknown. */
  ip: string | null;
  ipTruncated: boolean;
  country: string | null;
  region: string | null;
  city: string | null;
  userAgent: string | null;
  clientName: string | null;
  clientOs: string | null;
  clientType: TrackingClientType | null;
  /** Automatic fetch (Apple Mail Privacy Protection, image proxy, link scanner): not a person. */
  machine: boolean;
  /** Click target, or bounce diagnostic for `bounce`. */
  url: string | null;
};

export const SEND_KINDS = ["mail", "campaign", "sequence", "test"] as const;
export type SendKind = (typeof SEND_KINDS)[number];
export const SEND_STATUSES = ["queued", "sending", "sent", "failed", "skipped"] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

/** What the reader shows for one sent message. `GET {base}/tracking?messageId=<RFC Message-ID>` → `{ ok, tracking | null }`. */
export type MessageTrackingSummary = {
  sendId: string;
  kind: SendKind;
  messageId: string | null;
  recipients: string;
  subject: string;
  sentAt: number | null;
  trackOpens: boolean;
  trackClicks: boolean;
  /** Counts exclude machine events; `machineOpens` reports them separately. */
  opens: number;
  machineOpens: number;
  clicks: number;
  firstOpenedAt: number | null;
  lastOpenedAt: number | null;
  lastClickedAt: number | null;
  bounced: boolean;
  /** The newest non-machine open or click, for the one-line status. */
  lastEvent: TrackingEvent | null;
};

/** `GET {base}/tracking/events?sendId=&contactId=&campaignId=&sequenceId=&type=&includeMachine=&limit=&before=` */
export type TrackingEventsResponse = { ok: true; events: TrackingEvent[]; nextBefore: number | null };

/** Aggregate over many sends (campaign, sequence step, contact). Unique = distinct sends, machine events excluded. */
export type SendStats = {
  recipients: number;
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  complained: number;
  machineOpens: number;
};

// ---------------------------------------------------------------- contacts / lists

export const EMAIL_CONSENTS = ["subscribed", "unsubscribed", "never"] as const;
export type EmailConsent = (typeof EMAIL_CONSENTS)[number];
export const SUPPRESSION_REASONS = ["hard_bounce", "complaint", "manual"] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];
export const LIST_MEMBER_STATUSES = ["subscribed", "pending", "unsubscribed"] as const;
export type ListMemberStatus = (typeof LIST_MEMBER_STATUSES)[number];
export const OPT_IN_MODES = ["single", "double"] as const;
export type OptInMode = (typeof OPT_IN_MODES)[number];

export type Contact = {
  id: string;
  accountId: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Free key/value data; values are strings, numbers or booleans. */
  properties: Record<string, string | number | boolean>;
  emailConsent: EmailConsent;
  consentAt: number | null;
  consentSource: string | null;
  suppressedReason: SuppressionReason | null;
  suppressedAt: number | null;
  source: string;
  createdAt: number;
  updatedAt: number;
};

export type ContactListMembership = { listId: string; listName: string; status: ListMemberStatus; subscribedAt: number | null; unsubscribedAt: number | null };

/** `GET {base}/contacts/{contactId}` */
export type ContactDetail = Contact & { lists: ContactListMembership[]; stats: SendStats; lastSends: SendSummary[] };

export type ContactInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  properties?: Record<string, string | number | boolean>;
};

/** `GET {base}/contacts?q=&listId=&consent=&suppressed=&page=&pageSize=` */
export type ContactListResponse = { ok: true; contacts: Contact[]; total: number; page: number; pageSize: number };

export type ContactList = {
  id: string;
  accountId: string;
  name: string;
  description: string;
  optIn: OptInMode;
  /** Members with status `subscribed`. */
  memberCount: number;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
};

export type ContactListInput = { name: string; description?: string; optIn?: OptInMode };

/**
 * `POST {base}/contacts/{contactId}/subscriptions`
 * Subscribing someone who has an unsubscribe on record (global or of that list) needs
 * `confirmResubscribe: true`: without it the server answers 409 `resubscribe_confirmation_required`
 * with `unsubscribedAt`, so no caller re-subscribes a person by accident.
 */
export type SubscriptionChange = { listId: string; action: "subscribe" | "unsubscribe"; consentSource?: string; confirmResubscribe?: boolean };
/** Body of the 409 that asks for `confirmResubscribe`. */
export type ResubscribeConfirmationRequired = { ok: false; code: "resubscribe_confirmation_required"; message: string; unsubscribedAt: number };

/** `GET|POST {base}/api-tokens`; the secret is returned once, on creation, as `token`. */
export type OutreachApiToken = { id: string; name: string; listIds: string[]; createdAt: number; lastUsedAt: number | null; revokedAt: number | null };

/**
 * Server-to-server: `POST /api/addons/outreach/subscribe` with `Authorization: Bearer <token>`.
 * Upserts the contact, records consent and subscribes it to the list (which enrolls it in live
 * sequences triggered by that list). Idempotent per (email, listId).
 */
export type SubscribeRequest = ContactInput & { listId: string; consentAt?: number; consentSource?: string };
/** Uniform for new and known addresses: a token must not reveal whether a contact existed. */
export type SubscribeResponse = { ok: true; contactId: string; status: ListMemberStatus };

// ---------------------------------------------------------------- templates

/**
 * Placeholders (Klaviyo-compatible spellings are accepted on import and normalized):
 * `{{ first_name }}`, `{{ last_name }}`, `{{ email }}`, `{{ organization.name }}`,
 * `{{ organization.full_address }}`, `{{ current_year }}`, `{{ unsubscribe_url }}`,
 * each with an optional `|default:"…"`. Unknown placeholders render empty.
 */
export const TEMPLATE_PLACEHOLDERS = ["first_name", "last_name", "email", "organization.name", "organization.full_address", "current_year", "unsubscribe_url"] as const;

export type EmailTemplate = {
  id: string;
  accountId: string;
  name: string;
  subject: string;
  previewText: string;
  html: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
};
/** List responses omit `html` and `text`. */
export type EmailTemplateSummary = Omit<EmailTemplate, "html" | "text">;
export type EmailTemplateInput = { name: string; subject?: string; previewText?: string; html?: string; text?: string };
/** `POST {base}/render` — body `{ subject, html, text?, contactId? }`; renders with the contact or sample data. */
export type RenderResponse = { ok: true; subject: string; html: string; text: string; warnings: string[] };

// ---------------------------------------------------------------- images

/**
 * Images for templates, campaigns and sequence steps, kept by the addon and served publicly
 * from `/t/m/{sha256}.{ext}` (long cache, content-addressed, also while the addon is switched
 * off). Content stores the root-relative `url`; rendering for sending makes it absolute with the
 * public origin, so templates do not depend on the host name. Raster images only (no SVG).
 */
export const OUTREACH_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export type OutreachImageType = (typeof OUTREACH_IMAGE_TYPES)[number];
export const OUTREACH_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Stored image bytes per mailbox. Images cannot be removed (sent mail keeps pointing to them), so this caps the data volume a mailbox's editors can fill. */
export const OUTREACH_IMAGE_QUOTA_BYTES = 200 * 1024 * 1024;
/** Stored image bytes of all mailboxes together (each distinct file counted once). */
export const OUTREACH_IMAGE_TOTAL_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
/** Free space the data volume keeps after a new image file: mail and databases share that volume. */
export const OUTREACH_IMAGE_FREE_SPACE_RESERVE_BYTES = 1024 * 1024 * 1024;

export type OutreachImage = {
  id: string;
  accountId: string;
  /** Root-relative public path, e.g. `/t/m/3f…9a.png`; put this into `<img src>`. */
  url: string;
  contentType: OutreachImageType;
  bytes: number;
  width: number | null;
  height: number | null;
  /** Name it was uploaded with, for display only. */
  filename: string;
  createdAt: number;
};
/** `GET {base}/images` */
export type OutreachImageListResponse = { ok: true; images: OutreachImage[] };
/**
 * `POST {base}/images?filename=<name>` with `Content-Type: application/octet-stream` and the file
 * bytes as the body (same-origin, editor). The type is taken from the bytes, not from the name.
 * Uploading the same bytes again answers the existing image with `created: false`.
 */
export type OutreachImageUploadResponse = { ok: true; image: OutreachImage; created: boolean };

// ---------------------------------------------------------------- campaigns

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "cancelled", "failed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type Campaign = {
  id: string;
  accountId: string;
  name: string;
  subject: string;
  previewText: string;
  senderIdentityId: string | null;
  templateId: string | null;
  html: string;
  text: string;
  listIds: string[];
  excludedListIds: string[];
  status: CampaignStatus;
  trackOpens: boolean;
  trackClicks: boolean;
  sendAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  /** Who scheduled the campaign; the scheduled sends act for this user. Null for a draft. */
  scheduledByUserId: string | null;
  /** How: `"app"` or `"mcp:<label> (…<suffix>)"` (see `via.ts`); null for a draft and for campaigns scheduled before this was recorded. */
  scheduledVia: string | null;
  createdAt: number;
  updatedAt: number;
};
export type CampaignSummary = Omit<Campaign, "html" | "text"> & { stats: SendStats };
/** Only a `draft` campaign can be edited. */
export type CampaignInput = Partial<Pick<Campaign, "name" | "subject" | "previewText" | "senderIdentityId" | "templateId" | "html" | "text" | "listIds" | "excludedListIds" | "trackOpens" | "trackClicks">>;
/**
 * `POST {base}/campaigns/{id}/schedule` — `sendAt: null` sends now. Answers the number of recipients it will reach.
 * `dryRun: true` runs every check and answers the count without scheduling anything.
 */
/**
 * `expectedUpdatedAt` binds the request to the campaign version the caller reviewed (also on the dry run);
 * `expectedContentVersion` binds the confirmation to the dry run's resolved content, sender and audience.
 */
export type CampaignScheduleRequest = { sendAt: number | null; dryRun?: boolean; expectedUpdatedAt?: number; expectedContentVersion?: string };
export type CampaignScheduleResponse = { ok: true; campaign: CampaignSummary; recipients: number; contentVersion: string };
/** `POST {base}/sequences/{id}/status`; `expectedUpdatedAt` binds going live to the sequence version the caller reviewed. */
export type SequenceStatusRequest = { status: Exclude<SequenceStatus, "draft">; expectedUpdatedAt?: number };
/** `POST {base}/campaigns/{id}/test` — one rendered copy to an address, never counted in the report. */
export type TestSendRequest = { to: string; contactId?: string };
/** `GET {base}/campaigns/{id}/report` */
export type CampaignReport = { ok: true; campaign: CampaignSummary; stats: SendStats; links: Array<{ url: string; clicks: number; uniqueClicks: number }>; recipients: SendSummary[]; nextCursor: string | null };

export type SendSummary = {
  sendId: string;
  kind: SendKind;
  contactId: string | null;
  recipients: string;
  subject: string;
  status: SendStatus;
  error: string | null;
  sentAt: number | null;
  campaignId: string | null;
  sequenceId: string | null;
  opens: number;
  clicks: number;
  bounced: boolean;
  unsubscribed: boolean;
};

// ---------------------------------------------------------------- sequences

export const SEQUENCE_STATUSES = ["draft", "live", "paused"] as const;
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];

export type SequenceStep = {
  id: string;
  position: number;
  /** Wait after the previous step; after enrollment for the first step. */
  delayMinutes: number;
  name: string;
  subject: string;
  previewText: string;
  templateId: string | null;
  html: string;
  text: string;
  enabled: boolean;
};
export type SequenceStepInput = Partial<Omit<SequenceStep, "id" | "position">> & { id?: string };

export type Sequence = {
  id: string;
  accountId: string;
  name: string;
  /** A contact subscribed to this list is enrolled once. */
  triggerListId: string | null;
  senderIdentityId: string | null;
  status: SequenceStatus;
  trackOpens: boolean;
  trackClicks: boolean;
  /** Who last switched the status (live or paused); live sends act for this user. */
  statusChangedByUserId: string | null;
  /** How: `"app"` or `"mcp:<label> (…<suffix>)"` (see `via.ts`); null before the first change and for changes before this was recorded. */
  statusChangedVia: string | null;
  steps: SequenceStep[];
  createdAt: number;
  updatedAt: number;
};
export type SequenceSummary = Omit<Sequence, "steps"> & { stepCount: number; activeEnrollments: number; stats: SendStats };
/** `steps` replaces the whole step list in the given order. Steps of a `live` sequence can be edited; enrollments keep their position. */
export type SequenceInput = Partial<Pick<Sequence, "name" | "triggerListId" | "senderIdentityId" | "trackOpens" | "trackClicks">> & { steps?: SequenceStepInput[] };
/** `GET {base}/sequences/{id}/report` */
export type SequenceReport = { ok: true; sequence: SequenceSummary; steps: Array<{ stepId: string; position: number; name: string; stats: SendStats }>; enrollments: { active: number; completed: number; cancelled: number } };

/** `GET {base}/overview` — numbers for the addon's start page. */
export type OutreachOverview = { ok: true; contacts: number; subscribed: number; lists: number; campaigns: number; sequencesLive: number; last30Days: SendStats };
