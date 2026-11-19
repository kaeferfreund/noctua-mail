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
| `<data dir>/db/addons/outreach.db` | metadata (own SQLite file, own `user_version`) |
| `<data dir>/addons/outreach/media/` | uploaded image files |

The addon never adds a table or column to `db/main.db` or to an account shard. Removing it
is: flag off, delete `outreach.db` and the media directory.

Switching the flag off does not break mail that was already sent. As long as `outreach.db`
exists, `/t/c/{token}` still redirects to the stored target and `/t/u/{token}` still shows the page
and stores the unsubscribe (and cancels what is queued for that person). The open pixel still
answers and hosted images still load. These requests record no tracking events while the flag
is off. Deleting `outreach.db` makes tracked links, unsubscribe links and hosted image requests
answer 404 at the server. Delete the file only when those mails no longer matter. An installation that never used the
addon has no such file and its `/t/*` routes answer 404.

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

`lib/addons/outreach/db.ts` holds the schema (v1, with migrations up to v6). Every table
carries `accountId`. Mailbox queries filter by it. The public image route finds the shared file
by content hash. Shapes that cross a boundary are in `lib/addons/outreach/types.ts`.

Consent rules live in `lib/addons/outreach/contacts/consent.ts`. A contact is mailed only with
consent, without a suppression and while subscribed to the list. `contacts.unsubscribedAt` keeps
the newest global unsubscribe even after a re-subscription, so a consent older than it can never
be applied to any list. Erasing a contact removes its data; `erased_addresses` always keeps a
SHA-256 of the address with the suppression and dates, nothing else. The erase counts as an
unsubscribe at its time (or at a later unsubscribe on record), and a suppression is kept as it
was. A contact created later for that address takes the block over: the subscribe API accepts
it only with a `consentAt` later than the erase, the Klaviyo import does not activate it with an
older consent or list join, and a manual subscribe in the app or over MCP asks for the
re-subscription confirmation. Until then nothing is mailed to it. The delete confirmation in the
contact view says so.

A campaign scheduled, or a sequence switched live or paused, acts for the user who did it: the
scheduled sends check that user's live role at every send, and they keep running when the MCP
token that scheduled them is revoked (the campaign can still be cancelled, the sequence paused).
So that this stays traceable, `campaigns.scheduledByUserId` / `scheduledVia` and
`sequences.statusChangedByUserId` / `statusChangedVia` record who and through what:
`"app"` or `"mcp:<label> (…<suffix>)"`, a snapshot of the token's label and suffix at that moment
(label capped at 80 characters; see `lib/addons/outreach/via.ts`). Rows from before schema v4 have
no value. The campaign view and the sequence editor show it in one quiet line.

