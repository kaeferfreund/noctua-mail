import { describe, expect, test } from "bun:test";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  PasswordPolicyError,
  hashPassword,
  validatePasswordPolicy,
  verifyPassword
} from "./passwords";

const VALID_PASSWORD = "correct horse battery";

describe("validatePasswordPolicy", () => {
  test("accepts passwords between the bounds, inclusive", () => {
    expect(validatePasswordPolicy("a".repeat(PASSWORD_MIN))).toBeNull();
    expect(validatePasswordPolicy("a".repeat(PASSWORD_MAX))).toBeNull();
  });

  test("returns a user-facing message for missing, short and long passwords", () => {
    expect(validatePasswordPolicy(undefined)).toBe("Password is required");
    expect(validatePasswordPolicy("")).toBe("Password is required");
    expect(validatePasswordPolicy(12345678901)).toBe("Password is required");
    expect(validatePasswordPolicy("a".repeat(PASSWORD_MIN - 1))).toBe(
      `Password must be at least ${PASSWORD_MIN} characters`
    );
    expect(validatePasswordPolicy("a".repeat(PASSWORD_MAX + 1))).toBe(
      `Password must be at most ${PASSWORD_MAX} characters`
    );
  });

  test("uses the documented bounds", () => {
    expect(PASSWORD_MIN).toBe(10);
    expect(PASSWORD_MAX).toBe(256);
  });
});

describe("hashPassword / verifyPassword", () => {
  test("hashes with argon2id and verifies the same password only", async () => {
    const hash = await hashPassword(VALID_PASSWORD);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain(VALID_PASSWORD);
    expect(await verifyPassword(VALID_PASSWORD, hash)).toBe(true);
    expect(await verifyPassword(`${VALID_PASSWORD}!`, hash)).toBe(false);
  });

  test("salts every hash", async () => {
    const [first, second] = await Promise.all([
      hashPassword(VALID_PASSWORD),
      hashPassword(VALID_PASSWORD)
    ]);
    expect(first).not.toBe(second);
  });

  test("refuses to hash a password that violates the policy", async () => {
    await expect(hashPassword("short")).rejects.toBeInstanceOf(PasswordPolicyError);
    await expect(hashPassword("a".repeat(PASSWORD_MAX + 1))).rejects.toThrow(
      `Password must be at most ${PASSWORD_MAX} characters`
    );
  });

  test("rejects empty and over-long input and a missing hash without hashing", async () => {
    const hash = await hashPassword(VALID_PASSWORD);
    expect(await verifyPassword("", hash)).toBe(false);
    expect(await verifyPassword("a".repeat(PASSWORD_MAX + 1), hash)).toBe(false);
    expect(await verifyPassword(VALID_PASSWORD, null)).toBe(false);
    expect(await verifyPassword(VALID_PASSWORD, "")).toBe(false);
  });
});
