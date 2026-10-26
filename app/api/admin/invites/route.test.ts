import { describe, expect, test } from "bun:test";
import { DELETE, GET, POST } from "./route";
import { POST as REVOKE } from "./[id]/revoke/route";
import { createAuthenticatedTestSession, syntheticRequestIp } from "@/lib/testAuthHarness";
import { inviteHistoryId } from "@/lib/db";

const ORIGIN = "http://localhost:3000";
const url = `${ORIGIN}/api/admin/invites`;

describe("admin invite mutation origin contract", () => {
  test("origin and JSON checks precede the admin guard; same-origin JSON creates an invite", async () => {
    const f = await createAuthenticatedTestSession(undefined, "admin");
    const request = (headers: Record<string, string>, cookie = f.jar.header()) => new Request(url, {
      method: "POST", headers: { cookie, ...headers }, body: "{}"
    });
    const json = { "content-type": "application/json" };
    for (const cookie of ["", f.jar.header()]) {
      expect((await POST(request({ ...json, origin: "https://foreign.example.test" }, cookie))).status).toBe(403);
      expect((await POST(request(json, cookie))).status).toBe(403);
      expect((await POST(request({ origin: "http://localhost:3000", "content-type": "text/plain" }, cookie))).status).toBe(400);
    }
    expect((await POST(request({ ...json, origin: "http://localhost:3000" }))).status).toBe(201);
    expect((await POST(request({ ...json, referer: "http://localhost:3000/admin" }))).status).toBe(201);
  });
});

