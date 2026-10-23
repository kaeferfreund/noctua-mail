import { describe, expect, test } from "bun:test";
import { redactAuthUrl } from "./authRecoveryContext";

const capability = "synthetic-reset-capability";
const origin = "http://localhost";
const page = `${origin}/reset-password`;
const callback = `${origin}/api/ba/reset-password/[REDACTED]`;

// Request targets as the launcher sees them; each must lose the capability but keep its route.
const resetTargets: [target: string, logged: string][] = [
  [`/reset-password?token=${capability}`, page],
  [`/reset-password?token=${capability}#fragment`, page],
  [`/api/ba/reset-password/${capability}?callbackURL=http%3A%2F%2Flocalhost%2Freset-password`, callback],
  [`/reset-password/?token=${capability}`, page],
  [`/RESET-PASSWORD?token=${capability}`, page],
  [`/Reset-Password?Token=${capability}`, page],
  [`//reset-password?token=${capability}`, page],
  [`///reset-password//?token=${capability}`, page],
  [`/reset%2Dpassword?token=${capability}`, page],
  [`/reset%252Dpassword?token=${capability}`, page],
  [`/%72eset-password?token=${capability}`, page],
  [`/reset-password.?token=${capability}`, page],
  [`/reset-password;a?token=${capability}`, page],
  [`/reset-password;?token=${capability}`, page],
  [`/reset-password%20?token=${capability}`, page],
  [`/reset-password%3Ftoken=${capability}`, page],
  [`/reset-password%253Ftoken%253D${capability}`, page],
  [`/reset-password%23token=${capability}`, page],
  [`/reset-password/${capability}`, `${page}/[REDACTED]`],
  [`/other/..%2Freset-password?token=${capability}`, page],
  [`/%2e%2e/reset-password?token=${capability}`, page],
  [`/api/ba//reset-password/${capability}`, callback],
  [`/api/ba/Reset-Password/${capability}`, callback],
  [`/API/BA/RESET-PASSWORD/${capability}`, callback],
  [`//api//ba/reset-password/${capability}/`, callback],
  [`/api/ba/reset%2Dpassword/${capability}`, callback],
  [`/api%2Fba%2Freset-password%2F${capability}`, callback],
  [`/api/ba/reset-password;x/${capability}`, callback],
  [`/api/ba/reset-password./${capability}`, callback],
  [`/api/ba/./reset-password/${capability}`, callback]
];

function logged(target: string) {
  // The launcher's parse: origin-form targets are paths below the local origin.
  return redactAuthUrl(new URL(`${origin}${target}`).href);
}

describe("redactAuthUrl reset routes", () => {
  for (const [target, expected] of resetTargets) test(`redacts ${target}`, () => {
    const result = logged(target);
    expect(result).not.toContain(capability);
    expect(result).toBe(expected);
  });

  test("redacts absolute-form, credentialed and scheme-relative spellings", () => {
    for (const value of [
      `https://user:pass@mail.example.test/reset-password?token=${capability}`,
      `https://mail.example.test/RESET-PASSWORD/?token=${capability}`,
      `https://mail.example.test/api/ba/Reset-Password/${capability}`
    ]) {
      const result = redactAuthUrl(value);
      expect(result).not.toContain(capability);
      expect(result).not.toContain("pass@");
      expect(result).toMatch(/^https:\/\/mail\.example\.test\/(api\/ba\/)?reset-password/);
    }
  });
});

describe("redactAuthUrl capability parameters on other routes", () => {
  const cases: [target: string, logged: string][] = [
    [`/api/ba/verify-email?token=${capability}&callbackURL=%2F`, `${origin}/api/ba/verify-email?token=%5BREDACTED%5D&callbackURL=%2F`],
    [`/api/ba/delete-user/callback?TOKEN=${capability}`, `${origin}/api/ba/delete-user/callback?TOKEN=%5BREDACTED%5D`],
    [`/any?code=${capability}&state=s`, `${origin}/any?code=%5BREDACTED%5D&state=s`],
    [`/any?otp=${capability}`, `${origin}/any?otp=%5BREDACTED%5D`],
    [`/any?inviteCode=${capability}`, `${origin}/any?inviteCode=%5BREDACTED%5D`],
    [`/any?backup_code=${capability}`, `${origin}/any?backup_code=%5BREDACTED%5D`],
    [`/any?secret=${capability}`, `${origin}/any?secret=%5BREDACTED%5D`],
    [`/any?access_token=${capability}`, `${origin}/any?access_token=%5BREDACTED%5D`],
    [`/any?%74oken=${capability}`, `${origin}/any?token=%5BREDACTED%5D`],
    [`/any?%2574oken=${capability}`, `${origin}/any?%2574oken=%5BREDACTED%5D`],
    [`/any#token=${capability}`, `${origin}/any`],
    [`/any%3Ftoken%3D${capability}`, `${origin}/any/[REDACTED]`],
    [`/any?callbackURL=%2Freset-password%3Ftoken%3D${capability}`, `${origin}/any?callbackURL=%2Freset-password`],
    [`/any?next=http%3A%2F%2Flocalhost%2Fx%3Fcode%3D${capability}`, `${origin}/any?next=http%3A%2F%2Flocalhost%2Fx%3Fcode%3D%255BREDACTED%255D`]
  ];
  for (const [target, expected] of cases) test(`redacts ${target}`, () => {
    const result = logged(target);
    expect(result).not.toContain(capability);
    expect(result).toBe(expected);
  });

  test("leaves URLs without capabilities unchanged", () => {
    for (const target of ["/", "/api/accounts/a1/threads?q=synthetic&page=2&groupBy=date", "/compose/window?handoff=h1", "/api/ba/get-session"])
      expect(logged(target)).toBe(`${origin}${target}`);
  });

  test("reports unparseable values without throwing", () => {
    for (const value of ["", "/reset-password?token=relative", "http://[bad"]) expect(redactAuthUrl(value)).toBe("[invalid-url]");
  });
});
