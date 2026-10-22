/**
 * App-password hashing for personal logins (design D1, §4.4).
 *
 * Uses `Bun.password` (argon2id) so no dependency is needed; the app already
 * requires Bun. There are no `@types/bun`, so the global is reached through
 * `globalThis` with a local shape, the same way `lib/syncJobs.ts` reaches
 * `Bun.spawn`.
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 256;

type BunPasswordApi = {
  hash(
    password: string,
    options?: { algorithm: "argon2id"; memoryCost?: number; timeCost?: number }
  ): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
};

function getBunPassword(): BunPasswordApi {
  const bun = (globalThis as typeof globalThis & { Bun?: { password?: BunPasswordApi } }).Bun;
  if (!bun?.password) {
    throw new Error("Bun runtime is required for password hashing.");
  }
  return bun.password;
}

/** Thrown by `hashPassword` when the password violates the policy. */
export class PasswordPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordPolicyError";
  }
}

/**
 * Returns a user-facing message when the password violates the policy,
 * otherwise `null`. Routes map a message to a 400 response.
 */
export function validatePasswordPolicy(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required";
  }
  if (password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters`;
  }
  if (password.length > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} characters`;
  }
  return null;
}

/** argon2id hash of a policy-conforming password. Throws `PasswordPolicyError` otherwise. */
export async function hashPassword(password: string): Promise<string> {
  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    throw new PasswordPolicyError(policyError);
  }
  return getBunPassword().hash(password, { algorithm: "argon2id" });
}

/**
 * Verifies a password against a stored argon2id hash. Empty or over-long
 * inputs and an empty hash are rejected without touching the hasher; a
 * malformed stored hash is a data error and is allowed to throw.
 */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0 || password.length > PASSWORD_MAX) {
    return false;
  }
  if (!hash) {
    return false;
  }
  return getBunPassword().verify(password, hash);
}
