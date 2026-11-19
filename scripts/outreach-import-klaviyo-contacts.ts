import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { getOutreachDb, getOutreachDbPath, initOutreachSchema } from "@/lib/addons/outreach/db";
import { newOutreachId } from "@/lib/addons/outreach/ids";
import { getMembership, notifyContactUnmailable, shouldApplySuppression, subscriptionDecision, unsubscribeGlobally, writeMembership } from "@/lib/addons/outreach/contacts/consent";
import { emailSchema, listInput, propertiesSchema } from "@/lib/addons/outreach/contacts/input";
import { canChangeContactAddress, findContactByEmail, insertContact, updateContactFields, type ContactRow, type ListRow } from "@/lib/addons/outreach/contacts/records";
import type { ContactInput, EmailConsent, ListMemberStatus, OptInMode, SuppressionReason } from "@/lib/addons/outreach/types";

type FileOptions = { accountId: string; lists: string; profiles: string; members: string; write?: boolean };
type ImportCounts = { created: number; updated: number; unchanged: number; skipped: Record<string, number> };
type ImportSummary = { mode: "write" | "dry-run"; lists: ImportCounts; profiles: ImportCounts; memberships: ImportCounts };
type JsonObject = Record<string, unknown>;

function counts(): ImportCounts {
  return { created: 0, updated: 0, unchanged: 0, skipped: {} };
}

function skip(result: ImportCounts, reason: string) {
  result.skipped[reason] = (result.skipped[reason] ?? 0) + 1;
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function externalId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
}

function readExport(file: string, kind: string): Promise<unknown[]>;
function readExport(file: string, kind: string, optional: true): Promise<unknown[] | null>;
async function readExport(file: string, kind: string, optional = false): Promise<unknown[] | null> {
  try {
    const doc = object(JSON.parse(await readFile(file, "utf8")));
    if (Array.isArray(doc.data)) return doc.data;
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === "ENOENT") return null;
  }
  throw new Error(`Invalid or unreadable ${kind} export`);
}

function timestamp(value: unknown, now: number): number | null {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= now ? parsed : null;
}

function profileFields(email: string, attributes: JsonObject): ContactInput {
  const fields: ContactInput = { email };
  if (typeof attributes.first_name === "string") fields.firstName = attributes.first_name.trim().slice(0, 200);
  if (typeof attributes.last_name === "string") fields.lastName = attributes.last_name.trim().slice(0, 200);
  if (attributes.properties != null) {
    fields.properties = {};
    for (const [key, value] of Object.entries(object(attributes.properties))) {
      if (Object.keys(fields.properties).length >= 50) break;
      const property = propertiesSchema.safeParse({ [key]: value });
      if (property.success) Object.assign(fields.properties, property.data);
    }
  }
  return fields;
}

function importSuppression(marketing: JsonObject, consent: EmailConsent, now: number) {
  const suppressions = (Array.isArray(marketing.suppression) ? marketing.suppression : []).map(value => {
    const entry = object(value);
    const raw = typeof entry.reason === "string" ? entry.reason.toLowerCase() : "";
    const reason: SuppressionReason = /spam|complaint/.test(raw) ? "complaint" : /bounce/.test(raw) ? "hard_bounce" : "manual";
    return { reason, at: timestamp(entry.timestamp, now) };
  });
  const order: SuppressionReason[] = ["complaint", "hard_bounce", "manual"];
  for (const reason of order) {
    const match = suppressions.filter(entry => entry.reason === reason).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
    if (match) return match;
  }
  if (marketing.can_receive_email_marketing === false && consent === "subscribed") {
    return { reason: "manual" as const, at: null };
  }
  return null;
}