describe("admin invite history", () => {
  const admin = createAuthenticatedTestSession(undefined, "admin");
  const list = async (cookie: string) => (await (await GET(new Request(url, { headers: { cookie } }))).json()).invites as
    { id: string; email: string | null; issuedBy: string | null; issuerDeleted: boolean; status: string }[];
  const seed = async (rows: { code: string; uses?: number; expiresAt?: number | null; revokedAt?: number | null; issuedByUserId?: string | null; email?: string | null }[]) => {
    const { master } = await admin;
    for (const row of rows) master.prepare(`INSERT INTO invite_codes(code,role,maxUses,uses,expiresAt,createdAt,email,issuedByUserId,provenance,revokedAt)
      VALUES(?, 'user', 1, ?, ?, ?, ?, ?, ?, ?)`).run(row.code, row.uses ?? 0, row.expiresAt ?? null, Date.now(), row.email ?? null,
      row.issuedByUserId ?? null, row.issuedByUserId === undefined ? "operator" : "admin", row.revokedAt ?? null);
  };
  const codes = async () => new Set(((await admin).master.prepare(`SELECT code FROM invite_codes`).all() as { code: string }[]).map(row => row.code));

  test("shows the issuer by name or email instead of the user id, operator codes without issuer", async () => {
    const { jar, user, master } = await admin;
    master.prepare(`UPDATE auth_user SET name='' WHERE id=?`).run(user.id);
    const tag = crypto.randomUUID();
    await seed([{ code: `issuer-${tag}`, issuedByUserId: user.id, email: `issuer-${tag}@example.test` }, { code: `operator-${tag}` },
      { code: `deleted-${tag}`, issuedByUserId: `gone-${tag}`, email: `deleted-${tag}@example.test` }]);
    const byCode = async (code: string) => (await list(jar.header())).find(invite => invite.id === inviteHistoryId(code))!;
    expect(await byCode(`issuer-${tag}`)).toMatchObject({ issuedBy: user.email, issuerDeleted: false, status: "issued" });
    expect(await byCode(`operator-${tag}`)).toMatchObject({ issuedBy: null, issuerDeleted: false });
    expect(await byCode(`deleted-${tag}`)).toMatchObject({ issuedBy: null, issuerDeleted: true });
    master.prepare(`UPDATE auth_user SET name='Synthetic Issuer' WHERE id=?`).run(user.id);
    expect((await byCode(`issuer-${tag}`)).issuedBy).toBe("Synthetic Issuer");
    expect(JSON.stringify(await list(jar.header()))).not.toContain(user.id);
  });

  test("cleanup requires an admin and same origin, deletes only settled codes and reports the count", async () => {
    const { jar, user, master } = await admin;
    const member = await createAuthenticatedTestSession();
    const tag = crypto.randomUUID(), now = Date.now();
    await seed([
      { code: `issued-${tag}`, expiresAt: now + 86400000, issuedByUserId: user.id, email: `issued-${tag}@example.test` },
      { code: `legacy-issued-${tag}` },
      { code: `redeemed-${tag}`, uses: 1 }, { code: `expired-${tag}`, expiresAt: now - 1 }, { code: `revoked-${tag}`, revokedAt: now - 1 },
      { code: `claiming-${tag}`, expiresAt: now - 1 }
    ]);
    master.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,inviteCode,kind,state,createdAt,updatedAt) VALUES(?,?,?,?,'signup','reserved',?,?)`)
      .run(`op-${tag}`, `user-${tag}`, `claiming-${tag}@example.test`, `claiming-${tag}`, now, now);
    const cleanup = (headers: Record<string, string>) => DELETE(new Request(url, { method: "DELETE", headers }));
    expect((await cleanup({ cookie: jar.header() })).status).toBe(403);
    expect((await cleanup({ cookie: jar.header(), origin: "https://foreign.example.test" })).status).toBe(403);
    expect((await cleanup({ cookie: member.jar.header(), origin: ORIGIN })).status).toBe(403);
    expect((await cleanup({ origin: ORIGIN })).status).toBe(401);
    expect((await codes()).has(`redeemed-${tag}`)).toBe(true);

    const settled = (master.prepare(`SELECT count(*) n FROM invite_codes WHERE NOT (COALESCE(uses,0)=0 AND revokedAt IS NULL AND (expiresAt IS NULL OR expiresAt>?))
      AND code NOT IN (SELECT inviteCode FROM user_provisioning WHERE inviteCode IS NOT NULL AND state IN ('reserved','auth_created','cleanup_required'))`).get(Date.now()) as { n: number }).n;
    expect(settled).toBeGreaterThanOrEqual(3);
    const response = await cleanup({ cookie: jar.header(), origin: ORIGIN });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, deleted: settled });
    const left = await codes();
    for (const code of [`issued-${tag}`, `legacy-issued-${tag}`, `claiming-${tag}`]) expect(left.has(code)).toBe(true);
    for (const code of [`redeemed-${tag}`, `expired-${tag}`, `revoked-${tag}`]) expect(left.has(code)).toBe(false);
    const audit = master.prepare(`SELECT actorUserId,payload FROM admin_audit WHERE action='invite.cleanup' ORDER BY rowid DESC LIMIT 1`).get() as { actorUserId: string; payload: string };
    expect(audit.actorUserId).toBe(user.id);
    expect(JSON.parse(audit.payload)).toEqual({ count: settled });
    expect(audit.payload).not.toContain(tag);
    master.prepare(`DELETE FROM user_provisioning WHERE id=?`).run(`op-${tag}`);
  });

  test("an admin revokes one issued invite by its history id; settled or unknown invites are refused", async () => {
    const { jar, user, master } = await admin;
    const member = await createAuthenticatedTestSession();
    const tag = crypto.randomUUID();
    await seed([{ code: `revoke-${tag}`, expiresAt: Date.now() + 86400000, issuedByUserId: user.id, email: `revoke-${tag}@example.test` }, { code: `other-${tag}` }]);
    const revoke = (id: string, headers: Record<string, string>) => REVOKE(new Request(`${url}/${id}/revoke`, { method: "POST", headers }), { params: Promise.resolve({ id }) });
    const id = inviteHistoryId(`revoke-${tag}`);
    expect((await revoke(id, { cookie: jar.header() })).status).toBe(403);
    expect((await revoke(id, { cookie: member.jar.header(), origin: ORIGIN })).status).toBe(403);
    expect((await revoke(`revoke-${tag}`, { cookie: jar.header(), origin: ORIGIN })).status).toBe(409);
    expect((await revoke(id, { cookie: jar.header(), origin: ORIGIN })).status).toBe(200);
    expect((await revoke(id, { cookie: jar.header(), origin: ORIGIN })).status).toBe(409);
    const statuses = new Map((await list(jar.header())).map(invite => [invite.id, invite.status]));
    expect(statuses.get(id)).toBe("revoked");
    expect(statuses.get(inviteHistoryId(`other-${tag}`))).toBe("issued");
    const audit = master.prepare(`SELECT actorUserId,payload FROM admin_audit WHERE action='invite.revoke' ORDER BY rowid DESC LIMIT 1`).get() as { actorUserId: string; payload: string };
    expect(audit.actorUserId).toBe(user.id);
    expect(JSON.parse(audit.payload)).toMatchObject({ reason: "admin_revoked", email: `revoke-${tag}@example.test` });
  });
});


test("invite mutations share the per-admin budget and apply privacy headers even when limited", async () => {
  const f = await createAuthenticatedTestSession(undefined, "admin");
  const ip = syntheticRequestIp();
  for (let i = 0; i < 11; i++) {
    const headers = { cookie: f.jar.header(), origin: ORIGIN, "x-forwarded-for": ip };
    const response = i % 2 === 0
      ? await DELETE(new Request(url, { method: "DELETE", headers }))
      : await REVOKE(new Request(`${url}/unknown/revoke`, { method: "POST", headers }), { params: Promise.resolve({ id: "unknown" }) });
    expect(response.status).toBe(i === 10 ? 429 : i % 2 === 0 ? 200 : 409);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    if (i === 10) expect(response.headers.get("retry-after")).toBe("60");
  }
});

test("invite cleanup limits a shared IP across different admins", async () => {
  const ip = syntheticRequestIp();
  const admins = await Promise.all(Array.from({ length: 4 }, () => createAuthenticatedTestSession(undefined, "admin")));
  for (let i = 0; i < 31; i++) {
    const response = await DELETE(new Request(url, { method: "DELETE", headers: {
      cookie: admins[i % admins.length].jar.header(), origin: ORIGIN, "x-forwarded-for": ip
    } }));
    expect(response.status).toBe(i === 30 ? 429 : 200);
  }
});
