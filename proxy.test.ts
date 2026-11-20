import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
// Next compiles matcher sources with this parser. Its testing helpers ("next/experimental/testing/server")
// are not used: loaded after "next/server", they break route tests that run later in the same process.
import { tryToParsePath } from "next/dist/lib/try-to-parse-path";
import { config, proxy } from "./proxy";

describe("page Content-Security-Policy proxy", () => {
  test("sends a fresh nonce policy to the browser and to the renderer", () => {
    const first = proxy(new NextRequest("http://localhost:3000/"));
    const second = proxy(new NextRequest("http://localhost:3000/"));
    const policy = first.headers.get("content-security-policy") ?? "";
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
    expect(nonce).toBeTruthy();
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(second.headers.get("content-security-policy")).not.toBe(policy);
    // NextResponse.next({ request }) forwards overridden request headers this way.
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce!);
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
  });

  test("runs for pages, not for API, tracking, icon or static file routes", () => {
    const [matcher] = config.matcher;
    const pattern = new RegExp(tryToParsePath(matcher.source).regexStr!);
    for (const path of ["/", "/compose/window", "/message/window", "/calendar/window", "/calendar/import",
      "/reset-password", "/newsletter", "/settings"]) {
      expect({ path, match: pattern.test(path) }).toEqual({ path, match: true });
    }
    for (const path of ["/api/ba/ok", "/api/accounts/a/messages/m/attachments/x", "/_next/static/chunks/app.js",
      "/t/u/synthetic-token", "/icons/badged/256", "/sw.js", "/runtime-config.js", "/manifest.webmanifest",
      "/fonts/inter.woff2", "/favicon.png"]) {
      expect({ path, match: pattern.test(path) }).toEqual({ path, match: false });
    }
    // Router prefetches render no HTML document.
    expect(matcher.missing).toEqual([
      { type: "header", key: "next-router-prefetch" },
      { type: "header", key: "purpose", value: "prefetch" }
    ]);
  });
});