function importProfile(db: Database, accountId: string, item: unknown, now: number, summary: ImportCounts) {
  const id = externalId(object(item).id);
  const attributes = object(object(item).attributes);
  const address = emailSchema.safeParse(attributes.email);
  if (!id || !address.success) {
    skip(summary, !id ? "invalid_id" : "invalid_email");
    return null;
  }
  const byId = db.query("SELECT * FROM contacts WHERE accountId = ? AND externalId = ?").get(accountId, id) as ContactRow | null;
  const byEmail = findContactByEmail(db, accountId, address.data);
  if ((byId && byEmail && byId.id !== byEmail.id) || (byEmail?.externalId && byEmail.externalId !== id) ||
      (byId && byId.emailLower !== address.data && !canChangeContactAddress(db, byId))) {
    skip(summary, "identity_conflict");
    return null;
  }

  const input = profileFields(address.data, attributes);
  const existing = byId ?? byEmail;
  let row = existing ? updateContactFields(db, existing, input, now)
    : insertContact(db, accountId, input, "klaviyo", timestamp(attributes.created, now) ?? now);
  const fieldsChanged = existing !== row;
  const marketing = object(object(object(attributes.subscriptions).email).marketing);
  const consent: EmailConsent = marketing.consent === "SUBSCRIBED" ? "subscribed"
    : marketing.consent === "UNSUBSCRIBED" ? "unsubscribed" : "never";
  const consentAt = timestamp(marketing.consent_timestamp, now);
  const newerConsent = consentAt !== null && (row.consentAt === null || consentAt > row.consentAt);
  const suppression = importSuppression(marketing, consent, now);
  const applySuppression = suppression && shouldApplySuppression(row, suppression.reason);
  // Existing unsubscribes win ties and take precedence over a timestamp-free export.
  const canSubscribe = (row.emailConsent === "never" || newerConsent) && consent === "subscribed"
    && subscriptionDecision(row, null, consentAt ?? now, consentAt !== null) === "subscribe";
  // An explicit unsubscribe applies unless the stored consent is provably later; without a
  // timestamp the import time is recorded.
  const canUnsubscribe = consent === "unsubscribed" && row.emailConsent !== "unsubscribed"
    && (consentAt === null || row.consentAt === null || consentAt >= row.consentAt);
  if (canUnsubscribe) unsubscribeGlobally(db, row, consentAt ?? now, "klaviyo");
  if (row.externalId !== id || canSubscribe || canUnsubscribe || applySuppression) {
    row = db.query(`UPDATE contacts SET externalId = ?,
      emailConsent = ?, consentAt = ?, consentSource = ?, suppressedReason = ?, suppressedAt = ?, updatedAt = ?
      WHERE accountId = ? AND id = ? RETURNING *`).get(id,
      canSubscribe || canUnsubscribe ? consent : row.emailConsent,
      canSubscribe ? consentAt : canUnsubscribe ? consentAt ?? now : row.consentAt,
      canSubscribe || canUnsubscribe ? "klaviyo" : row.consentSource,
      applySuppression ? suppression.reason : row.suppressedReason, applySuppression ? suppression.at ?? now : row.suppressedAt,
      now, accountId, row.id) as ContactRow;
    summary[existing ? "updated" : "created"]++;
  } else {
    summary[fieldsChanged ? "updated" : "unchanged"]++;
  }
  return { contact: row, becameUnmailable: canUnsubscribe || Boolean(applySuppression) };
}

