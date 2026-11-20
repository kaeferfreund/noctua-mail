import { describe, expect, mock, test } from "bun:test";
import type { LookupFn } from "@/lib/net/urlSafety";

// We mock `tsdav` before importing the client module so that `createDAVClient`
// never tries to reach the network. `assertPublicUrl` catches SSRF-ish URLs
// before `tsdav` is invoked at all; these tests verify that chokepoint is in
// place and that a valid URL does get handed through.
const createDAVClient = mock(async (_options: Parameters<typeof import("tsdav").createDAVClient>[0]) => ({
  fetchCalendars: async () => []
}));
mock.module("tsdav", () => ({ createDAVClient }));

const {
  assertSafeCaldavUrl,
  CaldavCalendarSelectionError,
  CaldavUrlRejectedError,
  createCaldavClient,
  createGuardedCaldavFetch,
  isHrefInCalendarCollection,
  MAX_CALDAV_REDIRECTS,
  selectConfiguredCalendars,
  testCaldavConnection
} = await import("./client");

// Synthetic name → address table for the guard's DNS step; never touches DNS.
const hostTable: Record<string, string> = {
  "caldav.example.com": "93.184.216.34",
  "other.example.com": "93.184.216.35",
  "internal.example.test": "10.0.0.5"
};
const tableLookup: LookupFn = async (hostname) => {
  const address = hostTable[hostname];
  if (!address) throw new Error(`unexpected lookup ${hostname}`);
  return [{ address, family: 4 }];
};


describe("assertSafeCaldavUrl", () => {
  const denyLookup: LookupFn = async () => {
    throw new Error("DNS should not be called");
  };
  const publicLookup: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];

  test("accepts https:// public host", async () => {
    const url = await assertSafeCaldavUrl("https://caldav.example.com/remote.php/dav", {
      lookup: publicLookup
    });
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("caldav.example.com");
  });

  test("rejects http:// when the connection uses a password", async () => {
    const err = await assertSafeCaldavUrl("http://caldav.example.com/", {
      lookup: publicLookup,
      requireHttps: true
    }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(CaldavUrlRejectedError);
    expect((err as InstanceType<typeof CaldavUrlRejectedError>).reason).toBe("https-required");
  });

  test("accepts http:// public host without password (self-hosted CalDAV case)", async () => {
    const url = await assertSafeCaldavUrl("http://caldav.example.com/", {
      lookup: publicLookup
    });
    expect(url.protocol).toBe("http:");
  });

  test("rejects literal loopback IPv4 (http://127.0.0.1)", async () => {
    expect(
      assertSafeCaldavUrl("http://127.0.0.1:8008/", { lookup: denyLookup })
    ).rejects.toBeInstanceOf(CaldavUrlRejectedError);
  });

  test("rejects cloud metadata literal 169.254.169.254", async () => {
    expect(
      assertSafeCaldavUrl("http://169.254.169.254/latest/meta-data/", {
        lookup: denyLookup
      })
    ).rejects.toBeInstanceOf(CaldavUrlRejectedError);
  });

  test("rejects RFC 1918 private range (10.0.0.5)", async () => {
    expect(
      assertSafeCaldavUrl("https://10.0.0.5/dav", { lookup: denyLookup })
    ).rejects.toBeInstanceOf(CaldavUrlRejectedError);
  });

  test("rejects IPv6 loopback [::1]", async () => {
    expect(
      assertSafeCaldavUrl("https://[::1]:8008/", { lookup: denyLookup })
    ).rejects.toBeInstanceOf(CaldavUrlRejectedError);
  });

  test("rejects non-http(s) schemes", async () => {
    for (const url of ["file:///etc/passwd", "ftp://caldav.example.com/", "javascript:1"]) {
      const err = await assertSafeCaldavUrl(url, { lookup: denyLookup }).catch(
        (e: Error) => e
      );
      expect(err).toBeInstanceOf(CaldavUrlRejectedError);
      expect((err as InstanceType<typeof CaldavUrlRejectedError>).reason).toBe("unsupported-protocol");
    }
  });

  test("rejects hostnames that resolve to a private address", async () => {
    const lookup: LookupFn = async () => [{ address: "10.0.0.5", family: 4 }];
    const err = await assertSafeCaldavUrl("https://internal.example.test/", {
      lookup
    }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(CaldavUrlRejectedError);
    expect((err as InstanceType<typeof CaldavUrlRejectedError>).reason).toBe("private-ip");
  });

  test("rejects hostnames where *any* resolved record is private (rebinding-style)", async () => {
    const lookup: LookupFn = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 }
    ];
    const err = await assertSafeCaldavUrl("https://mixed.example.test/", {
      lookup
    }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(CaldavUrlRejectedError);
    expect((err as InstanceType<typeof CaldavUrlRejectedError>).reason).toBe("private-ip");
  });

  test("rejects malformed URLs", async () => {
    const err = await assertSafeCaldavUrl("not a url", { lookup: denyLookup }).catch(
      (e: Error) => e
    );
    expect(err).toBeInstanceOf(CaldavUrlRejectedError);
    expect((err as InstanceType<typeof CaldavUrlRejectedError>).reason).toBe("invalid-url");
  });
});

