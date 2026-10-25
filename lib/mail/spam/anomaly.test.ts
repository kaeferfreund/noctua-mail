import { describe, expect, test } from "bun:test";
import {
  assessSenderTrust,
  attachmentAnomalies,
  authAnomalies,
  contentAnomalies,
  detectSenderAnomalies,
  linkAnomalies,
  recipientAnomalies,
  replyToAnomalies,
  serverVerdictAnomalies,
  serviceAnomalies
} from "./anomaly";
import { foldSenderMail } from "./senderProfile";
import { DAY, ownAddresses, START, trustedFacts, trustedInput, trustedProfile } from "./testProfiles";

const profile = trustedProfile(25, 60);
const mail = trustedFacts({ date: START + 61 * DAY });

describe("anomaly rules: each one positive and one negative case", () => {
  test("usual mail of a trusted sender has no anomaly", () => {
    expect(detectSenderAnomalies(profile, mail)).toEqual({ anomalies: [] });
  });

  test("recipients: too many To/Cc", () => {
    expect(recipientAnomalies(profile, { ...mail, recipients: 47 }).anomalies).toEqual(["47 Empfänger (sonst höchstens 1)"]);
    expect(recipientAnomalies(profile, { ...mail, recipients: 5 }).anomalies).toEqual([]);
  });

  test("recipients: mailbox only in Bcc although usually addressed directly", () => {
    expect(recipientAnomalies(profile, { ...mail, direct: false }).anomalies).toEqual(["Postfach nur in Bcc (sonst direkt adressiert)"]);
    const bccSender = trustedProfile(25, 60, { direct: false });
    expect(recipientAnomalies(bccSender, { ...mail, direct: false }).anomalies).toEqual([]);
  });

  test("recipients: burst to different recipient circles within an hour", () => {
    const recent = [{ date: mail.date - 10 * 60_000, circle: "b@example.invalid" }, { date: mail.date + 20 * 60_000, circle: "c@example.invalid" }];
    expect(recipientAnomalies(profile, { ...mail, circle: "a@example.invalid" }, recent).anomalies).toEqual(["3 Mails in einer Stunde an verschiedene Empfänger"]);
    const sameCircle = recent.map((entry) => ({ ...entry, circle: "a@example.invalid" }));
    expect(recipientAnomalies(profile, { ...mail, circle: "a@example.invalid" }, sameCircle).anomalies).toEqual([]);
    const later = recent.map((entry) => ({ ...entry, date: entry.date + 3 * 60 * 60_000 }));
    expect(recipientAnomalies(profile, { ...mail, circle: "a@example.invalid" }, later).anomalies).toEqual([]);
  });

  test("reply-to: first appearance and a new foreign domain", () => {
    expect(replyToAnomalies(profile, { ...mail, replyToDomain: "service.example.test" }).anomalies).toEqual(["Antwortadresse erstmals gesetzt"]);
    expect(replyToAnomalies(profile, mail).anomalies).toEqual([]);
    const withReplyTo = trustedProfile(25, 60, { replyToDomain: "helpdesk.example.test" });
    expect(replyToAnomalies(withReplyTo, { ...mail, replyToDomain: "payout.example.invalid" }).anomalies)
      .toEqual(["Antwortadresse bei neuer fremder Domain example.invalid"]);
    expect(replyToAnomalies(withReplyTo, { ...mail, replyToDomain: "support.example.test" }).anomalies).toEqual([]);
  });

  test("authentication: unaligned, SPF fail, missing headers, new DKIM domain", () => {
    expect(authAnomalies(profile, { ...mail, auth: "unaligned", dkimDomains: [] }).anomalies)
      .toEqual(["keine passende DKIM-/SPF-Authentifizierung", "DKIM-Signatur fehlt (sonst vorhanden)"]);
    expect(authAnomalies(profile, { ...mail, spf: "softfail" }).anomalies).toEqual(["SPF softfail"]);
    expect(authAnomalies(profile, { ...mail, auth: "unknown" }).anomalies).toEqual(["Authentifizierungs-Kopfzeilen fehlen"]);
    expect(authAnomalies(profile, { ...mail, dkimDomains: ["mailer.service.example.test"] }).anomalies).toEqual(["DKIM-Domain mailer.service.example.test neu"]);
    expect(authAnomalies(profile, mail).anomalies).toEqual([]);
  });

  test("links: IP links, shorteners/file shares, never-used domains, masked link text", () => {
    expect(linkAnomalies(profile, { ...mail, linkHosts: ["203.0.113.9"] }).anomalies).toEqual(["IP-Link 203.0.113.9"]);
    expect(linkAnomalies(profile, { ...mail, linkHosts: ["127.0.0.1", "192.168.1.10"] }).anomalies).toEqual([]);
    expect(linkAnomalies(profile, { ...mail, linkHosts: ["bit.ly"] }).anomalies).toEqual(["neue Link-Domain bit.ly (Kürzer/Freigabe)"]);
    expect(linkAnomalies(profile, { ...mail, linkHosts: ["login.example.invalid"] }).anomalies).toEqual(["neue Link-Domain example.invalid"]);
    expect(linkAnomalies(profile, { ...mail, maskedLinkDomains: ["evil.example.invalid"] }).anomalies)
      .toEqual(["Linktext zeigt eine andere Domain als das Ziel (evil.example.invalid)"]);
    expect(linkAnomalies(profile, { ...mail, linkHosts: ["docs.service.example.test"] }).anomalies).toEqual([]);
  });

  test("links: a flood of one-off link domains never switches the new-domain rule off", () => {
    let flooded = trustedProfile(25, 60);
    for (let index = 0; index < 400; index += 1) {
      flooded = foldSenderMail(flooded, trustedFacts({ date: START + 60 * DAY + index * 60_000, linkHosts: [`www.flood${index}.invalid`] }));
    }
    const later = { ...mail, date: START + 62 * DAY };
    expect(Object.keys(flooded.linkDomains)).toHaveLength(150);
    // The usual domain stays known, the latest one-off domains too; anything else is new again.
    expect(linkAnomalies(flooded, { ...later, linkHosts: ["app.service.example.test", "www.flood399.invalid"] }).anomalies).toEqual([]);
    expect(linkAnomalies(flooded, { ...later, linkHosts: ["login.phish.invalid"] }).anomalies).toEqual(["neue Link-Domain phish.invalid"]);
    expect(linkAnomalies(flooded, { ...later, linkHosts: ["www.flood0.invalid"] }).anomalies).toEqual(["neue Link-Domain flood0.invalid"]);
    // A domain that recurs climbs into the frequent part and is not displaced by the next flood.
    let recurring = flooded;
    for (let index = 0; index < 3; index += 1) {
      recurring = foldSenderMail(recurring, trustedFacts({ date: START + 61 * DAY + index * 60_000, linkHosts: ["www.partner.invalid"] }));
    }
    for (let index = 0; index < 300; index += 1) {
      recurring = foldSenderMail(recurring, trustedFacts({ date: START + 62 * DAY + index * 60_000, linkHosts: [`www.wave${index}.invalid`] }));
    }
    expect(recurring.linkDomains["partner.invalid"]).toBe(3);
    expect(Object.keys(recurring.linkDomainsSeenAt).sort()).toEqual(Object.keys(recurring.linkDomains).sort());
  });

  test("attachments: risky types always, PDF only when unusual or with a payment subject", () => {
    expect(attachmentAnomalies(profile, { ...mail, attachmentTypes: ["zip"] }).anomalies).toEqual(["riskanter Anhang .zip"]);
    expect(attachmentAnomalies(profile, { ...mail, attachmentTypes: ["pdf"] }).anomalies).toEqual(["PDF-Anhang (sonst keine Anhänge)"]);
    const pdfSender = trustedProfile(25, 60, { attachmentTypes: ["pdf"] });
    expect(attachmentAnomalies(pdfSender, { ...mail, attachmentTypes: ["pdf"] }).anomalies).toEqual([]);
    expect(attachmentAnomalies(pdfSender, { ...mail, attachmentTypes: ["pdf"], subjectPayment: true }).anomalies).toEqual(["PDF-Anhang mit Zahlungsbetreff"]);
  });

  test("content: new lexicon words, changed bank details, language switch, broken subject pattern", () => {
    expect(contentAnomalies(profile, { ...mail, lexicon: ["credentials"] }).anomalies).toEqual(["Wörter zu Zugangsdaten (bei diesem Absender neu)"]);
    const invoices = trustedProfile(25, 60, { lexicon: ["payment"] });
    expect(contentAnomalies(invoices, { ...mail, lexicon: ["payment"] }).anomalies).toEqual([]);
    expect(contentAnomalies(invoices, { ...mail, lexicon: ["payment", "bankChange"] }).anomalies).toEqual(["Wörter zu geänderte Bankverbindung (bei diesem Absender neu)"]);
    expect(contentAnomalies(profile, { ...mail, language: "de" }).anomalies).toEqual(["Sprachwechsel (sonst englisch, jetzt deutsch)"]);
    expect(contentAnomalies(profile, { ...mail, language: null }).anomalies).toEqual([]);
    expect(contentAnomalies(profile, { ...mail, subjectPrefix: "urgent:" }).anomalies).toEqual(["Betreff weicht vom festen Muster ab"]);
  });

  test("service marks: missing List-Id/Auto-Submitted and an unusual Message-ID domain", () => {
    expect(serviceAnomalies(profile, { ...mail, serviceMarks: false }).anomalies).toEqual(["List-Id/Auto-Submitted fehlen (sonst vorhanden)"]);
    expect(serviceAnomalies(profile, { ...mail, messageIdDomain: "example.invalid" }).anomalies).toEqual(["Message-ID-Domain example.invalid ungewöhnlich"]);
    expect(serviceAnomalies(trustedProfile(25, 60, { serviceMarks: false }), { ...mail, serviceMarks: false }).anomalies).toEqual([]);
  });

  test("server verdict: X-Spam-Flag or SpamAssassin score from 3", () => {
    expect(serverVerdictAnomalies({ ...mail, serverSpamFlag: true }).anomalies).toEqual(["Mailserver hat die Mail als Spam markiert"]);
    expect(serverVerdictAnomalies({ ...mail, serverSpamScore: 3.4 }).anomalies).toEqual(["SpamAssassin-Score 3.4"]);
    expect(serverVerdictAnomalies({ ...mail, serverSpamScore: 2.9 }).anomalies).toEqual([]);
  });
});