function importList(db: Database, accountId: string, id: string, attributes: JsonObject, now: number, summary: ImportCounts) {
  const rawMode = typeof attributes.opt_in_process === "string" ? attributes.opt_in_process.toLowerCase() : "";
  const optIn: OptInMode | undefined = /^double(?:_opt_in)?$/.test(rawMode) ? "double"
    : /^single(?:_opt_in)?$/.test(rawMode) ? "single" : undefined;
  const parsed = listInput.safeParse({ name: attributes.name, optIn });
  if (!parsed.success) {
    skip(summary, "invalid_name");
    return null;
  }
  const existing = db.query("SELECT * FROM lists WHERE accountId = ? AND externalId = ?").get(accountId, id) as ListRow | null;
  const name = parsed.data.name;
  if (existing) {
    const nextOptIn = optIn ?? existing.optIn;
    if (name === existing.name && nextOptIn === existing.optIn) {
      summary.unchanged++;
    } else {
      db.query("UPDATE lists SET name = ?, optIn = ?, updatedAt = ? WHERE accountId = ? AND id = ?")
        .run(name, nextOptIn, now, accountId, existing.id);
      summary.updated++;
    }
    return existing.id;
  }
  const listId = newOutreachId("lst");
  db.query("INSERT INTO lists (id, accountId, externalId, name, optIn, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(listId, accountId, id, name, optIn ?? "single", now, now);
  summary.created++;
  return listId;
}

function importMember(db: Database, accountId: string, listId: string, contact: ContactRow, entry: JsonObject, now: number, summary: ImportCounts) {
  const old = getMembership(db, accountId, contact.id, listId);
  // List presence proves neither consent nor a reversal of an explicit list opt-out.
  const status: ListMemberStatus = contact.emailConsent === "never" ? "pending" : contact.emailConsent;
  if (old?.status === status || old?.status === "unsubscribed" || (old?.status === "subscribed" && status === "pending")) {
    summary.unchanged++;
    return;
  }
  const joinedAt = timestamp(object(entry.attributes).joined_group_at, now);
  // A join that is not provably later than an unsubscribe on record (global or of this list) is
  // no consent for this list. Suppression is enforced at send time, as for the other lists.
  if (status === "subscribed" && subscriptionDecision(contact, old, joinedAt ?? now, joinedAt !== null) === "new_consent_required") {
    skip(summary, "unsubscribed_after_join");
    return;
  }
  writeMembership(db, accountId, contact.id, listId, {
    status,
    subscribedAt: status === "subscribed" ? joinedAt ?? contact.consentAt : old?.subscribedAt ?? null,
    unsubscribedAt: status === "unsubscribed" ? contact.consentAt ?? now : null
  }, "klaviyo");
  summary[old ? "updated" : "created"]++;
}

/** Copy just the target mailbox's import data into memory so a dry run can execute the same writes. */
function dryRunDatabase(accountId: string) {
  const preview = initOutreachSchema(new Database(":memory:"));
  const file = getOutreachDbPath();
  if (!existsSync(file)) return preview;
  const source = new Database(file, { readonly: true });
  try {
    source.transaction(() => {
      for (const table of ["contacts", "lists", "list_members", "erased_addresses", "sends"] as const) {
        // Sends are only used to reject unsafe address changes. Copy their keys, not message data.
        if (table === "sends") {
          const insert = preview.query("INSERT INTO sends (id, accountId, contactId, kind, status, queuedAt) VALUES (?, ?, ?, 'mail', 'sent', 0)");
          const rows = source.query("SELECT id, accountId, contactId FROM sends WHERE accountId = ? AND contactId IS NOT NULL")
            .all(accountId) as Array<{ id: string; accountId: string; contactId: string }>;
          for (const row of rows) insert.run(row.id, row.accountId, row.contactId);
          continue;
        }
        const rows = source.query(`SELECT * FROM ${table} WHERE accountId = ?`).all(accountId) as Array<Record<string, string | number | null>>;
        if (!rows.length) continue;
        const columns = Object.keys(rows[0]);
        const insert = preview.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`);
        for (const row of rows) insert.run(...columns.map(column => row[column]));
      }
    })();
    return preview;
  } catch (error) {
    preview.close();
    throw error;
  } finally {
    source.close();
  }
}

export async function importKlaviyoContacts(options: FileOptions, now = Date.now()): Promise<ImportSummary> {
  const { accountId } = options;
  const [lists, profiles] = await Promise.all([readExport(options.lists, "lists"), readExport(options.profiles, "profiles")]);
  const summary: ImportSummary = { mode: options.write ? "write" : "dry-run", lists: counts(), profiles: counts(), memberships: counts() };
  const membershipExports = new Map<string, unknown[] | null>();
  for (const item of lists) {
    const id = externalId(object(item).id);
    if (id && !membershipExports.has(id)) {
      membershipExports.set(id, await readExport(join(options.members, `${id}.json`), "list membership", true));
    }
  }

  const db = options.write ? await getOutreachDb() : dryRunDatabase(accountId);
  try {
    const unmailableContacts = new Set<string>();
    db.transaction(() => {
      const contacts = new Map<string, ContactRow>();
      const seenLists = new Set<string>();
      for (const item of profiles) {
        const imported = importProfile(db, accountId, item, now, summary.profiles);
        if (!imported?.contact.externalId) continue;
        contacts.set(imported.contact.externalId, imported.contact);
        if (imported.becameUnmailable) unmailableContacts.add(imported.contact.id);
      }
      for (const item of lists) {
        const id = externalId(object(item).id);
        if (!id || seenLists.has(id)) {
          skip(summary.lists, id ? "duplicate_id" : "invalid_id");
          continue;
        }
        seenLists.add(id);
        const listId = importList(db, accountId, id, object(object(item).attributes), now, summary.lists);
        if (!listId) continue;
        const members = membershipExports.get(id);
        if (!members) {
          skip(summary.memberships, "missing_member_file");
          continue;
        }
        for (const member of members) {
          const entry = object(member);
          const id = externalId(entry.id);
          const contact = id ? contacts.get(id) : undefined;
          if (contact) importMember(db, accountId, listId, contact, entry, now, summary.memberships);
          else skip(summary.memberships, id ? "profile_not_imported" : "invalid_id");
        }
      }
    }).immediate();
    if (options.write) {
      for (const contactId of unmailableContacts) await notifyContactUnmailable(accountId, contactId);
    }
    return summary;
  } finally {
    if (!options.write) db.close();
  }
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({ options: {
      account: { type: "string" }, lists: { type: "string" }, profiles: { type: "string" }, members: { type: "string" }, write: { type: "boolean" }
    } });
    const { account, lists, profiles, members, write } = values;
    if (!account?.trim() || !lists || !profiles || !members) throw new Error("Missing arguments");
    console.log(JSON.stringify(await importKlaviyoContacts({ accountId: account.trim(), lists, profiles, members, write }), null, 2));
  } catch {
    console.error("Import failed. Check the JSON exports and database access.");
    console.error("Usage: bun scripts/outreach-import-klaviyo-contacts.ts --account <id> --lists <file> --profiles <file> --members <directory> [--write]");
    process.exitCode = 1;
  }
}
