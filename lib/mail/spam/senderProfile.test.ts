import { describe, expect, test } from "bun:test";
import { START, trustedFacts, trustedInput, trustedProfile } from "./testProfiles";
import {
  describeSenderTrust,
  emptySenderProfile,
  evaluateSenderTrust,
  foldSenderMail,
  guessLanguage,
  isTrustCanary,
  mergeSenderProfiles,
  recipientP95,
  senderMailFacts,
  senderProfileFromRow,
  serializeProfilePatterns,
  spamArrivalTime,
  subjectPrefix,
  TRUST_DECAY_MS
} from "./senderProfile";
import type { SpamInput } from "./types";

const DAY = 24 * 60 * 60_000;
const own = new Set(["anna@example.test"]);

describe("senderMailFacts", () => {
  test("reads alignment, recipients, links, language and service marks from the input", () => {
    const facts = trustedFacts();
    expect(facts).toMatchObject({
      senderKey: "notify@service.example.test", auth: "aligned", dkimDomains: ["service.example.test"], spf: "pass",
      recipients: 1, direct: true, circle: "", replyToDomain: null, linkHosts: ["app.service.example.test"], language: "en",
      subjectPrefix: "[service]", serviceMarks: true, messageIdDomain: "example.test", serverSpamFlag: false, serverSpamScore: 0.1
    });
  });

  test("unaligned and missing authentication are told apart", () => {
    const other = { ...trustedInput, authenticationResults: ["mx.example.test; spf=pass smtp.mailfrom=other.example.invalid; dkim=pass header.d=other.example.invalid"] };
    expect(senderMailFacts(other, { ownAddresses: own })?.auth).toBe("unaligned");
    expect(senderMailFacts({ ...trustedInput, authenticationResults: [] }, { ownAddresses: own })?.auth).toBe("unknown");
    expect(senderMailFacts({ ...trustedInput, fromEmail: null }, { ownAddresses: own })).toBeNull();
  });

  test("only DKIM header.d/header.i and SPF smtp.mailfrom align; selectors, HELO, comments and other tokens never do", () => {
    const from = (fromEmail: string, results: string): SpamInput =>
      ({ ...trustedInput, from: fromEmail, fromEmail, authenticationResults: [`mx.example.test; ${results}`] });
    const auth = (fromEmail: string, results: string) => senderMailFacts(from(fromEmail, results), { ownAddresses: own });
    expect(auth("chef@victim.test", "dkim=pass header.d=attacker.test header.s=victim.test")).toMatchObject({ auth: "unaligned", dkimDomains: [] });
    expect(auth("chef@victim.test", "spf=pass smtp.mailfrom=bounce@attacker.test smtp.helo=victim.test")?.auth).toBe("unaligned");
    expect(auth("chef@victim.test", "spf=pass smtp.helo=victim.test")?.auth).toBe("unaligned");
    expect(auth("chef@victim.test", "spf=pass (victim.test) smtp.mailfrom=a@attacker.test x.y=victim.test")?.auth).toBe("unaligned");
    expect(auth("chef@victim.test", "dkim=pass header.d=attacker.test policy.d=victim.test header.b=victim.test")?.auth).toBe("unaligned");
    expect(auth("chef@victim.test", "dkim=pass header.d=victimtest.test")?.auth).toBe("unaligned");
    expect(auth("x@bank.co.uk", "dkim=pass header.d=attacker.co.uk")?.auth).toBe("unaligned");
    expect(auth("x@bank.co.uk", "dkim=pass header.d=co.uk")?.auth).toBe("unaligned");
    expect(auth("x@co.uk", "dkim=pass header.d=co.uk")?.auth).toBe("unaligned");
    expect(auth("x@bank.co.uk", "dkim=pass header.d=mail.bank.co.uk")).toMatchObject({ auth: "aligned", dkimDomains: ["mail.bank.co.uk"] });
    expect(auth("chef@news.victim.test", "dkim=pass header.i=@victim.test")).toMatchObject({ auth: "aligned", dkimDomains: ["victim.test"] });
    expect(auth("chef@victim.test", "spf=pass (sender IP is 192.0.2.1) smtp.mailfrom=bounce@em.victim.test smtp.helo=out.attacker.test"))
      .toMatchObject({ auth: "aligned", dkimDomains: [], spf: "pass" });
    expect(auth("chef@victim.test", "dkim=fail header.d=victim.test")?.auth).toBe("unaligned");
  });

  test("the arrival is the Received stamp or the caller's time, never the sender's Date header", () => {
    const received = Date.UTC(2026, 5, 1, 12);
    expect(senderMailFacts({ ...trustedInput, date: "2020-01-01T00:00:00.000Z", receivedAt: new Date(received).toISOString() }, { ownAddresses: own })?.date)
      .toBe(received);
    expect(senderMailFacts({ ...trustedInput, date: "2020-01-01T00:00:00.000Z", receivedAt: null }, { ownAddresses: own, arrivedAt: received })?.date)
      .toBe(received);
    const before = Date.now();
    expect(spamArrivalTime({ receivedAt: "2999-01-01T00:00:00.000Z" })).toBeGreaterThanOrEqual(before);
    expect(spamArrivalTime({ receivedAt: "2999-01-01T00:00:00.000Z" })).toBeLessThanOrEqual(Date.now());
  });

  test("20 mails on one day with a backdated Date header earn no trust", () => {
    let profile = null;
    for (let index = 0; index < 20; index += 1) {
      const date = new Date(START - (index === 0 ? 31 : 0) * DAY + index * 60_000).toISOString();
      const receivedAt = new Date(START + index * 60_000).toISOString();
      profile = foldSenderMail(profile, senderMailFacts({ ...trustedInput, date, receivedAt }, { ownAddresses: own })!);
    }
    expect(profile).toMatchObject({ count: 20, firstSeenAt: START, lastSeenAt: START + 19 * 60_000 });
    expect(evaluateSenderTrust(profile, START + DAY)).toMatchObject({ trusted: false, reason: "zu kurze Historie" });
  });

  test("language, subject prefix and masked links of the own domain", () => {
    expect(guessLanguage("Sehr geehrte Damen und Herren, bitte prüfen Sie die Rechnung und den Betrag für die Lieferung.")).toBe("de");
    expect(guessLanguage("ok")).toBeNull();
    expect(subjectPrefix("Re: Rechnung 2026-123: bitte prüfen")).toBe("rechnung #-#:");
    const masked = senderMailFacts({ ...trustedInput, maskedLinkDomains: ["service.example.test", "evil.example.invalid"] }, { ownAddresses: own });
    expect(masked?.maskedLinkDomains).toEqual(["evil.example.invalid"]);
  });
});

