import { describe, expect, it } from "bun:test";
import { createBuildVersionPayload, getBuildInfo, getBuildVersionLabel, resolveRunningBuild } from "./buildVersion";

const HASH = "0ac6cfa3d9e1b2c4f5a6b7c8d9e0f1a2b3c4d5e6";

describe("getBuildInfo", () => {
  it("returns the full and short commit hash with the build time as UTC ISO", () => {
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: ` ${HASH}\n`, NOCTUA_BUILD_TIME: "2026-10-23T13:16:05Z" })).toEqual({
      hash: HASH, shortHash: "0ac6cfa", builtAt: "2026-10-23T13:16:05Z"
    });
  });

  it("normalizes offsets and fractional seconds to UTC", () => {
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: "2026-10-23T15:16:05.250+02:00" })?.builtAt)
      .toBe("2026-10-23T13:16:05.250Z");
  });

  it("reads the CI stamp without an offset as UTC", () => {
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: "2026-10-23 13:16" })?.builtAt)
      .toBe("2026-10-23T13:16:00Z");
  });

  it("falls back to the NEXT_PUBLIC variables", () => {
    expect(getBuildInfo({ NEXT_PUBLIC_BUILD_HASH: HASH, NEXT_PUBLIC_BUILD_TIME: "2026-03-29T00:59:59Z" })).toEqual({
      hash: HASH, shortHash: "0ac6cfa", builtAt: "2026-03-29T00:59:59Z"
    });
  });

  it("prefers the NOCTUA variables over the NEXT_PUBLIC ones", () => {
    expect(getBuildInfo({
      NOCTUA_BUILD_HASH: "1111111aaaa", NEXT_PUBLIC_BUILD_HASH: HASH,
      NOCTUA_BUILD_TIME: "2026-10-23T13:16:05Z", NEXT_PUBLIC_BUILD_TIME: "2020-01-01T00:00:00Z"
    })).toEqual({ hash: "1111111aaaa", shortHash: "1111111", builtAt: "2026-10-23T13:16:05Z" });
  });

  it("treats a blank NOCTUA variable as unset", () => {
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: "", NEXT_PUBLIC_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: " ", NEXT_PUBLIC_BUILD_TIME: "2026-10-23T13:16:05Z" }))
      .toEqual({ hash: HASH, shortHash: "0ac6cfa", builtAt: "2026-10-23T13:16:05Z" });
  });

  it("strips a sha256 digest prefix", () => {
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: `sha256:${HASH}` })?.shortHash).toBe("0ac6cfa");
  });

  it("returns null without a build hash", () => {
    expect(getBuildInfo({})).toBeNull();
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: "  ", NOCTUA_BUILD_TIME: "2026-10-23T13:16:05Z" })).toBeNull();
  });

  it("keeps the hash when the build time is missing or not a date-time", () => {
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: HASH })?.builtAt).toBeNull();
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: "yesterday" })?.builtAt).toBeNull();
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: "2026-13-45T99:99:99Z" })?.builtAt).toBeNull();
    // Date.parse would roll these over into the next month or day.
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: "2026-02-30T10:00:00Z" })?.builtAt).toBeNull();
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: "2026-04-31 10:00" })?.builtAt).toBeNull();
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: "2026-10-23T24:00:00Z" })?.builtAt).toBeNull();
    expect(getBuildInfo({ NOCTUA_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: "2028-02-29T23:59:59+01:00" })?.builtAt).toBe("2028-02-29T22:59:59Z");
  });
});

describe("getBuildVersionLabel", () => {
  it("keeps the twelve-character hash and minute stamp for existing callers", () => {
    expect(getBuildVersionLabel({ NOCTUA_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: "2026-10-23T13:16:05Z" }))
      .toStartWith("0ac6cfa3d9e1 | 2026-10-23 13:16");
    expect(getBuildVersionLabel({ NOCTUA_BUILD_HASH: HASH })).toBe("0ac6cfa3d9e1");
    expect(getBuildVersionLabel({})).toBe("");
  });
});

describe("running build", () => {
  const env = { NOCTUA_BUILD_HASH: HASH, NOCTUA_BUILD_TIME: "2026-10-23T13:16:05Z" };

  it("records the build-time identity in the artifact", () => {
    const payload = createBuildVersionPayload(env);
    expect(payload).toMatchObject({ ok: true, hash: HASH, builtAt: "2026-10-23T13:16:05Z" });
    expect(payload.buildVersionLabel).toStartWith("0ac6cfa3d9e1 | 2026-10-23 13:16");
    expect(createBuildVersionPayload({})).toEqual({ ok: true, buildVersionLabel: "" });
  });

  it("reads the identity from the artifact even without runtime variables (Docker image)", () => {
    expect(resolveRunningBuild(createBuildVersionPayload(env), {})).toEqual({
      label: createBuildVersionPayload(env).buildVersionLabel,
      info: { hash: HASH, shortHash: "0ac6cfa", builtAt: "2026-10-23T13:16:05Z" }
    });
  });

  it("prefers the artifact over a runtime environment that describes another build", () => {
    const running = resolveRunningBuild(createBuildVersionPayload(env), { NOCTUA_BUILD_HASH: "1111111aaaa", NOCTUA_BUILD_TIME: "2026-10-25T00:30:00Z" });
    expect(running.info?.hash).toBe(HASH);
    expect(running.label).toStartWith("0ac6cfa3d9e1");
  });

  it("uses the runtime environment only when the artifact has no identity", () => {
    for (const file of [null, { ok: true as const, buildVersionLabel: "" }]) {
      expect(resolveRunningBuild(file, env).info).toEqual({ hash: HASH, shortHash: "0ac6cfa", builtAt: "2026-10-23T13:16:05Z" });
      expect(resolveRunningBuild(file, env).label).toStartWith("0ac6cfa3d9e1 | 2026-10-23 13:16");
      expect(resolveRunningBuild(file, {})).toEqual({ label: "", info: null });
    }
    // An older artifact without a hash still supplies its label.
    expect(resolveRunningBuild({ ok: true, buildVersionLabel: "old-label" }, {}).label).toBe("old-label");
  });
});
