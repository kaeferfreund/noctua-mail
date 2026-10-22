// Test helpers for the Better Auth spike tests (not a test file itself).
import { Database } from "bun:sqlite";
import { createHmac } from "crypto";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { parseSetCookieHeader } from "better-auth/cookies";
import { configureDb } from "./db/connection";
import { initMasterSchema } from "./db/schema";

export const TEST_SECRET = "spike-better-auth-test-secret-0123456789abcdef";
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
  const db = new Database(dbPath) as any;
  configureDb(db);
  initMasterSchema(db);
  return db as {
    prepare(sql: string): { run: (...p: any[]) => any; get: (...p: any[]) => any; all: (...p: any[]) => any[] };
    exec(sql: string): void;
    close(): void;
  };
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