describe("createCaldavClient — SSRF guard", () => {
  const denyLookup: LookupFn = async () => {
    throw new Error("DNS should not be called");
  };

  test("throws CaldavUrlRejectedError before calling tsdav for private URLs", async () => {
    const callsBefore = createDAVClient.mock.calls.length;
    await expect(
      createCaldavClient(
        { url: "http://127.0.0.1/", user: "u", password: "p" },
        { lookup: denyLookup }
      )
    ).rejects.toBeInstanceOf(CaldavUrlRejectedError);
    // tsdav must not have been invoked — the guard short-circuits first.
    expect(createDAVClient.mock.calls.length).toBe(callsBefore);
  });

  test("refuses plain http:// with a password before calling tsdav", async () => {
    const callsBefore = createDAVClient.mock.calls.length;
    const err = await createCaldavClient(
      { url: "http://caldav.example.com/", user: "u", password: "p" },
      { lookup: tableLookup }
    ).catch((e: Error) => e);
    expect(err).toBeInstanceOf(CaldavUrlRejectedError);
    expect((err as InstanceType<typeof CaldavUrlRejectedError>).reason).toBe("https-required");
    expect(createDAVClient.mock.calls.length).toBe(callsBefore);
  });

  test("hands tsdav a guarded fetch for every request", async () => {
    await createCaldavClient(
      { url: "https://caldav.example.com/", user: "u", password: "p" },
      { lookup: tableLookup }
    );
    const lastCall = createDAVClient.mock.calls[createDAVClient.mock.calls.length - 1];
    expect(typeof (lastCall[0] as { fetch?: unknown }).fetch).toBe("function");
  });

  test("calls tsdav when the URL is public", async () => {
    const lookup: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];
    const callsBefore = createDAVClient.mock.calls.length;
    await createCaldavClient(
      { url: "https://caldav.example.com/", user: "u", password: "p" },
      { lookup }
    );
    expect(createDAVClient.mock.calls.length).toBe(callsBefore + 1);
  });

  test("hands tsdav the validated URL (not the raw user input) so no re-parse happens", async () => {
    const lookup: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];
    await createCaldavClient(
      { url: "https://caldav.example.com/dav", user: "u", password: "p" },
      { lookup }
    );
    const lastCall = createDAVClient.mock.calls[createDAVClient.mock.calls.length - 1];
    const arg = lastCall[0] as { serverUrl: string };
    // `new URL("https://caldav.example.com/dav").toString()` canonicalizes to
    // the same value for this input; the point is that tsdav receives a
    // URL-parsed string rather than the unvalidated raw config field.
    expect(arg.serverUrl).toBe("https://caldav.example.com/dav");
  });
});

