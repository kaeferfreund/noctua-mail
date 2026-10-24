import { promises as fs } from "fs";
import path from "path";
import { getDataDir } from "@/lib/runtimePaths";
import { senderAuthPassed } from "./allowlist";
import type { SpamInput } from "./types";

/**
 * Static rules derived from the existing mail (briefs/spam/static-rules.json,
 * copied to the data dir on deploy; semantics in static-rules-report.md §4).
 * - allow `address`/`domain` short-circuit to ham; with `requireAuth` only when
 *   SPF or DKIM passed for the sender's domain, otherwise they do nothing,
 * - allow `name` entries never allow; they feed the weak "known display name
 *   from an unknown address" hint,
 * - deny rules short-circuit to spam only when `safe: true`,
 * - everything else (hints, `builtin:*` features) goes to the model as a hint.
 * Unknown fields and unknown `builtin:*` values are ignored; a missing or
 * unreadable file means "no static rules".
 */
export type StaticRuleType = "address" | "domain" | "name" | "subjectPattern" | "namePattern" | "header";
export type StaticRule = {
  type: StaticRuleType;
  value: string;
  safe?: boolean;
  note?: string;
  spamHits?: number;
  hamHits?: number;
  requireAuth?: boolean;
  /** For `name` allow entries: the addresses this display name was seen with. */
  addresses?: string[];
};
export type StaticRules = { allow: StaticRule[]; deny: StaticRule[]; hints: StaticRule[] };
export type StaticRuleResult = { decision: "allow" | "deny" | null; rule?: StaticRule; hints: string[] };

export const EMPTY_STATIC_RULES: StaticRules = { allow: [], deny: [], hints: [] };
const RULE_TYPES = new Set<StaticRuleType>(["address", "domain", "name", "subjectPattern", "namePattern", "header"]);
const BUILTIN = "builtin:";
const MAX_HINTS = 8;

export function staticRulesPath(env: Record<string, string | undefined> = process.env) {
  return env.NOCTUA_SPAM_RULES_FILE?.trim() || path.join(getDataDir(), "spam-static-rules.json");
}

const lower = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

function parseRuleList(value: unknown): StaticRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const rule = entry as Record<string, unknown>;
    if (!RULE_TYPES.has(rule.type as StaticRuleType) || typeof rule.value !== "string" || !rule.value.trim()) return [];
    return [{
      type: rule.type as StaticRuleType,
      value: rule.value.trim(),
      safe: rule.safe === true,
      note: typeof rule.note === "string" && rule.note ? rule.note : undefined,
      spamHits: count(rule.spamHits),
      hamHits: count(rule.hamHits),
      requireAuth: rule.requireAuth === true,
      addresses: Array.isArray(rule.addresses) ? rule.addresses.filter((item): item is string => typeof item === "string").map(lower) : undefined
    }];
  });
}

export function parseStaticRules(json: unknown): StaticRules {
  if (!json || typeof json !== "object") return EMPTY_STATIC_RULES;
  const data = json as Record<string, unknown>;
  return { allow: parseRuleList(data.allow), deny: parseRuleList(data.deny), hints: parseRuleList(data.hints) };
}

let cached: { filePath: string; version: string; rules: StaticRules } | null = null;

