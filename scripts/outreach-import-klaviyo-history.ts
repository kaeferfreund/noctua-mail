import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { closeOutreachDb, getOutreachDb, getOutreachDbPath, initOutreachSchema, klaviyoEventIdSql, OUTREACH_SCHEMA_VERSION } from "@/lib/addons/outreach/db";
import { itemId, validated } from "@/lib/addons/outreach/sending/input";
import { rows } from "@/lib/addons/outreach/sending/sql";
import { normalizeTrackingIp, trackingIpExpiryCutoff, truncateTrackingIp } from "@/lib/addons/outreach/tracking/ip";
import type { TrackingEventType, TrackingEvent } from "@/lib/addons/outreach/types";
import { OUTREACH_VIA_KLAVIYO } from "@/lib/addons/outreach/via";
import { sequenceId } from "./outreach-import-klaviyo-content";
import { readKlaviyoHistoryArchive, stringField, type HistoryArchive, type HistoryEvent, type HistoryMessage } from "./outreach-klaviyo-history-archive";

const eventTypes = new Map<string, TrackingEventType>([
  ["Received Email", "delivered"], ["Opened Email", "open"], ["Clicked Email", "click"], ["Bounced Email", "bounce"],
  ["Marked Email as Spam", "complaint"], ["Unsubscribed from Email Marketing", "unsubscribe"], ["Clicked email to unsubscribe", "unsubscribe"]
]);
const clientTypes = new Map<string, NonNullable<TrackingEvent["clientType"]>>([
  ["browser", "browser"], ["mobile browser", "mobile"], ["mobile", "mobile"], ["email client", "mail-client"],
  ["mail client", "mail-client"], ["image proxy", "proxy"], ["proxy", "proxy"], ["bot", "bot"]
]);

type MailEvent = HistoryEvent & { type: TrackingEventType; machine: boolean };
type Contact = { id: string; email: string };
type SavedSend = { accountId: string; contactId: string | null; source: string };
type Mail = {
  message: HistoryMessage;
  events: MailEvent[];
  totals: ReturnType<typeof mailTotals>;
};

function mailTotals(kind: HistoryMessage["kind"]) {
  return { kind, sends: 0, anonymousSends: 0, anonymousEvents: 0,
    delivered: 0, open: 0, humanOpens: 0, openedRecipients: 0, humanOpenedRecipients: 0,
    click: 0, humanClicks: 0, humanClickedRecipients: 0, bounce: 0, unsubscribe: 0, complaint: 0 };
}

function historicalId(prefix: string, ...parts: string[]) {
  return `${prefix}_klaviyo_${createHash("sha256").update(JSON.stringify(parts)).digest("hex")}`;
}