describe("sender profile", () => {
  test("folds mails into counts and patterns; p95 of recipients", () => {
    const profile = trustedProfile(25, 60);
    expect(profile).toMatchObject({ count: 25, authAligned: 25, directCount: 25, serviceCount: 25, firstSeenAt: START, lastSeenAt: START + 60 * DAY });
    expect(profile.dkimDomains).toEqual({ "service.example.test": 25 });
    expect(profile.linkDomains).toEqual({ "example.test": 25 });
    expect(recipientP95(profile)).toBe(1);
    expect(describeSenderTrust(profile)).toBe("25 Mails seit 2026-03, DKIM service.example.test");
  });

  test("a mail after more than 180 silent days starts the history over, keeping a user's spam mark", () => {
    const profile = trustedProfile(25, 60);
    profile.lastUserSpamAt = START;
    const later = foldSenderMail(profile, trustedFacts({ date: profile.lastSeenAt + TRUST_DECAY_MS + DAY }));
    expect(later).toMatchObject({ count: 1, lastUserSpamAt: START });
  });

  test("trust needs 20 mails over 30 days, 95 % authentication, no user spam, no decay and few junk mails", () => {
    const now = START + 61 * DAY;
    expect(evaluateSenderTrust(trustedProfile(25, 60), now)).toEqual({ trusted: true });
    expect(evaluateSenderTrust(null, now)).toMatchObject({ trusted: false });
    expect(evaluateSenderTrust(trustedProfile(19, 60), now)).toMatchObject({ trusted: false, reason: "zu wenige Mails" });
    expect(evaluateSenderTrust(trustedProfile(25, 20), now)).toMatchObject({ trusted: false, reason: "zu kurze Historie" });
    expect(evaluateSenderTrust(trustedProfile(25, 60, { auth: "unknown" }), now)).toMatchObject({ reason: "Authentifizierung zu selten" });
    expect(evaluateSenderTrust({ ...trustedProfile(25, 60), lastUserSpamAt: START }, now)).toMatchObject({ reason: "vom Nutzer als Spam markiert" });
    expect(evaluateSenderTrust(trustedProfile(25, 60), now + TRUST_DECAY_MS)).toMatchObject({ reason: "lange keine Mail" });
    expect(evaluateSenderTrust({ ...trustedProfile(25, 60), junkCount: 3 }, now)).toMatchObject({ reason: "oft im Spam-Ordner" });
  });

  test("household merge sums mailboxes, keeps the earliest start and any user spam; silent mailboxes only add the spam mark", () => {
    const now = START + 61 * DAY;
    const a = trustedProfile(12, 60);
    const b = trustedProfile(12, 40);
    const merged = mergeSenderProfiles([a, b], now)!;
    expect(merged).toMatchObject({ count: 24, firstSeenAt: START, lastSeenAt: START + 60 * DAY, lastUserSpamAt: null });
    expect(evaluateSenderTrust(merged, now).trusted).toBe(true);
    const revoked = { ...emptySenderProfile(a.senderKey, now), lastUserSpamAt: now - DAY };
    expect(mergeSenderProfiles([a, b, revoked], now)).toMatchObject({ count: 24, lastUserSpamAt: now - DAY });
    expect(mergeSenderProfiles([], now)).toBeNull();
  });

  test("patterns survive the row round trip", () => {
    const profile = trustedProfile(21, 45);
    const row = { senderKey: profile.senderKey, count: profile.count, firstSeenAt: profile.firstSeenAt, lastSeenAt: profile.lastSeenAt,
      lastUserSpamAt: null, patterns: serializeProfilePatterns(profile) };
    expect(senderProfileFromRow(row)).toEqual(profile);
    expect(senderProfileFromRow({ ...row, patterns: "not json" }).count).toBe(21);
  });

  test("the canary sample is deterministic and about 2 %", () => {
    const ids = Array.from({ length: 20_000 }, (_, index) => `imap-${index.toString(16)}`);
    const sampled = ids.filter((id) => isTrustCanary(id)).length;
    expect(sampled / ids.length).toBeGreaterThan(0.015);
    expect(sampled / ids.length).toBeLessThan(0.025);
    expect(ids.map((id) => isTrustCanary(id))).toEqual(ids.map((id) => isTrustCanary(id)));
  });
});
