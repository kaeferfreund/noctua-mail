import { describe, expect, mock, test } from "bun:test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { LookupFn } from "@/lib/net/urlSafety";
import { pinnedHttpTransport, type HopResponse, type HopTransport, type PinnedHop } from "@/lib/net/publicHttp";
import { parseListUnsubscribeUrls, performOneClickUnsubscribe } from "./route";

const hopResponse = (status: number, headers: Record<string, string> = {}): HopResponse =>
  ({ status, statusText: "", headers: new Headers(headers), body: new Uint8Array() });

// These tests cover the SSRF guard around the RFC 8058 one-click POST.
// `assertPublicUrl` itself is covered exhaustively in lib/net/urlSafety.test.ts;
// here we verify the guard is actually *in the path* to the transport and that
// the rejection shape is wired through correctly.

describe("performOneClickUnsubscribe — URL safety guard", () => {
  const denyLookup: LookupFn = async () => {
    throw new Error("DNS should not be called");
  };

  test("rejects non-https URLs before issuing any request", async () => {
    const transport = mock(() => Promise.resolve(hopResponse(200)));
    const res = await performOneClickUnsubscribe("http://example.com/unsub", {
      transport: transport,
      lookup: denyLookup
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.message).toContain("unsupported-protocol");
    }
    expect(transport).not.toHaveBeenCalled();
  });

  test("rejects literal loopback IPv4 before issuing any request", async () => {
    const transport = mock(() => Promise.resolve(hopResponse(200)));
    const res = await performOneClickUnsubscribe("https://127.0.0.1/unsub", {
      transport: transport,
      lookup: denyLookup
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.message).toContain("private-ip");
    }
    expect(transport).not.toHaveBeenCalled();
  });

  test("rejects cloud metadata literal 169.254.169.254 before issuing any request", async () => {
    const transport = mock(() => Promise.resolve(hopResponse(200)));
    const res = await performOneClickUnsubscribe(
      "https://169.254.169.254/latest/meta-data/",
      { transport: transport, lookup: denyLookup }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("private-ip");
    expect(transport).not.toHaveBeenCalled();
  });

  test("rejects IPv6 loopback in bracket form before issuing any request", async () => {
    const transport = mock(() => Promise.resolve(hopResponse(200)));
    const res = await performOneClickUnsubscribe("https://[::1]/unsub", {
      transport: transport,
      lookup: denyLookup
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("private-ip");
    expect(transport).not.toHaveBeenCalled();
  });

  test("rejects hostnames that resolve to a private address", async () => {
    const transport = mock(() => Promise.resolve(hopResponse(200)));
    const lookup: LookupFn = async () => [{ address: "10.0.0.5", family: 4 }];
    const res = await performOneClickUnsubscribe("https://internal.example.test/unsub", {
      transport: transport,
      lookup
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("private-ip");
    expect(transport).not.toHaveBeenCalled();
  });

  test("rejects malformed URLs", async () => {
    const transport = mock(() => Promise.resolve(hopResponse(200)));
    const res = await performOneClickUnsubscribe("not a url", {
      transport: transport,
      lookup: denyLookup
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("invalid-url");
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("performOneClickUnsubscribe — request behaviour", () => {
  const publicLookup: LookupFn = async () => [
    { address: "93.184.216.34", family: 4 }
  ];

  test("issues POST to the validated URL with RFC 8058 body when the host is public", async () => {
    const transport = mock(async (hop: PinnedHop) => {
      expect(hop.url.toString()).toBe("https://public.example.test/unsub");
      expect(hop.addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
      expect(hop.method).toBe("POST");
      expect(new TextDecoder().decode(hop.body!)).toBe("List-Unsubscribe=One-Click");
      expect(hop.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
      return hopResponse(200);
    });

    const res = await performOneClickUnsubscribe("https://public.example.test/unsub", {
      transport: transport,
      lookup: publicLookup
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.status).toBe(200);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  test("accepts 202 Accepted as success", async () => {
    const transport = mock(() => Promise.resolve(hopResponse(202)));
    const res = await performOneClickUnsubscribe("https://public.example.test/unsub", {
      transport: transport,
      lookup: publicLookup
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.status).toBe(202);
  });

  test("reports 502 with upstream status when the remote returns 4xx/5xx", async () => {
    const transport = mock(() => Promise.resolve(hopResponse(403)));
    const res = await performOneClickUnsubscribe("https://public.example.test/unsub", {
      transport: transport,
      lookup: publicLookup
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(502);
      expect(res.message).toContain("403");
    }
  });

  test("refuses a redirect to an internal address without sending the second request (CF-09, A33, S28, DS-07, GLM-01)", async () => {
    const transport = mock(async (hop: PinnedHop) => hop.url.hostname === "public.example.test"
      ? hopResponse(307, { location: "https://127.0.0.1:8443/internal-post" })
      : hopResponse(200));
    const res = await performOneClickUnsubscribe("https://public.example.test/unsub", { transport, lookup: publicLookup });
    expect(res).toEqual({ ok: false, status: 400, message: "Unsubscribe URL rejected: private-ip" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  test("refuses a redirect to a host that resolves to a tailnet address", async () => {
    const lookup: LookupFn = async (host) => [{ address: host === "public.example.test" ? "93.184.216.34" : "100.100.100.100", family: 4 }];
    const transport = mock(async () => hopResponse(302, { location: "https://internal.example.test/" }));
    const res = await performOneClickUnsubscribe("https://public.example.test/unsub", { transport, lookup });
    expect(res.ok).toBe(false);
    expect(res.ok ? 0 : res.status).toBe(400);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  test("follows a public redirect with the POST body and gives up after three redirects", async () => {
    const followed = mock(async (hop: PinnedHop) => hop.url.pathname === "/unsub" ? hopResponse(307, { location: "/done" }) : hopResponse(200));
    expect(await performOneClickUnsubscribe("https://public.example.test/unsub", { transport: followed, lookup: publicLookup })).toEqual({ ok: true, status: 200 });
    expect(followed.mock.calls[1][0].method).toBe("POST");
    const looping = mock(async () => hopResponse(308, { location: "/again" }));
    const res = await performOneClickUnsubscribe("https://public.example.test/unsub", { transport: looping, lookup: publicLookup });
    expect(res.ok ? 0 : res.status).toBe(502);
    expect(looping).toHaveBeenCalledTimes(4);
  });

  test("reports 502 when fetch throws", async () => {
    const transport = mock(() => Promise.reject(new Error("connect ECONNREFUSED")));
    const res = await performOneClickUnsubscribe("https://public.example.test/unsub", {
      transport: transport,
      lookup: publicLookup
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(502);
      expect(res.message).toContain("ECONNREFUSED");
    }
  });
});

describe("parseListUnsubscribeUrls — http/https separation", () => {
  test("splits http and https into separate buckets", () => {
    const result = parseListUnsubscribeUrls(
      "<http://insecure.example.test/unsub>, <https://secure.example.test/unsub>"
    );
    expect(result.https).toEqual(["https://secure.example.test/unsub"]);
    expect(result.http).toEqual(["http://insecure.example.test/unsub"]);
    expect(result.mailto).toEqual([]);
  });

  test("collects mailto separately from web URLs", () => {
    const result = parseListUnsubscribeUrls(
      "<mailto:unsub@example.test>, <https://example.test/unsub>"
    );
    expect(result.https).toEqual(["https://example.test/unsub"]);
    expect(result.http).toEqual([]);
    expect(result.mailto).toEqual(["mailto:unsub@example.test"]);
  });

  test("regression: does NOT lump http into the https bucket — one-click would otherwise pick the insecure URL and fail validation even when a valid https URL is present", () => {
    // This is the scenario called out in the PR review: a header like
    // `<http://...>, <https://...>` used to put both into `urls.https`,
    // so the one-click path would pick the http entry (position 0), get
    // rejected by assertPublicUrl as `unsupported-protocol`, and never
    // try the https entry.
    const result = parseListUnsubscribeUrls(
      "<http://first.example.test/u>, <https://second.example.test/u>"
    );
    expect(result.https[0]).toBe("https://second.example.test/u");
    expect(result.http[0]).toBe("http://first.example.test/u");
  });

  test("ignores unknown schemes", () => {
    const result = parseListUnsubscribeUrls("<javascript:alert(1)>, <ftp://example.test/u>");
    expect(result.https).toEqual([]);
    expect(result.http).toEqual([]);
    expect(result.mailto).toEqual([]);
  });

  test("returns empty buckets for a header with no angle-bracketed URLs", () => {
    const result = parseListUnsubscribeUrls("junk without brackets");
    expect(result).toEqual({ https: [], http: [], mailto: [] });
  });
});

describe("performOneClickUnsubscribe — large confirmation pages", () => {
  test("a 200 with a body over the 64 KiB cap counts as unsubscribed", async () => {
    const server = http.createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("<p>Abgemeldet</p>" + "x".repeat(100 * 1024));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    // Real pinned transport (size cap and truncation); the checked https hop is served locally over http.
    const hops: PinnedHop[] = [];
    const transport: HopTransport = (hop) => {
      hops.push(hop);
      return pinnedHttpTransport({
        ...hop,
        url: new URL(`http://127.0.0.1:${port}${hop.url.pathname}`),
        addresses: [{ address: "127.0.0.1", family: 4 }]
      });
    };
    try {
      const res = await performOneClickUnsubscribe("https://public.example.test/unsub", {
        transport,
        lookup: async () => [{ address: "93.184.216.34", family: 4 }]
      });
      expect(res).toEqual({ ok: true, status: 200 });
      expect(hops[0]?.maxResponseBytes).toBe(64 * 1024);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
