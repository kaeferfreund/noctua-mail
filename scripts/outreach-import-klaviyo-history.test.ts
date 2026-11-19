import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { eraseContact } from "@/lib/addons/outreach/contacts/consent";
import { getContactDetail, upsertContact } from "@/lib/addons/outreach/contacts/records";
import { closeOutreachDb, getOutreachDb, getOutreachDbPath, OUTREACH_SCHEMA_VERSION } from "@/lib/addons/outreach/db";
import { removeHistorySchema } from "@/lib/addons/outreach/testFixtures/legacySchema";
import { enroll, expandSequences } from "@/lib/addons/outreach/sending/queue";
import { OutreachScheduler } from "@/lib/addons/outreach/sending/scheduler";
import { applySesEvent } from "@/lib/addons/outreach/sending/sesEvents";
import { campaignReport, listCampaigns, sequenceReport } from "@/lib/addons/outreach/sending/store";
import { getOutreachOverview, listTrackingEvents } from "@/lib/addons/outreach/tracking";
import { DAY_MS } from "@/lib/addons/outreach/tracking/ip";
import { importContent, sequenceId } from "./outreach-import-klaviyo-content";
import { assertCurrentHistorySchema, HistoryImportError, historyArchiveDir, importKlaviyoHistory } from "./outreach-import-klaviyo-history";
import { readKlaviyoHistoryArchive } from "./outreach-klaviyo-history-archive";

const accountId = "history-test";
const listId = "local-list";
const flowId = "sample-flow";
const seqId = sequenceId(accountId, flowId);
const now = Date.now();
const start = now - 2 * DAY_MS;
const previousDataDir = process.env.NOCTUA_DATA_DIR;
let dir: string;

beforeEach(() => {
  closeOutreachDb();
  dir = mkdtempSync(join(tmpdir(), "outreach-history-"));
  process.env.NOCTUA_DATA_DIR = dir;
});

afterEach(() => {
  closeOutreachDb();
  if (previousDataDir === undefined) delete process.env.NOCTUA_DATA_DIR;
  else process.env.NOCTUA_DATA_DIR = previousDataDir;
  rmSync(dir, { recursive: true, force: true });
});

const ref = (id: string) => ({ data: { id } });
const resource = (type: string, id: string, attributes: Record<string, unknown>, relationships = {}) => ({ type, id, attributes, relationships });