A `sends` row is one tracked outgoing mail: per recipient for campaigns and sequences, per
message for a normal mail (then several recipients share one row, so an open means "someone
opened"). `tracking_links` maps the opaque public tokens to a send; `tracking_events` holds
opens, clicks, unsubscribes, deliveries, bounces and complaints.

## Import Klaviyo email history

Run `bun scripts/outreach-import-klaviyo-history.ts --account example --archive /path/to/archive/raw`
for a read-only preview. Add `--write` to import into the outreach database selected by
`NOCTUA_DATA_DIR`. The command reports counts only. Import flow content first to include
history for its matching sequence steps.

The import adds sent campaigns, historical sends and their delivery, open, click, bounce,
complaint and message-linked unsubscribe events. Missing profiles and addresses without a
contact contribute anonymous counts without recipient addresses, IPs or user agents. Older
IPs for matching contacts are truncated according to the mailbox setting. Campaign HTML keeps
its archived image URLs. The import never queues mail, enrolls anyone or updates consent.
Replaying the same archive leaves existing history unchanged. Erasing a contact deletes their
imported sends and events and records opaque send IDs to prevent replay of those rows.

## Public routes (`/t/*`, no session, no cookies)

| Route | Purpose |
| --- | --- |
| `GET /t/o/{token}.gif` | open pixel; always answers the same 1×1 GIF, also for unknown tokens |
| `GET /t/c/{token}` | click; 302 only to the URL stored for the token, 404 otherwise |
| `GET, HEAD /t/m/{sha256}.{ext}` | an uploaded image; content-addressed, cached for a year, no event recorded |
| `GET /t/u/{token}` | unsubscribe confirmation page (German and English) |
| `POST /t/u/{token}` | unsubscribe (form and RFC 8058 one-click); its own budget of 2,000 submissions per minute per client, apart from the 120 page views, and a refused submission never shows the confirmation |
| `POST /t/ses-events` | Amazon SNS notifications for SES (signature and topic verified) |

Open and click events share a per-client budget of 120 requests per minute. The routes use
`TRUSTED_PROXY_HOPS` to resolve the client address. When the budget runs out, the GIF and
stored redirects still work. Malformed tokens skip database lookups. For an unknown token,
the result is reused for up to one minute, with room for 4,096 recent misses per database.
The first lookup of a new guess uses the token index and leaves the event budget available.

Open and click events from HEAD requests, Apple Mail Privacy Protection user-agent signatures
(including a bare `Mozilla/5.0`), known security gateways and crawlers, or the first five seconds
after SMTP acceptance are marked `machine`. The client and operating system come from user-agent
patterns. Gmail and Yahoo image-proxy GET opens count as human opens, including in the first
five seconds. Their IP and location belong to the proxy. These rules are estimates based on
request metadata. Counts of human opens and clicks exclude machine events.

Repeated opens within 60 seconds for the same send, IP and user agent collapse into one event
per classification (human or machine). With immediate IP truncation, a short-lived,
in-memory digest distinguishes clients on the same network. The IP is retained only at
/24 (IPv4) or /48 (IPv6) after the mailbox retention window. Location comes from the optional
local database. Event listings and the latest event in a send summary truncate expired IPs
as soon as the retention window ends. Each physical cleanup run processes up to 20 batches
of 500 rows per mailbox and yields between transactions.

One send can store up to 2,000 open and click events combined. A click stores a reference
to its link, which holds the target URL. Links longer than 2,048 characters keep their
original href. The open pixel is omitted if the rewritten HTML cannot render it as an
image.

For open and click event pages, pass the returned `nextBefore` unchanged as `before`. The
cursor is the last event's ID and distinguishes events with the same timestamp.

## REST

`GET /api/addons/outreach/status` → `OutreachStatusResponse` (answers also with the flag off).

`POST /api/addons/outreach/subscribe` with `Authorization: Bearer <api token>` →
`SubscribeRequest` / `SubscribeResponse` (server to server, no session). `consentAt` is epoch
milliseconds. The caller's clock may differ from this server's by up to 60 seconds: a value up to
that far ahead is stored as "now", anything further in the future answers 400. Against a recorded
unsubscribe or erase the claim counts 60 seconds earlier than stated, so the same request never
becomes "newer" by being sent again; a new consent must therefore be later than the unsubscribe by
more than 60 seconds, otherwise the answer is 409 `new_consent_required`.

Base for everything else: `/api/addons/outreach/accounts/{accountId}`.

| Method | Path | Body → success |
| --- | --- | --- |
| GET, PUT | `{base}/settings` | `OutreachSettingsPatch` → `{ok, settings}` |
| GET | `{base}/overview` | → `OutreachOverview` |
| GET | `{base}/tracking?messageId=` or `?sendId=` | → `{ok, tracking: MessageTrackingSummary \| null}` |
| GET | `{base}/tracking/events?sendId=&contactId=&campaignId=&sequenceId=&type=&includeMachine=&limit=&before=` | → `TrackingEventsResponse` |
| GET | `{base}/contacts?q=&listId=&consent=&suppressed=&page=&pageSize=` | → `ContactListResponse` |
| POST | `{base}/contacts` | `ContactInput` (upsert by address) → `{ok, contact, created}` |
| GET, PATCH, DELETE | `{base}/contacts/{contactId}` | `Partial<ContactInput>` → `{ok, contact: ContactDetail}`; DELETE erases the contact and its events and keeps the address blocked (see Data model) |
| POST | `{base}/contacts/{contactId}/subscriptions` | `SubscriptionChange` → `{ok, contact: ContactDetail}`; 409 `resubscribe_confirmation_required` (with `unsubscribedAt`) until `confirmResubscribe: true` is sent for a person with an unsubscribe on record |
| POST | `{base}/contacts/{contactId}/suppression` | `{suppressed: boolean}` (manager) → `{ok, contact: ContactDetail}` |
| GET, POST | `{base}/lists` | `ContactListInput` → `{ok, lists}` / `{ok, list}` |
| PATCH, DELETE | `{base}/lists/{listId}` | `Partial<ContactListInput>` → `{ok, list}`; DELETE archives |
| GET, POST | `{base}/api-tokens` | `{name, listIds}` (manager) → `{ok, tokens}` / `{ok, token: OutreachApiToken, secret}` |
| DELETE | `{base}/api-tokens/{tokenId}` | (manager) → `{ok}` |
| GET, POST | `{base}/templates` | `EmailTemplateInput` → `{ok, templates: EmailTemplateSummary[]}` / `{ok, template}` |
| GET, PATCH, DELETE | `{base}/templates/{templateId}` | `Partial<EmailTemplateInput>` → `{ok, template}`; DELETE archives |
| POST | `{base}/render` | `{subject, html, text?, contactId?}` → `RenderResponse` |
| GET | `{base}/images` | → `OutreachImageListResponse` |
| POST | `{base}/images?filename=` | file bytes as `application/octet-stream` → `OutreachImageUploadResponse` (PNG, JPEG, GIF, WebP; at most 5 MiB; 413 if oversized, 415 if unsupported or the extension disagrees with the detected type) |
| GET, POST | `{base}/campaigns` | `CampaignInput` → `{ok, campaigns: CampaignSummary[]}` / `{ok, campaign}` |
| GET, PATCH, DELETE | `{base}/campaigns/{campaignId}` | `CampaignInput` → `{ok, campaign: Campaign}`; only drafts change or delete. `Campaign` and `CampaignSummary` carry `scheduledByUserId` and `scheduledVia` |
| POST | `{base}/campaigns/{campaignId}/test` | `TestSendRequest` → `{ok}` |
| POST | `{base}/campaigns/{campaignId}/schedule` | `CampaignScheduleRequest` → `CampaignScheduleResponse`; `dryRun: true` checks and counts without scheduling. Pass its `campaign.updatedAt` as `expectedUpdatedAt` to reject a changed draft with 409 `campaign_changed`. Scheduling a campaign that would reach nobody answers 409 `no_recipients`. |
| POST | `{base}/campaigns/{campaignId}/cancel` | → `{ok, campaign}` |
| GET | `{base}/campaigns/{campaignId}/report?cursor=` | → `CampaignReport` |
| GET, POST | `{base}/sequences` | `SequenceInput` → `{ok, sequences: SequenceSummary[]}` / `{ok, sequence}` |
| GET, PATCH, DELETE | `{base}/sequences/{sequenceId}` | `SequenceInput` → `{ok, sequence: Sequence}`; only drafts delete. `Sequence` and `SequenceSummary` carry `statusChangedByUserId` and `statusChangedVia` |
| POST | `{base}/sequences/{sequenceId}/status` | `{status: "live" \| "paused"}` → `{ok, sequence}` |
| GET | `{base}/sequences/{sequenceId}/report` | → `SequenceReport` |

Errors: `{ok:false, message, code?}`; 404 flag off or unknown id, 409 `outreach_disabled`
when the mailbox has not activated the addon, 409 for a state conflict (for example editing
a sent campaign), 400 for invalid input.

The compose send route accepts one extra field, `tracking?: boolean`. It is ignored unless
the flag is on and the mailbox has the addon activated.

## Hosted email images

Use the returned root-relative `image.url` in an `<img src>` in a template, campaign or sequence
step. Preview and send rendering prepend the configured public origin to these image paths.
HTML `srcset`, CSS URLs and Outlook conditional comments keep their original URLs.
The URL uses the SHA-256 of the file bytes and a canonical extension (`.png`, `.jpg`, `.gif`,
or `.webp`). Mailboxes share the file bytes and keep separate library entries. The public
URL can be read by anyone who has it. There is no delete operation because previously sent
mail depends on the URL. Back up the media directory with the addon database.

Uploads and rehosting require a complete image header with dimensions from 1 to 16,384 pixels
on each side. The server checks the header without decoding the image pixels. Rehosting keeps
the source filename's base and adds or replaces the extension using the detected format.

To migrate existing image references, use `bun scripts/outreach-rehost-images.ts --account example
--host images.example.test --drop-links-to badge.example.test`. The command scans template HTML,
campaign drafts and sequence steps in that mailbox. It fetches only over HTTPS on the explicitly
listed hosts, including redirect destinations. Both modes report replacements, anchor removals,
ambiguous markup skipped per document, and download failures. The dry run leaves stored data
untouched. Add `--write` to apply the reported edits. Anchor removals are applied only when the
source range is unambiguous and reparsing preserves the rest of the HTML tree. Image rewrites
must preserve the tree apart from the intended `src` changes. Diagnostic URLs omit credentials
and query values. Rerun to retry failures or edits detected while downloading.

## Areas inside `lib/addons/outreach/`

| Folder | Owns | Public surface (`index.ts`) |
| --- | --- | --- |
| `tracking/` | tokens, HTML rewrite, events, classification, location, retention, read models over sends and events | `prepareTrackedHtml`, `recordTrackingEvent`, `getMessageTracking`, `getSendStats`, `listSendSummaries`, `listLinkStats`, `runTrackingRetention` |
| `contacts/` | contacts, lists, consent, suppression, API tokens, unsubscribe | `listSendableRecipients`, `getSendableRecipient`, `createUnsubscribeUrls`, `suppressContact` |
| `sending/` | templates, rendering, campaigns, sequences, transports, scheduler, SES events | `isSesConfigured`, `onListSubscribed`, `onContactUnmailable`, `startOutreachScheduler` |
| `media/` | image type checks, metadata, content-addressed files | `listOutreachImages`, `prepareImage`, `saveOutreachImage` |
| `mcp/` | one file per area with that area's tools | `registerOutreachMcpTools` |

An area imports another area only through its `index.ts`.

## MCP tools

Scopes are listed in `lib/addons/outreach/mcpScopes.ts`. A token without `send` can prepare
contacts, templates and campaign drafts; scheduling a campaign or switching a sequence live
needs `send`, consent changes need `manage`. Tools: `get_message_tracking`,
`list_tracking_events`, `list_contact_lists`, `search_contacts`, `get_contact`,
`upsert_contact`, `save_contact_list`, `subscribe_contact`, `unsubscribe_contact`,
`list_email_templates`, `get_email_template`, `save_email_template`, `list_email_images`,
`upload_email_image` (base64 `data` and `filename`), `list_campaigns`,
`get_campaign`, `get_campaign_report`, `save_campaign`, `schedule_campaign`,
`cancel_campaign`, `list_sequences`, `get_sequence`, `save_sequence`, `set_sequence_status`.
`list_campaigns`, `get_campaign`, `list_sequences` and `get_sequence` return the trace fields of
the REST shapes; `schedule_campaign` and `set_sequence_status` record the calling token.

Authenticated `/api/mcp` requests have a 36 MiB body limit, including the entire body of a
JSON-RPC batch. It is sized for a draft with about 25 MiB of attachments; the image upload checks
its own 5 MiB limit. Larger requests receive HTTP 413, and a body that has not arrived completely
after 120 seconds receives HTTP 408.
