/**
 * Where a campaign was scheduled or a sequence's status was last changed (`campaigns.scheduledVia`,
 * `sequences.statusChangedVia`): `"app"` or `"mcp:<label> (…<suffix>)"` with the MCP token's label
 * and suffix as they were at that moment, so it stays readable after the token is deleted.
 * Pure and client-safe: the UI parses what the server wrote.
 */

export const OUTREACH_VIA_APP = "app";
export const OUTREACH_VIA_KLAVIYO = "import:klaviyo";
const MAX_LABEL = 80;
const MAX_SUFFIX = 12;

export type OutreachVia = { kind: "app" } | { kind: "mcp"; label: string; suffix: string } | { kind: "import"; source: "klaviyo" };

function clean(value: string, max: number) {
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, " ").trim()).slice(0, max).join("");
}

/** The stored value for work done through an MCP token; capped, so the column stays short. */
export function outreachViaMcp(label: string, suffix: string) {
  return `mcp:${clean(label, MAX_LABEL)} (…${clean(suffix, MAX_SUFFIX).replace(/[()]/g, "")})`;
}

/** Null for rows from before the trace existed, and for anything not written by this module. */
export function parseOutreachVia(value: string | null | undefined): OutreachVia | null {
  if (value === OUTREACH_VIA_APP) return { kind: "app" };
  if (value === OUTREACH_VIA_KLAVIYO) return { kind: "import", source: "klaviyo" };
  const match = value ? /^mcp:([\s\S]*) \(…([^()]*)\)$/.exec(value) : null;
  return match ? { kind: "mcp", label: match[1], suffix: match[2] } : null;
}
