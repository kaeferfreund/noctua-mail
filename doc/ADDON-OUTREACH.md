# Outreach addon (newsletter, sequences, open and click tracking)

An optional module. With `NOCTUA_ADDON_OUTREACH` unset the mail program behaves exactly as
without it: the addon routes answer 404, no scheduler starts, no MCP tool is registered, no
UI entry shows, and outgoing mail is byte-identical.

All examples use synthetic data.

## Boundaries

| Where | What |
| --- | --- |
| `lib/addons/outreach/` | all server logic |
| `app/api/addons/outreach/` | signed-in REST routes and the token-authenticated subscribe route |
| `app/t/` | public routes that recipients' mail clients reach |
| `app/components/addons/outreach/` | all UI |
| `<data dir>/db/addons/outreach.db` | all data (own SQLite file, own `user_version`) |

The addon never adds a table or column to `db/main.db` or to an account shard. Removing it
is: flag off, delete `outreach.db`.

Core files call into the addon at exactly these seams:

1. `instrumentation.ts` starts the addon scheduler when the flag is on.
2. `lib/mcpServer.ts` registers the addon's MCP tools when the flag is on;
   `lib/mcpPermissions.ts` reads their scopes from `lib/addons/outreach/mcpScopes.ts`.
3. The compose send route asks the addon for the wire version of the HTML body
   (pixel and rewritten links). The Sent copy keeps the untracked body. A failure of the
   addon sends the mail untracked; it never blocks or fails a send.
4. The reader shows one status line for a sent message when the mailbox has the addon
   activated.

## Configuration (environment)

