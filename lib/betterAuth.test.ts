import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { betterAuth } from "better-auth";
import { withAuthProof } from "./authPolicyContext";
import { AUTH_BASE_PATH, createNoctuaAuth, migrateAuthSchema, noctuaAuthOptions, readAuthEnv, setActiveAccountId, type NoctuaAuth } from "./betterAuth";
import { CookieJar, TEST_BASE_URL, TEST_SECRET, caught, createTempDir, openMasterDb, totpFromUri, createTestAuthHarness, enrollTestTotp, type TestAuthHarness } from "./testAuthHarness";

let fixture: TestAuthHarness;
let db: TestAuthHarness["database"];
let auth: NoctuaAuth;
let adminJar: CookieJar;
const signIn = (email: string, password: string) => fixture.signIn(email, password);
const enrolTotp = (jar: CookieJar, password?: string) => enrollTestTotp(auth, jar, password);
async function createUser(email: string, password?: string, role: "admin" | "user" = "user") {
  return (await auth.api.createUser({ body: { email, password, name: "Synthetic User", role }, headers: adminJar.headers() })).user;
}
beforeAll(async () => {
  fixture = await createTestAuthHarness();
  db = fixture.database;
  auth = fixture.auth;
  await fixture.createUser("admin@example.test", "admin-password-1", "admin");
  adminJar = (await signIn("admin@example.test", "admin-password-1")).jar;
});
afterAll(() => fixture?.close());

