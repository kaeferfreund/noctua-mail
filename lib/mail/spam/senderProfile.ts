import { normalizeIdentityEmail, parseAddressEmails } from "@/lib/ownAddresses";
import { isPublicSuffix } from "@/lib/publicSuffixes";
import { getRootDomain } from "@/lib/senderIdentity";
import { serverFlaggedSpam } from "./staticRules";
import type { SpamInput } from "./types";

/**
 * Learned sender profiles for trusted senders (doc/SPAM-DETECTION.md,
 * briefs/spam/trusted-sender-concept.md). A profile summarises the header-level
 * facts of every mail a sender sent to a mailbox; the household view merges the
 * profiles of all mailboxes. A sender is trusted only with enough authenticated
 * history and never after an "Als Spam" decision; the anomaly gate (anomaly.ts)
 * then decides per mail whether the model still has to look.
 */
export const TRUST_MIN_MAILS = 20;
export const TRUST_MIN_SPAN_MS = 30 * 24 * 60 * 60_000;
export const TRUST_MIN_AUTH_SHARE = 0.95;
export const TRUST_DECAY_MS = 180 * 24 * 60 * 60_000;
/** More of the sender's mail than this in Junk folders: not trusted. */
export const TRUST_MAX_JUNK_SHARE = 0.05;
/** Share of trusted skips that the model checks anyway. */
export const TRUST_CANARY_PERCENT = 2;
/** Spam threshold for trusted senders whose mail goes to the model. */
export const TRUSTED_SPAM_THRESHOLD = 0.9;

const RECIPIENT_BUCKETS = 51;
const CAPS = { dkimDomains: 10, replyToDomains: 20, linkDomains: 150, attachmentTypes: 20, subjectPrefixes: 40, lexicon: 8, messageIdDomains: 10 };

type Counts = Record<string, number>;
export type SpamLanguage = "de" | "en";
export type LexiconCategory = "credentials" | "payment" | "urgency" | "bankChange";

/** The facts of one mail the profile learns from and the anomaly gate compares. */
export type SenderMailFacts = {
  senderKey: string;
  fromDomain: string;
  /** Arrival time (spamArrivalTime), not the sender's Date header. */
  date: number;
  /** aligned: SPF or DKIM pass for the From domain; unknown: no Authentication-Results at all. */
  auth: "aligned" | "unaligned" | "unknown";
  /** Passing DKIM signatures (d=) aligned with the From domain. */
  dkimDomains: string[];
  spf: "pass" | "fail" | "softfail" | "other" | null;
  /** To + Cc. */
  recipients: number;
  /** A household address is in To or Cc. */
  direct: boolean;
  /** To + Cc outside the household and the sender's own domain, sorted (burst rule). */
  circle: string;
  replyToDomain: string | null;
  linkHosts: string[];
  maskedLinkDomains: string[];
  attachmentTypes: string[];
  language: SpamLanguage | null;
  subjectPrefix: string | null;
  subjectPayment: boolean;
  lexicon: LexiconCategory[];
  /** List-Id, List-Unsubscribe or Auto-Submitted present. */
  serviceMarks: boolean;
  messageIdDomain: string | null;
  serverSpamFlag: boolean;
  serverSpamScore: number | null;
};

export type SenderProfile = {
  senderKey: string;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastUserSpamAt: number | null;
  junkCount: number;
  authAligned: number;
  authUnknown: number;
  dkimDomains: Counts;
  /** Histogram of To+Cc counts; the last bucket holds everything above. */
  recipients: number[];
  directCount: number;
  replyToCount: number;
  replyToDomains: Counts;
  linkMailCount: number;
  linkDomains: Counts;
  /** More distinct link domains than the cap: "never seen" is no longer reliable. */
  linkDomainsOverflow: boolean;
  maskedLinkCount: number;
  attachmentCount: number;
  attachmentTypes: Counts;
  languages: Record<SpamLanguage, number>;
  subjectPrefixes: Counts;
  lexicon: Counts;
  serviceCount: number;
  messageIdDomains: Counts;
};

const lower = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export function spamSenderKey(email: string | null | undefined) {
  const value = lower(email);
  if (!value.includes("@")) return null;
  return normalizeIdentityEmail(value) ?? value;
}