| Variable | Meaning |
| --- | --- |
| `NOCTUA_ADDON_OUTREACH=1` | switch the addon on |
| `NOCTUA_OUTREACH_PUBLIC_URL` | origin for `/t/*` links, for example `https://links.example.test`; defaults to the app origin. Recommended: a hostname the reverse proxy routes only to `/t/*` |
| `NOCTUA_OUTREACH_SES_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Amazon SES for campaign and sequence mails |
| `NOCTUA_OUTREACH_SES_CONFIGURATION_SET` | optional SES configuration set |
| `NOCTUA_OUTREACH_SES_EVENTS_TOPIC_ARN` | SNS topic whose bounce/complaint/delivery notifications `/t/ses-events` accepts |
| `NOCTUA_OUTREACH_GEOIP_DB` | optional path to a local IP-to-location database; without it events carry no location |

Credentials live in the environment only, never in the database. Per mailbox, a manager
activates the addon and sets transport (`ses` or `mailbox-smtp`), default sender identity,
tracking default for normal mails, IP retention and send rate.

## Roles

viewer reads; editor edits contacts, lists, templates, campaign drafts and sends; manager
changes settings, API tokens and consent-independent suppression. Every route starts with
`requireOutreachContext` (`app/api/addons/outreach/_helpers/outreachContext.ts`); JSON writes
also pass `requireJsonSameOrigin`. Addon sends use the same `authorizeOutbound` and sender
identity checks as the manual send routes.

## Data model

`lib/addons/outreach/db.ts` holds the schema (v1) with comments. Every table carries
`accountId`; every query filters by it. Shapes that cross a boundary are in
`lib/addons/outreach/types.ts`.

Consent rules live in `lib/addons/outreach/contacts/consent.ts`. A contact is mailed only with
consent, without a suppression and while subscribed to the list. `contacts.unsubscribedAt` keeps
the newest global unsubscribe even after a re-subscription, so a consent older than it can never
be applied to any list. Erasing a contact removes its data; if it was suppressed or had
unsubscribed, `erased_addresses` keeps a SHA-256 of the address with the reason and dates, and a
contact created later for that address takes the block over.

A `sends` row is one tracked outgoing mail: per recipient for campaigns and sequences, per
message for a normal mail (then several recipients share one row, so an open means "someone
opened"). `tracking_links` maps the opaque public tokens to a send; `tracking_events` holds
opens, clicks, unsubscribes, deliveries, bounces and complaints.

## Public routes (`/t/*`, no session, no cookies)

| Route | Purpose |
| --- | --- |
| `GET /t/o/{token}.gif` | open pixel; always answers the same 1×1 GIF, also for unknown tokens |
| `GET /t/c/{token}` | click; 302 only to the URL stored for the token, 404 otherwise |
| `GET /t/u/{token}` | unsubscribe confirmation page (German and English) |
| `POST /t/u/{token}` | unsubscribe (form and RFC 8058 one-click) |
| `POST /t/ses-events` | Amazon SNS notifications for SES (signature and topic verified) |

Rate limited per client address (`TRUSTED_PROXY_HOPS` as in the rest of the app). An event
is `machine` when it comes from Apple Mail Privacy Protection, an image proxy, a link scanner
or arrives within seconds of delivery; machine events are stored but not counted as opens.

## REST

`GET /api/addons/outreach/status` → `OutreachStatusResponse` (answers also with the flag off).

`POST /api/addons/outreach/subscribe` with `Authorization: Bearer <api token>` →
`SubscribeRequest` / `SubscribeResponse` (server to server, no session).

Base for everything else: `/api/addons/outreach/accounts/{accountId}`.

| Method | Path | Body → success |
| --- | --- | --- |
| GET, PUT | `{base}/settings` | `OutreachSettingsPatch` → `{ok, settings}` |
| GET | `{base}/overview` | → `OutreachOverview` |
| GET | `{base}/tracking?messageId=` or `?sendId=` | → `{ok, tracking: MessageTrackingSummary \| null}` |
| GET | `{base}/tracking/events?sendId=&contactId=&campaignId=&sequenceId=&type=&includeMachine=&limit=&before=` | → `TrackingEventsResponse` |
| GET | `{base}/contacts?q=&listId=&consent=&suppressed=&page=&pageSize=` | → `ContactListResponse` |
| POST | `{base}/contacts` | `ContactInput` (upsert by address) → `{ok, contact, created}` |
| GET, PATCH, DELETE | `{base}/contacts/{contactId}` | `Partial<ContactInput>` → `{ok, contact: ContactDetail}`; DELETE erases the contact and its events |
| POST | `{base}/contacts/{contactId}/subscriptions` | `SubscriptionChange` → `{ok, contact: ContactDetail}` |
| POST | `{base}/contacts/{contactId}/suppression` | `{suppressed: boolean}` (manager) → `{ok, contact: ContactDetail}` |
| GET, POST | `{base}/lists` | `ContactListInput` → `{ok, lists}` / `{ok, list}` |
| PATCH, DELETE | `{base}/lists/{listId}` | `Partial<ContactListInput>` → `{ok, list}`; DELETE archives |
| GET, POST | `{base}/api-tokens` | `{name, listIds}` (manager) → `{ok, tokens}` / `{ok, token: OutreachApiToken, secret}` |
| DELETE | `{base}/api-tokens/{tokenId}` | (manager) → `{ok}` |
| GET, POST | `{base}/templates` | `EmailTemplateInput` → `{ok, templates: EmailTemplateSummary[]}` / `{ok, template}` |
| GET, PATCH, DELETE | `{base}/templates/{templateId}` | `Partial<EmailTemplateInput>` → `{ok, template}`; DELETE archives |
| POST | `{base}/render` | `{subject, html, text?, contactId?}` → `RenderResponse` |
| GET, POST | `{base}/campaigns` | `CampaignInput` → `{ok, campaigns: CampaignSummary[]}` / `{ok, campaign}` |
| GET, PATCH, DELETE | `{base}/campaigns/{campaignId}` | `CampaignInput` → `{ok, campaign: Campaign}`; only drafts change or delete |
| POST | `{base}/campaigns/{campaignId}/test` | `TestSendRequest` → `{ok}` |
| POST | `{base}/campaigns/{campaignId}/schedule` | `CampaignScheduleRequest` → `CampaignScheduleResponse` |
| POST | `{base}/campaigns/{campaignId}/cancel` | → `{ok, campaign}` |
| GET | `{base}/campaigns/{campaignId}/report?cursor=` | → `CampaignReport` |
| GET, POST | `{base}/sequences` | `SequenceInput` → `{ok, sequences: SequenceSummary[]}` / `{ok, sequence}` |
| GET, PATCH, DELETE | `{base}/sequences/{sequenceId}` | `SequenceInput` → `{ok, sequence: Sequence}`; only drafts delete |
| POST | `{base}/sequences/{sequenceId}/status` | `{status: "live" \| "paused"}` → `{ok, sequence}` |
| GET | `{base}/sequences/{sequenceId}/report` | → `SequenceReport` |

Errors: `{ok:false, message, code?}`; 404 flag off or unknown id, 409 `outreach_disabled`
when the mailbox has not activated the addon, 409 for a state conflict (for example editing
a sent campaign), 400 for invalid input.

The compose send route accepts one extra field, `tracking?: boolean`. It is ignored unless
the flag is on and the mailbox has the addon activated.

## Areas inside `lib/addons/outreach/`

| Folder | Owns | Public surface (`index.ts`) |
| --- | --- | --- |
| `tracking/` | tokens, HTML rewrite, events, classification, location, retention, read models over sends and events | `prepareTrackedHtml`, `recordTrackingEvent`, `getMessageTracking`, `getSendStats`, `listSendSummaries`, `listLinkStats`, `runTrackingRetention` |
| `contacts/` | contacts, lists, consent, suppression, API tokens, unsubscribe | `listSendableRecipients`, `getSendableRecipient`, `createUnsubscribeUrls`, `suppressContact` |
| `sending/` | templates, rendering, campaigns, sequences, transports, scheduler, SES events | `isSesConfigured`, `onListSubscribed`, `onContactUnmailable`, `startOutreachScheduler` |
| `mcp/` | one file per area with that area's tools | `registerOutreachMcpTools` |

An area imports another area only through its `index.ts`.

## MCP tools

Scopes are listed in `lib/addons/outreach/mcpScopes.ts`. A token without `send` can prepare
contacts, templates and campaign drafts; scheduling a campaign or switching a sequence live
needs `send`, consent changes need `manage`. Tools: `get_message_tracking`,
`list_tracking_events`, `list_contact_lists`, `search_contacts`, `get_contact`,
`upsert_contact`, `save_contact_list`, `subscribe_contact`, `unsubscribe_contact`,
`list_email_templates`, `get_email_template`, `save_email_template`, `list_campaigns`,
`get_campaign`, `get_campaign_report`, `save_campaign`, `schedule_campaign`,
`cancel_campaign`, `list_sequences`, `get_sequence`, `save_sequence`, `set_sequence_status`.
