import { describe, expect, test } from "bun:test";
import { assessSenderTrust } from "./anomaly";
import type { SenderMailRecord } from "./profileBuild";
import { householdProfiles, type AccountProfiles, type ProfileFile } from "./profileFile";
import { DAY, START, ownAddresses, trustedFacts, trustedInput } from "./testProfiles";

const senderKey = "notify@service.example.test";
const at = (index: number) => START + index * 2 * DAY;
/** 30 mails every two days; the last one links to a domain no earlier mail used. */
const mails: SenderMailRecord[] = Array.from({ length: 30 }, (_, index) => ({
  ...trustedFacts({ date: at(index), linkHosts: index === 29 ? ["new.example.invalid"] : ["app.service.example.test"] }), id: `m${index}`
}));
const account = (overrides: Partial<AccountProfiles> = {}): AccountProfiles =>
  ({ mails: { [senderKey]: mails }, junkMails: {}, userSpam: {}, inboxMails: {}, rows: mails.length, withSource: mails.length, ...overrides });
const file = (accounts: Record<string, AccountProfiles>): ProfileFile => ({ version: 2, generatedAt: "2026-10-24T00:00:00.000Z", accounts });
const judged = { ...trustedInput, linkDomains: ["new.example.invalid"], receivedAt: new Date(at(29)).toISOString() };

describe("eval sender histories", () => {
  test("a mail is judged without itself and later mail, so first-seen rules fire", async () => {
    const household = householdProfiles(file({ a: account() }), ownAddresses, "built", at(30));
    const context = household.context("a", "m29", at(29));
    expect((await context.loadProfile(senderKey, at(29)))?.count).toBe(29);
    const assessment = await assessSenderTrust(judged, context);
    expect(assessment).toMatchObject({ kind: "anomaly", anomalies: ["neue Link-Domain example.invalid"] });
    // With the whole history the new domain would already be known.
    const later = householdProfiles(file({ a: account() }), ownAddresses, "built", at(40)).context("a", "other", at(40));
    expect((await later.loadProfile(senderKey, at(40)))?.linkDomains["example.invalid"]).toBe(1);
  });

  test("mails with the same or a later arrival stay out; the first mail of a sender is never trusted", async () => {
    const household = householdProfiles(file({ a: account() }), ownAddresses, "built", at(30));
    expect((await household.context("a", "m10", at(29)).loadProfile(senderKey, at(29)))?.count).toBe(10);
    expect(await household.context("a", "m0", at(0)).loadProfile(senderKey, at(0))).toBeNull();
    expect(await assessSenderTrust({ ...trustedInput, receivedAt: new Date(at(0)).toISOString() }, household.context("a", "m0", at(0)))).toBeNull();
  });

  test("history is merged per household; a stored \"Als Spam\" in any mailbox revokes trust", async () => {
    const split = file({ a: account({ mails: { [senderKey]: mails.filter((_, index) => index % 2 === 0) } }),
      b: account({ mails: { [senderKey]: mails.filter((_, index) => index % 2 === 1) } }) });
    const household = householdProfiles(split, ownAddresses, "built", at(30));
    expect(household).toMatchObject({ senders: 1, trusted: 1 });
    expect((await household.context("a", "m28", at(28)).loadProfile(senderKey, at(28)))?.count).toBe(28);
    const revoked = householdProfiles(file({ a: account(), b: account({ mails: {}, userSpam: { [senderKey]: START } }) }), ownAddresses, "built", at(30));
    expect(revoked.trusted).toBe(0);
    expect(await assessSenderTrust({ ...trustedInput, receivedAt: new Date(at(29)).toISOString() }, revoked.context("a", "m29", at(29)))).toBeNull();
  });
});
