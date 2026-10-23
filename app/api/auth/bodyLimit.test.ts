import { describe, expect, test } from "bun:test";
import { AUTH_JSON_BODY_LIMIT } from "../_helpers/readAuthJson";
import { createAuthenticatedTestSession, syntheticRequestIp, totpFromUri } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { reauthenticate } from "@/lib/authSecurity";
import { readSessionSecurity } from "../../../lib/db/authPolicy";
import { createRateLimiter } from "@/lib/rateLimit";
import { PUT as preferences } from "./preferences/route";
import { POST as switchAccount } from "./switch-account/route";
import { POST as reauth } from "./reauth/route";
import { POST as replaceTotp } from "./totp/replace/route";
import { POST as password } from "./security/password/route";
import { POST as backupCodes } from "./security/backup-codes/route";
import { POST as revokeSessions } from "./security/sessions/revoke/route";
import { POST as renamePasskey } from "./security/passkeys/rename/route";
import { POST as removePasskey } from "./security/passkeys/remove/route";
import type { ReauthPurpose } from "@/lib/authPolicy";

const routes = [
  { path: "preferences", method: "PUT", handler: preferences },
  { path: "switch-account", method: "POST", handler: switchAccount },
  { path: "reauth", method: "POST", handler: reauth },
  { path: "totp/replace", method: "POST", handler: replaceTotp, purpose: "totp.replace" },
  { path: "security/password", method: "POST", handler: password, purpose: "password.change" },
  { path: "security/backup-codes", method: "POST", handler: backupCodes, purpose: "backup.regenerate" },
  { path: "security/sessions/revoke", method: "POST", handler: revokeSessions, purpose: "sessions.revoke" },
  { path: "security/passkeys/rename", method: "POST", handler: renamePasskey, purpose: "passkey.rename" },
  { path: "security/passkeys/remove", method: "POST", handler: removePasskey, purpose: "passkey.remove" }
] satisfies { path: string; method: string; handler: (request: Request) => Promise<Response>; purpose?: ReauthPurpose }[];

function padded(body: unknown, size = AUTH_JSON_BODY_LIMIT) {
  const json = JSON.stringify(body);
  return " ".repeat(size - new TextEncoder().encode(json).byteLength) + json;
}

describe("self-service auth body limits", () => {
  for (const route of routes) {
    test(`${route.method} /api/auth/${route.path}: 413 above limit; identical validation and success at limit`, async () => {
      const f = await createAuthenticatedTestSession();
      const ip = syntheticRequestIp();
      function request(body: string, grant?: string) {
        return new Request(`http://localhost:3000/api/auth/${route.path}`, {
          method: route.method, headers: f.jar.headers({
            origin: "http://localhost:3000", "content-type": "application/json",
            "x-forwarded-for": ip, ...(grant ? { "x-noctua-reauth": grant } : {})
          }), body
        });
      }
      const audits = () => f.master.prepare("SELECT * FROM admin_audit WHERE actorUserId=? ORDER BY id").all(f.user.id);
      const before = audits();
      // No Content-Length is needed to enforce the bound. Includes the review's 2 MiB regression.
      for (const size of [AUTH_JSON_BODY_LIMIT + 1, 2 * 1024 * 1024]) {
        const rejected = await route.handler(request(padded({ uiLocale: "en" }, size)));
        expect(rejected.status).toBe(413);
        expect(await rejected.text()).toBe('{"ok":false,"code":"payload_too_large"}');
        expect(rejected.headers.get("cache-control")).toBe("no-store");
      }
      expect(audits()).toEqual(before);
      expect(await f.auth.api.getSession({ headers: f.jar.headers() })).not.toBeNull();

      // Preserve both shape errors and malformed-JSON errors byte for byte at the boundary.
      for (const invalid of ['{"unknown":true}', '{']) {
        const ordinary = await route.handler(request(invalid));
        const boundary = await route.handler(request(" ".repeat(AUTH_JSON_BODY_LIMIT - invalid.length) + invalid));
        expect(ordinary.status).toBe(400);
        expect(boundary.status).toBe(ordinary.status);
        expect(await boundary.text()).toBe(await ordinary.text());
      }
      expect(audits()).toEqual(before);

      let body: Record<string, unknown>;
      let grant: string | undefined;
      const expected: Record<string, unknown> = { ok: true };
      if (route.path === "preferences") {
        body = { uiLocale: "en" };
        expected.uiLocale = "en";
      } else if (route.path === "switch-account") {
        const id = `body-limit-${crypto.randomUUID()}`;
        await (await dbModulePromise).upsertAccount({ id, name: "Synthetic boundary mailbox", email: `${id}@example.test`, avatar: "",
          imap: { host: "imap.example.test", port: 993, secure: true, user: "synthetic@example.test", password: "synthetic" },
          smtp: { host: "smtp.example.test", port: 465, secure: true, user: "synthetic@example.test", password: "synthetic" }
        });
        await f.addMembership(f.user.id, id);
        body = { accountId: id };
        expected.accountId = id;
      } else {
        const factor = await f.auth.api.getTOTPURI({ headers: f.jar.headers(), body: { password: "synthetic-password-123" } });
        const proof = { purpose: "password.change" as ReauthPurpose, currentPassword: "synthetic-password-123", totpCode: totpFromUri(factor.totpURI) };
        if (route.path === "reauth") {
          body = proof;
          expected.ceremonyRequired = false;
          expected.purpose = "password.change";
        } else {
          proof.purpose = route.purpose!;
          grant = (await reauthenticate(f.auth, f.master, readSessionSecurity(f.master, f.session.id), request("{}"), proof, createRateLimiter({ max: 50 }))).grant;
          if (route.path.includes("passkeys")) {
            const passkey = await (await f.auth.$context).adapter.create({ model: "passkey", data: {
              userId: f.user.id, name: "Synthetic key", credentialID: crypto.randomUUID(), publicKey: "synthetic",
              counter: 0, deviceType: "singleDevice", backedUp: false, createdAt: new Date()
            } });
            body = { passkeyId: passkey.id, ...(route.path.endsWith("rename") ? { name: "Synthetic renamed key" } : {}) };
          } else if (route.path.endsWith("revoke")) body = { all: true };
          else body = { currentPassword: "synthetic-password-123", ...(route.path.endsWith("password") ? { newPassword: "synthetic-new-password-123" } : {}) };
        }
      }
      // Oversize rejection must not spend a supplied one-use grant.
      const tooLarge = await route.handler(request(padded(body, AUTH_JSON_BODY_LIMIT + 1), grant));
      expect(tooLarge.status).toBe(413);
      expect(await tooLarge.json()).toEqual({ ok: false, code: "payload_too_large" });
      const result = await route.handler(request(padded(body), grant));
      expect(result.status).toBe(200);
      const data = await result.json();
      expect(data).toMatchObject(expected);
      if (route.path === "security/backup-codes") {
        expect(Array.isArray(data.backupCodes)).toBe(true);
        expect(data.backupCodes.length).toBeGreaterThan(0);
      }
      if (route.path === "totp/replace") {
        expect(data).toMatchObject({ purpose: "totp.enroll", enrollmentRequired: true });
        expect(typeof data.grant).toBe("string");
        expect(result.headers.getSetCookie().length).toBeGreaterThan(0);
      }
      if (route.path === "preferences" || route.path === "switch-account") expect(audits()).toEqual(before);
    });
  }
});
