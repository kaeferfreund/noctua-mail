import { rows } from "./sql";
import type { Database } from "bun:sqlite";

/** System jobs enumerate mailbox ids first, then scope all message and contact work to one id. */
export function outreachAccounts(db: Database, enabledOnly = true) {
  return rows<{ accountId: string }>(db, `SELECT accountId FROM account_settings
    WHERE accountId <> '' AND (enabled = 1 OR ? = 0)`).all(+enabledOnly).map(row => row.accountId);
}
