import { describe, expect, it } from "bun:test";
import { AuthClientError, authErrorMessage, createAuthClient, validateNewPassword, type Proof } from "./authClient";

describe("Noctua auth client boundary", () => {
  it("keeps proof in headers and logout bodyless, without adding capability query strings", async () => {
    const calls: { path: string; init?: RequestInit }[] = [];
    const client = createAuthClient(async (path, init) => { calls.push({ path: String(path), init }); return Response.json({ ok: true }); });
    const proof: Proof = { ok: true, purpose: "totp.replace", grant: "synthetic-proof", expiresAt: Date.now() + 1000 };
    await client.replaceTotp("synthetic-password", proof);
    await client.renamePasskey("synthetic-key", "Synthetic key", { ...proof, purpose: "passkey.rename" });
    await client.revokeSessions({ all: true }, { ...proof, purpose: "sessions.revoke" });
    await client.logout();
    expect(calls.map(call => call.path)).toEqual(["/api/auth/totp/replace", "/api/auth/security/passkeys/rename", "/api/auth/security/sessions/revoke", "/api/auth/logout"]);
    for (const call of calls.slice(0, 3)) {
      expect(new Headers(call.init?.headers).get("x-noctua-reauth")).toBe("synthetic-proof");
      expect(call.init?.body).not.toContain("synthetic-proof");
    }
    expect(calls[3].init?.method).toBe("POST"); expect(calls[3].init?.body).toBeUndefined();
    expect(new Headers(calls[3].init?.headers).has("content-type")).toBe(false);
  });
  it("maps stable codes/status, preserves 403 sessions and Retry-After, and ignores message text", async () => {
    for (const status of [401, 403, 429]) {
      const client = createAuthClient(async () => Response.json({ code: "invalid_proof", message: "synthetic-private-upstream-detail" }, { status, headers: { "Retry-After": "900" } }));
      try { await client.me(); throw new Error("Expected HTTP failure"); }
      catch (error) {
        expect(error instanceof AuthClientError).toBe(true);
        const failure = error as AuthClientError;
        expect(failure.loggedOut).toBe(status === 401);
        expect(authErrorMessage(error)).not.toContain("private-upstream");
        if (status === 429) expect(authErrorMessage(error)).toContain("900 seconds");
      }
    }
  });
  it("validates password length and confirmation without trimming a chosen password", () => {
    expect(validateNewPassword("short", "short")).toContain("10 and 256");
    expect(validateNewPassword("x".repeat(257), "x".repeat(257))).toContain("10 and 256");
    expect(validateNewPassword("  synthetic password  ", "synthetic password")).toContain("do not match");
  });
});
