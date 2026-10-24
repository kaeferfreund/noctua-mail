import { getRootDomain } from "@/lib/senderIdentity";
import {
  describeSenderTrust,
  evaluateSenderTrust,
  isIpHost,
  isLocalHost,
  linkDomainKey,
  recipientP95,
  senderMailFacts,
  type LexiconCategory,
  type SenderMailFacts,
  type SenderProfile
} from "./senderProfile";
import type { SpamInput } from "./types";

/**
 * Anomaly gate for trusted senders (concept §3.5): each rule compares the
 * current mail with the sender's household profile and returns short German
 * reasons. Any reason sends the mail to the model with the hint "vertrauter
 * Absender; Abweichung: …" instead of skipping it.
 */
export type AnomalyResult = { anomalies: string[] };
/** Another mail of the same sender to the same mailbox (burst rule). */
export type RecentSenderMail = { date: number; circle: string };

const share = (part: number, total: number) => (total > 0 ? part / total : 0);
const none: AnomalyResult = { anomalies: [] };
const result = (...anomalies: Array<string | false | null | undefined>): AnomalyResult =>
  ({ anomalies: anomalies.filter((entry): entry is string => typeof entry === "string") });

/** Usual share above which a missing feature counts as a deviation. */
const HABIT_SHARE = 0.9;
/** Below this share a lexicon category is new for the sender. */
const RARE_SHARE = 0.2;
export const BURST_WINDOW_MS = 60 * 60_000;
const BURST_CIRCLES = 3;

export function recipientAnomalies(profile: SenderProfile, mail: SenderMailFacts, recent: RecentSenderMail[] = []): AnomalyResult {
  const p95 = recipientP95(profile);
  const limit = Math.max(5, 3 * p95);
  const nearby = recent.filter((entry) => Math.abs(entry.date - mail.date) <= BURST_WINDOW_MS);
  const circles = new Set([mail.circle, ...nearby.map((entry) => entry.circle)].filter(Boolean));
  return result(
    mail.recipients > limit && `${mail.recipients} Empfänger (sonst höchstens ${p95})`,
    !mail.direct && share(profile.directCount, profile.count) >= HABIT_SHARE && "Postfach nur in Bcc (sonst direkt adressiert)",
    circles.size >= BURST_CIRCLES && `${nearby.length + 1} Mails in einer Stunde an verschiedene Empfänger`
  );
}

export function replyToAnomalies(profile: SenderProfile, mail: SenderMailFacts): AnomalyResult {
  if (!mail.replyToDomain) return none;
  const root = getRootDomain(mail.replyToDomain) ?? mail.replyToDomain;
  if (profile.replyToCount === 0) return result("Antwortadresse erstmals gesetzt");
  const foreign = root !== getRootDomain(mail.fromDomain) && !profile.replyToDomains[root];
  return result(foreign && `Antwortadresse bei neuer fremder Domain ${root}`);
}

export function authAnomalies(profile: SenderProfile, mail: SenderMailFacts): AnomalyResult {
  if (mail.auth === "unknown") return result("Authentifizierungs-Kopfzeilen fehlen");
  const knownDkim = Object.keys(profile.dkimDomains);
  const dkimUsual = share(Object.values(profile.dkimDomains).reduce((max, value) => Math.max(max, value), 0), profile.count) >= 0.5;
  return result(
    mail.auth === "unaligned" && "keine passende DKIM-/SPF-Authentifizierung",
    (mail.spf === "fail" || mail.spf === "softfail") && `SPF ${mail.spf}`,
    dkimUsual && !mail.dkimDomains.some((domain) => knownDkim.includes(domain))
      && (mail.dkimDomains.length ? `DKIM-Domain ${mail.dkimDomains[0]} neu` : "DKIM-Signatur fehlt (sonst vorhanden)")
  );
}

/** URL shorteners and file-sharing/e-signature services (concept §3.5). */
const RISKY_LINK_HOSTS = [
  "bit.ly", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc", "t.ly", "s.id",
  "wetransfer.com", "we.tl", "dropbox.com", "dropboxusercontent.com", "onedrive.live.com", "1drv.ms", "sharepoint.com", "docusign.net",
  "docusign.com", "adobesign.com", "echosign.com", "acrobat.adobe.com", "documentcloud.adobe.com", "drive.google.com", "docs.google.com",
  "box.com", "mega.nz"
];
export const isRiskyLinkHost = (host: string) => RISKY_LINK_HOSTS.some((entry) => host === entry || host.endsWith(`.${entry}`));

export function linkAnomalies(profile: SenderProfile, mail: SenderMailFacts): AnomalyResult {
  const anomalies: string[] = [];
  for (const host of mail.linkHosts) {
    if (isLocalHost(host)) continue;
    const key = linkDomainKey(host);
    if (isIpHost(host)) anomalies.push(`IP-Link ${host}`);
    else if (profile.linkDomains[key]) continue;
    else if (isRiskyLinkHost(host)) anomalies.push(`neue Link-Domain ${host} (Kürzer/Freigabe)`);
    else if (!profile.linkDomainsOverflow) anomalies.push(`neue Link-Domain ${key}`);
  }
  if (mail.maskedLinkDomains.length && share(profile.maskedLinkCount, profile.count) < RARE_SHARE) {
    anomalies.push(`Linktext zeigt eine andere Domain als das Ziel (${mail.maskedLinkDomains[0]})`);
  }
  return { anomalies: [...new Set(anomalies)].slice(0, 3) };
}

const RISKY_ATTACHMENTS = new Set(["html", "htm", "shtml", "xhtml", "zip", "rar", "7z", "iso", "img", "lnk", "js", "vbs", "docm", "xlsm",
  "pptm", "svg", "exe", "scr", "bat", "cmd", "ps1", "jar", "hta"]);

