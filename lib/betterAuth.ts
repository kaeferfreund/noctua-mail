/**
 * SPIKE (branch spike/better-auth, never merged): Better Auth on the Noctua
 * master DB. See doc/SPIKE-BETTER-AUTH.md for what this proves.
 *
 * - One Better Auth instance per module graph, built lazily on the master
 *   bun:sqlite connection from `getAuthDb()` (after `getDb()` has run
 *   `initMasterSchema`), followed by Better Auth's own additive migrations.
 * - Mounted at `/api/ba` (app/api/ba/[...all]/route.ts) so it cannot shadow
 *   or be shadowed by the existing `/api/auth/*` routes during the migration.
 * - All Better Auth tables are prefixed `auth_` so its "account" model can
 *   never be confused with Noctua's `accounts` (mailboxes) table.
 */
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { defaultAc, userAc } from "better-auth/plugins/admin/access";
import { passkey } from "@better-auth/passkey";
import { getAuthDb } from "./db/connection";
import { imapSignIn, type VerifyImapCredentials } from "./betterAuthImapSignIn";

export const AUTH_BASE_PATH = "/api/ba";
export const AUTH_COOKIE_PREFIX = "noctua";
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 256;

/**
 * Where the Better Auth `user` model lives:
 * - "auth_user": its own table; `users.id` mirrors `auth_user.id` (the
 *   recommended variant, see the spike report).
 * - "users": mapped onto Noctua's existing `users` table (evaluated, works
 *   only on an empty table, see the spike report).
 */
export type AuthUserTable = "auth_user" | "users";

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
  userTable?: AuthUserTable;
  verifyImap?: VerifyImapCredentials;
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

type AuthUserRow = { id: string; email: string; role?: string | null; createdAt?: Date | string | null };

function toEpochMs(value: Date | string | null | undefined) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function toNoctuaRole(role: string | null | undefined) {
  return role === "admin" ? "admin" : "user";
}

/**
 * Keeps the Noctua `users` row (memberships, MCP tokens, audit, prefs all
 * point at `users.id`) in step with `auth_user` in the separate-table variant.
 */
function noctuaUserMirrorHooks(db: SqliteHandle): NonNullable<BetterAuthOptions["databaseHooks"]> {
  return {
    user: {
      create: {
        // A user that already exists in Noctua (legacy invite/IMAP signup)
        // keeps its id, so every existing reference stays valid.
        async before(user) {
          const existing = db
            .prepare(`SELECT id FROM users WHERE lower(email) = lower(?)`)
            .get(String(user.email ?? "")) as { id?: string } | undefined;
          if (!existing?.id) return;
          return { data: { ...user, id: existing.id } };
        },
        async after(user) {
          const row = user as unknown as AuthUserRow;
          db.prepare(
            `INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET email = excluded.email, role = excluded.role`
          ).run(row.id, row.email, toNoctuaRole(row.role), toEpochMs(row.createdAt));
        }
      },
      update: {
        async after(user) {
          const row = user as unknown as AuthUserRow;
          db.prepare(`UPDATE users SET email = ?, role = ? WHERE id = ?`).run(
            row.email,
            toNoctuaRole(row.role),
            row.id
          );
        }
      }
    }
  };
}

function rejectImapSignIn(): Promise<boolean> {
  return Promise.resolve(false);
}

/**
 * The Better Auth options for Noctua. Kept separate from `betterAuth()` so the
 * schema can be migrated before an instance exists: constructing the instance
 * starts Better Auth's schema check, which logs "Database schema mismatch" as
 * an error on a database that has not been migrated yet.
 */
export function noctuaAuthOptions(config: NoctuaAuthConfig) {
  const userTable = config.userTable ?? "auth_user";
  const twoFactorPlugin = twoFactor({
    issuer: "Noctua",
    // Users without a Better Auth password (IMAP-only or passkey-only) can
    // enrol TOTP with their session alone; users with a password must still
    // confirm it (shouldRequirePassword).
    allowPasswordless: true,
    schema: { twoFactor: { modelName: "auth_two_factor" } }
  });
  // /sign-in/imap re-uses the two-factor plugin's own sign-in after-hook
  // (its matcher is hard-wired to /sign-in/email|username|phone-number).
  // Better Auth 1.7.12 exposes exactly one; if an upgrade changes that, the
  // IMAP path must be reviewed before it can silently skip the challenge.
  const secondFactorHooks = twoFactorPlugin.hooks?.after ?? [];
  if (secondFactorHooks.length !== 1) {
    throw new Error(
      `better-auth twoFactor exposes ${secondFactorHooks.length} sign-in after-hooks (expected 1); ` +
        "review lib/betterAuthImapSignIn.ts before /sign-in/imap can re-use its second-factor challenge."
    );
  }
  return {
    appName: "Noctua",
    baseURL: config.baseURL,
    basePath: AUTH_BASE_PATH,
    secret: config.secret,
    database: config.database as never,
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      password: argon2idPassword
    },
    user: { modelName: userTable },
    session: {
      modelName: "auth_session",
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
    databaseHooks: userTable === "auth_user" ? noctuaUserMirrorHooks(config.database) : undefined,
    plugins: [
      // `ac` is only read by the admin client plugin; the server checks `roles`.
      admin({ roles: { admin: adminWithoutImpersonation, user: userAc } }),
      twoFactorPlugin,
      passkey({
        rpID: config.passkeyRpID ?? new URL(config.baseURL).hostname,
        rpName: "Noctua",
        schema: { passkey: { modelName: "auth_passkey" } }
      }),
      imapSignIn({
        verifyImap: config.verifyImap ?? rejectImapSignIn,
        secondFactorHooks
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
 * plans nothing. Throws `UnsafeMigrationError` instead of adding a required
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

function readAuthEnv() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters.");
  }
  const baseURL = process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";
  return {
    secret,
    baseURL,
    passkeyRpID: process.env.PASSKEY_RP_ID?.trim() || undefined
  };
}

let authPromise: Promise<NoctuaAuth> | null = null;

/** Graph-local Better Auth instance on the master DB, migrated on first use. */
export function getAuth(): Promise<NoctuaAuth> {
  if (!authPromise) {
    authPromise = (async () => {
      const database = await getAuthDb();
      const options = noctuaAuthOptions({ database, ...readAuthEnv() });
      const summary = await migrateAuthSchema(options);
      if (summary.createdTables.length || summary.addedColumns.length || summary.addedIndexes.length) {
        console.info("[auth] better-auth schema migrated", summary);
      }
      return betterAuth(options);
    })().catch((error) => {
      authPromise = null;
      throw error;
    });
  }
  return authPromise;
}
