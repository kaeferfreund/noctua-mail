import { describe, expect, it } from "bun:test";
import { inviteCodeFromFragment, inviteSignupUrl, isWebUrl } from "./inviteLink";

describe("invite sign-up link", () => {
  it("builds the link from the given origin with the code in the fragment only", () => {
    const url = new URL(inviteSignupUrl("https://mail.example.test", "9f0c-ab"));
    expect(url.origin).toBe("https://mail.example.test");
    expect(url.pathname).toBe("/");
    expect(url.search).toBe("");
    expect(inviteCodeFromFragment(url.hash)).toBe("9f0c-ab");
  });
  it("ignores a path on the origin argument and encodes reserved characters", () => {
    const url = inviteSignupUrl("http://localhost:3000/some/path", "a&b c#d");
    expect(url.startsWith("http://localhost:3000/#invite=")).toBe(true);
    expect(inviteCodeFromFragment(new URL(url).hash)).toBe("a&b c#d");
  });
  it("reads no code from unrelated or empty fragments", () => {
    for (const hash of ["", "#", "#other=1", "#invite=", "#invite=%20%20"]) expect(inviteCodeFromFragment(hash)).toBeNull();
  });
  it("accepts only absolute http(s) URLs for a QR code", () => {
    expect(isWebUrl("https://mail.example.test/reset-password?token=x")).toBe(true);
    expect(isWebUrl("http://localhost:3000/")).toBe(true);
    expect(isWebUrl("9f0c-ab")).toBe(false);
    expect(isWebUrl("javascript:alert(1)")).toBe(false);
    expect(isWebUrl("mailto:someone@example.test")).toBe(false);
  });
});
