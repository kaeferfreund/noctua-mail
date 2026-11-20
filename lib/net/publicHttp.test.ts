import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  createPublicFetch,
  pinnedHttpTransport,
  publicRequest,
  PublicRequestError,
  type HopTransport,
  type PinnedHop
} from "./publicHttp";
import type { LookupFn } from "./urlSafety";

type Seen = { method: string; url: string; host: string; authorization?: string; body: string };
const seen: Seen[] = [];
let server: http.Server;
let port = 0;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      seen.push({ method: req.method ?? "", url: req.url ?? "", host: req.headers.host ?? "", authorization: req.headers.authorization, body });
      const target = new URL(req.url ?? "/", "http://local");
      if (target.pathname === "/redirect") {
        res.writeHead(Number(target.searchParams.get("status") ?? 307), { location: target.searchParams.get("to") ?? "/" });
        res.end();
      } else if (target.pathname === "/big") {
        res.end("x".repeat(64 * 1024));
      } else if (target.pathname === "/hang") {
        // never answers
      } else {
        res.end(`ok ${req.method}`);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const PUBLIC_IP = "93.184.216.34";
const publicLookup: LookupFn = async () => [{ address: PUBLIC_IP, family: 4 }];
const HTTP = ["http:", "https:"] as const;

/** Real pinned transport, but the checked public test address is served by the local server. */
const loopbackTransport = (hops: PinnedHop[] = []): HopTransport => (hop) => {
  hops.push(hop);
  return pinnedHttpTransport({
    ...hop,
    addresses: hop.addresses.map((a) => (a.address === PUBLIC_IP ? { address: "127.0.0.1", family: 4 as const } : a))
  });
};

describe("pinnedHttpTransport", () => {
  test("connects to the pinned address without resolving the host name", async () => {
    seen.length = 0;
    const response = await pinnedHttpTransport({
      url: new URL(`http://pinned.example.test:${port}/hello?x=1`),
      addresses: [{ address: "127.0.0.1", family: 4 }],
      method: "GET",
      headers: new Headers(),
      body: null,
      signal: AbortSignal.timeout(5000),
      maxResponseBytes: 1024
    });
    expect(response.status).toBe(200);
    expect(new TextDecoder().decode(response.body)).toBe("ok GET");
    expect(seen).toEqual([expect.objectContaining({ url: "/hello?x=1", host: `pinned.example.test:${port}` })]);
  });
});

describe("publicRequest — per-hop checks (CF-09, A33, S28, DS-07, GLM-01)", () => {
  test("a redirect to a loopback address is refused before any connection to it", async () => {
    seen.length = 0;
    const to = `http://127.0.0.1:${port}/internal`;
    const error = await publicRequest(`http://public.example.test:${port}/redirect?to=${encodeURIComponent(to)}`, {
      method: "POST", body: "List-Unsubscribe=One-Click", protocols: HTTP, lookup: publicLookup, transport: loopbackTransport()
    }).catch((e) => e);
    expect(error).toBeInstanceOf(PublicRequestError);
    expect(error.reason).toBe("private-ip");
    expect(seen.map((s) => s.url.split("?")[0])).toEqual(["/redirect"]);
  });

  test("a redirect to a host that resolves to a private address is refused", async () => {
    seen.length = 0;
    const lookup: LookupFn = async (host) => [{ address: host === "internal.example.test" ? "100.100.100.100" : PUBLIC_IP, family: 4 }];
    const error = await publicRequest(`http://public.example.test:${port}/redirect?status=302&to=${encodeURIComponent(`http://internal.example.test:${port}/x`)}`, {
      protocols: HTTP, lookup, transport: loopbackTransport()
    }).catch((e) => e);
    expect(error.reason).toBe("private-ip");
    expect(seen).toHaveLength(1);
  });

  test("redirects to an unsupported scheme are refused", async () => {
    const transport: HopTransport = async () => ({ status: 302, statusText: "", headers: new Headers({ location: "http://public.example.test/" }), body: new Uint8Array() });
    const error = await publicRequest("https://public.example.test/", { lookup: publicLookup, transport }).catch((e) => e);
    expect(error.reason).toBe("unsupported-protocol");
  });

  test("follows public redirects and stops after the limit", async () => {
    let hops = 0;
    const transport: HopTransport = async (hop) => {
      hops++;
      return { status: 301, statusText: "", headers: new Headers({ location: `/next-${hop.url.pathname.length}` }), body: new Uint8Array() };
    };
    const error = await publicRequest("https://public.example.test/a", { lookup: publicLookup, transport, maxRedirects: 3 }).catch((e) => e);
    expect(error.reason).toBe("too-many-redirects");
    expect(hops).toBe(4);
  });

  test("connects to the address that was checked, even if DNS changes afterwards (rebinding)", async () => {
    seen.length = 0;
    let lookups = 0;
    const rebinding: LookupFn = async () => (lookups++ === 0 ? [{ address: PUBLIC_IP, family: 4 }] : [{ address: "127.0.0.1", family: 4 }]);
    const hops: PinnedHop[] = [];
    const response = await publicRequest(`http://rebind.example.test:${port}/ok`, { protocols: HTTP, lookup: rebinding, transport: loopbackTransport(hops) });
    expect(response.status).toBe(200);
    expect(lookups).toBe(1);
    expect(hops[0].addresses).toEqual([{ address: PUBLIC_IP, family: 4 }]);
  });

  test("POST after 302 becomes GET without body; 307 keeps method and body", async () => {
    seen.length = 0;
    await publicRequest(`http://public.example.test:${port}/redirect?status=302&to=/after302`, {
      method: "POST", body: "a=1", headers: { "content-type": "application/x-www-form-urlencoded" }, protocols: HTTP, lookup: publicLookup, transport: loopbackTransport()
    });
    await publicRequest(`http://public.example.test:${port}/redirect?status=307&to=/after307`, {
      method: "POST", body: "b=2", protocols: HTTP, lookup: publicLookup, transport: loopbackTransport()
    });
    expect(seen.filter((s) => s.url.startsWith("/after")).map(({ method, url, body }) => ({ method, url, body }))).toEqual([
      { method: "GET", url: "/after302", body: "" },
      { method: "POST", url: "/after307", body: "b=2" }
    ]);
  });

  test("credentials are dropped on cross-origin redirects and kept on same-origin ones", async () => {
    seen.length = 0;
    const other = `http://other.example.test:${port}/cross`;
    await publicRequest(`http://public.example.test:${port}/redirect?to=/same`, {
      headers: { authorization: "Basic dGVzdDp0ZXN0" }, protocols: HTTP, lookup: publicLookup, transport: loopbackTransport()
    });
    await publicRequest(`http://public.example.test:${port}/redirect?to=${encodeURIComponent(other)}`, {
      headers: { authorization: "Basic dGVzdDp0ZXN0" }, protocols: HTTP, lookup: publicLookup, transport: loopbackTransport()
    });
    expect(seen.find((s) => s.url === "/same")?.authorization).toBe("Basic dGVzdDp0ZXN0");
    expect(seen.find((s) => s.url === "/cross")?.authorization).toBeUndefined();
  });

  test("manual redirect mode returns the 3xx response without following it", async () => {
    seen.length = 0;
    const response = await publicRequest(`http://public.example.test:${port}/redirect?to=/target`, {
      redirect: "manual", protocols: HTTP, lookup: publicLookup, transport: loopbackTransport()
    });
    expect(response.status).toBe(307);
    expect(seen).toHaveLength(1);
  });
});