function put(name: string, data: unknown, included?: unknown[]) {
  const path = join(dir, "archive", name + ".json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ data, included }));
}

function fixtureArchive() {
  const metrics = ["Received Email", "Opened Email", "Clicked Email", "Bounced Email", "Marked Email as Spam",
    "Unsubscribed from Email Marketing", "Clicked email to unsubscribe", "Dropped Email", "Subscribed to List"];
  put("metrics", metrics.map(name => resource("metric", name, { name }, { unrelated: { links: {} } })));
  put("profiles", [
    resource("profile", "present", { email: "mAtCh@example.test" }),
    resource("profile", "unmatched", { email: "foreign@example.test" })
  ]);
  const campaign = (id: string, ids: string[]) => resource("campaign", id, { name: "Newsletter" }, {
    "campaign-messages": { data: ids.map(id => ({ id })) }
  });
  const campaignMessage = (id: string) => resource("campaign-message", id, {
    definition: { content: { subject: "Archived subject" } }
  }, { template: ref("source-template") });
  put("campaigns-email", [campaign("parent", ["campaign-first", "campaign-second"]), campaign("empty", ["empty-message"])],
    [campaignMessage("campaign-second"), campaignMessage("empty-message")]);
  put("campaign-messages/campaign-first", campaignMessage("campaign-first"), [
    resource("template", "source-template", { html: "<p>Archived</p>", text: "Archived" })
  ]);
  const email = (id: string, next: string | null) => ({
    id: "action-" + id, type: "send-email", data: { message: { id, subject_line: id, template_id: "step-" + id } }, links: { next }
  });
  const actions = [email("flow-second", null), email("flow-first", "action-flow-second")];
  const flow = resource("flow", flowId, { name: "Archived flow", definition: {
    entry_action_id: "action-flow-first", triggers: [{ id: "source-list" }], actions
  } });
  put("flows", [resource("flow", flowId, {}), resource("flow", "unimported", {})]);
  put("flows/" + flowId, flow);
  put("flow-actions/" + flowId, actions.map(action => resource("flow-action", action.id, {})));
  put("flow-actions/unimported", [resource("flow-action", "action-orphan", {})]);
  for (const id of ["flow-first", "flow-second", "orphan"]) {
    put("flow-messages/action-" + id, [resource("flow-message", id, { channel: "Email", definition: { id, subject_line: id } })]);
  }
  const event = (id: string, metric: string, profile: string, message: string, at: number, extra = {}) =>
    resource("event", id, { datetime: new Date(at).toISOString(), event_properties: { $message: message, ...extra } },
      { metric: ref(metric), profile: ref(profile) });
  put("events", [
    event("duplicate-variant", "Received Email", "present", "parent", start + 500, { $message_variation: "campaign-second" }),
    event("delivered", "Received Email", "present", "parent", start, { $message_variation: "campaign-first" }),
    event("delivered-repeat", "Received Email", "present", "campaign-first", start + 100),
    event("machine", "Opened Email", "present", "campaign-first", start + 600, { machine_open: "True" }),
    event("human", "Opened Email", "present", "campaign-first", start + 700,
      { _ip: "192.0.2.24", "Client Name": "Example Mail", "Client OS": "Example OS", "Client Type": "Email client" }),
    event("click", "Clicked Email", "present", "campaign-first", now - 100, { ip_address: "2001:db8::10", URL: "https://example.test/demo" }),
    event("bot", "Clicked Email", "present", "campaign-first", now - 99, { "Bot Click": true, URL: "https://example.test/demo" }),
    event("unsub-click", "Clicked email to unsubscribe", "present", "campaign-first", now - 90),
    event("unsub", "Unsubscribed from Email Marketing", "present", "campaign-first", now - 89),
    event("unassigned", "Unsubscribed from Email Marketing", "present", "", now - 88),
    event("complaint", "Marked Email as Spam", "present", "campaign-first", now - 87),
    event("deleted-profile", "Bounced Email", "gone", "campaign-first", start + 200,
      { "Recipient Email Address": "match@example.test", _ip: "192.0.2.11" }),
    event("deleted-click", "Clicked Email", "gone", "campaign-first", start + 300,
      { URL: "https://example.test/demo?recipient=match%40example.test", _ip: "192.0.2.12" }),
    event("known-unmatched", "Received Email", "unmatched", "campaign-first", start + 300),
    event("flow-second-delivery", "Received Email", "present", "flow-second", start + 900),
    event("flow-first-bounce", "Bounced Email", "present", "flow-first", start - 200),
    event("missing-sequence", "Received Email", "present", "orphan", start + 900),
    event("missing-anchor", "Opened Email", "another-gone", "campaign-first", start + 900),
    event("missing-message", "Opened Email", "present", "unknown", start),
    event("dropped", "Dropped Email", "present", "campaign-first", start),
    event("consent", "Subscribed to List", "present", "", start)
  ]);
  return {
    archive: readKlaviyoHistoryArchive(join(dir, "archive")), flow: { data: flow },
    templates: { data: ["flow-first", "flow-second"].map(id => resource("template", "step-" + id, { name: id, html: "<p>Step</p>" })) }
  };
}

async function setup() {
  const { archive, flow, templates } = fixtureArchive();
  const db = await getOutreachDb();
  db.query("INSERT INTO account_settings (accountId, enabled, ipRetentionDays, updatedAt) VALUES (?, 1, 1, ?)").run(accountId, now);
  db.query("INSERT INTO lists (id, accountId, name, externalId, createdAt, updatedAt) VALUES (?, ?, 'Example', 'source-list', ?, ?)")
    .run(listId, accountId, now, now);
  const { contact } = await upsertContact(accountId, { email: "match@example.test" });
  await upsertContact("elsewhere", { email: "foreign@example.test" });
  importContent(db, { accountId, flow, templates, write: true });
  db.query("UPDATE sequences SET status = 'live', statusChangedByUserId = 'local-user' WHERE id = ?").run(seqId);
  db.query("INSERT INTO campaigns (id, accountId, name, externalId, createdAt, updatedAt) VALUES ('live-data', ?, 'Native campaign', 'parent', ?, ?)")
    .run(accountId, now, now);
  const options = { accountId, archive, now };
  return { db, contact, archive, options, report: (write = false) => importKlaviyoHistory(db, { ...options, write }) };
}

test("imports archive history idempotently and preserves reports, contact privacy and mailbox state", async () => {
  const { db, contact, archive, report } = await setup();
  const contacts = db.query("SELECT * FROM contacts ORDER BY id").all();
  const sequences = db.query("SELECT * FROM sequences").all();
  const steps = db.query("SELECT * FROM sequence_steps ORDER BY id").all();
  const dry = report();
  expect(db.query("SELECT * FROM sends").all()).toEqual([]);
  expect(db.query("SELECT * FROM tracking_events").all()).toEqual([]);
  expect(report(true)).toEqual({ ...dry, written: true });
  expect(dry).toMatchObject({
    campaigns: { inserted: 1, withoutTemplate: 0 }, sends: { inserted: 5, anonymous: 2 },
    events: { inserted: 13, anonymous: 3 }, collapsedDeliveries: 1,
    skipped: { ignoredMetric: 1, unassignedUnsubscribe: 1, duplicateUnsubscribe: 1, droppedEmail: 1,
      duplicateSend: 1, duplicateSendEvents: 1, missingSequence: 1, noDeliveryOrBounce: 1, unknownMessage: 1 }
  });
  expect(report(true)).toMatchObject({
    campaigns: { inserted: 0, updated: 0, unchanged: 1 }, sends: { inserted: 0, updated: 0, unchanged: 5 },
    events: { inserted: 0, unchanged: 13 }
  });
  expect(db.query("SELECT * FROM contacts ORDER BY id").all()).toEqual(contacts);
  expect(db.query("SELECT * FROM sequences").all()).toEqual(sequences);
  expect(db.query("SELECT * FROM sequence_steps ORDER BY id").all()).toEqual(steps);
  expect(db.query("SELECT * FROM list_members").all()).toEqual([]);

  const campaigns = await listCampaigns(db, accountId);
  expect(campaigns).toHaveLength(2);
  expect(campaigns.find(campaign => campaign.id === "live-data")).toMatchObject({ name: "Native campaign", status: "draft" });
  const campaign = campaigns.find(campaign => campaign.scheduledVia === "import:klaviyo")!;
  expect(campaign).toMatchObject({ status: "sent", startedAt: start, finishedAt: start + 500 });
  expect(db.query("SELECT html, text FROM campaigns WHERE id = ?").get(campaign.id)).toEqual({ html: "<p>Archived</p>", text: "Archived" });
  expect(await campaignReport(db, accountId, campaign.id)).toMatchObject({
    stats: { sent: 3, queued: 0, opened: 1, clicked: 2, machineOpens: 1, bounced: 1, unsubscribed: 1, complained: 1 },
    links: [{ url: "https://example.test/demo", clicks: 2, uniqueClicks: 2 }]
  });
  expect((await sequenceReport(db, accountId, seqId)).steps.map(step => step.stats)).toMatchObject([
    { sent: 1, bounced: 1 }, { sent: 1, bounced: 0 }
  ]);
  expect((await getOutreachOverview(accountId, now)).last30Days).toMatchObject({ sent: 5, queued: 0, opened: 1, machineOpens: 1 });
  expect(await getContactDetail(accountId, contact.id)).toMatchObject({ stats: { sent: 3 }, lastSends: [
    { subject: "flow-second", sentAt: start + 900 }, { subject: "Archived subject", sentAt: start }, { subject: "flow-first", sentAt: start - 200 }
  ] });
  const contactEvents = (await listTrackingEvents(accountId, { contactId: contact.id, includeMachine: true })).events;
  expect(contactEvents).toContainEqual(expect.objectContaining({ type: "open", machine: false, ip: "192.0.2.0", ipTruncated: true,
    clientName: "Example Mail", clientOs: "Example OS", clientType: "mail-client" }));
  expect(contactEvents).toContainEqual(expect.objectContaining({ type: "click", machine: false, ip: "2001:db8::10", ipTruncated: false }));
  expect(db.query("SELECT recipients, messageId, providerMessageId FROM sends WHERE contactId IS NULL").all())
    .toEqual(Array.from({ length: 2 }, () => ({ recipients: "", messageId: null, providerMessageId: null })));
  expect(db.query("SELECT count(*) AS n FROM tracking_events WHERE contactId IS NULL AND (ip IS NOT NULL OR userAgent IS NOT NULL)").get())
    .toEqual({ n: 0 });
  expect(db.query("SELECT * FROM tracking_links").all()).toEqual([]);

  const template = archive.messages.get("campaign-first")!;
  if (template.kind !== "campaign") throw new Error("fixture message must be a campaign");
  template.name = "Updated archive name";
  expect(report(true).campaigns).toMatchObject({ inserted: 0, updated: 1, unchanged: 0 });
  expect((await listCampaigns(db, accountId)).find(entry => entry.id === campaign.id)?.name).toBe("Updated archive name");
});

test("scheduler and SES ignore historical rows, and a native enrollment keeps its original steps", async () => {
  const { db, contact, report } = await setup();
  report(true);
  let passes = 0;
  let expansions = 0;
  let sends = 0;
  const scheduler = new OutreachScheduler({
    db: async () => db, now: () => now,
    recipients: async () => { expansions++; throw new Error("historical campaigns must never expand"); },
    settings: async () => { throw new Error("historical sends must never be claimed"); },
    send: async () => { sends++; return { status: "failed", reason: "test" }; },
    retention: async () => ++passes
  });
  await scheduler.tick();
  await scheduler.stop();
  expect(passes).toBe(1);
  expect(expansions).toBe(0);
  expect(sends).toBe(0);
  expect(db.query("SELECT attempts, status FROM sends WHERE attempts <> 0 OR status <> 'sent'").all()).toEqual([]);
  expect(db.query("SELECT * FROM sequence_enrollments").all()).toEqual([]);
  const send = db.query("SELECT id FROM sends WHERE contactId = ? LIMIT 1").get(contact.id) as { id: string };
  db.query("UPDATE sends SET providerMessageId = 'receipt' WHERE id = ?").run(send.id);
  await applySesEvent("sns-fixture", {
    eventType: "Bounce", mail: { messageId: "receipt", tags: { noctua_send_id: [send.id] } }, bounce: { bounceType: "Permanent" }
  }, {
    db: async () => db, now: () => now,
    suppress: async () => { throw new Error("receipt must not suppress contact"); },
    record: async () => { throw new Error("receipt must not match historical send"); }
  });
  enroll(db, accountId, { listId, contactId: contact.id, at: now });
  expandSequences(db, accountId, now);
  expect(db.query("SELECT nextStepPosition, nextSendAt FROM sequence_enrollments WHERE contactId = ?").get(contact.id))
    .toEqual({ nextStepPosition: 0, nextSendAt: now });
  expect(db.query("SELECT subject FROM sends WHERE source = 'native' AND status = 'queued'").all())
    .toEqual([{ subject: "flow-first" }]);
});

test("contact erase deletes historical sends and events and replay cannot restore them", async () => {
  const { db, contact, report } = await setup();
  report(true);
  const ids = (db.query("SELECT id FROM sends WHERE contactId = ?").all(contact.id) as Array<{ id: string }>).map(row => row.id);
  expect(ids).toHaveLength(3);
  await eraseContact(accountId, contact.id, now + 1);
  for (const id of ids) {
    expect(db.query("SELECT * FROM sends WHERE id = ?").get(id)).toBeNull();
    expect(db.query("SELECT * FROM tracking_events WHERE sendId = ?").get(id)).toBeNull();
  }
  expect(db.query("SELECT count(*) AS n FROM sends WHERE source = 'klaviyo'").get()).toEqual({ n: 2 });
  await upsertContact(accountId, { email: "match@example.test" });
  const repeated = report(true);
  expect(repeated.skipped.erasedSend).toBe(3);
  expect(repeated.sends.inserted).toBe(0);
  for (const id of ids) expect(db.query("SELECT * FROM sends WHERE id = ?").get(id)).toBeNull();
});

test("a flow message with no matching saved step is counted and skipped", async () => {
  const { db, report } = await setup();
  db.query("UPDATE sequence_steps SET templateId = NULL WHERE sequenceId = ? AND position = 1").run(seqId);
  expect(report(true).skipped.missingStep).toBe(1);
  expect(db.query("SELECT subject FROM sends WHERE sequenceId = ?").all(seqId)).toEqual([{ subject: "flow-first" }]);
});

test("a write run refuses a database of another schema version and leaves it untouched", async () => {
  // No file yet: the server has never run with the addon.
  expect(() => assertCurrentHistorySchema(getOutreachDbPath())).toThrow(HistoryImportError);
  const db = await getOutreachDb();
  expect(() => assertCurrentHistorySchema(getOutreachDbPath())).not.toThrow();
  // The file of a server that still runs the previous release.
  removeHistorySchema(db);
  closeOutreachDb();
  expect(() => assertCurrentHistorySchema(getOutreachDbPath())).toThrow(`needs ${OUTREACH_SCHEMA_VERSION}`);
  const untouched = new Database(getOutreachDbPath(), { readonly: true });
  expect(untouched.query("PRAGMA user_version").get()).toEqual({ user_version: OUTREACH_SCHEMA_VERSION - 1 });
  expect(untouched.query("SELECT 1 FROM sqlite_master WHERE name = 'klaviyo_erased_sends'").get()).toBeNull();
  untouched.close();
});

test("the archive folder or its raw folder is accepted", () => {
  const raw = join(dir, "archive", "raw");
  mkdirSync(raw, { recursive: true });
  writeFileSync(join(raw, "events.json"), "{}");
  expect(historyArchiveDir(join(dir, "archive"))).toBe(raw);
  expect(historyArchiveDir(raw)).toBe(raw);
  expect(historyArchiveDir(join(dir, "elsewhere"))).toBe(join(dir, "elsewhere"));
});
