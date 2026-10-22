import { teamFeaturesSupported } from "./teamFeatures";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { defaultAc, userAc } from "better-auth/plugins/admin/access";
import { passkey } from "@better-auth/passkey";
import { getAuthDb, getDbConnectionGeneration } from "./db/connection";
import { installAuthControlPlane } from "./db/authPolicy";

export const AUTH_BASE_PATH = "/api/ba";
export const AUTH_COOKIE_PREFIX = "noctua";
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 256;

type SqliteHandle = {
  prepare(sql: string): {
    run: (...params: any[]) => unknown;
    get: (...params: any[]) => any;
  };
};

export type NoctuaAuthConfig = {
  /** The dedicated bun:sqlite auth handle on the master DB, after `initMasterSchema`. */
  database: SqliteHandle;
  baseURL: string;
  secret: string;
  passkeyRpID?: string;
  trustedOrigins?: string[];
};

type BunPasswordApi = {
  hash(password: string, options?: { algorithm: "argon2id" }): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
};

function getBunPassword(): BunPasswordApi {
  const bun = (globalThis as typeof globalThis & { Bun?: { password?: BunPasswordApi } }).Bun;
  if (!bun?.password) throw new Error("Bun runtime is required for password hashing.");
  return bun.password;
}

// Same rules as the design's D1 (argon2id via Bun.password). The policy
// (length) is enforced by Better Auth's min/maxPasswordLength, never here:
// Better Auth also hashes arbitrary input to equalise timing for unknown
// users, and a throwing hasher would turn that into a distinguishable error.
const argon2idPassword = {
  hash: (password: string) => getBunPassword().hash(password, { algorithm: "argon2id" }),
  verify: ({ hash, password }: { hash: string; password: string }) =>
    getBunPassword().verify(password, hash)
};

// Admin role without the impersonation statements. `adminUserIds` is not
// used on purpose: it bypasses every permission check, including these.
const adminWithoutImpersonation = defaultAc.newRole({
  user: ["create", "list", "set-role", "ban", "delete", "set-password", "set-email", "get", "update"],
  session: ["list", "revoke", "delete"]
});

/**
 * The Better Auth options for Noctua. Kept separate from `betterAuth()` so the
 * schema can be migrated before an instance exists: constructing the instance
 * starts Better Auth's schema check, which logs "Database schema mismatch" as
 * an error on a database that has not been migrated yet.
 */
export function noctuaAuthOptions(config: NoctuaAuthConfig) {
  const twoFactorPlugin = twoFactor({
    issuer: "Noctua",
    // Passwordless migration requires the Noctua proof wrappers (Slice 4).
    // This library option alone never establishes session MFA assurance.
    allowPasswordless: true,
    schema: { twoFactor: { modelName: "auth_two_factor" } }
  });
  return {
    appName: "Noctua",
    baseURL: config.baseURL,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: config.trustedOrigins ?? [config.baseURL],
    secret: config.secret,
    database: config.database as never,
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      password: argon2idPassword,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 900
    },
    user: { modelName: "auth_user" },
    session: {
      modelName: "auth_session",
      expiresIn: 86400,
      updateAge: 3600,
      freshAge: 300,
      cookieCache: { enabled: false },
      additionalFields: {
        // Active mailbox. input:false: clients cannot set it through
        // /update-session; Noctua's switch-account route checks membership
        // and writes it via setActiveAccountId().
        activeAccountId: { type: "string", required: false, input: false }
      }
    },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      // Explicit, so tests exercise the same checks as production: Better
      // Auth skips the origin check by default when NODE_ENV is "test".
      disableOriginCheck: false,
      disableCSRFCheck: false
    },
    // Belt and braces next to the role definition above: the HTTP router
    // answers 404 for these. (auth.api.* server calls are not routed.)
    disabledPaths: ["/admin/impersonate-user", "/admin/stop-impersonating"],
    plugins: [
      // `ac` is only read by the admin client plugin; the server checks `roles`.
      admin({ roles: { admin: adminWithoutImpersonation, user: userAc } }),
      twoFactorPlugin,
      passkey({
        rpID: config.passkeyRpID ?? new URL(config.baseURL).hostname,
        rpName: "Noctua",
        origin: config.baseURL,
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
        registration: {
          requireSession: true,
          afterVerification: async ({ verification }) => {
            if (verification.registrationInfo?.userVerified !== true) throw new Error("Passkey user verification required");
          }
        },
        authentication: {
          afterVerification: async ({ verification }) => {
            if (verification.authenticationInfo.userVerified !== true) throw new Error("Passkey user verification required");
          }
        },
        schema: { passkey: { modelName: "auth_passkey" } }
      }),
      nextCookies()
    ]
  } satisfies BetterAuthOptions;
}

