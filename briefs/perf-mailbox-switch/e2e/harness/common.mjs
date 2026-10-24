// Shared helpers for the Spike A harness. Synthetic data only; no secrets written to results.
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
const require = createRequire("/home/monkey/code/noctua-mail/wt-spike-switch-e2e/package.json");
export const { chromium } = require("playwright");
export const BASE = process.env.SPIKE_BASE ?? "http://127.0.0.1:3905";
export const SEED = process.env.SPIKE_SEED ?? "/tmp/spike-switch-e2e/seed.json";
export const STATE = process.env.SPIKE_STATE ?? "/tmp/spike-switch-e2e/storage-state.json";
function base32Decode(input) {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, value = 0; const out = [];
  for (const c of input.replace(/=+$/, "").toUpperCase()) { value = (value << 5) | a.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; } }
  return Buffer.from(out);
}
export function totpFromUri(uri, at = Date.now()) { // RFC 6238, same as tests/helpers/totp.ts
  const url = new URL(uri); const secret = url.searchParams.get("secret");
  const digits = Number(url.searchParams.get("digits") ?? 6), period = Number(url.searchParams.get("period") ?? 30);
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / period)));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest(); const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}
/** Sign in via the same API sequence as tests/browser/ui/qaRound2Session.ts and persist storage state (scratch only). */
export async function ensureSession(browser, { fresh = false, accountId } = {}) {
  if (!fresh && existsSync(STATE)) return JSON.parse(readFileSync(STATE, "utf8"));
  const seed = JSON.parse(readFileSync(SEED, "utf8"));
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage(); await page.goto("/");
  const steps = [["/api/ba/sign-in/email", { email: seed.email, password: seed.password }], ["/api/ba/two-factor/verify-totp", { code: totpFromUri(seed.totpURI) }]];
  if (accountId) steps.push(["/api/auth/switch-account", { accountId }]);
  for (const [url, data] of steps) {
    const r = await page.request.post(url, { data, headers: { origin: BASE } });
    if (r.status() !== 200) throw new Error(`${url} -> ${r.status()} ${await r.text()}`);
  }
  const state = await ctx.storageState({ path: STATE }); await ctx.close(); return state;
}
export const redact = (u) => { const url = new URL(u); return url.pathname.replace(/spike-(small|medium|large|folders)/g, "{acct:$1}").replace(/\/[0-9a-f]{16,}|\/[A-Za-z0-9_-]{20,}/g, "/{id}") + (url.search ? "?" + [...url.searchParams.keys()].map(k => `${k}=…`).join("&") : ""); };