describe("users: admin create, sign-in, session", () => {
  test("createUser -> signInEmail -> getSession, mirrored into Noctua users", async () => {
    const created = await createUser("alice@example.test", "alice-password-1");
    const { jar, response } = await signIn("Alice@Example.test", "alice-password-1");
    expect(response.token).toBeString();
    expect(jar.names()).toEqual(["noctua.session_token"]);

    const session = await auth.api.getSession({ headers: jar.headers() });
    expect(session?.user.id).toBe(created.id);
    expect(session?.user.email).toBe("alice@example.test");
    expect((session?.user as { role?: string }).role).toBe("user");

    const mirrored = db.prepare(`SELECT * FROM users WHERE id = ?`).get(created.id) as Record<string, unknown>;
    expect(mirrored).toMatchObject({ email: "alice@example.test", role: "user" });
    expect(typeof mirrored.createdAt).toBe("number");
  });

  test("sign-up is disabled and non-admins cannot create users", async () => {
    const signUp = await caught(
      auth.api.signUpEmail({ body: { email: "self@example.test", password: "self-password-1", name: "Self" } })
    );
    expect(signUp.body?.code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");

    await createUser("nonadmin@example.test", "nonadmin-password-1");
    const { jar } = await signIn("nonadmin@example.test", "nonadmin-password-1");
    const forbidden = await caught(
      auth.api.createUser({
        body: { email: "x@example.test", password: "x-password-12", name: "X" },
        headers: jar.headers()
      })
    );
    expect(forbidden.statusCode).toBe(403);
  });

  test("public creation cannot claim a legacy profile by email", async () => {
    db.prepare(`INSERT INTO users(id,email,role,createdAt) VALUES(?,?,?,?)`).run("legacy-user", "legacy@example.test", "admin", 1700000000000);
    await caught(createUser("legacy@example.test", "legacy-password-1"));
    expect(db.prepare(`SELECT id FROM auth_user WHERE email=?`).get("legacy@example.test")).toBeNull();
    expect(db.prepare(`SELECT id,role FROM users WHERE email=?`).get("legacy@example.test")).toEqual({ id: "legacy-user", role: "admin" });
  });

  test("password policy: changePassword enforces the minimum, but admin createUser skips it", async () => {
    await createUser("policy@example.test", "policy-password-1");
    const tooShort = await caught(
      auth.api.changePassword({
        body: { currentPassword: "policy-password-1", newPassword: "short" },
        headers: (await signIn("policy@example.test", "policy-password-1")).jar.headers()
      })
    );
    expect(tooShort.body?.code).toBe("PASSWORD_TOO_SHORT");
    // Better Auth 1.7.12: /admin/create-user only checks the maximum length.
    const weak = await createUser("weak@example.test", "abc");
    expect(weak.id).toBeString();
  });
});

describe("two-factor (TOTP)", () => {
  test("enable requires the password, verify activates, sign-in is challenged, verifyTotp completes", async () => {
    await createUser("totp@example.test", "totp-password-1");
    const { jar } = await signIn("totp@example.test", "totp-password-1");

    const wrong = await caught(
      auth.api.enableTwoFactor({ body: { password: "not-the-password" }, headers: jar.headers() })
    );
    expect(wrong.body?.code).toBe("INVALID_PASSWORD");

    const enrolment = await enrolTotp(jar, "totp-password-1");
    expect(enrolment.totpURI).toStartWith("otpauth://totp/Mail:totp%40example.test?");
    expect(enrolment.backupCodes.length).toBe(10);
    const afterEnable = await auth.api.getSession({ headers: jar.headers() });
    expect((afterEnable?.user as { twoFactorEnabled?: boolean }).twoFactorEnabled).toBe(true);

    // Password sign-in now stops at the challenge: no session cookie.
    const challenge = await signIn("totp@example.test", "totp-password-1");
    expect(challenge.response).toMatchObject({ twoFactorRedirect: true, twoFactorMethods: ["totp"] });
    expect(challenge.jar.names()).toEqual(["noctua.two_factor"]);
    expect(await auth.api.getSession({ headers: challenge.jar.headers() })).toBeNull();

    const badCode = await caught(
      auth.api.verifyTOTP({ body: { code: String((Number(totpFromUri(enrolment.totpURI)) + 500_000) % 1_000_000).padStart(6, "0") }, headers: challenge.jar.headers() })
    );
    expect(badCode.body?.code).toBe("INVALID_CODE");

    const completed = await auth.api.verifyTOTP({
      body: { code: totpFromUri(enrolment.totpURI) },
      headers: challenge.jar.headers(),
      returnHeaders: true
    });
    challenge.jar.absorb(completed.headers);
    expect(challenge.jar.names()).toEqual(["noctua.session_token"]);
    const session = await auth.api.getSession({ headers: challenge.jar.headers() });
    expect(session?.user.email).toBe("totp@example.test");
  });

  test("backup codes complete the challenge once each", async () => {
    await createUser("backup@example.test", "backup-password-1");
    const { jar } = await signIn("backup@example.test", "backup-password-1");
    const { backupCodes } = await enrolTotp(jar, "backup-password-1");

    const first = await signIn("backup@example.test", "backup-password-1");
    const used = await auth.api.verifyBackupCode({
      body: { code: backupCodes[0] },
      headers: first.jar.headers(),
      returnHeaders: true
    });
    first.jar.absorb(used.headers);
    expect((await auth.api.getSession({ headers: first.jar.headers() }))?.user.email).toBe("backup@example.test");

    const second = await signIn("backup@example.test", "backup-password-1");
    const reused = await caught(
      auth.api.verifyBackupCode({ body: { code: backupCodes[0] }, headers: second.jar.headers() })
    );
    expect(reused.statusCode).toBe(401);
  });
});

describe("admin: ban, impersonation", () => {
  test("banUser revokes live sessions and blocks sign-in", async () => {
    const user = await createUser("bob@example.test", "bob-password-12");
    const { jar } = await signIn("bob@example.test", "bob-password-12");
    expect(await auth.api.getSession({ headers: jar.headers() })).not.toBeNull();

    await auth.api.banUser({ body: { userId: user.id, banReason: "left the company" }, headers: adminJar.headers() });
    expect(await auth.api.getSession({ headers: jar.headers() })).toBeNull();

    const blocked = await caught(signIn("bob@example.test", "bob-password-12"));
    expect(blocked.statusCode).toBe(403);
    expect(blocked.body?.code).toBe("BANNED_USER");

    await auth.api.unbanUser({ body: { userId: user.id }, headers: adminJar.headers() });
    expect((await signIn("bob@example.test", "bob-password-12")).response.token).toBeString();
  });

  test("impersonation is not granted to admins and its routes are disabled", async () => {
    const target = await createUser("target@example.test", "target-password-1");
    const denied = await caught(
      auth.api.impersonateUser({ body: { userId: target.id }, headers: adminJar.headers() })
    );
    expect(denied.statusCode).toBe(403);

    const viaHttp = await auth.handler(
      new Request(`${TEST_BASE_URL}${AUTH_BASE_PATH}/admin/impersonate-user`, {
        method: "POST",
        headers: adminJar.headers({ "content-type": "application/json", origin: TEST_BASE_URL }),
        body: JSON.stringify({ userId: target.id })
      })
    );
    expect(viaHttp.status).toBe(404);
  });
});

describe("passkey", () => {
  test("generate-register-options returns WebAuthn options for a signed-in user", async () => {
    await createUser("passkey@example.test", "passkey-password-1");
    const { jar } = await signIn("passkey@example.test", "passkey-password-1");
    const options = await auth.api.generatePasskeyRegistrationOptions({ headers: jar.headers() });
    expect(options.rp).toEqual({ name: "Mail", id: "localhost" });
    expect(options.challenge).toBeString();
    expect(options.user.name).toBe("passkey@example.test");
    expect(options.pubKeyCredParams.length).toBeGreaterThan(0);

    const anonymous = await caught(auth.api.generatePasskeyRegistrationOptions({ headers: new Headers() }));
    expect(anonymous.statusCode).toBe(401);
  });
});

describe("session additional field: active mailbox", () => {
  test("server-side set, read back via getSession; clients cannot set it", async () => {
    await createUser("carol@example.test", "carol-password-1");
    const { jar, response } = await signIn("carol@example.test", "carol-password-1");
    expect((await auth.api.getSession({ headers: jar.headers() }))?.session.activeAccountId ?? null).toBeNull();

    await setActiveAccountId(auth, response.token, "acct-shared-1");
    const session = await auth.api.getSession({ headers: jar.headers() });
    expect(session?.session.activeAccountId).toBe("acct-shared-1");

    const clientWrite = await caught(
      auth.api.updateSession({ body: { activeAccountId: "acct-foreign" } as never, headers: jar.headers() })
    );
    expect(clientWrite.statusCode).toBe(400);
    expect((await auth.api.getSession({ headers: jar.headers() }))?.session.activeAccountId).toBe("acct-shared-1");
  });
});

describe("changePassword", () => {
  test("revokeOtherSessions kills the other sessions and issues a new one", async () => {
    await createUser("dave@example.test", "dave-password-1");
    const laptop = await signIn("dave@example.test", "dave-password-1");
    const phone = await signIn("dave@example.test", "dave-password-1");

    const changed = await auth.api.changePassword({
      body: { currentPassword: "dave-password-1", newPassword: "dave-password-2", revokeOtherSessions: true },
      headers: laptop.jar.headers(),
      returnHeaders: true
    });
    expect(changed.response.token).toBeString();
    expect(await auth.api.getSession({ headers: phone.jar.headers() })).toBeNull();
    // The caller's old cookie is revoked too; the response carries its replacement.
    expect(await auth.api.getSession({ headers: laptop.jar.headers() })).toBeNull();
    laptop.jar.absorb(changed.headers);
    expect((await auth.api.getSession({ headers: laptop.jar.headers() }))?.user.email).toBe("dave@example.test");

    expect((await caught(signIn("dave@example.test", "dave-password-1"))).statusCode).toBe(401);
    expect((await signIn("dave@example.test", "dave-password-2")).response.token).toBeString();
  });
});

describe("table mapping: Better Auth's user model on Noctua's users table (rejected variant)", () => {
  function usersOptions(database: ReturnType<typeof openMasterDb>) {
    return { ...noctuaAuthOptions({ database, baseURL: TEST_BASE_URL, secret: TEST_SECRET }), user: { modelName: "users" } };
  }

  test("a populated users table cannot be migrated: required columns without a static default", async () => {
    const scratch = createTempDir("noctua-auth-users-populated-");
    const handle = openMasterDb(scratch.dbPath);
    try {
      handle
        .prepare(`INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, ?, ?)`)
        .run("existing-1", "existing@example.test", "user", Date.now());
      const failure = await caught(migrateAuthSchema(usersOptions(handle)));
      expect(failure.message).toMatch(/name|updatedAt|required/);
      const columns = (handle.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map((c) => c.name);
      expect(columns).not.toContain("emailVerified");
    } finally {
      handle.close();
      scratch.cleanup();
    }
  });

  test("an empty users table migrates, but Better Auth writes ISO text into the INTEGER createdAt", async () => {
    const scratch = createTempDir("noctua-auth-users-empty-");
    const handle = openMasterDb(scratch.dbPath);
    try {
      const options = usersOptions(handle);
      const migration = await migrateAuthSchema(options);
      expect(migration.createdTables).not.toContain("users");
      expect(migration.addedColumns).toEqual(
        expect.arrayContaining(["users.emailVerified", "users.updatedAt", "users.twoFactorEnabled", "users.banned"])
      );
      const instance = betterAuth(options);
      const { user } = await withAuthProof({db:handle,internal:true,creation:{userId:crypto.randomUUID(),email:"fresh@example.test",role:"user"},authenticatedAt:Date.now(),method:"migration_fixture",createdSessionIds:[]},()=>instance.api.createUser({
        body: { email: "fresh@example.test", password: "fresh-password-1", name: "Fresh", role: "user" }
      }));
      const row = handle
        .prepare(`SELECT createdAt, typeof(createdAt) AS t FROM users WHERE id = ?`)
        .get(user.id) as { createdAt: unknown; t: string };
      expect(row.t).toBe("text");
      // Noctua's mapUserRow does Number(createdAt): mixed INTEGER/TEXT rows and NaN.
      expect(Number(row.createdAt)).toBeNaN();
    } finally {
      handle.close();
      scratch.cleanup();
    }
  });
});

describe("HTTP handler: base path, cookies, origin/CSRF", () => {
  beforeAll(async () => {
    await createUser("http@example.test", "http-password-1");
  });

  function post(pathname: string, body: unknown, headers: Record<string, string>) {
    return auth.handler(
      new Request(`${TEST_BASE_URL}${AUTH_BASE_PATH}${pathname}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body)
      })
    );
  }

  test("sign-in from the app origin sets an httpOnly lax noctua.session_token", async () => {
    const res = await post(
      "/sign-in/email",
      { email: "http@example.test", password: "http-password-1" },
      { origin: TEST_BASE_URL }
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toStartWith("noctua.session_token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain("Secure");
  });

  test("a cross-origin sign-in is rejected even without cookies", async () => {
    const res = await post(
      "/sign-in/email",
      { email: "http@example.test", password: "http-password-1" },
      { origin: "https://evil.example" }
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("INVALID_ORIGIN");
  });

  test("a cookie-carrying POST without Origin/Referer is rejected", async () => {
    const { jar } = await signIn("http@example.test", "http-password-1");
    const res = await post("/sign-out", {}, { cookie: jar.header() });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("MISSING_OR_NULL_ORIGIN");
  });

  test("an https baseURL switches to __Secure- cookies", async () => {
    const secure = createNoctuaAuth({
      database: db,
      baseURL: "https://mail.example.test",
      policyDatabase: async () => fixture.master,
      secret: TEST_SECRET
    });
    const res = await secure.handler(
      new Request(`https://mail.example.test${AUTH_BASE_PATH}/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://mail.example.test" },
        body: JSON.stringify({ email: "http@example.test", password: "http-password-1" })
      })
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toStartWith("__Secure-noctua.session_token=");
    expect(setCookie).toContain("Secure");
  });
});

describe("fresh sessions", () => {
  test("passkey registration and listSessions reject an old session with SESSION_NOT_FRESH", async () => {
    await createUser("old-session@example.test", "old-session-password");
    const { jar, response } = await signIn("old-session@example.test", "old-session-password");
    db.prepare(`UPDATE auth_session SET createdAt = ? WHERE token = ?`).run(
      new Date(Date.now() - 2 * 86_400_000).toISOString(), response.token
    );
    expect(await auth.api.getSession({ headers: jar.headers() })).not.toBeNull();
    expect((await caught(auth.api.generatePasskeyRegistrationOptions({ headers: jar.headers() }))).body?.code).toBe("SESSION_NOT_FRESH");
    expect((await caught(auth.api.listSessions({ headers: jar.headers() }))).body?.code).toBe("SESSION_NOT_FRESH");
  });
});


describe("startup configuration", () => {
  const valid = { BETTER_AUTH_SECRET: TEST_SECRET, BETTER_AUTH_URL: "https://mail.example.test" };
  test("explicit origin, exact RP ID and telemetry off", () => {
    expect(readAuthEnv(valid)).toMatchObject({ baseURL: valid.BETTER_AUTH_URL, passkeyRpID: "mail.example.test" });
    expect(auth.options.telemetry).toEqual({ enabled: false });
    expect(noctuaAuthOptions({database:db,secret:TEST_SECRET,baseURL:TEST_BASE_URL}).rateLimit).toMatchObject({enabled:true,storage:"memory",customRules:{"/sign-in/*":{window:10,max:3},"/two-factor/*":{window:10,max:3}}});
    expect(auth.options.databaseHooks.verification?.create?.before).toBeFunction();
    expect(auth.options.session?.cookieCache?.enabled).toBe(false);
  });
  test("rejects missing secrets/origin, unsafe origins, telemetry, unsupported modes and RP mismatch", () => {
    for (const patch of [
      { BETTER_AUTH_SECRET: "short" }, { BETTER_AUTH_URL: "" },
      { BETTER_AUTH_URL: "https://mail.example.test/path" },
      { BETTER_AUTH_URL: "https://user:pass@mail.example.test" },
      { BETTER_AUTH_URL: "http://192.0.2.1" }, { PASSKEY_RP_ID: "example.test" },
      { NOCTUA_DESKTOP_MODE: "true" }, { IMAP_CREDENTIALS_STORAGE: "cookie" },
      { BETTER_AUTH_TELEMETRY: "1" }, { BETTER_AUTH_TELEMETRY_ENDPOINT: "https://telemetry.example.test" },
      { NOCTUA_TRUSTED_ORIGINS: "https://*.example.test" },
      { NOCTUA_TRUSTED_ORIGINS: "https://remote-arm.tail31b4a1.ts.net:3790" }
    ]) expect(() => readAuthEnv({ ...valid, ...patch })).toThrow();
    expect(readAuthEnv({ ...valid, IMAP_CREDENTIALS_STORAGE: "both" }).baseURL).toBe(valid.BETTER_AUTH_URL);
    expect(readAuthEnv({ ...valid, BETTER_AUTH_URL: "http://localhost:3784" }).passkeyRpID).toBe("localhost");
  });
});
