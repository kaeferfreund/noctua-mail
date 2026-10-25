import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("active deployment documents agree on canonical auth, DB credentials and personal recovery", () => {
  // The README is the public entry point and names only the auth model and the
  // settings; the household's hosts, IP and preview URL live in the two ops docs.
  const generic = ["Better Auth", "BETTER_AUTH_URL", "PASSKEY_RP_ID", "NOCTUA_IMAP_LOGIN_HOSTS", "IMAP_CREDENTIALS_STORAGE", "personally"];
  const deployment = ["mail.example.org", "203.0.113.10", "mailprovider", "DNS-01", "preview.example.org:3790"];
  for (const file of ["README.md", "doc/AUTHENTICATION.md", "doc/DEPLOYMENT.md"]) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const term of file === "README.md" ? generic : [...generic, ...deployment]) expect(text).toContain(term);
    expect(text).not.toContain("SESSION_SEAL_KEY=<");
    expect(text).not.toContain("IMAP_CREDENTIALS_STORAGE=both");
  }
});
