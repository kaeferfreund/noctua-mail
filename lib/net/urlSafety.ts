import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Classifies an IPv4 or IPv6 address literal as "public" (globally routable
 * unicast) or not. The decision is made on the parsed bytes, so every textual
 * form of the same address (dotted or hexadecimal IPv4-mapped IPv6, compressed
 * or expanded groups, zone identifiers) gets the same answer.
 *
 * IPv4: everything except the special-purpose ranges in `NON_PUBLIC_IPV4`
 * (IANA IPv4 Special-Purpose Address Registry plus multicast, reserved and
 * broadcast).
 *
 * IPv6: only global unicast `2000::/3` can be public, minus the special-purpose
 * blocks in `NON_PUBLIC_IPV6_GLOBAL` (Teredo and other IETF assignments,
 * documentation, deprecated 6to4). IPv4-mapped `::ffff:0:0/96` is classified
 * by its embedded IPv4 address. Everything else (loopback, unspecified,
 * IPv4-compatible, NAT64, discard, unique-local, link-local, site-local,
 * multicast, ...) is not public.
 *
 * Returns `false` for any string that is not a valid IP literal.
 */
export function isPublicIp(addr: string): boolean {
  const version = isIP(addr);
  if (version === 4) {
    const bytes = parseIpv4(addr);
    return bytes ? isPublicIpv4Bytes(bytes) : false;
  }
  if (version === 6) {
    const bytes = parseIpv6(addr);
    return bytes ? isPublicIpv6Bytes(bytes) : false;
  }
  return false;
}

type Cidr = readonly [bytes: readonly number[], prefixLength: number];

// IANA IPv4 Special-Purpose Address Registry (RFC 6890 and updates) plus
// multicast and the reserved class E block. 192.0.0.0/24 also covers the
// globally reachable 192.0.0.9/192.0.0.10 anycast services, which no
// outbound feature needs.
const NON_PUBLIC_IPV4: readonly Cidr[] = [
  [[0, 0, 0, 0], 8], // "this network", includes 0.0.0.0
  [[10, 0, 0, 0], 8], // RFC 1918 private
  [[100, 64, 0, 0], 10], // shared address space / CGNAT (RFC 6598), also used by tailnets
  [[127, 0, 0, 0], 8], // loopback
  [[169, 254, 0, 0], 16], // link-local, cloud metadata
  [[172, 16, 0, 0], 12], // RFC 1918 private
  [[192, 0, 0, 0], 24], // IETF protocol assignments
  [[192, 0, 2, 0], 24], // TEST-NET-1 documentation
  [[192, 88, 99, 0], 24], // deprecated 6to4 relay anycast (RFC 7526)
  [[192, 168, 0, 0], 16], // RFC 1918 private
  [[198, 18, 0, 0], 15], // benchmarking (RFC 2544)
  [[198, 51, 100, 0], 24], // TEST-NET-2 documentation
  [[203, 0, 113, 0], 24], // TEST-NET-3 documentation
  [[224, 0, 0, 0], 4], // multicast
  [[240, 0, 0, 0], 4] // reserved (class E), includes broadcast 255.255.255.255
];

// Special-purpose blocks inside global unicast 2000::/3 (IANA IPv6
// Special-Purpose Address Registry).
const NON_PUBLIC_IPV6_GLOBAL: readonly Cidr[] = [
  [[0x20, 0x01, 0x00, 0x00], 23], // IETF protocol assignments: Teredo 2001::/32, benchmarking 2001:2::/48, ORCHID, ...
  [[0x20, 0x01, 0x0d, 0xb8], 32], // documentation
  [[0x20, 0x02], 16], // 6to4 (deprecated, embeds arbitrary IPv4)
  [[0x3f, 0xff, 0x00], 20] // documentation (RFC 9637)
];

function inCidr(bytes: readonly number[], [base, prefixLength]: Cidr): boolean {
  let remaining = prefixLength;
  for (let i = 0; remaining > 0; i++, remaining -= 8) {
    const bits = Math.min(8, remaining);
    const mask = (0xff << (8 - bits)) & 0xff;
    if (((bytes[i] ?? 0) & mask) !== ((base[i] ?? 0) & mask)) return false;
  }
  return true;
}

function isPublicIpv4Bytes(bytes: readonly number[]): boolean {
  return !NON_PUBLIC_IPV4.some((cidr) => inCidr(bytes, cidr));
}

function isPublicIpv6Bytes(bytes: readonly number[]): boolean {
  // IPv4-mapped ::ffff:a.b.c.d — the socket layer connects to the embedded
  // IPv4 address, so classify that.
  if (bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isPublicIpv4Bytes(bytes.slice(12));
  }
  // Only global unicast 2000::/3 is routable on the public internet.
  if ((bytes[0] & 0xe0) !== 0x20) return false;
  return !NON_PUBLIC_IPV6_GLOBAL.some((cidr) => inCidr(bytes, cidr));
}

