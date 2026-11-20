import { createDAVClient, type DAVCalendar, type DAVObject } from "tsdav";
import type { CaldavConfig } from "@/lib/data";
import {
  assertPublicUrl,
  type AssertPublicUrlRejectionReason,
  type LookupFn
} from "@/lib/net/urlSafety";
import { createPublicFetch } from "@/lib/net/publicHttp";

export type CaldavClient = Awaited<ReturnType<typeof createDAVClient>>;

export type CaldavUrlRejectionReason =
  | AssertPublicUrlRejectionReason
  | "https-required"
  | "too-many-redirects";

/**
 * Error thrown when a CalDAV URL (the configured server URL, a redirect
 * target or a server-supplied href) fails the SSRF / transport guard.
 * Carries the rejection reason so callers (API routes, settings UI) can
 * surface a specific message.
 */
export class CaldavUrlRejectedError extends Error {
  readonly reason: CaldavUrlRejectionReason;
  constructor(reason: CaldavUrlRejectionReason) {
    super(`CalDAV server URL rejected (${reason})`);
    this.name = "CaldavUrlRejectedError";
    this.reason = reason;
  }
}

/** A configured calendar selector matched no collection, or more than one. */
export class CaldavCalendarSelectionError extends Error {
  constructor(readonly reason: "not-found" | "ambiguous") {
    super(`Configured CalDAV calendar ${reason === "not-found" ? "was not found" : "is ambiguous"}`);
    this.name = "CaldavCalendarSelectionError";
  }
}

// Plain `http:` is only accepted for connections without a password: Basic
// auth over HTTP hands the credential to every network observer. Private /
// LAN / link-local hosts are rejected for both schemes by `assertPublicUrl`.
const CALDAV_ALLOWED_PROTOCOLS = ["http:", "https:"] as const;
const CALDAV_PASSWORD_PROTOCOLS = ["https:"] as const;

/** Redirect hops a single CalDAV request may follow (each hop is re-checked). */
export const MAX_CALDAV_REDIRECTS = 5;

type CaldavUrlOptions = { lookup?: LookupFn; requireHttps?: boolean };
type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * SSRF / transport guard for every URL the CalDAV client contacts: the
 * user-configured server URL, discovery and HTTP redirects, and hrefs the
 * server returns. Rejects loopback / RFC 1918 / link-local / multicast /
 * IPv6 unique-local hosts (literal and DNS-resolved), non-`http(s)` schemes,
 * and plain `http:` when `requireHttps` is set (password authentication).
 *
 * The actual connection is made through `createPublicFetch`, which checks
 * again and connects only to the checked address (no second DNS lookup).
 */
