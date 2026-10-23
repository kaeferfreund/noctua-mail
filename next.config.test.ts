import { describe, expect, test } from "bun:test";

const PUBLIC_ASSET_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

describe("next.config headers", () => {
  test("gives public fonts and icons a bounded revalidating cache", async () => {
    const config = (await import("./next.config")).default;
    const headers = await config.headers!();

    // The icons rule names the static public files only; /icons/logo.svg
    // and /icons/badged/:size are dynamic deployment-label routes.
    for (const source of ["/fonts/:path*", "/icons/:file(icon-\\d+\\.png|base\\.svg)"]) {
      expect(headers).toContainEqual({
        source,
        headers: [{ key: "Cache-Control", value: PUBLIC_ASSET_CACHE_CONTROL }]
      });
    }
    // File names are not content-hashed, so the cache must stay revalidatable.
    expect(PUBLIC_ASSET_CACHE_CONTROL).not.toContain("immutable");
  });

  test("keeps the reset-password security headers unchanged", async () => {
    const config = (await import("./next.config")).default;
    const headers = await config.headers!();

    expect(headers).toContainEqual({
      source: "/reset-password",
      headers: [
        { key: "Cache-Control", value: "no-store" },
        { key: "Referrer-Policy", value: "no-referrer" }
      ]
    });
    // runtime-config.js is regenerated per deployment label and must stay
    // revalidated: no rule may give it (or any other public root file) a
    // long-lived cache.
    expect(headers.some((entry) => entry.source.includes("runtime-config"))).toBe(false);
    expect(headers.map((entry) => entry.source).sort()).toEqual([
      "/fonts/:path*",
      "/icons/:file(icon-\\d+\\.png|base\\.svg)",
      "/reset-password"
    ]);
    expect(headers.some((entry) => entry.source === "/icons/:path*")).toBe(false);
  });
});
