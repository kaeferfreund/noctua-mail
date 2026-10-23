import { describe, expect, test } from "bun:test";
import {
  GET,
  loadBuildVersionPayload,
  resetBuildVersionPayloadCacheForTests
} from "./route";

describe("build version file memo", () => {
  test("reads the build version file once per process", async () => {
    resetBuildVersionPayloadCacheForTests();
    let reads = 0;
    const reader = async () => {
      reads += 1;
      return { ok: true, buildVersionLabel: `label-${reads}` };
    };

    const [first, second] = await Promise.all([
      loadBuildVersionPayload(reader),
      loadBuildVersionPayload(reader)
    ]);
    const third = await loadBuildVersionPayload(reader);

    expect(reads).toBe(1);
    expect(first?.buildVersionLabel).toBe("label-1");
    expect(second?.buildVersionLabel).toBe("label-1");
    expect(third?.buildVersionLabel).toBe("label-1");
  });

  test("reads again after the cache is reset (process restart)", async () => {
    resetBuildVersionPayloadCacheForTests();
    let reads = 0;
    const reader = async () => {
      reads += 1;
      return { ok: true, buildVersionLabel: `label-${reads}` };
    };

    await loadBuildVersionPayload(reader);
    resetBuildVersionPayloadCacheForTests();
    const afterReset = await loadBuildVersionPayload(reader);

    expect(reads).toBe(2);
    expect(afterReset?.buildVersionLabel).toBe("label-2");
  });

  test("GET keeps the no-store response header", async () => {
    resetBuildVersionPayloadCacheForTests();
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    const body = (await response.json()) as { ok?: boolean; buildVersionLabel?: string };
    expect(body.ok).toBe(true);
    expect(typeof body.buildVersionLabel).toBe("string");
  });
});
