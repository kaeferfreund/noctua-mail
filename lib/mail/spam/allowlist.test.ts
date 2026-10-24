import { describe, expect, test } from "bun:test";
import { buildOwnIdentitySets, matchSpamAllowlist, type SpamAllowlistContext } from "./allowlist";
import { buildSpamInputFromMessage } from "./input";

const sets = buildOwnIdentitySets(["Office@Household.example.test", "owner@gmail.com", "not-an-address"]);
function context(overrides: Partial<SpamAllowlistContext> = {}): SpamAllowlistContext {
  return { ...sets, isCorrespondent: async () => false, latestDecision: async () => null, ...overrides };
}
const pass = (domain: string) => [`mxe.example.test; spf=pass smtp.mailfrom=bounce@${domain}; dkim=pass header.d=${domain}`];
const from = (address: string, authenticationResults: string[] = pass(address.replace(/^.*@|>$/g, ""))) =>
  ({ ...buildSpamInputFromMessage({ from: address, to: "office@household.example.test", subject: "S" }), authenticationResults });

describe("spam allowlist", () => {
  test("own addresses and own domains, but never a free-mail domain", async () => {
    expect(sets.ownDomains).toEqual(new Set(["household.example.test"]));
    expect(await matchSpamAllowlist(from("office@household.example.test"), context())).toBe("own-address");
    expect(await matchSpamAllowlist(from("Kollegin <kollegin@household.example.test>"), context())).toBe("own-domain");
    expect(await matchSpamAllowlist(from("owner@gmail.com"), context())).toBe("own-address");
    expect(await matchSpamAllowlist(from("stranger@gmail.com"), context())).toBeNull();
  });

  test("own addresses and domains need SPF or DKIM pass for the sender's domain", async () => {
    expect(await matchSpamAllowlist(from("office@household.example.test", ["mxe.example.test; spf=none smtp.mailfrom=x@forged.example"]), context())).toBeNull();
    expect(await matchSpamAllowlist(from("office@household.example.test", pass("forged.example")), context())).toBeNull();
    expect(await matchSpamAllowlist(from("office@household.example.test", []), context())).toBeNull();
    expect(await matchSpamAllowlist(from("office@household.example.test", ["mxe.example.test; spf=fail smtp.mailfrom=office@household.example.test; dkim=pass header.d=household.example.test"]), context()))
      .toBe("own-address");
  });

  test("only the authenticated identity counts: HELO, selectors, other properties and comments never do", async () => {
    const own = (result: string) => matchSpamAllowlist(from("office@household.example.test", [`mxe.example.test; ${result}`]), context());
    expect(await own("spf=pass smtp.mailfrom=bounce@attacker.example smtp.helo=household.example.test")).toBeNull();
    expect(await own("spf=pass smtp.helo=household.example.test")).toBeNull();
    expect(await own("dkim=pass header.d=attacker.example header.s=household.example.test")).toBeNull();
    expect(await own("dkim=pass header.d=attacker.example policy.d=household.example.test")).toBeNull();
    expect(await own("spf=pass (household.example.test) smtp.mailfrom=x@attacker.example x.y=household.example.test")).toBeNull();
    expect(await own("dkim=pass header.d=attacker.example (header.d=household.example.test)")).toBeNull();
    expect(await own("spf=pass smtp.mailfrom=bounce@mail.household.example.test smtp.helo=out.attacker.example")).toBe("own-address");
    expect(await own("dkim=pass header.i=@household.example.test")).toBe("own-address");
  });

  test("correspondents and explicit decisions", async () => {
    expect(await matchSpamAllowlist(from("partner@example.test"), context({ isCorrespondent: async (email) => email === "partner@example.test" })))
      .toBe("correspondent");
    expect(await matchSpamAllowlist(from("news@example.test"), context({ latestDecision: async () => "ham" }))).toBe("user-decision");
    // A later "Als Spam" outranks having written to the sender.
    expect(await matchSpamAllowlist(from("partner@example.test"), context({ isCorrespondent: async () => true, latestDecision: async () => "spam" })))
      .toBeNull();
  });

  test("correspondents and \"Kein Spam\" senders need authentication for the sender when the server reports any", async () => {
    const known = context({ isCorrespondent: async () => true });
    const decided = context({ latestDecision: async () => "ham" });
    const forged = ["mxe.example.test; spf=pass smtp.mailfrom=bounce@attacker.example; dkim=pass header.d=attacker.example"];
    expect(await matchSpamAllowlist(from("Partner <partner@example.test>", forged), known)).toBeNull();
    expect(await matchSpamAllowlist(from("news@example.test", forged), decided)).toBeNull();
    expect(await matchSpamAllowlist(from("partner@example.test", ["mxe.example.test; spf=fail smtp.mailfrom=partner@example.test"]), known)).toBeNull();
    expect(await matchSpamAllowlist(from("partner@example.test"), known)).toBe("correspondent");
    // Without any Authentication-Results there is nothing to judge.
    expect(await matchSpamAllowlist(from("partner@example.test", []), known)).toBe("correspondent");
  });
});
