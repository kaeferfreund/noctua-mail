import { describe, expect, test } from "bun:test";
// Next compiles header sources with this parser. Its testing helpers ("next/experimental/testing/server")
// are not used: loaded after "next/server", they break route tests that run later in the same process.
import { tryToParsePath } from "next/dist/lib/try-to-parse-path";

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
      "/((?!api/).*)",
      "/:path*",
      "/api/:path*",
      "/fonts/:path*",
      "/api/ba/reset-password",
      "/api/ba/reset-password/:path*",
      "/icons/:file(icon-\\d+\\.png|base\\.svg)",
      "/reset-password"
    ]);
    expect(headers.some((entry) => entry.source === "/icons/:path*")).toBe(false);
  });
});

describe("next.config security headers", () => {
  // Every matching rule applies; for the same key the later rule wins.
  const responseHeaders = async (path: string) => {
    const rules = await (await import("./next.config")).default.headers!();
    const result = new Map<string, string>();
    for (const rule of rules) {
      if (!new RegExp(tryToParsePath(rule.source).regexStr!).test(path)) continue;
      for (const { key, value } of rule.headers) result.set(key.toLowerCase(), value);
    }
    return result;
  };

  test("forbids framing of pages and type sniffing everywhere", async () => {
    for (const path of ["/", "/compose/window", "/reset-password", "/t/u/synthetic-token", "/sw.js"]) {
      const headers = await responseHeaders(path);
      expect({ path, frame: headers.get("x-frame-options") }).toEqual({ path, frame: "DENY" });
      expect({ path, sniff: headers.get("x-content-type-options") }).toEqual({ path, sniff: "nosniff" });
    }
  });

  test("lets Noctua frame its own API documents", async () => {
    for (const path of ["/api/accounts/a/messages/m/attachments/x", "/api/accounts/a/messages/m/html"]) {
      const headers = await responseHeaders(path);
      expect({ path, frame: headers.get("x-frame-options") }).toEqual({ path, frame: "SAMEORIGIN" });
      expect({ path, sniff: headers.get("x-content-type-options") }).toEqual({ path, sniff: "nosniff" });
    }
  });

  test("sends no referrer to other sites and none at all from the reset page", async () => {
    expect((await responseHeaders("/")).get("referrer-policy")).toBe("same-origin");
    expect((await responseHeaders("/reset-password")).get("referrer-policy")).toBe("no-referrer");
    // The handover redirect and the reset POST carry the token in the URL.
    for (const path of ["/api/ba/reset-password/synthetic-token", "/api/ba/reset-password"]) {
      expect({ path, policy: (await responseHeaders(path)).get("referrer-policy") }).toEqual({ path, policy: "no-referrer" });
    }
  });
});

describe("next.config request logging", () => {
  test("keeps every reset-password spelling out of the incoming request log", async () => {
    const config = (await import("./next.config")).default;
    const logging = config.logging as { incomingRequests: { ignore: RegExp[] } };
    const ignored = (url: string) => logging.incomingRequests.ignore.some((pattern) => pattern.test(url));

    for (const url of [
      "/reset-password?token=synthetic-token",
      "/reset-password",
      "/api/ba/reset-password/synthetic-token?callbackURL=%2Freset-password",
      // Non-canonical spellings from the security recheck (F2).
      "/reset-password/?token=synthetic-token",
      "/RESET-PASSWORD?token=synthetic-token",
      "/reset-password;a?token=synthetic-token",
      "/%72eset-password?token=synthetic-token",
      "/reset%2Dpassword?token=synthetic-token",
      "/reset-password%3Ftoken=synthetic-token",
      "/api/ba//reset-password/synthetic-token",
      "/api/ba/Reset-Password/synthetic-token",
      // Percent encodings of the upper-case letters, in both hex-digit cases.
      "/%52ESET-PASSWORD?token=synthetic-token",
      "/%52eset-password?token=synthetic-token",
      "/reset-%50assword?token=synthetic-token",
      "/%52%45%53%45%54%2D%50%41%53%53%57%4F%52%44?token=synthetic-token",
      "/%52%45%53%45%54%2d%50%41%53%53%57%4f%52%44?token=synthetic-token",
      "/%72%65%73%65%74%2d%70%61%73%73%77%6f%72%64?token=synthetic-token",
      "/api/ba/RESET%2DPASSWOR%44/synthetic-token"
    ]) expect({ url, ignored: ignored(url) }).toEqual({ url, ignored: true });

    for (const url of [
      "/", "/api/ba/sign-in/email", "/api/ba/request-password-reset", "/settings/password",
      // Encodings of other characters must not match.
      "/%53eset-password", "/reset-%51assword", "/reset%5Fpassword"
    ]) {
      expect({ url, ignored: ignored(url) }).toEqual({ url, ignored: false });
    }
  });

  test("keeps the outreach token paths out of the incoming request log", async () => {
    const config = (await import("./next.config")).default;
    const logging = config.logging as { incomingRequests: { ignore: RegExp[] } };
    const ignored = (url: string) => logging.incomingRequests.ignore.some((pattern) => pattern.test(url));

    for (const url of [
      "/t/u/synthetic-token", "/t/o/synthetic-token.gif", "/t/c/synthetic-token?x=1", "/t/ses-events",
      `/t/m/${"a".repeat(64)}.png`,
      "//t/u/synthetic-token", "/%74/u/synthetic-token", "/%54/u/synthetic-token", "/T/u/synthetic-token",
      "https://links.example.test/t/u/synthetic-token"
    ]) expect({ url, ignored: ignored(url) }).toEqual({ url, ignored: true });

    for (const url of ["/", "/topics", "/api/accounts/t/messages", "/api/t/u/x", "/calendar?t=/t/u/x"]) {
      expect({ url, ignored: ignored(url) }).toEqual({ url, ignored: false });
    }
  });
});
