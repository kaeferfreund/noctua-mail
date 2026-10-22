import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("active deployment documents agree on canonical auth, DB credentials and personal recovery", () => {
  for (const file of ["README.md", "doc/AUTHENTICATION.md", "doc/DEPLOYMENT.md"]) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const term of ["Better Auth", "BETTER_AUTH_URL", "mails.monkeymed.de", "PASSKEY_RP_ID", "100.92.134.1", "netcup", "DNS-01", "NOCTUA_IMAP_LOGIN_HOSTS", "IMAP_CREDENTIALS_STORAGE", "remote-arm.tail31b4a1.ts.net:3790", "personally"]) expect(text).toContain(term);
    expect(text).not.toContain("SESSION_SEAL_KEY=<");
    expect(text).not.toContain("IMAP_CREDENTIALS_STORAGE=both");
  }
});