const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1);
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
export const isIpHost = (host: string) => IPV4.test(host) || host.startsWith("[") || host.includes(":");
/** Loopback and private addresses (developer notifications quote them); never a phishing target. */
export const isLocalHost = (host: string) => host === "localhost" || host === "[::1]"
  || /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.0\.0\.0$)/.test(host);

/** Profile key of a link host: its root domain, IP literals as they are. */
export function linkDomainKey(host: string) {
  const value = lower(host);
  return isIpHost(value) ? value : getRootDomain(value) ?? value;
}

type AuthEntry = { method: string; result: string; domain: string | null };

/**
 * Method results of the receiving server's Authentication-Results (input.ts
 * keeps only its block). Only the identity a method authenticates counts:
 * DKIM `header.d` (else the domain of `header.i`), SPF `smtp.mailfrom`. Selectors,
 * `smtp.helo` and comments name nothing the sender proved to own.
 */
export function parseAuthenticationResults(values: string[]): AuthEntry[] {
  return values.flatMap((value) => {
    let text = value;
    for (let previous = ""; previous !== text;) {
      previous = text;
      text = text.replace(/\([^()]*\)/g, " ");
    }
    return text.split(";").slice(1).flatMap((segment) => {
      const match = segment.match(/^\s*([a-z0-9-]+)\s*=\s*([a-z]+)/i);
      if (!match) return [];
      const method = match[1].toLowerCase();
      const props = new Map<string, string>();
      for (const prop of segment.matchAll(/(?:^|\s)([a-z]+\.[a-z-]+)\s*=\s*("[^"]*"|[^\s;]+)/gi)) {
        const key = prop[1].toLowerCase();
        if (!props.has(key)) props.set(key, prop[2].toLowerCase().replace(/^"|"$/g, ""));
      }
      const identity = method === "dkim" ? props.get("header.d") ?? props.get("header.i")
        : method === "spf" ? props.get("smtp.mailfrom") : undefined;
      return [{ method, result: match[2].toLowerCase(), domain: identity ? domainOf(identity).replace(/\.$/, "") || null : null }];
    });
  });
}

/**
 * Relaxed DMARC-style alignment: `domain` is the organisational domain of the
 * From domain (public-suffix aware, getRootDomain) or one of its subdomains.
 */
export function isAlignedDomain(domain: string | null | undefined, fromDomain: string) {
  const org = getRootDomain(fromDomain);
  if (!domain || !org || isPublicSuffix(org)) return false;
  const value = domain.toLowerCase();
  return value === org || value.endsWith(`.${org}`);
}

/**
 * Arrival time of a mail: the receiving server's Received stamp, else
 * `fallback` (the caller's own clock or stored arrival); never the sender's
 * Date header and never in the future.
 */
export function spamArrivalTime(input: Pick<SpamInput, "receivedAt">, fallback = Date.now()) {
  const received = input.receivedAt ? Date.parse(input.receivedAt) : NaN;
  return Math.min(Number.isFinite(received) ? received : fallback, Date.now());
}

const STOP_WORDS: Record<SpamLanguage, Set<string>> = {
  de: new Set("der die das und ist nicht ein eine einen zu mit für auf sie wir ihr ihre ihren den dem des von bitte sehr wie auch noch bei über sind wird werden haben hat ich sich oder".split(" ")),
  en: new Set("the and is not a an to with for on you we your are of from please this that be have has will at by our it can".split(" "))
};

/** German or English by stop-word count; null when too short or mixed. */
export function guessLanguage(text: string): SpamLanguage | null {
  let de = 0;
  let en = 0;
  for (const word of (text.slice(0, 3000).toLowerCase().match(/\p{L}+/gu) ?? []).slice(0, 400)) {
    if (STOP_WORDS.de.has(word)) de += 1;
    if (STOP_WORDS.en.has(word)) en += 1;
  }
  if (de + en < 5) return null;
  return de >= 2 * en ? "de" : en >= 2 * de ? "en" : null;
}

const normalizePrefix = (value: string) => value.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

/** Fixed subject start of service mails: a [tag], the text before ":" or the first word. */
export function subjectPrefix(subject: string) {
  const text = subject.normalize("NFKC").trim().replace(/^((re|aw|fwd?|wg|antw)\s*:\s*)+/i, "");
  const tag = text.match(/^\[([^\]]{1,40})\]/);
  if (tag) return `[${normalizePrefix(tag[1])}]`;
  const colon = text.indexOf(":");
  if (colon > 0 && colon <= 40) return `${normalizePrefix(text.slice(0, colon))}:`;
  const word = text.match(/^[\p{L}\p{N}]+/u)?.[0];
  return word ? normalizePrefix(word) : null;
}

