import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import {
  AUTH_BASE_PATH,
  createNoctuaAuth,
  migrateAuthSchema,
  noctuaAuthOptions,
  setActiveAccountId,
  type NoctuaAuth
} from "./betterAuth";
import { imapSignIn } from "./betterAuthImapSignIn";
import { withDbWriteRetry } from "./dbWriteRetry";
import {
  CookieJar,
  TEST_BASE_URL,
  TEST_SECRET,
  caught,
  createTempDir,
  openMasterDb,
  totpFromUri
} from "./betterAuth.testSupport";

const temp = createTempDir("noctua-spike-better-auth-");
const IMAP_PASSWORDS = new Map<string, string>([
  ["imap.user@example.test", "imap-secret-123"],
  ["imap.2fa@example.test", "imap-secret-456"],
  ["imap.banned@example.test", "imap-secret-789"],
  ["imap.trust@example.test", "imap-secret-abc"],
  ["imap.disable@example.test", "imap-secret-def"]
]);
const verifyImap = async (email: string, password: string) => IMAP_PASSWORDS.get(email) === password;

let db: ReturnType<typeof openMasterDb>;
let auth: NoctuaAuth;
let firstStart: Awaited<ReturnType<typeof migrateAuthSchema>>;
let adminJar: CookieJar;
let secondStart: Awaited<ReturnType<typeof migrateAuthSchema>>;

// One process start as getAuth() does it: Noctua schema (openMasterDb),
// Better Auth migrations, then the instance.
async function start(dbPath: string) {
  const handle = openMasterDb(dbPath);
  const config = {
    database: handle,
    baseURL: TEST_BASE_URL,
    secret: TEST_SECRET,
    passkeyRpID: "localhost",
    verifyImap
  };
  const migration = await migrateAuthSchema(noctuaAuthOptions(config));
  return { handle, migration, instance: createNoctuaAuth(config) };
}

async function signIn(email: string, password: string) {
  const { headers, response } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true
  });
  return { jar: new CookieJar().absorb(headers), response: response as Record<string, any> };
}

async function createUser(email: string, password?: string, role: "admin" | "user" = "user") {
  const { user } = await auth.api.createUser({
    body: { email, password, name: email.split("@")[0], role },
    headers: adminJar.headers()
  });
  return user;
}

async function enrolTotp(jar: CookieJar, password?: string) {
  const { headers, response } = await auth.api.enableTwoFactor({
    body: password ? { password } : {},
    headers: jar.headers(),
    returnHeaders: true
  });
  jar.absorb(headers);
  if (response.method !== "totp") throw new Error("expected a TOTP enrolment");
  const verified = await auth.api.verifyTOTP({
    body: { code: totpFromUri(response.totpURI) },
    headers: jar.headers(),
    returnHeaders: true
  });
  jar.absorb(verified.headers);
  return response;
}

beforeAll(async () => {
  const first = await start(temp.dbPath);
  firstStart = first.migration;
  // betterAuth() starts its schema check asynchronously; every auth.api call
  // awaits it, so this keeps the handle open until the check has finished.
  await first.instance.api.getSession({ headers: new Headers() });
  first.handle.close();
  // Second start on the same file: must plan nothing.
  const second = await start(temp.dbPath);
  secondStart = second.migration;
  db = second.handle;
  auth = second.instance;

  // Bootstrap: the first admin is created by a server call without headers
  // (Better Auth allows admin createUser without a session server-side only).
  await auth.api.createUser({
    body: { email: "admin@example.test", password: "admin-password-1", name: "Admin", role: "admin" }
  });
  adminJar = (await signIn("admin@example.test", "admin-password-1")).jar;
});

afterAll(() => {
  db?.close();
  temp.cleanup();
});

