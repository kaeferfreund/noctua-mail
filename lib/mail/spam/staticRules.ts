import { readFileSync, statSync } from "fs";
import path from "path";
import { getDataDir } from "@/lib/runtimePaths";
import type { SpamInput } from "./types";

/**
 * Static rules derived from the existing mail (briefs/spam/static-rules.json,
 * copied to the data dir on deploy). Allow rules short-circuit to ham, deny
 * rules short-circuit to spam only when `safe: true`; every other match is a
 * hint for the model. A missing or unreadable file means "no static rules".
 */
export type StaticRuleType = "address" | "domain" | "name" | "subjectPattern" | "namePattern" | "header";
export type StaticRule = {
  type: StaticRuleType;
  value: string;
  safe?: boolean;
  note?: string;
  spamHits?: number;
  hamHits?: number;
};
export type StaticRules = { allow: StaticRule[]; deny: StaticRule[]; hints: StaticRule[] };
export type StaticRuleResult = { decision: "allow" | "deny" | null; rule?: StaticRule; hints: string[] };

export const EMPTY_STATIC_RULES: StaticRules = { allow: [], deny: [], hints: [] };
const RULE_TYPES = new Set<StaticRuleType>(["address", "domain", "name", "subjectPattern", "namePattern", "header"]);
const MAX_HINTS = 8;

export function staticRulesPath(env: Record<string, string | undefined> = process.env) {
  return env.NOCTUA_SPAM_RULES_FILE?.trim() || path.join(getDataDir(), "spam-static-rules.json");
}

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
      note: typeof rule.note === "string" ? rule.note : undefined,
      spamHits: typeof rule.spamHits === "number" ? rule.spamHits : undefined,
      hamHits: typeof rule.hamHits === "number" ? rule.hamHits : undefined
    }];
  });
}

export function parseStaticRules(json: unknown): StaticRules {
  if (!json || typeof json !== "object") return EMPTY_STATIC_RULES;
  const data = json as Record<string, unknown>;
  return { allow: parseRuleList(data.allow), deny: parseRuleList(data.deny), hints: parseRuleList(data.hints) };
}

let cached: { filePath: string; version: string; rules: StaticRules } | null = null;

export function loadStaticRules(filePath = staticRulesPath()): StaticRules {
  let version: string;
  try {
    const stat = statSync(filePath);
    version = `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return EMPTY_STATIC_RULES;
  }
  if (cached?.filePath === filePath && cached.version === version) return cached.rules;
  let rules = EMPTY_STATIC_RULES;
  try {
    rules = parseStaticRules(JSON.parse(readFileSync(filePath, "utf8")));
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

const lower = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

function senderDomain(input: SpamInput) {
  const email = lower(input.fromEmail);
  return email.includes("@") ? email.slice(email.lastIndexOf("@") + 1) : "";
}

/** "Name <address>" pairs a display name with its address; a bare name has no address. */
function splitNameRule(value: string) {
  const match = value.match(/^(.*?)<([^<>@\s]+@[^<>\s]+)>\s*$/);
  if (match) return { name: lower(match[1].replace(/^"|"$/g, "")), address: lower(match[2]) };
  return value.includes("@") ? { name: "", address: lower(value) } : { name: lower(value), address: "" };
}

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

function matches(rule: StaticRule, input: SpamInput): boolean {
  const value = lower(rule.value);
  switch (rule.type) {
    case "address":
      return !!input.fromEmail && lower(input.fromEmail) === value;
    case "domain": {
      const domain = senderDomain(input);
      return !!domain && (domain === value || domain.endsWith(`.${value}`));
    }
    case "name": {
      const { name, address } = splitNameRule(rule.value);
      if (!address) return false;
      return lower(input.fromEmail) === address && (!name || lower(input.fromName) === name);
    }
    case "subjectPattern":
      return compile(rule.value)?.test(input.subject) ?? false;
    case "namePattern":
      return !!input.fromName && (compile(rule.value)?.test(input.fromName) ?? false);
    case "header": {
      const separator = rule.value.indexOf(":");
      if (separator <= 0) return false;
      const regex = compile(rule.value.slice(separator + 1).trim());
      return !!regex && headerValues(input, rule.value.slice(0, separator)).some((line) => regex.test(line));
    }
  }
}

function describe(rule: StaticRule, kind: "deny" | "hint") {
  const counts = rule.spamHits !== undefined || rule.hamHits !== undefined
    ? ` (bisher ${rule.spamHits ?? 0}× Spam, ${rule.hamHits ?? 0}× kein Spam)` : "";
  const label = kind === "deny" ? "Spam-Muster" : "Hinweis";
  return `${label}: ${rule.type} „${rule.value}“${counts}${rule.note ? ` – ${rule.note}` : ""}`;
}

export function applyStaticRules(rules: StaticRules, input: SpamInput): StaticRuleResult {
  const allow = rules.allow.find((rule) => matches(rule, input));
  if (allow) return { decision: "allow", rule: allow, hints: [] };
  const hints: string[] = [];
  // A known display name from an address that is not on the allow list is a
  // classic spoofing pattern: tell the model, never allow on the name alone.
  const fromName = lower(input.fromName);
  if (fromName && rules.allow.some((rule) => rule.type === "name" && splitNameRule(rule.value).name === fromName)) {
    hints.push(`Hinweis: bekannter Anzeigename „${input.fromName}“ von einer unbekannten Adresse`);
  }
  for (const rule of rules.deny) {
    if (!matches(rule, input)) continue;
    if (rule.safe) return { decision: "deny", rule, hints };
    hints.push(describe(rule, "deny"));
  }
  for (const rule of rules.hints) {
    if (matches(rule, input)) hints.push(describe(rule, "hint"));
  }
  return { decision: null, hints: hints.slice(0, MAX_HINTS) };
}
