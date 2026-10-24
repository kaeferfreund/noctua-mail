import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getRunningBuild, readBuildVersionFile, resetRunningBuildForTests } from "./buildVersionFile";

const HASH = "0ac6cfa3d9e1b2c4f5a6b7c8d9e0f1a2b3c4d5e6";
afterEach(resetRunningBuildForTests);

describe("build version file", () => {
  test("reads the artifact written at build time and tolerates a missing or broken file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "build-version-"));
    try {
      const file = path.join(dir, "build-version.json");
      expect(readBuildVersionFile(file)).toBeNull();
      writeFileSync(file, "{ not json");
      expect(readBuildVersionFile(file)).toBeNull();
      writeFileSync(file, JSON.stringify({ ok: true, buildVersionLabel: "label", hash: HASH, builtAt: "2026-10-23T13:16:05Z" }));
      expect(readBuildVersionFile(file)).toEqual({ ok: true, buildVersionLabel: "label", hash: HASH, builtAt: "2026-10-23T13:16:05Z" });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("reads the artifact once per process", () => {
    let reads = 0;
    const read = () => ({ ok: true as const, buildVersionLabel: `label-${++reads}`, hash: HASH });
    expect(getRunningBuild(read).label).toBe("label-1");
    expect(getRunningBuild(read).label).toBe("label-1");
    expect(reads).toBe(1);
    resetRunningBuildForTests();
    expect(getRunningBuild(read).label).toBe("label-2");
  });
});