const words = (alternatives: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "iu");
const LEXICON: Record<LexiconCategory, RegExp> = {
  credentials: words("passwor[dt]|kennwort|zugangsdaten|anmeldedaten|login-?daten|konto\\s+(?:wurde\\s+)?gesperrt|account\\s+(?:has\\s+been\\s+)?(?:suspended|locked|disabled)"
    + "|verify\\s+your\\s+(?:account|identity|email)|bestätigen\\s+sie\\s+ihre?\\s+(?:konto|identität|e-mail-adresse)|verifizieren\\s+sie"),
  payment: words("rechnung|invoice|zahlung|zahlungsaufforderung|payment|überweisung|wire\\s+transfer|bankverbindung|kontoverbindung|iban|bitcoin|mahnung"),
  urgency: words("sofort|dringend|urgent|immediately|umgehend|innerhalb\\s+von\\s+24\\s+stunden|within\\s+24\\s+hours|letzte\\s+mahnung|final\\s+notice"),
  bankChange: words("(?:neue[nrs]?|geänderte[nrs]?|new|updated|changed)\\s+(?:iban|bankverbindung|kontoverbindung|bank\\s+details|bank\\s+account)"
    + "|(?:iban|bankverbindung|kontoverbindung|bank\\s+details)[^.\\n]{0,60}(?:geändert|geaendert|changed|updated)")
};
export const PAYMENT_WORDS = LEXICON.payment;

export function lexiconCategories(text: string): LexiconCategory[] {
  return (Object.keys(LEXICON) as LexiconCategory[]).filter((category) => LEXICON[category].test(text));
}

