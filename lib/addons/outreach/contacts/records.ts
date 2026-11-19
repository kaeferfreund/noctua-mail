import type { Database } from "bun:sqlite";
import { getOutreachDb } from "../db";
import { newOutreachId } from "../ids";
import { getSendStats, listSendSummaries } from "../tracking";
import type { Contact, ContactDetail, ContactInput, ContactList, ContactListInput, ContactListMembership, ContactListResponse } from "../types";
import { ContactError, type contactFilters } from "./input";
import type { z } from "zod";

export type ContactRow = Omit<Contact, "properties"> & { emailLower: string; properties: string; externalId: string | null };
export type ListRow = Omit<ContactList, "memberCount"> & { externalId: string | null };
export type ContactFilters = z.output<typeof contactFilters>;

export function contactFromRow({ emailLower, externalId, properties, ...contact }: ContactRow): Contact {
  void emailLower; void externalId;
  return { ...contact, properties: JSON.parse(properties) };
}

export function findContact(db: Database, accountId: string, contactId: string): ContactRow | null {
  return db.query("SELECT * FROM contacts WHERE accountId = ? AND id = ?").get(accountId, contactId) as ContactRow | null;
}

export function findContactByEmail(db: Database, accountId: string, email: string): ContactRow | null {
  return db.query("SELECT * FROM contacts WHERE accountId = ? AND emailLower = ?")
    .get(accountId, email.toLowerCase()) as ContactRow | null;
}

export function requireContact(db: Database, accountId: string, contactId: string): ContactRow {
  const row = findContact(db, accountId, contactId);
  if (!row) throw new ContactError("Contact not found", 404);
  return row;
}

export function requireList(db: Database, accountId: string, listId: string): ListRow {
  const row = db.query("SELECT * FROM lists WHERE accountId = ? AND id = ? AND archivedAt IS NULL")
    .get(accountId, listId) as ListRow | null;
  if (!row) throw new ContactError("List not found", 404);
  return row;
}

export function insertContact(db: Database, accountId: string, input: ContactInput, source: string, now: number): ContactRow {
  const email = input.email.toLowerCase();
  return db.query(
    `INSERT INTO contacts (id, accountId, email, emailLower, firstName, lastName, properties, source, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  ).get(newOutreachId("con"), accountId, email, email, input.firstName ?? "", input.lastName ?? "",
    JSON.stringify(input.properties ?? {}), source, now, now) as ContactRow;
}

export function updateContactFields(db: Database, row: ContactRow, input: Partial<ContactInput>, now: number): ContactRow {
  const email = input.email?.toLowerCase() ?? row.email;
  const firstName = input.firstName ?? row.firstName;
  const lastName = input.lastName ?? row.lastName;
  const properties = input.properties === undefined ? row.properties : JSON.stringify(input.properties);
  if (email === row.email && firstName === row.firstName && lastName === row.lastName && properties === row.properties) return row;
  return db.query(
    `UPDATE contacts SET email = ?, emailLower = ?, firstName = ?, lastName = ?, properties = ?, updatedAt = ?
     WHERE accountId = ? AND id = ? RETURNING *`
  ).get(email, email.toLowerCase(), firstName, lastName, properties, now, row.accountId, row.id) as ContactRow;
}

export async function upsertContact(accountId: string, input: ContactInput, now = Date.now()) {
  const db = await getOutreachDb();
  return db.transaction(() => {
    const existing = findContactByEmail(db, accountId, input.email);
    const row = existing
      ? updateContactFields(db, existing, input, now)
      : insertContact(db, accountId, input, "manual", now);
    return { contact: contactFromRow(row), created: !existing };
  }).immediate();
}

/** Consent, suppression and send history belong to the address that earned them. */
export function canChangeContactAddress(db: Database, row: ContactRow): boolean {
  if (row.emailConsent !== "never" || row.suppressedReason) return false;
  return !db.query(`SELECT 1 FROM list_members WHERE accountId = ?1 AND contactId = ?2
    UNION ALL SELECT 1 FROM sends WHERE accountId = ?1 AND contactId = ?2 LIMIT 1`).get(row.accountId, row.id);
}

export async function patchContact(accountId: string, contactId: string, patch: Partial<ContactInput>, now = Date.now()) {
  const db = await getOutreachDb();
  db.transaction(() => {
    const row = requireContact(db, accountId, contactId);
    if (patch.email && patch.email.toLowerCase() !== row.emailLower) {
      if (findContactByEmail(db, accountId, patch.email)) throw new ContactError("Email already exists", 409, "email_in_use");
      if (!canChangeContactAddress(db, row)) {
        throw new ContactError("Create a separate contact for the new address", 409, "email_change_conflict");
      }
    }
    updateContactFields(db, row, patch, now);
  }).immediate();
  return getContactDetail(accountId, contactId);
}

export async function searchContacts(accountId: string, filters: ContactFilters): Promise<ContactListResponse> {
  const db = await getOutreachDb();
  const conditions = ["c.accountId = ?"];
  const params = [accountId];
  const { q, listId, consent, suppressed, page, pageSize } = filters;
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(`(c.emailLower LIKE ? ESCAPE '\\' OR trim(c.firstName || ' ' || c.lastName) LIKE ? ESCAPE '\\')`);
    params.push(pattern.toLowerCase(), pattern);
  }
  if (listId) {
    conditions.push(`EXISTS (SELECT 1 FROM list_members m WHERE m.accountId = c.accountId AND m.contactId = c.id
      AND m.listId = ? AND m.status = 'subscribed')`);
    params.push(listId);
  }
  if (consent) {
    conditions.push("c.emailConsent = ?");
    params.push(consent);
  }
  if (suppressed !== undefined) conditions.push(suppressed ? "c.suppressedReason IS NOT NULL" : "c.suppressedReason IS NULL");
  const from = `FROM contacts c WHERE ${conditions.join(" AND ")}`;
  return db.transaction(() => {
    const { total } = db.query(`SELECT count(*) AS total ${from}`).get(...params) as { total: number };
    const rows = db.query(`SELECT c.* ${from} ORDER BY c.emailLower, c.id LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize) as ContactRow[];
    return { ok: true as const, contacts: rows.map(contactFromRow), total, page, pageSize };
  })();
}

