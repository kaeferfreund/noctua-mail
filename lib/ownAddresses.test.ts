import { describe, test, expect } from "bun:test";
import { getOwnAddresses, isOwnAddress, normalizeIdentityEmail, ownAddressMatcher, parseAddressEmails } from "./ownAddresses";

describe("own addresses", () => {
  test("canonical IDNA, plus tags and dots; reject lists, display syntax and controls", () => {
    expect(normalizeIdentityEmail(" A.B+Tag@BÜCHER.example ")).toBe("a.b+tag@xn--bcher-kva.example");
    for (const value of ["a@example.test,b@example.test", "A <a@example.test>", "a@example.test\r\nBcc: b@example.test", "a@bad..test", "a@-bad.test", "a@example.test/path", "a..b@example.test", "a@example.test\t"]) {
      expect(normalizeIdentityEmail(value)).toBeNull();
    }
    expect(parseAddressEmails('"Example, Person" <ALIAS@example.test>, invalid, other@example.test')).toEqual(["alias@example.test", "other@example.test"]);
  });
  test("disabled addresses remain own; foreign mailbox, Reply-To and substring matches are excluded", () => {
    const own = getOwnAddresses({ id: "a", email: "Primary@example.test" }, [
      { accountId: "a", email: "alias@example.test" }, { accountId: "b", email: "foreign@example.test" }
    ]);
    expect(own).toEqual(["primary@example.test", "alias@example.test"]);
    expect(isOwnAddress('"Alias" <ALIAS@example.test>', own)).toBe(true);
    for (const address of ["notalias@example.test", "foreign@example.test", "reply@example.test", '"alias@example.test" <external@example.test>']) {
      expect(isOwnAddress(address, own)).toBe(false);
    }
    const isOwn = ownAddressMatcher(own);
    for (const address of ['"Alias" <ALIAS@example.test>', "primary@example.test", "notalias@example.test", "foreign@example.test", null, ""]) {
      expect(isOwn(address)).toBe(isOwnAddress(address, own));
    }
  });
});

test("RFC recipient comments, quoted names and groups preserve only actual mailbox evidence", () => {
  expect(parseAddressEmails('Team: "alias@example.test" <customer@example.test> (customer), alias@example.test\t(original (recipient)), "Comma, Name" <idn@bücher.example>;')).toEqual([
    "customer@example.test", "alias@example.test", "idn@xn--bcher-kva.example"
  ]);
  for (const value of ['"alias@example.test"', '(alias@example.test)', 'alias@example.test\r\nBcc: other@example.test']) {
    expect(parseAddressEmails(value)).toEqual([]);
  }
});
