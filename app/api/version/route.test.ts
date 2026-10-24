import { afterEach, describe, expect, test } from "bun:test";
import { getRunningBuild, resetRunningBuildForTests } from "@/lib/buildVersionFile";
import { GET } from "./route";

afterEach(resetRunningBuildForTests);

describe("GET /api/version", () => {
  test("answers the running build's label with no-store", async () => {
    resetRunningBuildForTests();
    getRunningBuild(() => ({ ok: true, buildVersionLabel: "0ac6cfa3d9e1 | 2026-10-23 13:16 UTC", hash: "0ac6cfa3d9e1b2c4", builtAt: "2026-10-23T13:16:05Z" }));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(await response.json()).toEqual({ ok: true, buildVersionLabel: "0ac6cfa3d9e1 | 2026-10-23 13:16 UTC" });
  });
});
