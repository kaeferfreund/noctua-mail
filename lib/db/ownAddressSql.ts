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
