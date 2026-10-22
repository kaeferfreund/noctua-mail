import { createAuthClient, type Proof, type SecurityInfo } from "@/lib/authClient";

export const proof: Proof = { ok: true, grant: "synthetic-one-use-grant", purpose: "totp.enroll", expiresAt: Date.now() + 300000, ceremonyRequired: false };
export const setup = { method: "totp", totpURI: "otpauth://totp/Synthetic?secret=JBSWY3DPEHPK3PXP&issuer=Noctua", backupCodes: ["synthetic-code-a", "synthetic-code-b"] };
export const securityInfo: SecurityInfo = { ok: true, hasPassword: true, totpEnrolled: true, mfaStateInconsistent: false, enrollmentRequired: false, reauthRequired: false,
  passkeys: [{ id: "synthetic-key", name: "Synthetic key", createdAt: "2026-01-01", deviceType: "singleDevice", backedUp: false }],
  sessions: [{ id: "synthetic-current", current: true, createdAt: "2026-01-01", updatedAt: "2026-01-01" }, { id: "synthetic-other", current: false, createdAt: "2026-01-01", updatedAt: "2026-01-01" }] };
export function clientFixture(respond: (path: string, body: Record<string, unknown>, init?: RequestInit) => Response | Promise<Response> = () => Response.json({ ok: true })) {
  const calls: { path: string; body: Record<string, unknown>; init?: RequestInit }[] = [];
  const client = createAuthClient(async (input, init) => {
    const path = new URL(String(input), "http://localhost").pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ path, body, init });
    return respond(path, body, init);
  });
  // Real browser ceremonies are covered by the browser harness; DOM tests stop
  // at the dedicated auth client seam rather than replacing credential internals.
  client.conditionalAvailable = async () => false;
  client.cancelPasskey = async () => {};
  return { client, calls };
}
