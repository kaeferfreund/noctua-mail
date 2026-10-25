import { expect, test } from "bun:test";
import { createAuthenticatedTestSession, getSharedTestAuthHarness } from "@/lib/testAuthHarness";
import { PUT } from "./route";
import { GET as me } from "../me/route";
import { getUserById, setUserUiLocale } from "@/lib/serverDb";
import { resolveRequestLocale } from "@/lib/i18n/requestLocale";

function request(cookie = "", body: unknown = { uiLocale: "en" }, extra: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/auth/preferences", { method: "PUT", headers: {
    origin: "http://localhost:3000", "content-type": "application/json", cookie, ...extra
  }, body: JSON.stringify(body) });
}

test("requires a live MFA session, without requiring a selected mailbox", async () => {
  expect((await PUT(request())).status).toBe(401);
  const h = await getSharedTestAuthHarness();
  const user = await h.createUser(`locale-setup-${crypto.randomUUID()}@example.test`);
  const signed = await h.signIn(user.email);
  await h.seedSessionSecurity(signed.session!.session.id, user.id, "setup");
  expect((await PUT(request(signed.jar.header()))).status).toBe(403);
  expect((await getUserById(user.id))?.uiLocale).toBeNull();
});

test("validates the exact sparse self-only shape and applies shared origin/JSON hygiene", async () => {
  const f = await createAuthenticatedTestSession();
  for (const body of [{}, null, [], "en", { uiLocale: "fr" }, { uiLocale: "EN" }, { uiLocale: false }, { uiLocale: "en", userId: "another-user" }, { uiLocale: "de", unknown: 1 }]) {
    const response = await PUT(request(f.jar.header(), body));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_request");
  }
  const malformed = request(f.jar.header());
  expect((await PUT(new Request(malformed.url, { method: "PUT", headers: malformed.headers, body: "{" }))).status).toBe(400);
  for (const extra of ([{ origin: "https://foreign.example.test" }, { origin: "" }, { "sec-fetch-site": "cross-site" }] as Record<string, string>[])) {
    const response = await PUT(request(f.jar.header(), { uiLocale: "de" }, extra));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("invalid_origin");
  }
  const nonJson = await PUT(request(f.jar.header(), { uiLocale: "en" }, { "content-type": "text/plain" }));
  expect(nonJson.status).toBe(400);
  expect((await nonJson.json()).code).toBe("json_required");
  expect((await getUserById(f.user.id))?.uiLocale).toBeNull();
});

test("persists only the session user's value, synchronizes cookie and exposes /me additively", async () => {
  const f = await createAuthenticatedTestSession();
  const other = await f.createUser(`locale-bystander-${crypto.randomUUID()}@example.test`);
  const authBefore = f.master.prepare("SELECT * FROM auth_user WHERE id=?").get(f.user.id);
  const auditBefore = f.master.prepare("SELECT COUNT(*) AS count FROM admin_audit WHERE actorUserId=?").get(f.user.id);
  for (const uiLocale of ["en", "de", null] as const) {
    const response = await PUT(request(f.jar.header(), { uiLocale }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, uiLocale });
    expect(response.headers.getSetCookie().some(cookie => cookie.startsWith(`noctua-ui-locale=${uiLocale ?? ""};`) && cookie.includes(uiLocale === null ? "Max-Age=0" : "Max-Age=31536000"))).toBe(true);
    expect((await getUserById(other.id))?.uiLocale).toBeNull();
    const identity = await me(new Request("http://localhost:3000/api/auth/me", { headers: f.jar.headers() }));
    expect(identity.status).toBe(200);
    const data = await identity.json();
    expect(data.user.uiLocale).toBe(uiLocale);
    expect(data).toMatchObject({ ok: true, mailboxState: "none", accountId: null, accounts: [], security: { enrollmentRequired: false, reauthRequired: false } });
    expect(typeof data.exp).toBe("number");
    expect(typeof data.ttlSeconds).toBe("number");
  }
  expect(f.master.prepare("SELECT * FROM auth_user WHERE id=?").get(f.user.id)).toEqual(authBefore);
  // Like switch-account, this non-security self-service mutation does not audit.
  expect(f.master.prepare("SELECT COUNT(*) AS count FROM admin_audit WHERE actorUserId=?").get(f.user.id)).toEqual(auditBefore);
});

test("server resolution uses the guarded identity and restricted /me retains its contract", async () => {
  const f = await createAuthenticatedTestSession();
  await setUserUiLocale(f.user.id, "en");
  const headers = f.jar.headers({ "accept-language": "de-AT" });
  expect(await resolveRequestLocale(headers, "de")).toEqual({ locale: "en", uiLocale: "en", deviceLocale: "de" });
  await setUserUiLocale(f.user.id, null);
  expect((await resolveRequestLocale(headers, "en")).locale).toBe("en");
  expect((await resolveRequestLocale(headers, "invalid")).locale).toBe("de");
  await f.seedSessionSecurity(f.session.id, f.user.id, "setup");
  const response = await me(new Request("http://localhost:3000/api/auth/me", { headers }));
  expect(await response.json()).toMatchObject({ mailboxState: "enrollment", accountId: null, accounts: [], user: { id: f.user.id, uiLocale: null } });
  await setUserUiLocale(f.user.id, "en");
  expect((await resolveRequestLocale(headers, "de")).locale).toBe("en");
  // Authentication age alone no longer ends a session; an expired session does.
  await f.seedSessionSecurity(f.session.id, f.user.id, "setup", "password", Date.now() - 86400_001);
  expect((await resolveRequestLocale(headers, "de")).locale).toBe("en");
  f.master.prepare("UPDATE auth_session SET expiresAt=? WHERE id=?").run(new Date(Date.now() - 1000).toISOString(), f.session.id);
  expect((await resolveRequestLocale(headers, "de")).locale).toBe("de");
});
