import type { Database } from "bun:sqlite";
import { getOutreachDb, outreachDbExists } from "./db";
import { rememberErasedAddress, type ContactRow } from "./contacts/records";

/** Only the hashed suppression of erased addresses outlives the mailbox. */
const KEPT_TABLES = new Set(["erased_addresses"]);

/** Every addon table that holds a mailbox's rows and ends with the mailbox. */
export function outreachAccountTables(db: Database) {
  return (db.query(`SELECT m.name FROM pragma_table_list m
    WHERE m.schema = 'main' AND m.type = 'table' AND EXISTS
      (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'accountId')
    ORDER BY m.name`).all() as Array<{ name: string }>).map(row => row.name).filter(name => !KEPT_TABLES.has(name));
}

/**
 * Removes every addon row of a deleted mailbox: settings, contacts, lists, API tokens,
 * templates, campaigns, sequences, sends, tracking and image metadata. A mailbox created
 * later for the same address gets the same id and must not inherit any of it. Each contact
 * is erased as `eraseContact` does, so its hashed suppression stays. Image bytes stay:
 * they are shared by hash and referenced by mails already sent.
 */
export async function purgeOutreachAccount(accountId: string, now = Date.now()) {
  if (!outreachDbExists()) return;
  const db = await getOutreachDb();
  const tables = outreachAccountTables(db);
  db.transaction(() => {
    const contacts = db.query("SELECT * FROM contacts WHERE accountId = ?").all(accountId) as ContactRow[];
    for (const contact of contacts) rememberErasedAddress(db, contact, now);
    for (const table of tables) db.query(`DELETE FROM "${table.replaceAll('"', '""')}" WHERE accountId = ?`).run(accountId);
  }).immediate();
}