export async function assertSafeCaldavUrl(
  rawUrl: string,
  options?: CaldavUrlOptions
): Promise<URL> {
  if (options?.requireHttps && URL.canParse(rawUrl) && new URL(rawUrl).protocol === "http:") {
    throw new CaldavUrlRejectedError("https-required");
  }
  const result = await assertPublicUrl(rawUrl, {
    lookup: options?.lookup,
    protocols: options?.requireHttps ? CALDAV_PASSWORD_PROTOCOLS : CALDAV_ALLOWED_PROTOCOLS
  });
  if (!result.ok) {
    throw new CaldavUrlRejectedError(result.reason);
  }
  return result.url;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * The `fetch` handed to tsdav. Every request URL — including hrefs the
 * server returned and every redirect hop — passes `assertSafeCaldavUrl`
 * before a connection is made. Redirects are followed manually (at most
 * `MAX_CALDAV_REDIRECTS`) with fetch-spec method rewriting, and the
 * `Authorization` header is dropped when a redirect leaves the origin.
 * Requests that ask for `redirect: "manual"` (tsdav's service discovery)
 * get the raw 3xx response; tsdav then requests the target through this
 * function again, so that target is checked as well.
 */
export function createGuardedCaldavFetch(
  options: CaldavUrlOptions & { fetch?: FetchFn } = {}
): typeof fetch {
  const baseFetch: FetchFn = options.fetch ?? fetch;
  const guarded = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (input instanceof Request) {
      throw new TypeError("CalDAV fetch expects a URL, not a Request");
    }
    let url = await assertSafeCaldavUrl(String(input), options);
    const mode = init?.redirect ?? "follow";
    let method = (init?.method ?? "GET").toUpperCase();
    let body = init?.body;
    const headers = new Headers(init?.headers);
    for (let hop = 0; ; hop++) {
      const response = await baseFetch(url.href, { ...init, method, body, headers, redirect: "manual" });
      const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get("location") : null;
      if (mode === "manual" || !location) return response;
      await response.body?.cancel().catch(() => undefined);
      if (mode === "error") throw new TypeError("CalDAV request was redirected");
      if (hop >= MAX_CALDAV_REDIRECTS) throw new CaldavUrlRejectedError("too-many-redirects");
      const next = await assertSafeCaldavUrl(new URL(location, url).href, options);
      if ((response.status === 303 && method !== "GET" && method !== "HEAD") ||
          ((response.status === 301 || response.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
        for (const name of ["content-type", "content-length", "content-encoding", "content-language", "content-location"]) headers.delete(name);
      }
      if (next.origin !== url.origin) headers.delete("authorization");
      url = next;
    }
  };
  return guarded as typeof fetch;
}

export async function createCaldavClient(
  config: CaldavConfig,
  options?: { lookup?: LookupFn; fetch?: FetchFn }
): Promise<CaldavClient> {
  // `config.url` is user-controlled account settings. Use the parsed/
  // validated URL returned by the guard rather than the raw string so tsdav
  // doesn't re-parse the untrusted input, and route every tsdav request
  // (discovery, redirects, server-supplied hrefs) through the same guard.
  const requireHttps = Boolean(config.password);
  const safeUrl = await assertSafeCaldavUrl(config.url, { lookup: options?.lookup, requireHttps });
  const client = await createDAVClient({
    serverUrl: safeUrl.toString(),
    credentials: { username: config.user, password: config.password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
    fetch: createGuardedCaldavFetch({
      lookup: options?.lookup,
      requireHttps,
      fetch:
        options?.fetch ??
        createPublicFetch({
          lookup: options?.lookup,
          protocols: requireHttps ? CALDAV_PASSWORD_PROTOCOLS : CALDAV_ALLOWED_PROTOCOLS
        })
    })
  });
  return client;
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

/** Comparable form of a collection path: decoded, one trailing slash. */
function canonicalCollectionPath(path: string): string {
  return `${safeDecode(path).replace(/\/+$/, "")}/`;
}

/**
 * Picks the configured calendar collection. A blank selector means "all
 * discovered calendars" (auto-discovery). A configured selector — a full
 * collection URL or its path — must match exactly one collection; a missing
 * or ambiguous match fails closed instead of importing other calendars.
 */
export function selectConfiguredCalendars<T extends { url?: string }>(
  calendars: T[],
  calendarPath?: string
): T[] {
  const selector = calendarPath?.trim();
  if (!selector) return calendars;
  const absolute = URL.canParse(selector) ? new URL(selector) : null;
  const matches = calendars.filter((calendar) => {
    if (!calendar.url || !URL.canParse(calendar.url)) return false;
    const candidate = new URL(calendar.url);
    if (absolute && absolute.origin !== candidate.origin) return false;
    return canonicalCollectionPath(candidate.pathname) ===
      canonicalCollectionPath(absolute ? absolute.pathname : selector);
  });
  if (matches.length === 0) throw new CaldavCalendarSelectionError("not-found");
  if (matches.length > 1) throw new CaldavCalendarSelectionError("ambiguous");
  return matches;
}

export async function fetchRemoteCalendars(
  client: CaldavClient,
  calendarPath?: string
): Promise<DAVCalendar[]> {
  return selectConfiguredCalendars(await client.fetchCalendars(), calendarPath);
}

/**
 * True when `remoteHref` names a resource inside the calendar collection
 * `calendarUrl` (same origin, path below the collection). Used before
 * writing to a stored href outside a fresh server listing.
 */
export function isHrefInCalendarCollection(remoteHref: string, calendarUrl: string | undefined): boolean {
  if (!calendarUrl || !URL.canParse(calendarUrl) || !URL.canParse(remoteHref, calendarUrl)) return false;
  const calendar = new URL(calendarUrl);
  const href = new URL(remoteHref, calendar);
  if (href.origin !== calendar.origin) return false;
  const base = canonicalCollectionPath(calendar.pathname);
  const target = safeDecode(href.pathname);
  return target.startsWith(base) && target.length > base.length && !target.slice(base.length).split("/").includes("..");
}

export async function fetchRemoteEvents(
  client: CaldavClient,
  calendar: DAVCalendar,
  timeRange?: { start: Date; end: Date }
): Promise<DAVObject[]> {
  return client.fetchCalendarObjects({
    calendar,
    timeRange: timeRange
      ? { start: timeRange.start.toISOString(), end: timeRange.end.toISOString() }
      : undefined
  });
}

export async function pushEventToRemote(
  client: CaldavClient,
  calendar: DAVCalendar,
  eventUid: string,
  icsData: string
): Promise<{ url: string; etag?: string }> {
  const calendarUrl = calendar.url ?? "";
  const objectUrl = `${calendarUrl.replace(/\/$/, "")}/${eventUid}.ics`;
  const result = await client.createCalendarObject({
    calendar,
    filename: `${eventUid}.ics`,
    iCalString: icsData
  });
  return { url: (result as any)?.url ?? objectUrl, etag: (result as any)?.etag };
}

export async function updateRemoteEvent(
  client: CaldavClient,
  remoteHref: string,
  etag: string | undefined,
  icsData: string
): Promise<{ etag?: string }> {
  const result = await client.updateCalendarObject({
    calendarObject: { url: remoteHref, etag, data: icsData }
  });
  return { etag: (result as any)?.etag };
}

export async function deleteRemoteEvent(
  client: CaldavClient,
  remoteHref: string,
  etag?: string
): Promise<void> {
  await client.deleteCalendarObject({
    calendarObject: { url: remoteHref, etag }
  });
}

export async function testCaldavConnection(
  config: Pick<CaldavConfig, "url" | "user" | "password">,
  options?: { lookup?: LookupFn }
): Promise<{ ok: true; calendars: { displayName?: string; url: string }[] } | { ok: false; message: string }> {
  try {
    const client = await createCaldavClient({ ...config, url: config.url }, options);
    const calendars = await client.fetchCalendars();
    return {
      ok: true,
      calendars: calendars.map((c) => ({
        displayName: c.displayName as string | undefined,
        url: c.url ?? ""
      }))
    };
  } catch (err) {
    if (err instanceof CaldavUrlRejectedError) {
      return { ok: false, message: err.message };
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, message };
  }
}