describe("publicRequest — bounds", () => {
  test("rejects responses larger than maxResponseBytes", async () => {
    const error = await publicRequest(`http://public.example.test:${port}/big`, {
      protocols: HTTP, lookup: publicLookup, transport: loopbackTransport(), maxResponseBytes: 1024
    }).catch((e) => e);
    expect(error.reason).toBe("response-too-large");
  });

  test("truncateResponse keeps the status and the first maxResponseBytes instead of failing", async () => {
    const response = await publicRequest(`http://public.example.test:${port}/big`, {
      protocols: HTTP, lookup: publicLookup, transport: loopbackTransport(), maxResponseBytes: 1024, truncateResponse: true
    });
    expect(response.status).toBe(200);
    expect(response.body.byteLength).toBe(1024);
  });

  test("enforces the overall deadline", async () => {
    const started = Date.now();
    const error = await publicRequest(`http://public.example.test:${port}/hang`, {
      protocols: HTTP, lookup: publicLookup, transport: loopbackTransport(), timeoutMs: 200
    }).catch((e) => e);
    expect(error.reason).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe("createPublicFetch", () => {
  test("returns a fetch Response from the checked, pinned request", async () => {
    seen.length = 0;
    const guardedFetch = createPublicFetch({ protocols: HTTP, lookup: publicLookup, transport: loopbackTransport() });
    const response = await guardedFetch(`http://public.example.test:${port}/redirect?to=/final`, {
      method: "PROPFIND", headers: { authorization: "Basic dGVzdDp0ZXN0", depth: "0" }, body: "<x/>"
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok PROPFIND");
    expect(response.url).toBe(`http://public.example.test:${port}/final`);
    expect(response.redirected).toBe(true);
    expect(seen.at(-1)).toEqual(expect.objectContaining({ method: "PROPFIND", body: "<x/>" }));
  });

  test("rejects private destinations like fetch rejects network errors", async () => {
    const guardedFetch = createPublicFetch({ protocols: HTTP, transport: loopbackTransport() });
    const error = await guardedFetch(`http://127.0.0.1:${port}/`).catch((e) => e);
    expect(error).toBeInstanceOf(PublicRequestError);
    expect(error.reason).toBe("private-ip");
  });
});