describe("testCaldavConnection — SSRF guard surfaces a clear message", () => {
  const denyLookup: LookupFn = async () => {
    throw new Error("DNS should not be called");
  };

  test("returns {ok:false, message} with the rejection reason for private URLs", async () => {
    const res = await testCaldavConnection(
      { url: "https://169.254.169.254/", user: "u", password: "p" },
      { lookup: denyLookup }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("private-ip");
  });

  test("returns {ok:false, message} for unsupported-protocol", async () => {
    const res = await testCaldavConnection(
      { url: "file:///etc/passwd", user: "u", password: "p" },
      { lookup: denyLookup }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("unsupported-protocol");
  });
});

type BaseCall = { url: string; init: RequestInit };
function scriptedFetch(responses: Array<() => Response>) {
  const calls: BaseCall[] = [];
  const base = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return next();
  };
  return { calls, base };
}
const redirect = (status: number, location: string) => () =>
  new Response(null, { status, headers: { location } });
const ok = () => new Response("<multistatus/>", { status: 207 });

describe("createGuardedCaldavFetch — every hop is checked", () => {
  test("rejects a private server-supplied href without connecting", async () => {
    const { calls, base } = scriptedFetch([ok]);
    const guarded = createGuardedCaldavFetch({ lookup: tableLookup, fetch: base });
    const err = await guarded("https://internal.example.test/cal/", { method: "PROPFIND" }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(CaldavUrlRejectedError);
    expect(calls).toHaveLength(0);
    const literal = await guarded("http://127.0.0.1:8008/internal-admin/", { method: "PROPFIND" }).catch((e: Error) => e);
    expect(literal).toBeInstanceOf(CaldavUrlRejectedError);
    expect(calls).toHaveLength(0);
  });

  test("does not follow a redirect to an internal address", async () => {
    const { calls, base } = scriptedFetch([redirect(301, "http://127.0.0.1:8008/internal-admin/"), ok]);
    const guarded = createGuardedCaldavFetch({ lookup: tableLookup, fetch: base });
    const err = await guarded("https://caldav.example.com/dav/", {
      method: "PROPFIND",
      headers: { authorization: "Basic c2VjcmV0" }
    }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(CaldavUrlRejectedError);
    expect(calls.map((c) => c.url)).toEqual(["https://caldav.example.com/dav/"]);
    expect(calls[0].init.redirect).toBe("manual");
  });

  test("does not follow a redirect to a hostname that resolves privately", async () => {
    const { calls, base } = scriptedFetch([redirect(307, "https://internal.example.test/x"), ok]);
    const guarded = createGuardedCaldavFetch({ lookup: tableLookup, fetch: base });
    await expect(guarded("https://caldav.example.com/dav/", { method: "PROPFIND" })).rejects.toBeInstanceOf(CaldavUrlRejectedError);
    expect(calls).toHaveLength(1);
  });

  test("follows a public redirect, keeps method and auth on the same origin", async () => {
    const { calls, base } = scriptedFetch([redirect(308, "/dav/calendars/"), ok]);
    const guarded = createGuardedCaldavFetch({ lookup: tableLookup, requireHttps: true, fetch: base });
    const res = await guarded("https://caldav.example.com/dav/", {
      method: "PROPFIND",
      body: "<propfind/>",
      headers: { authorization: "Basic c2VjcmV0" }
    });
    expect(res.status).toBe(207);
    expect(calls.map((c) => c.url)).toEqual(["https://caldav.example.com/dav/", "https://caldav.example.com/dav/calendars/"]);
    expect(calls[1].init.method).toBe("PROPFIND");
    expect(calls[1].init.body).toBe("<propfind/>");
    expect(new Headers(calls[1].init.headers).get("authorization")).toBe("Basic c2VjcmV0");
  });

  test("drops the Authorization header when a redirect leaves the origin", async () => {
    const { calls, base } = scriptedFetch([redirect(307, "https://other.example.com/dav/"), ok]);
    const guarded = createGuardedCaldavFetch({ lookup: tableLookup, fetch: base });
    await guarded("https://caldav.example.com/dav/", { method: "PROPFIND", headers: { authorization: "Basic c2VjcmV0" } });
    expect(new Headers(calls[1].init.headers).get("authorization")).toBeNull();
  });

  test("refuses a redirect to plain http:// for password connections", async () => {
    const { calls, base } = scriptedFetch([redirect(302, "http://caldav.example.com/dav/"), ok]);
    const guarded = createGuardedCaldavFetch({ lookup: tableLookup, requireHttps: true, fetch: base });
    const err = await guarded("https://caldav.example.com/dav/", { method: "PROPFIND" }).catch((e: Error) => e);
    expect((err as InstanceType<typeof CaldavUrlRejectedError>).reason).toBe("https-required");
    expect(calls).toHaveLength(1);
  });

  test("303 switches to GET without body", async () => {
    const { calls, base } = scriptedFetch([redirect(303, "/done"), ok]);
    const guarded = createGuardedCaldavFetch({ lookup: tableLookup, fetch: base });
    await guarded("https://caldav.example.com/dav/", { method: "PUT", body: "BEGIN:VCALENDAR", headers: { "content-type": "text/calendar" } });
    expect(calls[1].init.method).toBe("GET");
    expect(calls[1].init.body).toBeUndefined();
    expect(new Headers(calls[1].init.headers).get("content-type")).toBeNull();
  });

  test("stops after the redirect limit", async () => {
    const loops = Array.from({ length: MAX_CALDAV_REDIRECTS + 2 }, (_, i) => redirect(302, `/hop-${i}`));
    const { calls, base } = scriptedFetch(loops);
    const guarded = createGuardedCaldavFetch({ lookup: tableLookup, fetch: base });
    const err = await guarded("https://caldav.example.com/dav/").catch((e: Error) => e);
    expect((err as InstanceType<typeof CaldavUrlRejectedError>).reason).toBe("too-many-redirects");
    expect(calls).toHaveLength(MAX_CALDAV_REDIRECTS + 1);
  });

  test("returns the 3xx untouched for redirect: manual (tsdav discovery re-requests the target through the guard)", async () => {
    const { calls, base } = scriptedFetch([redirect(301, "http://127.0.0.1/")]);
    const guarded = createGuardedCaldavFetch({ lookup: tableLookup, fetch: base });
    const res = await guarded("https://caldav.example.com/.well-known/caldav", { method: "PROPFIND", redirect: "manual" });
    expect(res.status).toBe(301);
    expect(calls).toHaveLength(1);
    await expect(guarded(res.headers.get("location")!, { method: "PROPFIND" })).rejects.toBeInstanceOf(CaldavUrlRejectedError);
    expect(calls).toHaveLength(1);
  });
});

describe("selectConfiguredCalendars — fail closed", () => {
  const calendars = [
    { url: "https://caldav.example.com/dav/calendars/user/personal/", displayName: "Personal" },
    { url: "https://caldav.example.com/dav/calendars/user/personal-private/", displayName: "Private" },
    { url: "https://caldav.example.com/dav/calendars/user/team%20plan/", displayName: "Team" }
  ];

  test("blank selector keeps auto-discovery", () => {
    expect(selectConfiguredCalendars(calendars, "  ")).toHaveLength(3);
    expect(selectConfiguredCalendars(calendars, undefined)).toHaveLength(3);
  });

  test("matches exactly one collection by path or full URL", () => {
    expect(selectConfiguredCalendars(calendars, "/dav/calendars/user/personal/").map((c) => c.displayName)).toEqual(["Personal"]);
    expect(selectConfiguredCalendars(calendars, "/dav/calendars/user/personal").map((c) => c.displayName)).toEqual(["Personal"]);
    expect(selectConfiguredCalendars(calendars, "https://caldav.example.com/dav/calendars/user/personal-private/").map((c) => c.displayName)).toEqual(["Private"]);
    expect(selectConfiguredCalendars(calendars, "/dav/calendars/user/team plan/").map((c) => c.displayName)).toEqual(["Team"]);
  });

  test("an unmatched selector does not fall back to all calendars", () => {
    expect(() => selectConfiguredCalendars(calendars, "/dav/calendars/user/gone/")).toThrow(CaldavCalendarSelectionError);
    // A substring of several collections is no longer a match.
    expect(() => selectConfiguredCalendars(calendars, "personal")).toThrow(CaldavCalendarSelectionError);
    expect(() => selectConfiguredCalendars(calendars, "https://other.example.com/dav/calendars/user/personal/")).toThrow(CaldavCalendarSelectionError);
  });

  test("an ambiguous selector fails closed", () => {
    const twoOrigins = [
      { url: "https://caldav.example.com/cal/" },
      { url: "https://other.example.com/cal/" }
    ];
    expect(() => selectConfiguredCalendars(twoOrigins, "/cal/")).toThrow(CaldavCalendarSelectionError);
  });
});

describe("isHrefInCalendarCollection", () => {
  const calendar = "https://caldav.example.com/dav/cal/";
  test("accepts objects inside the collection", () => {
    expect(isHrefInCalendarCollection("https://caldav.example.com/dav/cal/a.ics", calendar)).toBe(true);
    expect(isHrefInCalendarCollection("/dav/cal/a.ics", calendar)).toBe(true);
  });
  test("rejects other origins, other collections and traversal", () => {
    expect(isHrefInCalendarCollection("https://other.example.com/dav/cal/a.ics", calendar)).toBe(false);
    expect(isHrefInCalendarCollection("https://caldav.example.com/dav/other/a.ics", calendar)).toBe(false);
    expect(isHrefInCalendarCollection("https://caldav.example.com/dav/cal/../other/a.ics", calendar)).toBe(false);
    expect(isHrefInCalendarCollection("https://caldav.example.com/dav/cal/%2e%2e/other/a.ics", calendar)).toBe(false);
    expect(isHrefInCalendarCollection("https://caldav.example.com/dav/cal/", calendar)).toBe(false);
    expect(isHrefInCalendarCollection("https://caldav.example.com/dav/cal/a.ics", undefined)).toBe(false);
  });
});
