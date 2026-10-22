import { isOwnAddress } from "../ownAddresses";

/** Exact RFC mailbox membership, including IDNA, without inspecting display text. */
export function registerOwnAddressSql(db: any) {
  db.function("mailbox_address_in", { deterministic: true }, (value: string | null, addresses: string) =>
    isOwnAddress(value, JSON.parse(addresses)) ? 1 : 0);
}

/** Exact whole-address fallback for legacy rows with NULL fromEmail. */
export function messageAuthorEmailSql(alias = "") {
  if (alias && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias)) throw new Error("Invalid SQL alias");
  const prefix = alias ? `${alias}.` : "";
  const raw = `${prefix}fromAddr`;
  return `lower(trim(COALESCE(NULLIF(${prefix}fromEmail, ''), CASE
    WHEN instr(${raw}, '<') > 0 AND instr(${raw}, '>') > instr(${raw}, '<')
    THEN substr(${raw}, instr(${raw}, '<') + 1, instr(${raw}, '>') - instr(${raw}, '<') - 1)
    ELSE ${raw} END)))`;
}
