import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file: string) => readFileSync(join(root, file), "utf8");

test("active deployment documents agree on canonical auth, DB credentials and personal recovery", () => {
  // The README is the public entry point and names only the auth model and the
  // settings; the two ops docs add the deployment shape with placeholder hosts.
  const generic = ["Better Auth", "BETTER_AUTH_URL", "PASSKEY_RP_ID", "NOCTUA_IMAP_LOGIN_HOSTS", "IMAP_CREDENTIALS_STORAGE", "personally"];
  const deployment = ["DNS-01", "mail.example.org", "preview.example.org:3790"];
  for (const file of ["README.md", "doc/AUTHENTICATION.md", "doc/DEPLOYMENT.md"]) {
    const text = read(file);
    for (const term of file === "README.md" ? generic : [...generic, ...deployment]) expect(text).toContain(term);
    expect(text).not.toContain("SESSION_SEAL_KEY=<");
    expect(text).not.toContain("IMAP_CREDENTIALS_STORAGE=both");
  }
});

test("public docs, deploy scripts and CI config name no private deployment details", () => {
  // The repository is public. Hosts, IPs, provider ids and workspace paths of a
  // real installation belong in the operator's private notes, not here.
  const privateTokens = ["tailnet-example", "203.0.113.", "preview-host", "examplemed", "mx1", "mailprovider", "/home/user"];
  const files = ["README.md", ...["doc", "deploy-scripts", ".github", "scripts"].flatMap((dir) =>
    readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
      .map((entry) => join(dir, entry))
      .filter((file) => statSync(join(root, file)).isFile()))];
  expect(files.length).toBeGreaterThan(20);
  const hits = files.flatMap((file) => {
    const text = read(file).toLowerCase();
    return privateTokens.filter((token) => text.includes(token)).map((token) => `${file}: ${token}`);
  });
  expect(hits).toEqual([]);
});
