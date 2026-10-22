// Synthetic Better Auth fixtures. Never ship a test route or sign cookies by hand.
import { Database } from "bun:sqlite";
import { createHmac } from "crypto";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { parseSetCookieHeader } from "better-auth/cookies";
import { withDbWriteRetry } from "./dbWriteRetry";
import { migrateAuthSchema, noctuaAuthOptions, type NoctuaAuth } from "./betterAuth";
import { installAuthControlPlane } from "./db/authPolicy";
import { configureDb } from "./db/connection";
import { initMasterSchema } from "./db/schema";

export const TEST_SECRET = "noctua-auth-test-secret-0123456789abcdef";
export const TEST_BASE_URL = "http://localhost:3000";

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
  configureDb(db, 0);
  initMasterSchema(db);
  return db;
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

function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error(`invalid base32 character ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * RFC 6238 TOTP (HMAC-SHA1) computed from an `otpauth://` URI, i.e. exactly
 * what an authenticator app sees. Independent of Better Auth's own helper.
 */
export function totpFromUri(uri: string, at = Date.now()) {
  const url = new URL(uri);
  const secret = url.searchParams.get("secret");
  if (!secret) throw new Error("otpauth URI without secret");
  const digits = Number(url.searchParams.get("digits") ?? 6);
  const period = Number(url.searchParams.get("period") ?? 30);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / period)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
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
export async function createTestAuthHarness(options?: (config: ReturnType<typeof noctuaAuthOptions>) => void) {
  const temp = createTempDir("noctua-auth-test-");
  const master = openMasterDb(temp.dbPath);
  const database = new Database(temp.dbPath);
  configureDb(database, 0);
  const config = { database, baseURL: TEST_BASE_URL, secret: TEST_SECRET };
  const authOptions = noctuaAuthOptions(config);
  options?.(authOptions);
  try {
    const migration = await migrateAuthSchema(authOptions);
    installAuthControlPlane(database);
    // Construct only after migrations + the transaction-safe control plane.
    const { betterAuth } = await import("better-auth");
    const auth = betterAuth(authOptions) as NoctuaAuth;
    await auth.api.getSession({ headers: new Headers() });
    return {
      temp, master, database, auth, migration,
      ...authFixtures(auth, master),
      close() { database.close(); master.close(); temp.cleanup(); }
    };
  } catch (error) {
    database.close(); master.close(); temp.cleanup(); throw error;
  }
}

/**
 * Route tests share the existing testDbHarness storage. Callers supply explicit
 * synthetic BETTER_AUTH_* environment before calling; no production bypass.
 * Never close this harness: testDbHarness owns process-wide teardown.
 */
export async function getSharedTestAuthHarness() {
  const { dbModulePromise } = await import("./testDbHarness");
  await (await dbModulePromise).initializeMasterDb();
  const { getAuth } = await import("./betterAuth");
  const { getDb } = await import("./db/connection");
  const auth = await getAuth();
  const master = await getDb();
  return { auth, master, ...authFixtures(auth, master) };
}

function authFixtures(auth: NoctuaAuth, master: Database) {
  return {
    createUser: (email: string, password = "synthetic-password-123", role: "admin" | "user" = "user") =>
      auth.api.createUser({ body: { email, password, role, name: "Synthetic User" } }).then(result => result.user),
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