function parseIpv4(addr: string): number[] | null {
  const parts = addr.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

/**
 * Parses an IPv6 literal (compressed `::`, optional dotted IPv4 tail,
 * optional `%zone`) into its 16 bytes. Returns `null` if malformed.
 */
function parseIpv6(input: string): number[] | null {
  let addr = input.toLowerCase();
  const zone = addr.indexOf("%");
  if (zone >= 0) addr = addr.slice(0, zone);
  let tail: number[] = [];
  const lastColon = addr.lastIndexOf(":");
  if (addr.slice(lastColon + 1).includes(".")) {
    const v4 = parseIpv4(addr.slice(lastColon + 1));
    if (!v4) return null;
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    addr = addr.slice(0, lastColon + 1) + "0:0";
  }
  const groups = expandIpv6(addr);
  if (!groups) return null;
  if (tail.length) groups.splice(6, 2, ...tail);
  return groups.flatMap((g) => [g >> 8, g & 0xff]);
}

/**
 * Expands an IPv6 literal (possibly compressed with `::`) into its eight
 * 16-bit groups as numbers. Returns `null` if the input is malformed.
 */
function expandIpv6(addr: string): number[] | null {
  if (addr.indexOf("::") !== addr.lastIndexOf("::")) return null;
  const doubleColonIdx = addr.indexOf("::");
  let parts: string[];
  if (doubleColonIdx >= 0) {
    const headStr = addr.slice(0, doubleColonIdx);
    const tailStr = addr.slice(doubleColonIdx + 2);
    const head = headStr.length ? headStr.split(":") : [];
    const tail = tailStr.length ? tailStr.split(":") : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    parts = [...head, ...new Array(missing).fill("0"), ...tail];
  } else {
    parts = addr.split(":");
  }
  if (parts.length !== 8) return null;
  const groups: number[] = [];
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
    groups.push(parseInt(part, 16));
  }
  return groups;
}

export type AssertPublicUrlRejectionReason =
  | "invalid-url"
  | "unsupported-protocol"
  | "empty-host"
  | "private-ip"
  | "no-dns-records"
  | "dns-lookup-failed";

/** An address the guard has checked; connections must go to exactly this address. */
export type PublicAddress = { address: string; family: 4 | 6 };

export type AssertPublicUrlResult =
  | { ok: true; url: URL; resolved: string[]; addresses: PublicAddress[] }
  | { ok: false; reason: AssertPublicUrlRejectionReason };

export type ResolvePublicHostResult =
  | { ok: true; addresses: PublicAddress[] }
  | { ok: false; reason: Exclude<AssertPublicUrlRejectionReason, "invalid-url" | "unsupported-protocol"> };

export type LookupFn = (
  hostname: string
) => Promise<Array<{ address: string; family: number }>>;

const defaultLookup: LookupFn = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

const DEFAULT_PROTOCOLS = ["https:"] as const;

/**
 * Resolves a host name (or IP literal, with or without IPv6 brackets) and
 * accepts it only when every address is public (`isPublicIp`). The returned
 * addresses are the ones that were checked: callers must connect to them
 * directly (see `lib/net/publicHttp.ts` and the `/api/probe` route) instead
 * of resolving the name again, otherwise a DNS answer that changes between
 * check and connect (rebinding) bypasses the guard.
 */
export async function resolvePublicHost(
  rawHost: string,
  options?: { lookup?: LookupFn }
): Promise<ResolvePublicHostResult> {
  // URL.hostname keeps brackets around IPv6 literals (e.g. `[::1]`). Strip
  // them, and drop any zone identifier (`%eth0`) before classification.
  let host = rawHost.trim();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  host = host.replace(/%.*$/, "");
  if (!host) return { ok: false, reason: "empty-host" };

  const literal = isIP(host);
  if (literal) {
    if (!isPublicIp(host)) return { ok: false, reason: "private-ip" };
    return { ok: true, addresses: [{ address: host, family: literal === 6 ? 6 : 4 }] };
  }

  const lookup = options?.lookup ?? defaultLookup;
  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(host);
  } catch {
    return { ok: false, reason: "dns-lookup-failed" };
  }
  if (records.length === 0) return { ok: false, reason: "no-dns-records" };
  const addresses: PublicAddress[] = [];
  for (const { address } of records) {
    const family = isIP(address);
    if (!family || !isPublicIp(address)) return { ok: false, reason: "private-ip" };
    addresses.push({ address, family: family === 6 ? 6 : 4 });
  }
  return { ok: true, addresses };
}

/**
 * Parses `rawUrl`, enforces an allowed-protocol list (default `["https:"]`)
 * and accepts the URL only when its host is public (`resolvePublicHost`):
 * literal IPs and every DNS answer must be outside the non-public ranges.
 * Use this before issuing server-side requests to URLs that come from
 * untrusted input (e.g. email headers, user-configured server URLs).
 *
 * Checking alone does not bind the connection to the checked addresses and
 * does not cover redirects. For HTTP use `publicRequest` / `createPublicFetch`
 * from `lib/net/publicHttp.ts`, which connect to `addresses` and re-check
 * every redirect hop.
 *
 * Pass `protocols: ["http:", "https:"]` only for contexts where plain
 * HTTP is legitimately supported for publicly reachable servers. The
 * private-IP / DNS guards still apply.
 */
export async function assertPublicUrl(
  rawUrl: string,
  options?: { lookup?: LookupFn; protocols?: readonly string[] }
): Promise<AssertPublicUrlResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }
  const allowedProtocols = options?.protocols ?? DEFAULT_PROTOCOLS;
  if (!allowedProtocols.includes(parsed.protocol)) {
    return { ok: false, reason: "unsupported-protocol" };
  }
  const host = await resolvePublicHost(parsed.hostname, { lookup: options?.lookup });
  if (!host.ok) return host;
  return {
    ok: true,
    url: parsed,
    resolved: host.addresses.map((a) => a.address),
    addresses: host.addresses
  };
}
