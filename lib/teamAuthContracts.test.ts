import { expect, test } from "bun:test";
import { createAuthenticatedTestSession, syntheticRequestIp, totpFromUri } from "./testAuthHarness";
import { dbModulePromise } from "./testDbHarness";
import { persistAccountRow } from "./db/rowParsers";
import { GET as candidates } from "@/app/api/accounts/[accountId]/members/candidates/route";
import { PUT as putMember, DELETE as deleteMember } from "@/app/api/accounts/[accountId]/members/[userId]/route";
import { PUT as adminPutMember, DELETE as adminDeleteMember } from "@/app/api/admin/accounts/[accountId]/members/[userId]/route";
import { GET as users } from "@/app/api/admin/users/route";
import { DELETE as removePasskey } from "@/app/api/admin/users/[userId]/passkeys/[passkeyId]/route";
import { POST as reauth } from "@/app/api/auth/reauth/route";
import { GET as audit } from "@/app/api/admin/audit/route";
import { GET as invites, POST as issueInvite } from "@/app/api/admin/invites/route";

async function fixture() {
  const id = `contracts-${crypto.randomUUID()}`;
  const actor = await createAuthenticatedTestSession(undefined, "admin");
  const account = { id, name: "Synthetic Contract Mailbox", email: `${id}@example.test`, avatar: "",
    imap: { host: "imap.example.test", user: "synthetic@example.test", password: "synthetic-secret", port: 993, secure: true },
    smtp: { host: "smtp.example.test", user: "synthetic@example.test", password: "synthetic-secret", port: 465, secure: true } };
  persistAccountRow(actor.master, account);
  await actor.addMembership(actor.user.id, id);
  return { ...actor, id, account };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function request(f: Fixture, path: string, method = "GET", body?: unknown, extra: Record<string,string> = {}) {
  return new Request(`http://localhost:3000/api/${path}`, { method,
    headers: f.jar.headers({ origin: "http://localhost:3000", "x-forwarded-for": syntheticRequestIp(), ...(body === undefined ? {} : { "content-type": "application/json" }), ...extra }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function params(f: Fixture, userId = "") { return { params: Promise.resolve({ accountId: f.id, userId }) }; }

for (const role of ["viewer", "editor"] as const) test(`G1 candidates denies ${role} and admin without membership (D6)`, async () => {
  const f = await fixture(), db = await dbModulePromise;
  await db.setUserAccountRole(f.user.id, f.id, role, f.user.id);
  expect((await candidates(request(f, "candidates"), params(f))).status).toBe(403);
  await db.removeUserAccountLink(f.user.id, f.id);
  expect((await candidates(request(f, "candidates"), params(f))).status).toBe(403);
});

test("G1 candidates excludes disabled, incomplete, members and implicit owner; returns identity fields only", async () => {
  const f = await fixture();
  const prefix = `directory-${crypto.randomUUID()}`;
  const enabled = await f.createUser(`${prefix}-enabled@example.test`);
  const disabled = await f.createUser(`${prefix}-disabled@example.test`);
  const member = await f.createUser(`${prefix}-member@example.test`);
  const owner = await f.createUser(`${prefix}-owner@example.test`);
  const incomplete = await f.createUser(`${prefix}-incomplete@example.test`);
  await f.auth.api.banUser({ headers: f.jar.headers(), body: { userId: disabled.id } });
  await f.addMembership(member.id, f.id, "viewer");
  persistAccountRow(f.master, { ...f.account, ownerUserId: owner.id });
  const now = Date.now();
  f.master.prepare(`INSERT INTO user_provisioning(id,normalizedEmail,userId,kind,state,createdAt,updatedAt) VALUES(?,?,?,'signup','reserved',?,?)`).run(crypto.randomUUID(), incomplete.email, incomplete.id, now, now);
  const response = await candidates(request(f, `candidates?q=${prefix.toUpperCase()}`), params(f));
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ ok: true, candidates: [{ id: enabled.id, name: enabled.name, email: enabled.email }] });
  expect((await (await candidates(request(f, `candidates?q=${prefix}%25`), params(f))).json()).candidates).toEqual([]);
  f.master.prepare(`DELETE FROM user_provisioning WHERE userId=?`).run(incomplete.id);
});

test("G1 candidates caps enumeration at 100, defaults to 25, bounds query and limit", async () => {
  const f = await fixture(), prefix = `cap-${crypto.randomUUID()}`;
  const insert = f.master.prepare(`INSERT INTO auth_user(id,name,email,emailVerified,createdAt,updatedAt,role) VALUES(?,?,?,0,?,?,'user')`);
  f.master.transaction(() => {
    for (let i = 0; i < 105; i++) insert.run(`${prefix}-${i}`, "Synthetic Candidate", `${prefix}-${String(i).padStart(3,"0")}@example.test`, new Date().toISOString(), new Date().toISOString());
  })();
  for (const [limit, count] of [["",25],["&limit=999999",100],["&limit=2",2],["&limit=-1",1],["&limit=NaN",25]] as const) {
    const response = await candidates(request(f, `candidates?q=${prefix}${limit}`), params(f));
    const body = await response.json();expect(body.candidates).toHaveLength(count);
    expect(body.candidates[0].email).toBe(`${prefix}-000@example.test`);
  }
  expect((await candidates(request(f, `candidates?q=${"x".repeat(129)}`), params(f))).status).toBe(400);
});

for (const admin of [false, true]) for (const code of ["owner_immutable", "self_role_change", "last_manager", "target_disabled", "target_missing", "above_manager", "not_member"] as const) {
  if (admin && code === "self_role_change") continue; // Dedicated admin routes deliberately override the self rule.
  test(`G2 ${admin ? "admin" : "manager"} membership returns ${code}`, async () => {
    const f = await fixture();
    let userId = `missing-${crypto.randomUUID()}`, role = "viewer", remove = false;
    if (code === "owner_immutable") {
      const owner = await f.createUser(`owner-${crypto.randomUUID()}@example.test`);userId = owner.id;
      persistAccountRow(f.master, { ...f.account, ownerUserId: userId });
    } else if (code === "self_role_change" || code === "last_manager") {
      userId = f.user.id;remove = code === "last_manager";
    } else if (code === "target_disabled") {
      const target = await f.createUser(`disabled-${crypto.randomUUID()}@example.test`);userId = target.id;
      await f.auth.api.banUser({ headers: f.jar.headers(), body: { userId } });
    } else if (code === "above_manager") role = "admin";
    else if (code === "not_member") { userId = (await f.createUser(`nonmember-${crypto.randomUUID()}@example.test`)).id;remove = true; }
    const handler = remove ? admin ? adminDeleteMember : deleteMember : admin ? adminPutMember : putMember;
    const response = await handler(request(f, "members", remove ? "DELETE" : "PUT", remove ? undefined : { role }), params(f,userId));
    expect(response.status).toBe(code === "not_member" ? 404 : ["target_disabled","target_missing","above_manager"].includes(code) ? 400 : 403);
    expect(await response.json()).toEqual({ ok: false, code, message: expect.any(String) });
    expect(f.master.prepare(`SELECT 1 FROM admin_audit WHERE targetAccountId=?`).get(f.id)).toBeNull();
  });
}

test("G2 admin self-role override still works with another enabled manager", async () => {
  const f = await fixture(), other = await f.createUser(`manager-${crypto.randomUUID()}@example.test`);
  await f.addMembership(other.id, f.id);
  expect((await adminPutMember(request(f,"members","PUT",{role:"viewer"}), params(f,f.user.id))).status).toBe(200);
});

test("G3 admin passkey DTO targets opaque resource; removal checks ownership and audits id", async () => {
  const f = await fixture(), target = await f.createUser(`key-target-${crypto.randomUUID()}@example.test`);
  const keyId = `opaque-${crypto.randomUUID()}`, createdAt = Date.now();
  f.master.prepare(`INSERT INTO auth_passkey(id,userId,name,createdAt,publicKey,credentialID,counter,deviceType,backedUp) VALUES(?,?,?,?,'synthetic-private-public-key','synthetic-credential-id',0,'singleDevice',0)`).run(keyId,target.id,"Synthetic Security Key",new Date(createdAt).toISOString());
  const response = await users(request(f,"admin/users")), body = await response.json();
  const dto = body.users.find((user: {id:string}) => user.id === target.id);
  expect(dto.passkeys).toEqual([{id:keyId,name:"Synthetic Security Key",createdAt}]);expect(dto.passkeyCount).toBe(1);
  expect(body.users.find((user: {id:string}) => user.id === f.user.id).passkeys).toEqual([]);
  expect(JSON.stringify(body)).not.toContain("synthetic-private-public-key");expect(JSON.stringify(body)).not.toContain("synthetic-credential-id");
  const admin = await f.createUser(`key-admin-${crypto.randomUUID()}@example.test`, undefined, "admin");
  const signed = await f.signIn(admin.email), factor = await f.enrollTotp(signed.jar,"synthetic-password-123");
  const live = await f.auth.api.getSession({headers:signed.jar.headers()});await f.seedSessionSecurity(live!.session.id,admin.id,"mfa");
  const actor = {...f,jar:signed.jar};
  for (const userId of [f.user.id,target.id]) {
    const proof = await reauth(request(actor,"auth/reauth","POST",{purpose:"admin.recovery",currentPassword:"synthetic-password-123",totpCode:totpFromUri(factor.totpURI)}));
    expect(proof.status).toBe(200);const {grant} = await proof.json();
    const removed = await removePasskey(request(actor,"admin/passkeys","DELETE",undefined,{"x-noctua-reauth":grant}),{params:Promise.resolve({userId,passkeyId:keyId})});
    expect(removed.status).toBe(userId === target.id ? 200 : 404);
    if (userId !== target.id) expect(await removed.json()).toEqual({ok:false,code:"passkey_not_found"});
  }
  expect(f.master.prepare(`SELECT 1 FROM auth_passkey WHERE id=?`).get(keyId)).toBeNull();
  const entry = f.master.prepare(`SELECT actorUserId,payload FROM admin_audit WHERE action='user.passkey_remove' AND targetUserId=?`).get(target.id) as {actorUserId:string;payload:string};
  expect(entry.actorUserId).toBe(admin.id);expect(JSON.parse(entry.payload)).toMatchObject({passkeyId:keyId});
  expect(entry.payload).not.toContain("synthetic-credential-id");
});

test("G4 audit cursor pages three equal timestamps without skipped or duplicate entries", async () => {
  const f = await fixture(), createdAt = Date.now() + 1_000_000;
  const ids = ["a","b","c"].map(id => `${f.id}-${id}`);
  for (const id of ids) f.master.prepare(`INSERT INTO admin_audit(id,actorUserId,action,createdAt) VALUES(?,?,'user.update',?)`).run(id,f.user.id,createdAt);
  try {
    const first = await audit(request(f,"admin/audit?limit=2")), body = await first.json();
    expect(first.status).toBe(200);expect(body.entries.map((entry:{id:string}) => entry.id)).toEqual([ids[2],ids[1]]);
    expect(typeof body.nextCursor).toBe("string");
    const next = await audit(request(f,`admin/audit?limit=2&before=${encodeURIComponent(body.nextCursor)}`)), second = await next.json();
    expect(second.entries[0].id).toBe(ids[0]);
    expect(second.entries.some((entry:{id:string}) => [ids[1],ids[2]].includes(entry.id))).toBe(false);
    for (const cursor of ["invalid","1234",Buffer.from(JSON.stringify([-1,"x"])).toString("base64url"),"x".repeat(513)]) {
      const bad = await audit(request(f,`admin/audit?before=${cursor}`));expect(bad.status).toBe(400);expect((await bad.json()).code).toBe("invalid_cursor");
    }
  } finally { for (const id of ids) f.master.prepare(`DELETE FROM admin_audit WHERE id=?`).run(id); }
});

test("G5 invite history is metadata only with stable non-redeemable ids and all statuses", async () => {
  const f = await fixture();
  const issued = await issueInvite(request(f,"admin/invites","POST",{}));expect(issued.status).toBe(201);
  const {invite} = await issued.json();expect(typeof invite.code).toBe("string");
  const now = Date.now(), codes = [invite.code];
  for (const status of ["redeemed","revoked","expired"] as const) {
    const code = crypto.randomUUID();codes.push(code);
    f.master.prepare(`INSERT INTO invite_codes(code,role,maxUses,uses,email,issuedByUserId,createdAt,expiresAt,revokedAt) VALUES(?,'user',1,?,?,?,?,?,?)`).run(code,status === "redeemed" ? 1 : 0,`${status}@example.test`,f.user.id,now,now-1,status === "revoked" ? now : null);
  }
  const response = await invites(request(f,"admin/invites")), history = await response.json();
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");
  // The issuer is shown by name or email, never by the internal user id.
  const issuer = f.master.prepare(`SELECT name,email FROM auth_user WHERE id=?`).get(f.user.id) as {name:string|null;email:string};
  const rows = history.invites.filter((row:{issuedBy:string}) => row.issuedBy === (issuer.name || issuer.email));
  expect(rows.map((row:{status:string}) => row.status).sort()).toEqual(["expired","issued","redeemed","revoked"]);
  for (const row of rows) expect(Object.keys(row).sort()).toEqual(["id","email","issuedBy","issuerDeleted","createdAt","expiresAt","status"].sort());
  for (const code of [...codes, f.user.id]) expect(JSON.stringify(history)).not.toContain(code);
  const again = await (await invites(request(f,"admin/invites"))).json();
  expect(again.invites.filter((row:{issuedBy:string}) => row.issuedBy === (issuer.name || issuer.email))).toEqual(rows);
  // A history id cannot redeem an invitation through the storage lookup.
  for (const row of rows) expect(f.master.prepare(`SELECT 1 FROM invite_codes WHERE code=?`).get(row.id)).toBeNull();
});


test("G2 membership guard failures preserve messages and add code/message envelope", async () => {
  const f = await fixture();
  for (const handler of [putMember, adminPutMember]) {
    const unauthorized = await handler(new Request("http://localhost:3000/api/members", {method:"PUT"}), params(f,"synthetic-missing"));
    expect(unauthorized.status).toBe(401);expect(await unauthorized.json()).toMatchObject({ok:false,code:"unauthorized",message:"Unauthorized"});
    const invalidOrigin = await handler(request(f,"members","PUT",{role:"viewer"},{origin:"https://foreign.example.test"}), params(f,"synthetic-missing"));
    expect(invalidOrigin.status).toBe(403);expect(await invalidOrigin.json()).toMatchObject({ok:false,code:"invalid_origin",message:expect.any(String)});
  }
});
