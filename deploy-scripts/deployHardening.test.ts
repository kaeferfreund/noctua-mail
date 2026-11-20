import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dir, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("S12: the deploy script passes secrets to docker by name, never as argument values", () => {
  const script = read("deploy-scripts/deploy-instance.sh");
  for (const name of ["BETTER_AUTH_SECRET", "IMAP_SECRET_KEY"]) {
    expect(script).toMatch(new RegExp(`^\\s*-e ${name}$`, "m"));
    expect(script).not.toMatch(new RegExp(`-e ${name}=`));
  }
  expect(script).toMatch(/^export BETTER_AUTH_SECRET IMAP_SECRET_KEY$/m);
});

test("S2: deploy and container start keep the data directory private", () => {
  expect(read("deploy-scripts/deploy-instance.sh")).toContain(`chmod 700 "$DEPLOY_PATH/data-$INSTANCE"`);
  expect(read("deploy-scripts/container-entrypoint.sh")).toMatch(/^umask 077$/m);
});

test("A20/S13: the sample nginx config logs no tracking or unsubscribe token paths", () => {
  const config = read("deploy-scripts/nginx-auth.conf");
  const quiet = /location ~ (\S+) \{\s*access_log off;/.exec(config);
  expect(quiet).not.toBeNull();
  const pattern = new RegExp(quiet![1]);
  for (const uri of ["/t/u/synthetictoken", "/t/c/synthetictoken", "/t/o/synthetictoken", "/api/auth/sign-in", "/reset-password"]) {
    expect(pattern.test(uri)).toBe(true);
  }
  expect(pattern.test("/api/accounts")).toBe(false);
});

test("DS-16: no .env file can enter the Docker build context", () => {
  const rules = read(".dockerignore").split("\n").map(line => line.trim());
  expect(rules).toContain(".env");
  expect(rules).toContain(".env*");
});
