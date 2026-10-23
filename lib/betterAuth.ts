import { ensureAuthLifetimeLock, type AuthLifetimeLock } from "./authLifetimeLock";
import { teamFeaturesSupported } from "./teamFeatures";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { defaultAc, userAc } from "better-auth/plugins/admin/access";
import { passkey } from "@better-auth/passkey";
import { getAuthDb, getDb, getDbConnectionGeneration } from "./db/connection";
import { installAuthControlPlane, reconcileSecurityOperations, readGeneration } from "./db/authPolicy";
import { authPolicyPlugin, authPolicyDatabaseHooks, RAW_DISABLED_PATHS, recordVerifiedPasskey, wrapAuthPolicyHandler } from "./authPolicyHandler";
import { imapSignIn } from "./betterAuthImapSignIn";
import { verifyEligibleImap } from "./imapLoginPolicy";
import { currentAuthProof } from "./authPolicyContext";
import { revokeAuthStreams } from "./authStreams";
import { handOverResetLink } from "./authRecoveryContext";
import { withDbWriteRetry } from "./dbWriteRetry";
import { recordAdminAuditRow } from "./db/adminAudit";

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
  imapVerification?: typeof import("./mail/imapAuth").verifyImapCredentials;
  policyDatabase?: typeof getDb;
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
  const bridge = twoFactorPlugin.hooks.after;
  if (bridge.length !== 1 || !bridge[0].matcher({path:"/sign-in/email"} as never) || bridge[0].matcher({path:"/sign-in/imap"} as never)) {
    throw new Error("Pinned Better Auth twoFactor bridge changed; IMAP login disabled pending review");
  }
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
      resetPasswordTokenExpiresIn: 900,
      sendResetPassword: async data => { handOverResetLink(data); },
      onPasswordReset: async ({user}) => {
        // Credential triggers are the security barrier. This callback only removes stale
        // rows and records the result after the password/token transaction has committed.
        const db=await (config.policyDatabase??getDb)();
        await withDbWriteRetry("passwordResetCleanup",()=>db.transaction(()=>{
          db.prepare(`DELETE FROM mcp_tokens WHERE createdByUserId=? AND securityGeneration IS NOT (SELECT generation FROM auth_security_state WHERE userId=?)`).run(user.id,user.id);
          recordAdminAuditRow(db,{actorUserId:user.id,action:"user.password_reset",targetUserId:user.id,payload:{operationId:currentAuthProof()?.op?.id??null}});
        }).immediate());
        revokeAuthStreams({userId:user.id});
      }
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
    disabledPaths: RAW_DISABLED_PATHS,
    rateLimit: { enabled: true, storage: "memory", customRules: {
      "/sign-in/*": { window: 10, max: 3 }, "/two-factor/*": { window: 10, max: 3 },
      "/reset-password": { window: 60, max: 5 }
    } },
    databaseHooks: authPolicyDatabaseHooks(),
    plugins: [
      // `ac` is only read by the admin client plugin; the server checks `roles`.
      admin({ roles: { admin: adminWithoutImpersonation, user: userAc } }),
      twoFactorPlugin,
      imapSignIn({ secondFactorHooks: bridge, verifyImap: async (_email, password) => {
        const proof = currentAuthProof();
        if (!proof?.op || !proof.request) return false;
        try {
          await verifyEligibleImap(proof.db, proof.op.userId, password, proof.request, true, config.imapVerification);
          // A changed login mailbox deliberately revoked the old generation. Capture AFTER write-back.
          proof.op.generation = readGeneration(proof.db, proof.op.userId);
          proof.authenticatedAt = Date.now();
          return true;
        } catch { return false; }
      } }),
      passkey({
        rpID: config.passkeyRpID ?? new URL(config.baseURL).hostname,
        rpName: "Noctua",
        origin: config.baseURL,
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
        registration: {
          requireSession: true,
          afterVerification: async ({ verification, user, clientData }) => {
            recordVerifiedPasskey(user.id, verification.registrationInfo?.userVerified === true, true, clientData.id);
          }
        },
        authentication: {
          afterVerification: async ({ verification }) => {
            recordVerifiedPasskey(undefined, verification.authenticationInfo.userVerified === true, false);
          }
        },
        schema: { passkey: { modelName: "auth_passkey" } }
      }),
      authPolicyPlugin(),
      nextCookies()
    ]
  } satisfies BetterAuthOptions;
}

export function createNoctuaAuth(config: NoctuaAuthConfig) {
  return attachAuthPolicyHandler(betterAuth(noctuaAuthOptions(config)), config.policyDatabase);
}

export type NoctuaAuth = ReturnType<typeof betterAuth<ReturnType<typeof noctuaAuthOptions>>>;

export function attachAuthPolicyHandler<T extends {handler:(request:Request)=>Promise<Response>}>(auth: T, database = getDb): T {
  auth.handler = wrapAuthPolicyHandler(auth.handler, database);
  return auth;
}

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
  return withDbWriteRetry("setActiveAccountId", () =>
    context.internalAdapter.updateSession(sessionToken, { activeAccountId: accountId }));
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
  if (trustedOrigins.some(origin => origin !== baseURL)) throw new Error("NOCTUA_TRUSTED_ORIGINS must contain only the canonical BETTER_AUTH_URL origin.");
  return { secret, baseURL, passkeyRpID, trustedOrigins: [baseURL] };
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
export function getAuth(initialization: {operatorLock?:AuthLifetimeLock} = {}): Promise<NoctuaAuth> {
  const generation = getDbConnectionGeneration();
  if (!authPromise || authGeneration !== generation) {
    authGeneration = generation;
    const pending = (async () => {
      await ensureAuthLifetimeLock(initialization.operatorLock);
      const env = readAuthEnv();
      if (process.env.IMAP_CREDENTIALS_STORAGE === "both") {
        console.warn("[auth] IMAP_CREDENTIALS_STORAGE=both is deprecated; use db.");
      }
      const database = await getAuthDb();
      const options = noctuaAuthOptions({ database, ...env });
      await migrateAuthSchema(options);
      installAuthControlPlane(database);
      if (getDbConnectionGeneration() !== generation) throw new Error("Auth storage closed during initialization.");
      const auth=attachAuthPolicyHandler(betterAuth(options));
      const db=await getDb(),cutoff=Date.now()-process.uptime()*1000;
      const {reconcileProvisioning}=await import("./db/userProvisioning");
      const {reconcileLifecycle}=await import("./userLifecycle");
      await reconcileProvisioning(db,cutoff);
      await reconcileLifecycle(auth,db,cutoff);
      const interrupted = await reconcileSecurityOperations(db, cutoff);
      for (const userId of interrupted) revokeAuthStreams({userId});
      return auth;
    })();
    authPromise = pending;
    void pending.catch(() => { if (authPromise === pending) authPromise = null; });
  }
  return authPromise;
}