export function attachmentAnomalies(profile: SenderProfile, mail: SenderMailFacts): AnomalyResult {
  const risky = mail.attachmentTypes.find((type) => RISKY_ATTACHMENTS.has(type));
  const pdf = mail.attachmentTypes.includes("pdf");
  return result(
    risky && `riskanter Anhang .${risky}`,
    pdf && share(profile.attachmentCount, profile.count) < 0.05 && "PDF-Anhang (sonst keine Anhänge)",
    pdf && mail.subjectPayment && "PDF-Anhang mit Zahlungsbetreff"
  );
}

const LEXICON_LABELS: Record<LexiconCategory, string> = {
  credentials: "Zugangsdaten", payment: "Zahlung", urgency: "Dringlichkeit", bankChange: "geänderte Bankverbindung"
};
const LANGUAGE_LABELS = { de: "deutsch", en: "englisch" } as const;
const PREFIX_TOP = 3;

export function contentAnomalies(profile: SenderProfile, mail: SenderMailFacts): AnomalyResult {
  const lexicon = mail.lexicon.filter((category) => category === "bankChange" || share(profile.lexicon[category] ?? 0, profile.count) < RARE_SHARE);
  const known = profile.languages.de + profile.languages.en;
  const usual = profile.languages.de >= profile.languages.en ? "de" : "en";
  const prefixes = Object.values(profile.subjectPrefixes).sort((a, b) => b - a).slice(0, PREFIX_TOP).reduce((sum, value) => sum + value, 0);
  return result(
    lexicon.length > 0 && `Wörter zu ${lexicon.map((category) => LEXICON_LABELS[category]).join(", ")} (bei diesem Absender neu)`,
    known >= 10 && share(profile.languages[usual], known) >= HABIT_SHARE && mail.language !== null && mail.language !== usual
      && `Sprachwechsel (sonst ${LANGUAGE_LABELS[usual]}, jetzt ${LANGUAGE_LABELS[mail.language]})`,
    share(prefixes, profile.count) >= HABIT_SHARE && mail.subjectPrefix !== null && !profile.subjectPrefixes[mail.subjectPrefix]
      && "Betreff weicht vom festen Muster ab"
  );
}

export function serviceAnomalies(profile: SenderProfile, mail: SenderMailFacts): AnomalyResult {
  const idDomains = Object.values(profile.messageIdDomains);
  const stableId = share(Math.max(0, ...idDomains), profile.count) >= 0.95;
  return result(
    !mail.serviceMarks && share(profile.serviceCount, profile.count) >= 0.95 && "List-Id/Auto-Submitted fehlen (sonst vorhanden)",
    stableId && mail.messageIdDomain !== null && !profile.messageIdDomains[mail.messageIdDomain] && `Message-ID-Domain ${mail.messageIdDomain} ungewöhnlich`
  );
}

export const SERVER_SPAM_SCORE_LIMIT = 3;

export function serverVerdictAnomalies(mail: SenderMailFacts): AnomalyResult {
  return result(
    mail.serverSpamFlag && "Mailserver hat die Mail als Spam markiert",
    !mail.serverSpamFlag && mail.serverSpamScore !== null && mail.serverSpamScore >= SERVER_SPAM_SCORE_LIMIT && `SpamAssassin-Score ${mail.serverSpamScore}`
  );
}

export function detectSenderAnomalies(profile: SenderProfile, mail: SenderMailFacts, recent: RecentSenderMail[] = []): AnomalyResult {
  return {
    anomalies: [
      recipientAnomalies(profile, mail, recent), replyToAnomalies(profile, mail), authAnomalies(profile, mail), linkAnomalies(profile, mail),
      attachmentAnomalies(profile, mail), contentAnomalies(profile, mail), serviceAnomalies(profile, mail), serverVerdictAnomalies(mail)
    ].flatMap((entry) => entry.anomalies)
  };
}

/** What the classifier needs to apply trust (classifySpam). Loaders run only when the sender could be trusted. */
export type SpamTrustContext = {
  ownAddresses: ReadonlySet<string>;
  /** The household-merged profile of a sender key as of `now` (the eval: only mails that arrived before). */
  loadProfile: (senderKey: string, now: number) => Promise<SenderProfile | null>;
  /** Other mails of the sender to this mailbox around `date` (burst rule). */
  loadRecent?: (senderKey: string, date: number) => Promise<RecentSenderMail[]>;
  /** Stable message key for the canary sample. */
  canaryKey: string;
  /** Reference time for decay; the server uses the check time (now), the eval the mail's arrival (spamArrivalTime). */
  now?: number;
};

export type SenderTrustAssessment =
  | { kind: "skip"; summary: string; facts: SenderMailFacts }
  | { kind: "anomaly"; anomalies: string[]; summary: string; facts: SenderMailFacts };

/** Null when the sender is not trusted: the normal pipeline decides. */
export async function assessSenderTrust(input: SpamInput, context: SpamTrustContext): Promise<SenderTrustAssessment | null> {
  const now = context.now ?? Date.now();
  const facts = senderMailFacts(input, { ownAddresses: context.ownAddresses, arrivedAt: now });
  if (!facts) return null;
  const profile = await context.loadProfile(facts.senderKey, now);
  if (!profile || !evaluateSenderTrust(profile, now).trusted) return null;
  const recent = context.loadRecent ? await context.loadRecent(facts.senderKey, facts.date) : [];
  const { anomalies } = detectSenderAnomalies(profile, facts, recent);
  const summary = describeSenderTrust(profile);
  return anomalies.length ? { kind: "anomaly", anomalies, summary, facts } : { kind: "skip", summary, facts };
}