function clickUrl(value: unknown, anonymous: boolean) {
  try {
    const url = new URL(stringField(value));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (!anonymous) return url.href;
    // Omit tracking parameters and recognizable addresses from anonymous links.
    if (decodeURIComponent(url.pathname).includes("@")) return null;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function byTime(a: HistoryEvent, b: HistoryEvent) {
  return a.at - b.at || a.id.localeCompare(b.id);
}

function recipientGroups(events: MailEvent[]) {
  const recipients = new Map<string, MailEvent[]>();
  for (const event of events) {
    // Address properties can group an unlinked event in memory, but cannot identify a Noctua contact.
    const email = stringField(event.properties["Recipient Email Address"]).trim().toLowerCase();
    const key = event.profileId ? `profile:${event.profileId}` : email ? `email:${email}` : `event:${event.id}`;
    if (!recipients.has(key)) recipients.set(key, []);
    recipients.get(key)!.push(event);
  }
  return Array.from(recipients.values(), items => {
    items.sort(byTime);
    const delivery = items.find(event => event.type === "delivered");
    return { items, anchor: delivery ?? items.find(event => event.type === "bounce") };
  });
}

export function importKlaviyoHistory(db: Database, options: { accountId: string; archive: HistoryArchive; write?: boolean; now?: number }) {
  const { accountId, archive, write = false, now = Date.now() } = options;
  const result = {
    written: write,
    campaigns: { inserted: 0, updated: 0, unchanged: 0, withoutTemplate: 0 },
    sends: { inserted: 0, updated: 0, unchanged: 0, anonymous: 0 },
    events: { inserted: 0, unchanged: 0, anonymous: 0, anonymized: 0 },
    skipped: { ignoredMetric: 0, droppedEmail: 0, unassignedUnsubscribe: 0, unknownMessage: 0, invalidTimestamp: 0,
      missingSequence: 0, missingStep: 0, noDeliveryOrBounce: 0, duplicateSend: 0, duplicateSendEvents: 0,
      duplicateUnsubscribe: 0, duplicateEvent: 0, erasedSend: 0, erasedEvents: 0 },
    collapsedDeliveries: 0,
    perMail: [] as Array<ReturnType<typeof mailTotals>>
  };
  const { skipped } = result;
  const mails = new Map<string, Mail>();
  const archiveEventIds = new Set<string>();
  for (const event of archive.events) {
    const type = eventTypes.get(event.metric ?? "");
    const dropped = event.metric === "Dropped Email";
    if (!type && !dropped) { skipped.ignoredMetric++; continue; }
    const id = event.messageId ?? stringField(event.properties.$message);
    const message = archive.messages.get(id);
    if (dropped) skipped.droppedEmail++;
    else if (!id && type === "unsubscribe") { skipped.unassignedUnsubscribe++; continue; }
    else if (!message) { skipped.unknownMessage++; continue; }
    if (!message) continue;
    if (!Number.isFinite(event.at)) { if (!dropped) skipped.invalidTimestamp++; continue; }
    if (archiveEventIds.has(event.id)) { if (!dropped) skipped.duplicateEvent++; continue; }
    archiveEventIds.add(event.id);
    // A mail with nothing but dropped events was never sent to anyone: no campaign row for it.
    if (!type) continue;
    if (!mails.has(id)) mails.set(id, { message, events: [], totals: mailTotals(message.kind) });
    const flag = type === "open" ? event.properties.machine_open : type === "click" ? event.properties["Bot Click"] : false;
    mails.get(id)!.events.push({ ...event, type, machine: flag === true || stringField(flag).toLowerCase() === "true" });
  }

  const apply = () => {
    const schema = rows<{ user_version: number }>(db, "PRAGMA user_version").get()!;
    if (schema.user_version > OUTREACH_SCHEMA_VERSION) throw new Error("Unsupported outreach schema");
    const hasHistorySchema = schema.user_version >= 6;
    const settings = rows<{ ipRetentionDays: number }>(db, "SELECT ipRetentionDays FROM account_settings WHERE accountId = ?").get(accountId);
    const ipCutoff = trackingIpExpiryCutoff(now, settings?.ipRetentionDays);
    const contacts = new Map(rows<Contact & { emailLower: string }>(db, "SELECT id, email, emailLower FROM contacts WHERE accountId = ?")
      .all(accountId).map(contact => [contact.emailLower, contact]));

    const campaignMails = new Map<string, Array<Mail & { message: Extract<HistoryMessage, { kind: "campaign" }> }>>();
    for (const mail of mails.values()) {
      if (mail.message.kind !== "campaign") continue;
      const id = mail.message.campaignId;
      if (!campaignMails.has(id)) campaignMails.set(id, []);
      campaignMails.get(id)!.push({ ...mail, message: mail.message });
    }
    const campaignIds = new Map<string, string>();
    for (const [externalId, entries] of campaignMails) {
      const allEvents = entries.flatMap(entry => entry.events).sort(byTime);
      const received = allEvents.filter(event => event.type === "delivered");
      const first = received[0]?.at ?? null;
      const last = received.at(-1)?.at ?? null;
      const primary = entries.find(entry => entry.events.some(event => event.id === received[0]?.id)) ?? entries[0];
      const { name, subject, html, text, hasTemplate } = primary.message;
      if (!hasTemplate) result.campaigns.withoutTemplate++;
      const saved = schema.user_version >= 4 ? rows<{ id: string; name: string; subject: string; html: string; text: string;
        startedAt: number | null; finishedAt: number | null }>(db, `SELECT id, name, subject, html, text, startedAt, finishedAt
        FROM campaigns WHERE accountId = ? AND scheduledVia = ? AND status = 'sent' AND externalId = ? LIMIT 2`)
        .all(accountId, OUTREACH_VIA_KLAVIYO, externalId) : [];
      if (saved.length > 1) throw new Error("Duplicate historical campaign in database");
      const existing = saved[0];
      const id = existing?.id ?? historicalId("cmp", accountId, externalId);
      campaignIds.set(externalId, id);
      if (!existing) {
        if (write) db.query(`INSERT INTO campaigns (id, accountId, externalId, name, subject, html, text, status,
          scheduledVia, startedAt, finishedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?)`)
          .run(id, accountId, externalId, name, subject, html, text, OUTREACH_VIA_KLAVIYO, first, last, first ?? allEvents[0]?.at ?? now, now);
        result.campaigns.inserted++;
      } else if (existing.name !== name || existing.subject !== subject || existing.html !== html ||
                 existing.text !== text || existing.startedAt !== first || existing.finishedAt !== last) {
        if (write) db.query(`UPDATE campaigns SET name = ?, subject = ?, html = ?, text = ?, startedAt = ?, finishedAt = ?, updatedAt = ?
          WHERE id = ? AND accountId = ?`).run(name, subject, html, text, first, last, now, id, accountId);
        result.campaigns.updated++;
      } else {
        result.campaigns.unchanged++;
      }
    }

    const groups = [];
    for (const [messageId, mail] of mails) {
      const { message, totals } = mail;
      result.perMail.push(totals);
      let campaignId: string | null = null;
      let seqId: string | null = null;
      let stepId: string | null = null;
      if (message.kind === "campaign") {
        campaignId = campaignIds.get(message.campaignId)!;
      } else {
        seqId = sequenceId(accountId, message.flowId);
        if (!db.query("SELECT 1 FROM sequences WHERE accountId = ? AND id = ?").get(accountId, seqId)) {
          skipped.missingSequence += mail.events.length;
          continue;
        }
        const step = message.step && rows<{ id: string }>(db, `SELECT p.id FROM sequence_steps p
          JOIN templates t ON t.accountId = p.accountId AND t.id = p.templateId
          WHERE p.accountId = ? AND p.sequenceId = ? AND p.position = ? AND t.externalId = ?`)
          .get(accountId, seqId, message.step.position, message.step.templateExternalId);
        if (!step) { skipped.missingStep += mail.events.length; continue; }
        stepId = step.id;
      }
      for (const { items, anchor } of recipientGroups(mail.events)) {
        if (!anchor) { skipped.noDeliveryOrBounce += items.length; continue; }
        groups.push({ messageId, message, totals, items, anchor, campaignId, seqId, stepId });
      }
    }

    const occupied = new Set<string>();
    const findSend = rows<SavedSend>(db, `SELECT accountId, contactId, ${hasHistorySchema ? "source" : "'native' AS source"} FROM sends WHERE id = ?`);
    const seenEvent = rows<{ sendId: string }>(db, `SELECT sendId FROM tracking_events WHERE accountId = ? AND ${klaviyoEventIdSql} = ?`);
    for (const { messageId, message, totals, items, anchor, campaignId, seqId, stepId } of groups.sort((a, b) => byTime(a.anchor, b.anchor))) {
      const email = archive.profiles.get(anchor.profileId ?? "")?.trim().toLowerCase();
      const contact = email ? contacts.get(email) : undefined;
      const id = historicalId("snd", accountId, messageId, anchor.profileId ?? anchor.id);
      const target = campaignId ?? stepId;
      const key = contact ? JSON.stringify([target, contact.id]) : null;
      if (hasHistorySchema && db.query("SELECT 1 FROM klaviyo_erased_sends WHERE accountId = ? AND sendId = ?").get(accountId, id)) {
        if (key) occupied.add(key);
        skipped.erasedSend++;
        skipped.erasedEvents += items.length;
        continue;
      }
      const saved = findSend.get(id);
      if (saved && (saved.accountId !== accountId || saved.source !== "klaviyo")) throw new Error("Historical send identifier collision");
      const contactId = saved ? saved.contactId === contact?.id ? saved.contactId : null : contact?.id ?? null;
      if (!saved && contactId && key) {
        const column = campaignId ? "campaignId" : "sequenceStepId";
        // A native send of the same step does not occupy the historical one (they differ in `source`).
        if (occupied.has(key) || db.query(`SELECT 1 FROM sends WHERE accountId = ? AND ${column} = ? AND contactId = ? AND kind = ?
          AND source = 'klaviyo'`).get(accountId, target, contactId, message.kind)) {
          skipped.duplicateSend++;
          skipped.duplicateSendEvents += items.length;
          continue;
        }
        occupied.add(key);
      }
      if (!saved) {
        if (write) db.query(`INSERT INTO sends (id, accountId, kind, campaignId, sequenceId, sequenceStepId, contactId, recipients,
          subject, status, source, queuedAt, sentAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', 'klaviyo', ?, ?)`)
          .run(id, accountId, message.kind, campaignId, seqId, stepId, contactId, contact?.email ?? "", message.subject, anchor.at, anchor.at);
        result.sends.inserted++;
      } else if (saved.contactId && !contactId) {
        const priorEvents = rows<{ id: number; url: string | null }>(db, "SELECT id, url FROM tracking_events WHERE accountId = ? AND sendId = ?")
          .all(accountId, id);
        if (write) {
          db.query("UPDATE sends SET contactId = NULL, recipients = '' WHERE accountId = ? AND id = ?").run(accountId, id);
          for (const event of priorEvents) {
            db.query(`UPDATE tracking_events SET contactId = NULL, ip = NULL, ipTruncated = 0, userAgent = NULL, url = ?
              WHERE accountId = ? AND id = ?`).run(clickUrl(event.url, true), accountId, event.id);
          }
        }
        result.sends.updated++;
        result.events.anonymized += priorEvents.length;
      } else result.sends.unchanged++;
      totals.sends++;
      if (!contactId) { result.sends.anonymous++; totals.anonymousSends++; }

      let hasUnsubscribe = Boolean(saved && db.query("SELECT 1 FROM tracking_events WHERE accountId = ? AND sendId = ? AND type = 'unsubscribe'")
        .get(accountId, id));
      let opened = false;
      let humanOpened = false;
      let humanClicked = false;
      result.collapsedDeliveries += Math.max(0, items.filter(event => event.type === "delivered").length - 1);
      for (const event of items) {
        const existing = seenEvent.get(accountId, event.id);
        if (existing && existing.sendId !== id) { skipped.duplicateEvent++; continue; }
        if (event.type === "unsubscribe" && !existing && hasUnsubscribe) { skipped.duplicateUnsubscribe++; continue; }
        if (event.type === "unsubscribe") hasUnsubscribe = true;
        const { at, type, machine, properties } = event;
        if (existing) result.events.unchanged++;
        else {
          const ip = contactId ? normalizeTrackingIp(stringField(properties._ip)) ?? normalizeTrackingIp(stringField(properties.ip_address)) : null;
          const truncate = ip !== null && at <= ipCutoff;
          const clientType = stringField(properties["Client Type"]).trim().toLowerCase();
          if (write) db.query(`INSERT INTO tracking_events (accountId, sendId, contactId, type, at, ip, ipTruncated, clientName,
            clientOs, clientType, machine, url, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(accountId, id, contactId, type, at, truncate ? truncateTrackingIp(ip) : ip, +truncate,
              stringField(properties["Client Name"]) || null, stringField(properties["Client OS"]) || null,
              clientType ? clientTypes.get(clientType) ?? "unknown" : null, +machine,
              type === "click" ? clickUrl(properties.URL, !contactId) : null,
              JSON.stringify({ source: "klaviyo", klaviyoEventId: event.id }));
          result.events.inserted++;
        }
        totals[type]++;
        if (type === "open") {
          opened = true;
          if (!machine) { totals.humanOpens++; humanOpened = true; }
        }
        if (type === "click" && !machine) { totals.humanClicks++; humanClicked = true; }
        if (!contactId) { result.events.anonymous++; totals.anonymousEvents++; }
      }
      totals.openedRecipients += +opened;
      totals.humanOpenedRecipients += +humanOpened;
      totals.humanClickedRecipients += +humanClicked;
    }
    return result;
  };
  const transaction = db.transaction(apply);
  return write ? transaction.immediate() : transaction.deferred();
}

/** Shown to the operator as is: says what to do, carries no row data. */
export class HistoryImportError extends Error {}

/**
 * The importer never migrates the addon database. A server of an older release that still has the
 * file open would break on the newer schema (its scheduler statements stop matching), so the file
 * must already be at this build's schema: deploy and start the matching server first.
 */
export function assertCurrentHistorySchema(file: string) {
  if (!existsSync(file)) throw new HistoryImportError(`No outreach database at ${file}. Start the server with the addon enabled first.`);
  const db = new Database(file, { readonly: true });
  try {
    const version = Number((db.query("PRAGMA user_version").get() as { user_version?: number } | null)?.user_version ?? 0);
    if (version !== OUTREACH_SCHEMA_VERSION) {
      throw new HistoryImportError(`The outreach database has schema version ${version}; this importer needs ${OUTREACH_SCHEMA_VERSION}. `
        + "Deploy and start the server release that carries that schema first, back up outreach.db, then import. Nothing was changed.");
    }
  } finally {
    db.close();
  }
}

/** Accepts the archive folder itself or the `raw` folder inside it. */
export function historyArchiveDir(dir: string) {
  return !existsSync(join(dir, "events.json")) && existsSync(join(dir, "raw", "events.json")) ? join(dir, "raw") : dir;
}

async function main() {
  const { values } = parseArgs({ options: {
    account: { type: "string" }, archive: { type: "string" }, write: { type: "boolean" }
  } });
  const accountId = validated(itemId, values.account);
  if (!values.archive?.trim()) throw new Error("Missing archive directory");
  const archive = readKlaviyoHistoryArchive(historyArchiveDir(values.archive));
  const file = getOutreachDbPath();
  if (values.write) assertCurrentHistorySchema(file);
  const db = values.write ? await getOutreachDb()
    : existsSync(file) ? new Database(file, { readonly: true }) : initOutreachSchema(new Database(":memory:"));
  try {
    console.info(JSON.stringify(importKlaviyoHistory(db, { accountId, archive, write: values.write }), null, 2));
  } finally {
    if (values.write) closeOutreachDb();
    else db.close();
  }
}

if (import.meta.main) {
  try { await main(); }
  catch (error) {
    console.error(error instanceof HistoryImportError ? error.message
      : "Could not import Klaviyo history. Check the account, archive, and outreach database.");
    process.exitCode = 1;
  }
}
