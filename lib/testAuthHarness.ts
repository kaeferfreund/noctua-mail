import "./testDbHarness";
// Synthetic Better Auth fixtures. Never ship a test route or sign cookies by hand.
import { Database } from "bun:sqlite";
import { totpFromUri } from "../tests/helpers/totp";
export { totpFromUri } from "../tests/helpers/totp";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { parseSetCookieHeader } from "better-auth/cookies";
import { withDbWriteRetry } from "./dbWriteRetry";
import { attachAuthPolicyHandler, migrateAuthSchema, noctuaAuthOptions, type NoctuaAuth, type NoctuaAuthConfig } from "./betterAuth";
import { installAuthControlPlane } from "./db/authPolicy";
import { configureDb } from "./db/connection";
import { initMasterSchema } from "./db/schema";
import { withAuthProof } from "./authPolicyContext";

export const TEST_SECRET = "noctua-auth-test-secret-0123456789abcdef";
export const TEST_BASE_URL = "http://localhost:3000";

/** Valid documentation-range IPs remain unique when Bun reloads tests but retains rate buckets. */
export function syntheticRequestIp() {
  return `2001:db8:${Array.from(crypto.getRandomValues(new Uint16Array(6)),value=>value.toString(16)).join(":")}`;
}

/** A temp directory per test file; the master DB file lives in it. */
export function createTempDir(prefix: string) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  return {
    dir,
    dbPath: path.join(dir, "main.db"),
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

/**
 * Opens a master DB file the way `getDb()` does (same pragmas, then
 * `initMasterSchema`) without touching the process-wide singleton that
 * other test files share.
 */
export function openMasterDb(dbPath: string) {
  const db = new Database(dbPath);
  try {
    configureDb(db, 0);
    initMasterSchema(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

/** Minimal browser-like cookie jar fed from Set-Cookie response headers. */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  absorb(headers: Headers | null | undefined) {
    const setCookie = headers?.get("set-cookie");
    if (!setCookie) return this;
    parseSetCookieHeader(setCookie).forEach((attributes, name) => {
      const maxAge = attributes["max-age"];
      if (!attributes.value || (typeof maxAge === "number" && maxAge <= 0)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, attributes.value);
      }
    });
    return this;
  }

  get(name: string) {
    return this.cookies.get(name);
  }

  names() {
    return [...this.cookies.keys()].sort();
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  headers(extra?: Record<string, string>) {
    const headers = new Headers(extra);
    const cookie = this.header();
    if (cookie) headers.set("cookie", cookie);
    return headers;
  }
}

/** Resolves to the thrown value (Better Auth's APIError) or fails the test. */
export async function caught(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { status?: string; statusCode?: number; body?: { code?: string; message?: string }; message?: string };
  }
  throw new Error("expected the call to throw");
}

/** Isolated file, production connection separation and actual library cookies. */
export async function createTestAuthHarness(options?: (config: ReturnType<typeof noctuaAuthOptions>) => void, configOverrides: Partial<NoctuaAuthConfig> = {}, settings: {libraryRateLimits?:boolean} = {}) {
  let temp: ReturnType<typeof createTempDir> | undefined;
  let master: Database | undefined;
  let database: Database | undefined;
  const close = () => {
    try { database?.close(); }
    finally {
      try { master?.close(); }
      finally { temp?.cleanup(); }
    }
  };
  try {
    temp = createTempDir("noctua-auth-test-");
    master = openMasterDb(temp.dbPath);
    database = new Database(temp.dbPath);
    configureDb(database, 0);
    const config = { database, baseURL: TEST_BASE_URL, secret: TEST_SECRET, policyDatabase:async()=>master!, ...configOverrides };
    const authOptions = noctuaAuthOptions(config);
    // Per-process library burst buckets outlive a fixture, especially under randomized reruns.
    // Tests that exercise rate limits opt in explicitly; production options remain enabled.
    if (!settings.libraryRateLimits) Object.assign(authOptions.rateLimit,{enabled:false});
    options?.(authOptions);
    const migration = await migrateAuthSchema(authOptions);
    installAuthControlPlane(database);
    // Construct only after migrations + the transaction-safe control plane.
    const { betterAuth } = await import("better-auth");
    const auth = attachAuthPolicyHandler(betterAuth(authOptions), async () => master!) as NoctuaAuth;
    await auth.api.getSession({ headers: new Headers() });
    return {
      temp, master, database, auth, migration,
      ...authFixtures(auth, master),
      close
    };
  } catch (error) {
    close();
    throw error;
  }
}

/**
 * Route tests share the existing testDbHarness storage. Callers supply explicit
 * synthetic BETTER_AUTH_* environment before calling; no production bypass.
 * Never close this harness: testDbHarness owns process-wide teardown.
 */
export async function getSharedTestAuthHarness() {
  const { dbModulePromise } = await import("./testDbHarness");
  await dbModulePromise;
  const { getAuth } = await import("./betterAuth");
  const { getDb } = await import("./db/connection");
  const auth = await getAuth();
  const master = await getDb();
  return { auth, master, ...authFixtures(auth, master) };
}

function authFixtures(auth: NoctuaAuth, master: Database) {
  return {
    createUser: (email: string, password = "synthetic-password-123", role: "admin" | "user" = "user") =>
      withAuthProof({db:master,internal:true,creation:{userId:crypto.randomUUID(),email:email.trim().toLowerCase(),role},authenticatedAt:Date.now(),method:"migration_fixture",createdSessionIds:[]},()=>
        auth.api.createUser({ body: { email, password, role, name: "Synthetic User" } }).then(result => result.user)),
    async signIn(email: string, password = "synthetic-password-123") {
      const result = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
      const jar = new CookieJar().absorb(result.headers);
      const session = await auth.api.getSession({ headers: jar.headers() });
      return { jar, session, response: result.response };
    },
    seedSessionSecurity: (sessionId: string, userId: string, assurance: "setup" | "mfa", method = "password", authenticatedAt = Date.now()) =>
      withDbWriteRetry("testAuthHarness.seedSessionSecurity", () => master.prepare(`
        INSERT INTO auth_session_security(sessionId,userId,generation,assurance,authenticatedAt,method)
        SELECT ?,userId,generation,?,?,? FROM auth_security_state WHERE userId=?
        ON CONFLICT(sessionId) DO UPDATE SET generation=excluded.generation,assurance=excluded.assurance,
          authenticatedAt=excluded.authenticatedAt,method=excluded.method`).run(sessionId, assurance, authenticatedAt, method, userId)),
    addMembership: (userId: string, accountId: string, role = "manager") =>
      withDbWriteRetry("testAuthHarness.addMembership", () => master.prepare(`
        INSERT INTO user_accounts(userId,accountId,role) VALUES(?,?,?)
        ON CONFLICT(userId,accountId) DO NOTHING`).run(userId, accountId, role)),
    enrollTotp: (jar: CookieJar, password?: string) => enrollTestTotp(auth, jar, password),
  };
}


/** Real encrypted factor and verification, no fake flag-only MFA enrollment. */
export async function enrollTestTotp(auth: NoctuaAuth, jar: CookieJar, password?: string) {
  const enabled = await auth.api.enableTwoFactor({ body: password ? { password } : {}, headers: jar.headers(), returnHeaders: true });
  jar.absorb(enabled.headers);
  if (enabled.response.method !== "totp") throw new Error("Expected TOTP enrollment");
  const verified = await auth.api.verifyTOTP({ body: { code: totpFromUri(enabled.response.totpURI) }, headers: jar.headers(), returnHeaders: true });
  jar.absorb(verified.headers);
  return enabled.response;
}

export type TestAuthHarness = Awaited<ReturnType<typeof createTestAuthHarness>>;

/** A real fully enrolled session for HTTP fixtures; each caller gets its own principal. */
export async function createAuthenticatedTestSession(accountId?: string, role: "admin" | "user" = "user") {
  const harness = await getSharedTestAuthHarness();
  const user = await harness.createUser(`fixture-${crypto.randomUUID()}@example.test`, undefined, role);
  const { jar } = await harness.signIn(user.email);
  await harness.enrollTotp(jar, "synthetic-password-123");
  const current = await harness.auth.api.getSession({ headers: jar.headers() });
  if (!current) throw new Error("Fixture session missing after TOTP rotation");
  await harness.seedSessionSecurity(current.session.id, user.id, "mfa", "password_totp");
  if (accountId) {
    await harness.addMembership(user.id, accountId);
    const { setActiveAccountId } = await import("./betterAuth");
    await setActiveAccountId(harness.auth, current.session.token, accountId);
  }
  return { ...harness, user, jar, session: current.session };
}

export async function authenticatedTestCookie(accountId?: string) {
  return (await createAuthenticatedTestSession(accountId)).jar.header();
}