describe("assessSenderTrust", () => {
  const context = (overrides = {}) => ({ ownAddresses, loadProfile: async () => profile, canaryKey: "m1", now: START + 61 * DAY, ...overrides });

  test("trusted without anomaly is a skip, with anomaly the deviations go along", async () => {
    expect(await assessSenderTrust(trustedInput, context())).toMatchObject({ kind: "skip", summary: "25 Mails seit 2026-03, DKIM service.example.test" });
    const phish = { ...trustedInput, linkDomains: ["bit.ly"], text: `${trustedInput.text} Please verify your account immediately.` };
    expect(await assessSenderTrust(phish, context())).toMatchObject({ kind: "anomaly",
      anomalies: ["neue Link-Domain bit.ly (Kürzer/Freigabe)", "Wörter zu Zugangsdaten, Dringlichkeit (bei diesem Absender neu)"] });
  });

  test("unknown, young or revoked senders are not trusted; burst data is loaded only for trusted senders", async () => {
    let recentLoads = 0;
    const loadRecent = async () => { recentLoads += 1; return []; };
    expect(await assessSenderTrust(trustedInput, context({ loadProfile: async () => null, loadRecent }))).toBeNull();
    expect(await assessSenderTrust(trustedInput, context({ loadProfile: async () => trustedProfile(25, 10), loadRecent }))).toBeNull();
    expect(await assessSenderTrust(trustedInput, context({ loadProfile: async () => ({ ...profile, lastUserSpamAt: START }), loadRecent }))).toBeNull();
    expect(recentLoads).toBe(0);
    await assessSenderTrust(trustedInput, context({ loadRecent }));
    expect(recentLoads).toBe(1);
  });
});