describe("schema and migrations", () => {
  test("second process start on the same file plans no migrations", () => {
    expect(secondStart).toEqual({ createdTables: [], addedColumns: [], addedIndexes: [] });
  });
  test("first start creates only auth_* tables and leaves Noctua tables alone", () => {
    expect(firstStart.createdTables.sort()).toEqual([
      "auth_account",
      "auth_passkey",
      "auth_session",
      "auth_two_factor",
      "auth_user",
      "auth_verification"
    ]);
    expect(firstStart.addedColumns).toEqual([]);
    const userColumns = (db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map(
      (column) => column.name
    );
    expect(userColumns).toEqual(["id", "email", "role", "createdAt"]);
  });

  test("auth_session carries the activeAccountId column and dates are ISO text", async () => {
    const sessionColumns = (db.prepare(`PRAGMA table_info(auth_session)`).all() as Array<{
      name: string;
      type: string;
    }>).map((column) => `${column.name}:${column.type}`);
    expect(sessionColumns).toContain("activeAccountId:TEXT");
    expect(sessionColumns).toContain("expiresAt:date");
    const row = db.prepare(`SELECT expiresAt, typeof(expiresAt) AS t FROM auth_session LIMIT 1`).get() as {
      expiresAt: string;
      t: string;
    };
    expect(row.t).toBe("text");
    expect(row.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

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

  test("an existing Noctua user keeps its id when Better Auth creates it", async () => {
    db.prepare(`INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, ?, ?)`).run(
      "legacy-user-1",
      "legacy@example.test",
      "user",
      1_700_000_000_000
    );
    const created = await createUser("legacy@example.test", "legacy-password-1");
    expect(created.id).toBe("legacy-user-1");
    const row = db.prepare(`SELECT createdAt FROM users WHERE id = ?`).get("legacy-user-1") as {
      createdAt: number;
    };
    expect(row.createdAt).toBe(1_700_000_000_000);
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
    expect(enrolment.totpURI).toStartWith("otpauth://totp/Noctua:totp%40example.test?");
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
    expect(options.rp).toEqual({ name: "Noctua", id: "localhost" });
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

describe("custom first factor: POST /sign-in/imap", () => {
  test("IMAP password creates a normal session; wrong password and unknown user get the same 401", async () => {
    await createUser("imap.user@example.test");
    const { headers, response } = await auth.api.signInImap({
      body: { email: "imap.user@example.test", password: "imap-secret-123" },
      returnHeaders: true
    });
    expect(response.token).toBeString();
    const jar = new CookieJar().absorb(headers);
    expect((await auth.api.getSession({ headers: jar.headers() }))?.user.email).toBe("imap.user@example.test");

    const wrong = await caught(
      auth.api.signInImap({ body: { email: "imap.user@example.test", password: "nope" } })
    );
    const unknown = await caught(
      auth.api.signInImap({ body: { email: "nobody@example.test", password: "imap-secret-123" } })
    );
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.body?.code).toBe(unknown.body?.code);
  });

  test("with the re-used two-factor hook an IMAP sign-in of a 2FA user is challenged", async () => {
    await createUser("imap.2fa@example.test");
    const first = await auth.api.signInImap({
      body: { email: "imap.2fa@example.test", password: "imap-secret-456" },
      returnHeaders: true
    });
    const jar = new CookieJar().absorb(first.headers);
    // No Better Auth password exists: allowPasswordless lets the session enrol TOTP.
    const { totpURI } = await enrolTotp(jar);

    const challenged = await auth.api.signInImap({
      body: { email: "imap.2fa@example.test", password: "imap-secret-456" },
      returnHeaders: true
    });
    expect(challenged.response).toMatchObject({ twoFactorRedirect: true, twoFactorMethods: ["totp"] });
    const challengeJar = new CookieJar().absorb(challenged.headers);
    expect(challengeJar.names()).toEqual(["noctua.two_factor"]);
    expect(await auth.api.getSession({ headers: challengeJar.headers() })).toBeNull();

    const completed = await auth.api.verifyTOTP({
      body: { code: totpFromUri(totpURI) },
      headers: challengeJar.headers(),
      returnHeaders: true
    });
    challengeJar.absorb(completed.headers);
    expect((await auth.api.getSession({ headers: challengeJar.headers() }))?.user.email).toBe("imap.2fa@example.test");
  });

  test("HTTP IMAP challenge removes the provisional DB session and backup code completes it", async () => {
    const user = await createUser("imap.http@example.test");
    IMAP_PASSWORDS.set(user.email, "imap-http-secret");
    const first = await auth.api.signInImap({
      body: { email: user.email, password: "imap-http-secret" }, returnHeaders: true
    });
    const jar = new CookieJar().absorb(first.headers);
    const { backupCodes } = await enrolTotp(jar);
    await auth.api.signOut({ headers: jar.headers() });
    const count = () => Number(db.prepare(`SELECT count(*) AS n FROM auth_session WHERE userId = ?`).get(user.id).n);
    expect(count()).toBe(0);
    const challenge = await auth.handler(new Request(`${TEST_BASE_URL}${AUTH_BASE_PATH}/sign-in/imap`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: TEST_BASE_URL },
      body: JSON.stringify({ email: user.email, password: "imap-http-secret" })
    }));
    expect(challenge.status).toBe(200);
    const payload = await challenge.json();
    expect(payload.twoFactorRedirect).toBe(true);
    expect(payload.token).toBeUndefined();
    expect(count()).toBe(0);
    const pending = new CookieJar().absorb(challenge.headers);
    expect(pending.names()).toEqual(["noctua.two_factor"]);
    const verified = await auth.api.verifyBackupCode({
      body: { code: backupCodes[0] }, headers: pending.headers(), returnHeaders: true
    });
    pending.absorb(verified.headers);
    expect((await auth.api.getSession({ headers: pending.headers() }))?.user.id).toBe(user.id);
    expect(count()).toBe(1);
  });

  test("without that hook the two-factor plugin does NOT intercept a custom sign-in path", async () => {
    // Seed independently: the randomized suite may run this before the positive control.
    const user = await createUser("imap.negative@example.test");
    IMAP_PASSWORDS.set(user.email, "imap-negative-secret");
    const first = await auth.api.signInImap({
      body: { email: user.email, password: "imap-negative-secret" }, returnHeaders: true
    });
    await enrolTotp(new CookieJar().absorb(first.headers));
    // Same DB, enrolled user; only the wiring differs: no secondFactorHooks.
    const bare = betterAuth({
      baseURL: TEST_BASE_URL,
      basePath: AUTH_BASE_PATH,
      secret: TEST_SECRET,
      database: db as never,
      telemetry: { enabled: false },
      user: { modelName: "auth_user" },
      session: { modelName: "auth_session" },
      account: { modelName: "auth_account" },
      verification: { modelName: "auth_verification" },
      advanced: { cookiePrefix: "noctua" },
      plugins: [
        twoFactor({ issuer: "Noctua", schema: { twoFactor: { modelName: "auth_two_factor" } } }),
        imapSignIn({ verifyImap })
      ]
    });
    const result = await bare.api.signInImap({
      body: { email: user.email, password: "imap-negative-secret" },
      returnHeaders: true
    });
    expect((result.response as Record<string, unknown>).twoFactorRedirect).toBeUndefined();
    expect(result.response.token).toBeString();
    expect(new CookieJar().absorb(result.headers).names()).toEqual(["noctua.session_token"]);
  });

  test("the admin plugin's ban check also covers the custom sign-in", async () => {
    const user = await createUser("imap.banned@example.test");
    await auth.api.banUser({ body: { userId: user.id }, headers: adminJar.headers() });
    const blocked = await caught(
      auth.api.signInImap({ body: { email: "imap.banned@example.test", password: "imap-secret-789" } })
    );
    expect(blocked.body?.code).toBe("BANNED_USER");
  });
});

describe("custom first factor: second-factor details", () => {
  async function imapSignIn(email: string, headers?: Headers) {
    const { headers: responseHeaders, response } = await auth.api.signInImap({
      body: { email, password: IMAP_PASSWORDS.get(email)! },
      headers,
      returnHeaders: true
    });
    return { jar: new CookieJar().absorb(responseHeaders), response: response as Record<string, any> };
  }

  test("trustDevice from the TOTP step is honoured by the next IMAP sign-in (same hook, same cookie)", async () => {
    await createUser("imap.trust@example.test");
    const { totpURI } = await enrolTotp((await imapSignIn("imap.trust@example.test")).jar);

    const challenged = await imapSignIn("imap.trust@example.test");
    expect(challenged.response.twoFactorRedirect).toBe(true);
    const trusted = await auth.api.verifyTOTP({
      body: { code: totpFromUri(totpURI), trustDevice: true },
      headers: challenged.jar.headers(),
      returnHeaders: true
    });
    challenged.jar.absorb(trusted.headers);
    expect(challenged.jar.names()).toEqual(["noctua.session_token", "noctua.trust_device"]);

    // The trusted device signs in again without a challenge; a fresh one is challenged.
    const again = await imapSignIn("imap.trust@example.test", challenged.jar.headers());
    expect(again.response.twoFactorRedirect).toBeUndefined();
    expect(again.response.token).toBeString();
    expect((await imapSignIn("imap.trust@example.test")).response.twoFactorRedirect).toBe(true);
  });

  test("an IMAP-only user must prove the IMAP password to disable 2FA; a password user proves the app password", async () => {
    await createUser("imap.disable@example.test");
    const { totpURI } = await enrolTotp((await imapSignIn("imap.disable@example.test")).jar);
    const challenged = await imapSignIn("imap.disable@example.test");
    const done = await auth.api.verifyTOTP({
      body: { code: totpFromUri(totpURI) },
      headers: challenged.jar.headers(),
      returnHeaders: true
    });
    const jar = challenged.jar.absorb(done.headers);

    const noProof = await caught(auth.api.disableTwoFactor({ body: {}, headers: jar.headers() }));
    expect(noProof.body?.code).toBe("INVALID_PASSWORD");
    const wrongProof = await caught(
      auth.api.disableTwoFactor({ body: { password: "not-the-imap-password" }, headers: jar.headers() })
    );
    expect(wrongProof.body?.code).toBe("INVALID_PASSWORD");
    expect((await auth.api.getSession({ headers: jar.headers() }))?.user.twoFactorEnabled).toBe(true);

    const disabled = await auth.api.disableTwoFactor({
      body: { password: "imap-secret-def" },
      headers: jar.headers(),
      returnHeaders: true
    });
    expect(disabled.response).toEqual({ status: true });
    jar.absorb(disabled.headers);
    expect((await auth.api.getSession({ headers: jar.headers() }))?.user.twoFactorEnabled).toBe(false);

    // Password users are untouched by the guard: Better Auth's own check applies.
    await createUser("pw.disable@example.test", "pw-disable-pass-1");
    const pw = await signIn("pw.disable@example.test", "pw-disable-pass-1");
    await enrolTotp(pw.jar, "pw-disable-pass-1");
    const pwWrong = await caught(
      auth.api.disableTwoFactor({ body: { password: "imap-secret-def" }, headers: pw.jar.headers() })
    );
    expect(pwWrong.body?.code).toBe("INVALID_PASSWORD");
    expect(
      (await auth.api.disableTwoFactor({ body: { password: "pw-disable-pass-1" }, headers: pw.jar.headers() })).status
    ).toBe(true);
  });

  test("over HTTP, /sign-in/imap gets the same origin check as /sign-in/email", async () => {
    const res = await auth.handler(
      new Request(`${TEST_BASE_URL}${AUTH_BASE_PATH}/sign-in/imap`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example" },
        body: JSON.stringify({ email: "imap.user@example.test", password: "imap-secret-123" })
      })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("INVALID_ORIGIN");
  });

  test("upgrade canary: the two-factor plugin exposes exactly one sign-in after-hook", () => {
    const plugin = twoFactor({ issuer: "Noctua" });
    expect(plugin.hooks?.after?.length).toBe(1);
    expect(typeof plugin.hooks?.after?.[0]?.handler).toBe("function");
    // Its matcher does not cover the custom path; the re-use above is what does.
    expect(plugin.hooks!.after![0]!.matcher({ path: "/sign-in/imap" } as never)).toBe(false);
    expect(plugin.hooks!.after![0]!.matcher({ path: "/sign-in/email" } as never)).toBe(true);
  });
});

describe("telemetry", () => {
  test("is disabled by config, off under bun test, and has no endpoint to send to", () => {
    expect(auth.options.telemetry).toEqual({ enabled: false });
    // @better-auth/telemetry createTelemetry(): without BETTER_AUTH_TELEMETRY_ENDPOINT
    // publish() is a no-op before the enabled flag is even evaluated.
    expect(process.env.BETTER_AUTH_TELEMETRY_ENDPOINT).toBeUndefined();
    expect(process.env.NODE_ENV).toBe("test");
  });
});

describe("table mapping: Better Auth's user model on Noctua's users table (rejected variant)", () => {
  function usersVariant(database: ReturnType<typeof openMasterDb>) {
    return { database, baseURL: TEST_BASE_URL, secret: TEST_SECRET, userTable: "users" as const };
  }

  test("a populated users table cannot be migrated: required columns without a static default", async () => {
    const scratch = createTempDir("noctua-spike-users-populated-");
    const handle = openMasterDb(scratch.dbPath);
    try {
      handle
        .prepare(`INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, ?, ?)`)
        .run("existing-1", "existing@example.test", "user", Date.now());
      const failure = await caught(migrateAuthSchema(noctuaAuthOptions(usersVariant(handle))));
      expect(failure.message).toMatch(/name|updatedAt|required/);
      const columns = (handle.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map((c) => c.name);
      expect(columns).toEqual(["id", "email", "role", "createdAt"]);
    } finally {
      handle.close();
      scratch.cleanup();
    }
  });

  test("an empty users table migrates, but Better Auth writes ISO text into the INTEGER createdAt", async () => {
    const scratch = createTempDir("noctua-spike-users-empty-");
    const handle = openMasterDb(scratch.dbPath);
    try {
      const config = usersVariant(handle);
      const migration = await migrateAuthSchema(noctuaAuthOptions(config));
      expect(migration.createdTables).not.toContain("users");
      expect(migration.addedColumns).toEqual(
        expect.arrayContaining(["users.name", "users.emailVerified", "users.updatedAt", "users.twoFactorEnabled", "users.banned"])
      );
      const instance = createNoctuaAuth(config);
      const { user } = await instance.api.createUser({
        body: { email: "fresh@example.test", password: "fresh-password-1", name: "Fresh", role: "user" }
      });
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

describe("shared bun:sqlite connection", () => {
  test("a Noctua write that interleaves with an open Better Auth transaction shares its fate", async () => {
    const context = await auth.$context;
    let interleaved: Promise<void> | null = null;
    const failure = await caught(
      context.adapter.transaction(async (trx) => {
        await trx.create({
          model: "verification",
          data: { identifier: "spike-tx", value: "x", expiresAt: new Date(Date.now() + 60_000) }
        });
        // Another request's code path resuming in a microtask while the
        // transaction is open: synchronous bun:sqlite write on the same handle.
        interleaved = (async () => {
          await Promise.resolve();
          db.prepare(`INSERT INTO invite_codes (code, role, createdAt) VALUES (?, ?, ?)`).run(
            "spike-invite",
            "user",
            Date.now()
          );
        })();
        await new Promise((resolve) => setTimeout(resolve, 0));
        throw new Error("rollback");
      })
    );
    await interleaved;
    expect(failure.message).toBe("rollback");
    expect(db.prepare(`SELECT code FROM invite_codes WHERE code = ?`).get("spike-invite")).toBeNull();
    expect(db.prepare(`SELECT id FROM auth_verification WHERE identifier = ?`).get("spike-tx")).toBeNull();
  });
});


describe("dedicated auth connection", () => {
  test("a separate handle isolates rollback and async retries let the auth writer finish", async () => {
    const scratch = createTempDir("noctua-spike-connections-");
    const master = openMasterDb(scratch.dbPath);
    const authHandle = openMasterDb(scratch.dbPath);
    master.exec("PRAGMA busy_timeout = 0");
    authHandle.exec("PRAGMA busy_timeout = 0");
    try {
      const config = { database: authHandle, baseURL: TEST_BASE_URL, secret: TEST_SECRET };
      await migrateAuthSchema(noctuaAuthOptions(config));
      const instance = createNoctuaAuth(config);
      await instance.api.getSession({ headers: new Headers() });
      const context = await instance.$context;
      let write: Promise<unknown> | undefined;
      let attempts = 0;
      const failure = await caught(context.adapter.transaction(async (trx) => {
        await trx.create({ model: "verification", data: {
          identifier: "isolated-rollback", value: "x", expiresAt: new Date(Date.now() + 60_000)
        } });
        write = withDbWriteRetry("spike-isolated-write", () => {
          attempts++;
          return master.prepare(`INSERT INTO invite_codes (code, role, createdAt) VALUES (?, ?, ?)`).run(
            "isolated-invite", "user", Date.now()
          );
        }, { baseDelayMs: 20, maxDelayMs: 20 });
        // Retry yields instead of blocking the loop that must release the auth lock.
        await new Promise((resolve) => setTimeout(resolve, 0));
        throw new Error("isolated rollback");
      }));
      await write;
      expect(failure.message).toBe("isolated rollback");
      expect(attempts).toBeGreaterThan(1);
      expect(master.prepare(`SELECT code FROM invite_codes WHERE code = ?`).get("isolated-invite")).not.toBeNull();
      expect(master.prepare(`SELECT id FROM auth_verification WHERE identifier = ?`).get("isolated-rollback")).toBeNull();
    } finally {
      authHandle.close();
      master.close();
      scratch.cleanup();
    }
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