/** SpamAssassin score from X-Spam-Score or the score= of X-Spam-Status. */
export function serverSpamScore(spamHeaders: string[]) {
  for (const line of spamHeaders) {
    const match = line.match(/^x-spam-score:\s*(-?\d+(?:\.\d+)?)/i) ?? line.match(/^x-spam-status:.*?\bscore=(-?\d+(?:\.\d+)?)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function attachmentType(entry: string) {
  const name = entry.replace(/\s*\([^()]*\)\s*$/, "").trim().toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot > 0 && dot < name.length - 1) return name.slice(dot + 1).slice(0, 10);
  const type = entry.match(/\(([^()]+)\)\s*$/)?.[1]?.toLowerCase();
  return type ? type.slice(type.indexOf("/") + 1).slice(0, 20) : "unbekannt";
}

const emailsOf = (value: string | null | undefined) => parseAddressEmails(value ?? "").map((email) => email.toLowerCase());

/** To + Cc outside the household and the sender's own domain, sorted: who else a mail went to (burst rule). */
export function recipientCircle(recipients: string[], senderKey: string, ownAddresses: ReadonlySet<string>) {
  const fromDomain = domainOf(senderKey);
  return [...new Set(recipients.filter((email) => !ownAddresses.has(email) && !isAlignedDomain(domainOf(email), fromDomain)))].sort().join(",");
}

export function recipientCircleOf(to: string | null | undefined, cc: string | null | undefined, senderKey: string, ownAddresses: ReadonlySet<string>) {
  return recipientCircle([...emailsOf(to), ...emailsOf(cc)], senderKey, ownAddresses);
}

/**
 * Extracts the facts of one mail. Null without a usable From address.
 * `arrivedAt`: arrival time when the mail has no Received stamp (spamArrivalTime).
 */
export function senderMailFacts(input: SpamInput, options: { ownAddresses: ReadonlySet<string>; arrivedAt?: number }): SenderMailFacts | null {
  const senderKey = spamSenderKey(input.fromEmail);
  if (!senderKey) return null;
  const fromDomain = domainOf(senderKey);
  const auth = parseAuthenticationResults(input.authenticationResults);
  const passed = auth.filter((entry) => entry.result === "pass" && (entry.method === "spf" || entry.method === "dkim")
    && isAlignedDomain(entry.domain, fromDomain));
  const spf = auth.find((entry) => entry.method === "spf")?.result;
  const recipients = [...emailsOf(input.to), ...emailsOf(input.cc)];
  const replyTo = emailsOf(input.replyTo)[0] ?? null;
  const messageIdDomain = input.messageId?.match(/@([^@>\s]+)>?\s*$/)?.[1];
  const score = serverSpamScore(input.spamHeaders);
  return {
    senderKey,
    fromDomain,
    date: spamArrivalTime(input, options.arrivedAt),
    auth: input.authenticationResults.length === 0 ? "unknown" : passed.length ? "aligned" : "unaligned",
    dkimDomains: [...new Set(passed.filter((entry) => entry.method === "dkim").map((entry) => entry.domain!))],
    spf: spf === undefined ? null : spf === "pass" || spf === "fail" || spf === "softfail" ? spf : "other",
    recipients: recipients.length,
    direct: recipients.some((email) => options.ownAddresses.has(email)),
    circle: recipientCircle(recipients, senderKey, options.ownAddresses),
    replyToDomain: replyTo && replyTo !== senderKey ? domainOf(replyTo) : null,
    linkHosts: input.linkDomains.map(lower).filter(Boolean),
    // A link into the sender's own domain is not deceptive, whatever its text says.
    maskedLinkDomains: (input.maskedLinkDomains ?? []).filter((host) => !isAlignedDomain(host, fromDomain)),
    attachmentTypes: [...new Set(input.attachments.map(attachmentType))],
    language: guessLanguage(input.text),
    subjectPrefix: subjectPrefix(input.subject),
    subjectPayment: PAYMENT_WORDS.test(input.subject),
    lexicon: lexiconCategories(`${input.subject}\n${input.text}`),
    serviceMarks: Boolean(input.listId || input.listUnsubscribe || (input.autoSubmitted && !/^\s*no\b/i.test(input.autoSubmitted))),
    messageIdDomain: messageIdDomain ? getRootDomain(messageIdDomain.toLowerCase()) : null,
    serverSpamFlag: serverFlaggedSpam(input),
    serverSpamScore: score !== null && Number.isFinite(score) ? score : null
  };
}

export function emptySenderProfile(senderKey: string, date: number): SenderProfile {
  return {
    senderKey, count: 0, firstSeenAt: date, lastSeenAt: date, lastUserSpamAt: null, junkCount: 0,
    authAligned: 0, authUnknown: 0, dkimDomains: {}, recipients: Array(RECIPIENT_BUCKETS).fill(0), directCount: 0,
    replyToCount: 0, replyToDomains: {}, linkMailCount: 0, linkDomains: {}, linkDomainsOverflow: false, maskedLinkCount: 0,
    attachmentCount: 0, attachmentTypes: {}, languages: { de: 0, en: 0 }, subjectPrefixes: {}, lexicon: {}, serviceCount: 0, messageIdDomains: {}
  };
}

/** Keeps the `cap` most frequent keys; returns whether any were dropped. */
function capCounts(counts: Counts, cap: number) {
  const keys = Object.keys(counts);
  if (keys.length <= cap) return false;
  keys.sort((a, b) => counts[b] - counts[a] || (a < b ? -1 : 1));
  for (const key of keys.slice(cap)) delete counts[key];
  return true;
}

function bump(counts: Counts, keys: Iterable<string | null>, cap: number) {
  for (const key of new Set(keys)) if (key) counts[key] = (counts[key] ?? 0) + 1;
  return capCounts(counts, cap);
}

/**
 * Adds one mail to a profile (in place). After TRUST_DECAY_MS without mail the
 * history starts over: a long silent sender is new again. A user's "Als Spam"
 * survives the restart.
 */
export function foldSenderMail(profile: SenderProfile | null, facts: SenderMailFacts): SenderProfile {
  let target = profile;
  if (!target || (target.count > 0 && facts.date - target.lastSeenAt > TRUST_DECAY_MS)) {
    const fresh = emptySenderProfile(facts.senderKey, facts.date);
    fresh.lastUserSpamAt = target?.lastUserSpamAt ?? null;
    target = fresh;
  }
  target.count += 1;
  if (facts.date < target.firstSeenAt || target.count === 1) target.firstSeenAt = facts.date;
  if (facts.date > target.lastSeenAt || target.count === 1) target.lastSeenAt = facts.date;
  if (facts.auth === "aligned") target.authAligned += 1;
  if (facts.auth === "unknown") target.authUnknown += 1;
  bump(target.dkimDomains, facts.dkimDomains, CAPS.dkimDomains);
  target.recipients[Math.min(facts.recipients, RECIPIENT_BUCKETS - 1)] += 1;
  if (facts.direct) target.directCount += 1;
  if (facts.replyToDomain) {
    target.replyToCount += 1;
    bump(target.replyToDomains, [getRootDomain(facts.replyToDomain)], CAPS.replyToDomains);
  }
  if (facts.linkHosts.length) {
    target.linkMailCount += 1;
    if (bump(target.linkDomains, facts.linkHosts.map(linkDomainKey), CAPS.linkDomains)) target.linkDomainsOverflow = true;
  }
  if (facts.maskedLinkDomains.length) target.maskedLinkCount += 1;
  if (facts.attachmentTypes.length) {
    target.attachmentCount += 1;
    bump(target.attachmentTypes, facts.attachmentTypes, CAPS.attachmentTypes);
  }
  if (facts.language) target.languages[facts.language] += 1;
  bump(target.subjectPrefixes, [facts.subjectPrefix], CAPS.subjectPrefixes);
  bump(target.lexicon, facts.lexicon, CAPS.lexicon);
  if (facts.serviceMarks) target.serviceCount += 1;
  bump(target.messageIdDomains, [facts.messageIdDomain], CAPS.messageIdDomains);
  return target;
}

function addCounts(target: Counts, source: Counts, cap: number) {
  for (const [key, value] of Object.entries(source)) target[key] = (target[key] ?? 0) + value;
  return capCounts(target, cap);
}

/**
 * Household view: the profiles of one sender across all mailboxes. Counts and
 * patterns add up, the earliest first and latest last mail win, and any "Als
 * Spam" in any mailbox counts everywhere. Profiles silent for longer than
 * TRUST_DECAY_MS contribute only their "Als Spam" time.
 */
export function mergeSenderProfiles(profiles: SenderProfile[], now = Date.now()): SenderProfile | null {
  if (!profiles.length) return null;
  const lastUserSpamAt = profiles.reduce<number | null>((latest, profile) =>
    profile.lastUserSpamAt !== null && (latest === null || profile.lastUserSpamAt > latest) ? profile.lastUserSpamAt : latest, null);
  const live = profiles.filter((profile) => profile.count > 0 && now - profile.lastSeenAt <= TRUST_DECAY_MS);
  const merged = emptySenderProfile(profiles[0].senderKey, live[0]?.firstSeenAt ?? now);
  merged.lastUserSpamAt = lastUserSpamAt;
  merged.junkCount = profiles.reduce((sum, profile) => sum + profile.junkCount, 0);
  if (!live.length) return merged;
  merged.firstSeenAt = Math.min(...live.map((profile) => profile.firstSeenAt));
  merged.lastSeenAt = Math.max(...live.map((profile) => profile.lastSeenAt));
  for (const profile of live) {
    for (const key of ["count", "authAligned", "authUnknown", "directCount", "replyToCount", "linkMailCount", "maskedLinkCount",
      "attachmentCount", "serviceCount"] as const) merged[key] += profile[key];
    profile.recipients.forEach((value, index) => { merged.recipients[Math.min(index, RECIPIENT_BUCKETS - 1)] += value; });
    merged.languages.de += profile.languages.de;
    merged.languages.en += profile.languages.en;
    addCounts(merged.dkimDomains, profile.dkimDomains, CAPS.dkimDomains);
    addCounts(merged.replyToDomains, profile.replyToDomains, CAPS.replyToDomains);
    if (addCounts(merged.linkDomains, profile.linkDomains, CAPS.linkDomains) || profile.linkDomainsOverflow) merged.linkDomainsOverflow = true;
    addCounts(merged.attachmentTypes, profile.attachmentTypes, CAPS.attachmentTypes);
    addCounts(merged.subjectPrefixes, profile.subjectPrefixes, CAPS.subjectPrefixes);
    addCounts(merged.lexicon, profile.lexicon, CAPS.lexicon);
    addCounts(merged.messageIdDomains, profile.messageIdDomains, CAPS.messageIdDomains);
  }
  return merged;
}

export type SenderTrust = { trusted: true } | { trusted: false; reason: string };

/** Concept §3.2: history, authentication and no "Als Spam" — the per-mail anomalies are checked separately. */
export function evaluateSenderTrust(profile: SenderProfile | null, now = Date.now()): SenderTrust {
  if (!profile || profile.count === 0) return { trusted: false, reason: "unbekannter Absender" };
  if (profile.lastUserSpamAt !== null) return { trusted: false, reason: "vom Nutzer als Spam markiert" };
  if (now - profile.lastSeenAt > TRUST_DECAY_MS) return { trusted: false, reason: "lange keine Mail" };
  if (profile.count < TRUST_MIN_MAILS) return { trusted: false, reason: "zu wenige Mails" };
  if (profile.lastSeenAt - profile.firstSeenAt < TRUST_MIN_SPAN_MS) return { trusted: false, reason: "zu kurze Historie" };
  if (profile.authAligned / profile.count < TRUST_MIN_AUTH_SHARE) return { trusted: false, reason: "Authentifizierung zu selten" };
  if (profile.junkCount / (profile.count + profile.junkCount) > TRUST_MAX_JUNK_SHARE) return { trusted: false, reason: "oft im Spam-Ordner" };
  return { trusted: true };
}

const topKey = (counts: Counts) => Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

/** "23 Mails seit 2026-03, DKIM github.com" */
export function describeSenderTrust(profile: SenderProfile) {
  const since = new Date(profile.firstSeenAt).toISOString().slice(0, 7);
  const dkim = topKey(profile.dkimDomains);
  return `${profile.count} Mails seit ${since}${dkim ? `, DKIM ${dkim}` : ", SPF"}`;
}

/** 95th percentile of the To+Cc histogram. */
export function recipientP95(profile: SenderProfile) {
  const total = profile.recipients.reduce((sum, value) => sum + value, 0);
  let seen = 0;
  for (let index = 0; index < profile.recipients.length; index += 1) {
    seen += profile.recipients[index];
    if (seen >= total * 0.95) return index;
  }
  return 0;
}

/** Deterministic canary sample (FNV-1a of the message id). */
export function isTrustCanary(key: string, percent = TRUST_CANARY_PERCENT) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 10_000 < percent * 100;
}

const PROFILE_COLUMNS = new Set(["senderKey", "count", "firstSeenAt", "lastSeenAt", "lastUserSpamAt"]);

/** The pattern fields stored as JSON next to the indexed columns. */
export function serializeProfilePatterns(profile: SenderProfile) {
  return JSON.stringify(Object.fromEntries(Object.entries(profile).filter(([key]) => !PROFILE_COLUMNS.has(key))));
}

export type SenderProfileRow = { senderKey: string; count: number; firstSeenAt: number; lastSeenAt: number; lastUserSpamAt: number | null; patterns: string | null };

export function senderProfileFromRow(row: SenderProfileRow): SenderProfile {
  let patterns: Partial<SenderProfile> = {};
  try { patterns = JSON.parse(row.patterns || "{}") as Partial<SenderProfile>; } catch { patterns = {}; }
  const base = emptySenderProfile(row.senderKey, row.firstSeenAt);
  const profile: SenderProfile = { ...base, ...patterns, senderKey: row.senderKey, count: row.count, firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt, lastUserSpamAt: row.lastUserSpamAt ?? null };
  if (!Array.isArray(profile.recipients) || profile.recipients.length !== RECIPIENT_BUCKETS) profile.recipients = base.recipients;
  return profile;
}
