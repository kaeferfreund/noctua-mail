import { afterAll, expect, test } from "bun:test";
import { chmodSync, lstatSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readPrivateJson, writePrivateJson } from "./privateReport";

const dir = mkdtempSync(path.join(tmpdir(), "spam-report-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("S22: reports are owner-only and never written through an existing link", () => {
  const previous = process.umask(0o022);
  try {
    const victim = path.join(dir, "victim.txt");
    writeFileSync(victim, "untouched");
    const report = path.join(dir, "report.json");
    symlinkSync(victim, report);
    writePrivateJson(report, { items: [{ subject: "Synthetic subject", fromEmail: "sender@example.test" }] });
    expect(readFileSync(victim, "utf8")).toBe("untouched");
    expect(lstatSync(report).isSymbolicLink()).toBe(false);
    expect(statSync(report).mode & 0o777).toBe(0o600);
    expect(readPrivateJson(report)).toEqual({ items: [{ subject: "Synthetic subject", fromEmail: "sender@example.test" }] });
    // Rewriting the own report (resumed runs) still works.
    writePrivateJson(report, { items: [] });
    expect(readPrivateJson(report)).toEqual({ items: [] });
  } finally { process.umask(previous); }
});

test("S22: an input others could have changed is refused", () => {
  const shared = path.join(dir, "shared.json");
  writeFileSync(shared, "{}");
  chmodSync(shared, 0o666);
  expect(() => readPrivateJson(shared)).toThrow("must not be writable by others");
  const linked = path.join(dir, "linked.json");
  symlinkSync(shared, linked);
  expect(() => readPrivateJson(linked)).toThrow();
});