export function createNoctuaAuth(config: NoctuaAuthConfig) {
  return betterAuth(noctuaAuthOptions(config));
}

export type NoctuaAuth = ReturnType<typeof createNoctuaAuth>;

export type AuthMigrationSummary = {
  createdTables: string[];
  addedColumns: string[];
  addedIndexes: string[];
};

/**
 * Better Auth's additive migrations (create table / add column / create
 * index), run after Noctua's `initMasterSchema`. Idempotent: a second run
 * plans nothing. Rejects instead of adding a required
 * column without default to a populated table.
 */
export async function migrateAuthSchema(options: BetterAuthOptions): Promise<AuthMigrationSummary> {
  const migrations = await getMigrations(options);
  await migrations.runMigrations();
  return {
    createdTables: migrations.toBeCreated.map((table) => table.table),
    addedColumns: migrations.toBeAdded.flatMap((table) =>
      Object.keys(table.fields).map((field) => `${table.table}.${field}`)
    ),
    addedIndexes: migrations.toBeAddedIndexes.map((entry) => entry.name)
  };
}

/** Writes the active mailbox onto the caller's Better Auth session row. */
export async function setActiveAccountId(auth: NoctuaAuth, sessionToken: string, accountId: string | null) {
  const context = await auth.$context;
  return context.internalAdapter.updateSession(sessionToken, { activeAccountId: accountId });
}

/** Fail startup instead of deriving security settings from request headers. */
export function readAuthEnv(env: Record<string, string | undefined> = process.env) {
  const secret = env.BETTER_AUTH_SECRET?.trim() ?? "";
  if (secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters.");
  const baseURL = parseOrigin(env.BETTER_AUTH_URL ?? "", "BETTER_AUTH_URL");
  if (env.NOCTUA_DESKTOP_MODE === "true") throw new Error("Team auth supports Linux/server mode only; desktop mode is unsupported.");
  if (!teamFeaturesSupported(env)) throw new Error("Team auth requires IMAP_CREDENTIALS_STORAGE=db; migrate cookie credentials first.");
  if (env.BETTER_AUTH_TELEMETRY && env.BETTER_AUTH_TELEMETRY !== "0") throw new Error("BETTER_AUTH_TELEMETRY must be 0.");
  if (env.BETTER_AUTH_TELEMETRY_ENDPOINT) throw new Error("BETTER_AUTH_TELEMETRY_ENDPOINT must be unset.");
  const hostname = new URL(baseURL).hostname;
  const passkeyRpID = env.PASSKEY_RP_ID?.trim() || hostname;
  if (passkeyRpID !== hostname) throw new Error("PASSKEY_RP_ID must equal the canonical BETTER_AUTH_URL hostname.");
  const trustedOrigins = (env.NOCTUA_TRUSTED_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean)
    .map(value => parseOrigin(value, "NOCTUA_TRUSTED_ORIGINS"));
  return { secret, baseURL, passkeyRpID, trustedOrigins: [baseURL, ...trustedOrigins] };
}

function parseOrigin(value: string, name: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an explicit canonical origin.`); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.hostname.includes("*")) {
    throw new Error(`${name} must be a path-free HTTPS origin (HTTP localhost is allowed for development).`);
  }
  return url.origin;
}

let authPromise: Promise<NoctuaAuth> | null = null;
let authGeneration = -1;

/** Graph-local singleton. Closing DBs invalidates it, including after teardown/reopen. */
export function getAuth(): Promise<NoctuaAuth> {
  const generation = getDbConnectionGeneration();
  if (!authPromise || authGeneration !== generation) {
    authGeneration = generation;
    const pending = (async () => {
      const env = readAuthEnv();
      if (process.env.IMAP_CREDENTIALS_STORAGE === "both") {
        console.warn("[auth] IMAP_CREDENTIALS_STORAGE=both is deprecated; use db.");
      }
      const database = await getAuthDb();
      const options = noctuaAuthOptions({ database, ...env });
      await migrateAuthSchema(options);
      installAuthControlPlane(database);
      if (getDbConnectionGeneration() !== generation) throw new Error("Auth storage closed during initialization.");
      return betterAuth(options);
    })();
    authPromise = pending;
    void pending.catch(() => { if (authPromise === pending) authPromise = null; });
  }
  return authPromise;
}
