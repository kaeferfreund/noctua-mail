import { describe, expect, it } from "bun:test";
import { getBuildInfo, getBuildVersionLabel } from "./buildVersion";

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
