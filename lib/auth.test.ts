import { describe, expect, test } from "bun:test";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireActiveUserSession, forwardAuthHeaders } from "./auth";
import { createAuthenticatedTestSession, getSharedTestAuthHarness } from "./testAuthHarness";
import { withDbWriteRetry } from "./dbWriteRetry";

function request(cookie: string) { return new Request("http://localhost:3000/api/auth/me", {headers:{cookie}}); }

describe("live session assurance gate", () => {
  test("ignores a forged legacy cookie", async () => {
    const response = await requireActiveUserSession(request("noctua_session=forged"));
    expect(response).toBeInstanceOf(NextResponse);
    expect((response as NextResponse).status).toBe(401);
  });

  test("requires a matching sidecar and current generation even for restricted access", async () => {
    const f = await createAuthenticatedTestSession();
    const guard = () => requireActiveUserSession(request(f.jar.header()), {allowRestricted:true});
    expect(await guard()).not.toBeInstanceOf(NextResponse);
    await withDbWriteRetry("test.gate", () => f.master.prepare("DELETE FROM auth_session_security WHERE sessionId=?").run(f.session.id));
    expect((await guard() as NextResponse).status).toBe(401);
    await f.seedSessionSecurity(f.session.id, f.user.id, "mfa");
    await withDbWriteRetry("test.gate", () => f.master.prepare("UPDATE auth_session_security SET generation=generation-1 WHERE sessionId=?").run(f.session.id));
    expect((await guard() as NextResponse).status).toBe(401);
    await f.seedSessionSecurity(f.session.id, f.user.id, "mfa");
    const other = await f.createUser(`other-${randomUUID()}@example.test`);
    await withDbWriteRetry("test.gate", () => f.master.prepare("UPDATE auth_session_security SET userId=? WHERE sessionId=?").run(other.id, f.session.id));
    expect((await guard() as NextResponse).status).toBe(401);
  });

  test("user-wide enrollment cannot promote another setup session", async () => {
    const f = await getSharedTestAuthHarness();
    const user = await f.createUser(`two-session-${randomUUID()}@example.test`);
    const a = await f.signIn(user.email); const b = await f.signIn(user.email);
    await f.enrollTotp(a.jar, "synthetic-password-123");
    await f.seedSessionSecurity(b.session!.session.id, user.id, "setup");
    const response = await requireActiveUserSession(request(b.jar.header()));
    expect((response as NextResponse).status).toBe(403);
    const restricted = await requireActiveUserSession(request(b.jar.header()),{allowRestricted:true});
    expect(restricted).not.toBeInstanceOf(NextResponse);
    if (!(restricted instanceof NextResponse)) expect(restricted.reauthRequired).toBe(true);
  });

  test("flag/factor write faults never authorize mail", async () => {
    const f = await createAuthenticatedTestSession();
    const guard = () => requireActiveUserSession(request(f.jar.header()));
    for (const mutate of [
      () => f.master.prepare("UPDATE auth_two_factor SET verified=0 WHERE userId=?").run(f.user.id),
      () => f.master.prepare("UPDATE auth_two_factor SET verified=1,secret='' WHERE userId=?").run(f.user.id),
      () => f.master.prepare("DELETE FROM auth_two_factor WHERE userId=?").run(f.user.id)
    ]) {
      await withDbWriteRetry("test.factorFault", mutate);
      const response = await guard() as NextResponse;
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("mfa_state_inconsistent");
    }
    const second = await createAuthenticatedTestSession();
    await withDbWriteRetry("test.factorFault", () => second.master.prepare("UPDATE auth_user SET twoFactorEnabled=0 WHERE id=?").run(second.user.id));
    const denied = await requireActiveUserSession(request(second.jar.header())) as NextResponse;
    expect((await denied.json()).code).toBe("mfa_state_inconsistent");
  });

  test("authentication age does not end a used session; a future authentication time still fails", async () => {
    const f = await createAuthenticatedTestSession();
    const authenticatedAt = Date.now()-90000_000;
    await f.seedSessionSecurity(f.session.id,f.user.id,"mfa","password_totp", authenticatedAt);
    const session = await requireActiveUserSession(request(f.jar.header()));
    if (session instanceof NextResponse) throw new Error(`Session used after 25 h was denied: ${session.status}`);
    expect(session.authenticatedAt).toBe(authenticatedAt);
    expect(session.expiresAt).toBe(new Date(f.master.prepare("SELECT expiresAt FROM auth_session WHERE id=?").get(f.session.id).expiresAt).getTime());
    await f.seedSessionSecurity(f.session.id,f.user.id,"mfa","password_totp", Date.now()+60_000);
    expect((await requireActiveUserSession(request(f.jar.header())) as NextResponse).status).toBe(401);
  });

  test("activity slides expiry to three days from now; three days without activity end the session", async () => {
    const f = await createAuthenticatedTestSession();
    const setSession = (updatedAt: number, expiresAt: number) => withDbWriteRetry("test.sliding", () =>
      f.master.prepare("UPDATE auth_session SET updatedAt=?,expiresAt=? WHERE id=?").run(new Date(updatedAt).toISOString(), new Date(expiresAt).toISOString(), f.session.id));
    // Within updateAge (1 h) of the last refresh, a request neither writes nor sets a cookie.
    const recent = Date.now()+259200_000-600_000;
    await setSession(Date.now()-600_000, recent);
    const unchanged = await requireActiveUserSession(request(f.jar.header()));
    if (unchanged instanceof NextResponse) throw new Error(`Recently refreshed session was denied: ${unchanged.status}`);
    expect(unchanged.expiresAt).toBe(recent);
    expect(unchanged.responseHeaders.getSetCookie()).toEqual([]);
    // Two days idle: the next request extends to now + 3 days and refreshes the cookie.
    await setSession(Date.now()-2*86400_000, Date.now()+86400_000);
    const before = Date.now();
    const used = await requireActiveUserSession(request(f.jar.header()));
    if (used instanceof NextResponse) throw new Error(`Session used after two idle days was denied: ${used.status}`);
    expect(used.expiresAt).toBeGreaterThanOrEqual(before+259200_000);
    expect(used.responseHeaders.getSetCookie().join(";")).toContain("Max-Age=259200");
    expect(new Date(f.master.prepare("SELECT expiresAt FROM auth_session WHERE id=?").get(f.session.id).expiresAt).getTime()).toBe(used.expiresAt);
    // Unused for more than three days: the row has expired and the session is gone.
    await setSession(Date.now()-259200_001, Date.now()-1);
    const expired = await requireActiveUserSession(request(f.jar.header())) as NextResponse;
    expect(expired.status).toBe(401);
    expect(expired.headers.getSetCookie().join(";")).toContain("Max-Age=0");
  });

  test("ban, missing profile, incomplete provisioning and session deletion fail closed", async () => {
    const f = await createAuthenticatedTestSession();
    const guard = () => requireActiveUserSession(request(f.jar.header()));
    const operation = randomUUID();
    await withDbWriteRetry("test.provision", () => f.master.prepare("INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt) VALUES(?,?,?,'signup','reserved',?,?)").run(operation,f.user.id,f.user.email,Date.now(),Date.now()));
    expect((await guard() as NextResponse).status).toBe(401);
    await withDbWriteRetry("test.provision", () => f.master.prepare("UPDATE user_provisioning SET state='complete' WHERE id=?").run(operation));
    await withDbWriteRetry("test.provision", () => f.master.prepare("UPDATE user_provisioning SET state='cancelled' WHERE id=?").run(operation));
    expect(await guard()).not.toBeInstanceOf(NextResponse);
    await withDbWriteRetry("test.profile", () => f.master.prepare("DELETE FROM users WHERE id=?").run(f.user.id));
    expect((await guard() as NextResponse).status).toBe(401);
    const b = await createAuthenticatedTestSession();
    await withDbWriteRetry("test.ban", () => b.master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(b.user.id));
    expect((await requireActiveUserSession(request(b.jar.header())) as NextResponse).status).toBe(401);
    const c = await createAuthenticatedTestSession();
    await withDbWriteRetry("test.delete", () => c.master.prepare("DELETE FROM auth_session WHERE id=?").run(c.session.id));
    expect((await requireActiveUserSession(request(c.jar.header())) as NextResponse).status).toBe(401);
  });

  test("forwards multiple cookies without coalescing or duplicating", () => {
    const headers = new Headers(); headers.append("set-cookie","one=1; Path=/");headers.append("set-cookie","two=2; Path=/");
    const response = forwardAuthHeaders(new NextResponse(),headers);
    forwardAuthHeaders(response,headers);
    expect(response.headers.getSetCookie()).toEqual(["one=1; Path=/","two=2; Path=/"]);
  });

  test("keeps a route's own Cache-Control and applies the library's only where the route stayed silent", () => {
    const headers = new Headers({ "cache-control": "no-store", "x-auth-extra": "1" });
    const cached = forwardAuthHeaders(new NextResponse(null, { headers: { "cache-control": "private, max-age=86400" } }), headers);
    expect(cached.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(cached.headers.get("x-auth-extra")).toBe("1");
    const silent = forwardAuthHeaders(new NextResponse(), headers);
    expect(silent.headers.get("cache-control")).toBe("no-store");
  });
});

test("keeps a route's own Cache-Control while forwarding auth headers", () => {
  const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json", "Content-Length": "123" });
  headers.append("Set-Cookie", "synthetic=1; Path=/");
  for (const status of [200, 304]) {
    const response = new Response(null, { status, headers: { "Cache-Control": "private, max-age=86400", ETag: '"synthetic"', "Content-Type": "application/octet-stream" } });
    forwardAuthHeaders(response, headers);
    expect(response.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(response.headers.get("etag")).toBe('"synthetic"');
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.has("content-length")).toBe(false);
    expect(response.headers.getSetCookie()).toEqual(["synthetic=1; Path=/"]);
  }
  expect(forwardAuthHeaders(new Response(), headers).headers.get("cache-control")).toBe("no-store");
});
