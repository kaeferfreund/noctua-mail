import { isIP } from "node:net";
import type { CityResponse, Reader } from "maxmind";
import { OUTREACH_DEFAULT_IP_RETENTION_DAYS } from "../config";

export const DAY_MS = 86_400_000;

export function trackingIpExpiryCutoff(now: number, retentionDays?: number | null): number {
  return retentionDays === 0 ? Number.MAX_SAFE_INTEGER : now - (retentionDays ?? OUTREACH_DEFAULT_IP_RETENTION_DAYS) * DAY_MS;
}

export function normalizeTrackingIp(value?: string | null): string | null {
  const ip = value?.trim().toLowerCase();
  if (!ip) return null;
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6 || ip.includes("%")) return null;
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(canonical);
  if (!mapped) return canonical;
  const high = parseInt(mapped[1], 16);
  const low = parseInt(mapped[2], 16);
  return [high >>> 8, high & 255, low >>> 8, low & 255].join(".");
}

export function truncateTrackingIp(value: string): string | null {
  const ip = normalizeTrackingIp(value);
  if (!ip) return null;
  if (isIP(ip) === 4) return `${ip.slice(0, ip.lastIndexOf("."))}.0`;
  const [prefix, suffix] = ip.split("::");
  const head = prefix ? prefix.split(":") : [];
  const tail = suffix ? suffix.split(":") : [];
  const words = suffix === undefined ? head : [...head, ...Array<string>(8 - head.length - tail.length).fill("0"), ...tail];
  return normalizeTrackingIp(`${words.slice(0, 3).join(":")}::`);
}

const key = Symbol.for("noctua.outreachGeoIp");
const host = globalThis as typeof globalThis & { [key]?: Promise<Reader<CityResponse> | null> };

export async function lookupTrackingLocation(ip: string | null) {
  const path = process.env.NOCTUA_OUTREACH_GEOIP_DB?.trim();
  const empty = { country: null, region: null, city: null };
  if (!ip || !path) return empty;
  host[key] ??= import("maxmind").then(({ open }) => open<CityResponse>(path)).catch(() => {
    console.warn("[outreach] Local tracking location database unavailable");
    return null;
  });
  try {
    const record = (await host[key])?.get(ip);
    return {
      country: record?.country?.iso_code ?? record?.registered_country?.iso_code ?? null,
      region: record?.subdivisions?.[0]?.names.en ?? record?.subdivisions?.[0]?.iso_code ?? null,
      city: record?.city?.names.en ?? null
    };
  } catch {
    return empty;
  }
}