export async function loadStaticRules(filePath = staticRulesPath()): Promise<StaticRules> {
  let version: string;
  try {
    // A runtime path in the data dir, not a build input: keep it out of output tracing.
    const stat = await fs.stat(/* turbopackIgnore: true */ filePath);
    version = `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return EMPTY_STATIC_RULES;
  }
  if (cached?.filePath === filePath && cached.version === version) return cached.rules;
  let rules = EMPTY_STATIC_RULES;
  try {
    rules = parseStaticRules(JSON.parse(await fs.readFile(/* turbopackIgnore: true */ filePath, "utf8")));
  } catch (error) {
    console.warn("[spam] static rules file is not valid JSON; ignoring it", { filePath, error: String(error) });
  }
  cached = { filePath, version, rules };
  return rules;
}

const regexCache = new Map<string, RegExp | null>();
function compile(pattern: string): RegExp | null {
  if (!regexCache.has(pattern)) {
    let regex: RegExp | null = null;
    try { regex = new RegExp(pattern, "iu"); } catch { regex = null; }
    regexCache.set(pattern, regex);
  }
  return regexCache.get(pattern) ?? null;
}

/** Display name as the rules were derived: NFKC, wrapping quotes stripped, whitespace collapsed. */
export function normalizeDisplayName(name: string | null | undefined) {
  return (name ?? "").normalize("NFKC").trim().replace(/^["']+|["']+$/g, "").replace(/\s+/g, " ").trim();
}

function senderDomain(input: SpamInput) {
  const email = lower(input.fromEmail);
  return email.includes("@") ? email.slice(email.lastIndexOf("@") + 1) : "";
}

/** Rule values are literal (no root-domain folding): `co.uk`-style values stay as they are. */
const inDomain = (domain: string, value: string) => !!domain && (domain === value || domain.endsWith(`.${value}`));

function headerValues(input: SpamInput, name: string): string[] {
  const key = lower(name);
  if (key === "authentication-results") return input.authenticationResults;
  if (key === "list-id") return input.listId ? [input.listId] : [];
  if (key === "list-unsubscribe") return input.listUnsubscribe ? [input.listUnsubscribe] : [];
  if (key === "reply-to") return input.replyTo ? [input.replyTo] : [];
  return input.spamHeaders
    .filter((line) => lower(line.slice(0, line.indexOf(":"))) === key)
    .map((line) => line.slice(line.indexOf(":") + 1).trim());
}

/** Built-in features named in the rules file; unknown ones never match. */
function matchesBuiltin(rule: StaticRule, input: SpamInput, rules: StaticRules) {
  switch (rule.value) {
    case "builtin:tld-shop":
      return senderDomain(input).endsWith(".shop");
    case "builtin:known-name-unknown-address":
      return knownNameFromUnknownAddress(rules, input);
    default:
      return false;
  }
}

function knownNameFromUnknownAddress(rules: StaticRules, input: SpamInput) {
  const name = normalizeDisplayName(input.fromName).toLowerCase();
  const email = lower(input.fromEmail);
  if (!name || !email) return false;
  const domain = senderDomain(input);
  return rules.allow.some((rule) => rule.type === "name" && normalizeDisplayName(rule.value).toLowerCase() === name
    && !(rule.addresses ?? []).some((address) => address === email || inDomain(domain, address.slice(address.lastIndexOf("@") + 1))));
}

function matches(rule: StaticRule, input: SpamInput, rules: StaticRules): boolean {
  if (rule.value.startsWith(BUILTIN)) return matchesBuiltin(rule, input, rules);
  const value = lower(rule.value);
  switch (rule.type) {
    case "address":
      return !!input.fromEmail && lower(input.fromEmail) === value;
    case "domain":
      return inDomain(senderDomain(input), value);
    case "name":
      return false;
    case "subjectPattern":
      return compile(rule.value)?.test(input.subject.normalize("NFKC")) ?? false;
    case "namePattern": {
      const name = normalizeDisplayName(input.fromName);
      return !!name && (compile(rule.value)?.test(name) ?? false);
    }
    case "header": {
      const separator = rule.value.indexOf(": ");
      if (separator <= 0) return false;
      const regex = compile(rule.value.slice(separator + 2));
      return !!regex && headerValues(input, rule.value.slice(0, separator)).some((line) => regex.test(line));
    }
  }
}

function allows(rule: StaticRule, input: SpamInput, rules: StaticRules) {
  if (rule.type === "name" || !matches(rule, input, rules)) return false;
  // Authenticated for the trusted domain itself (a subdomain sender signed by it counts).
  return !rule.requireAuth || senderAuthPassed(input, rule.type === "domain" ? lower(rule.value) : senderDomain(input));
}

function describe(rule: StaticRule) {
  const spam = rule.spamHits ?? 0;
  const ham = rule.hamHits ?? 0;
  const counted = rule.spamHits !== undefined || rule.hamHits !== undefined;
  // Rules seen at least as often in good mail as in spam are weak signals.
  const label = counted && ham >= spam ? "Schwacher Hinweis" : "Hinweis";
  const what = rule.value.startsWith(BUILTIN) ? rule.note ?? rule.value : `${rule.type} „${rule.value}“${rule.note ? ` (${rule.note})` : ""}`;
  return `${label}: ${what}${counted ? ` – bisher ${spam}× Spam, ${ham}× kein Spam` : ""}`;
}

const SERVER_FLAG = "Starker Hinweis: der Mailserver (SpamAssassin) hat die Nachricht als Spam gekennzeichnet (X-Spam-Flag: YES)";

export function serverFlaggedSpam(input: Pick<SpamInput, "spamHeaders">) {
  return input.spamHeaders.some((line) => /^x-spam-flag:\s*yes\b/i.test(line));
}

export function applyStaticRules(rules: StaticRules, input: SpamInput): StaticRuleResult {
  const allow = rules.allow.find((rule) => allows(rule, input, rules));
  if (allow) return { decision: "allow", rule: allow, hints: [] };
  const hints: string[] = [];
  // The server's own verdict is a strong hint, never a decision on its own.
  if (serverFlaggedSpam(input)) hints.push(SERVER_FLAG);
  for (const rule of rules.deny) {
    if (!matches(rule, input, rules)) continue;
    if (rule.safe) return { decision: "deny", rule, hints };
    hints.push(describe(rule));
  }
  for (const rule of rules.hints) {
    if (matches(rule, input, rules)) hints.push(describe(rule));
  }
  return { decision: null, hints: hints.slice(0, MAX_HINTS) };
}