export async function getContactDetail(accountId: string, contactId: string): Promise<ContactDetail> {
  const db = await getOutreachDb();
  const contact = contactFromRow(requireContact(db, accountId, contactId));
  const lists = db.query(`
    SELECT m.listId, l.name AS listName, m.status, m.subscribedAt, m.unsubscribedAt FROM list_members m
    JOIN lists l ON l.accountId = m.accountId AND l.id = m.listId
    WHERE m.accountId = ? AND m.contactId = ? AND l.archivedAt IS NULL ORDER BY l.name COLLATE NOCASE, l.id
  `).all(accountId, contactId) as ContactListMembership[];
  const [stats, { items: lastSends }] = await Promise.all([
    getSendStats(accountId, { contactId }),
    listSendSummaries(accountId, { contactId }, { limit: 20 })
  ]);
  return { ...contact, lists, stats, lastSends };
}

const listSelect = `SELECT l.*, (SELECT count(*) FROM list_members m
  WHERE m.accountId = l.accountId AND m.listId = l.id AND m.status = 'subscribed') AS memberCount FROM lists l`;

function listFromRow({ externalId, ...list }: ListRow & { memberCount: number }): ContactList {
  void externalId;
  return list;
}

export async function listContactLists(accountId: string): Promise<ContactList[]> {
  const db = await getOutreachDb();
  const rows = db.query(`${listSelect}
    WHERE l.accountId = ? AND l.archivedAt IS NULL ORDER BY l.name COLLATE NOCASE, l.id`).all(accountId) as Array<ListRow & { memberCount: number }>;
  return rows.map(listFromRow);
}

function getList(db: Database, accountId: string, listId: string): ContactList {
  return listFromRow(db.query(
    `${listSelect} WHERE l.accountId = ? AND l.id = ?`).get(accountId, listId) as ListRow & { memberCount: number });
}

export async function createContactList(accountId: string, input: ContactListInput, now = Date.now()) {
  const db = await getOutreachDb();
  const listId = newOutreachId("lst");
  return db.transaction(() => {
    db.query(`INSERT INTO lists (id, accountId, name, description, optIn, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(listId, accountId, input.name, input.description ?? "", input.optIn ?? "single", now, now);
    return getList(db, accountId, listId);
  }).immediate();
}

export async function updateContactList(accountId: string, listId: string, patch: Partial<ContactListInput>, now = Date.now()) {
  const db = await getOutreachDb();
  return db.transaction(() => {
    const row = requireList(db, accountId, listId);
    db.query("UPDATE lists SET name = ?, description = ?, optIn = ?, updatedAt = ? WHERE accountId = ? AND id = ?")
      .run(patch.name ?? row.name, patch.description ?? row.description, patch.optIn ?? row.optIn, now, accountId, listId);
    return getList(db, accountId, listId);
  }).immediate();
}

export async function archiveContactList(accountId: string, listId: string, now = Date.now()) {
  const db = await getOutreachDb();
  return db.transaction(() => {
    const updated = db.query(`UPDATE lists SET archivedAt = coalesce(archivedAt, ?1), updatedAt = coalesce(archivedAt, ?1)
      WHERE accountId = ?2 AND id = ?3`).run(now, accountId, listId);
    if (!updated.changes) throw new ContactError("List not found", 404);
    return getList(db, accountId, listId);
  }).immediate();
}
