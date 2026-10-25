import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

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
  // The repository is public. Hosts, IPs and workspace paths of a real
  // installation belong in the operator's private notes, not here. The patterns
  // are generic so this file names nothing private itself; an operator can add
  // the concrete names of their installation through NOCTUA_PRIVATE_TERMS_FILE,
  // a file outside the repository with one term per line.
  const privatePatterns = [
    /[a-z0-9-]+\.ts\.net\b/i,
    /(?<![\d.])100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}(?!\d)/,
    /\/home\/(?!user\/)[a-z_][a-z0-9_-]*\//i,
  ];
  for (const sample of ["https://box.tailnet-name.ts.net:3790", "listen 100.100.7.9:443", "/home/alice/code"]) {
    expect(privatePatterns.some((pattern) => pattern.test(sample))).toBe(true);
  }
  const termsFile = process.env.NOCTUA_PRIVATE_TERMS_FILE;
  const privateTerms = termsFile && existsSync(termsFile)
    ? readFileSync(termsFile, "utf8").split("\n").map((line) => line.trim().toLowerCase()).filter((line) => line && !line.startsWith("#"))
    : [];
  const files = ["README.md", ...["doc", "deploy-scripts", ".github", "scripts"].flatMap((dir) =>
    readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
      .map((entry) => join(dir, entry))
      .filter((file) => statSync(join(root, file)).isFile()))];
  expect(files.length).toBeGreaterThan(20);
  const hits = files.flatMap((file) => {
    const bytes = readFileSync(join(root, file));
    const text = (file.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8");
    const lower = text.toLowerCase();
    return [
      ...privatePatterns.filter((pattern) => pattern.test(text)).map((pattern) => `${file}: ${pattern.source}`),
      ...privateTerms.flatMap((term, index) => (lower.includes(term) ? [`${file}: private term #${index + 1}`] : [])),
    ];
  });
  expect(hits).toEqual([]);
});
