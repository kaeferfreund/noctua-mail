/** Browser-only auth boundary. Capabilities live in call/component memory, never storage. */
import { publishLocalePreference } from "./i18n/localeEvents";
import { forgetPushSubscriptionOnServer } from "./push/client";
import type { Account, User } from "./data";

export type MailboxState = "enrollment" | "none" | "unselected" | "selected";
export type AuthSecurity = {
  enrollmentRequired: boolean;
  reauthRequired: boolean;
  hasPassword: boolean;
  imapLoginAvailable: boolean;
  code?: string;
};
export type AuthUser = Pick<User, "id" | "email" | "name"> & Partial<Omit<User, "id" | "email" | "name">>;
export type AuthMe = {
  ok: true;
  user: AuthUser;
  accounts: Account[];
  accountId: string | null;
  mailboxState: MailboxState;
  security: AuthSecurity;
  exp: number;
  ttlSeconds: number;
};
export type SecurityInfo = {
  ok: true;
  hasPassword: boolean;
  totpEnrolled: boolean;
  mfaStateInconsistent: boolean;
  enrollmentRequired: boolean;
  reauthRequired: boolean;
  passkeys: { id: string; name: string | null; createdAt: string; deviceType: string; backedUp: boolean }[];
  sessions: { id: string; current: boolean; createdAt: string; updatedAt: string; userAgent?: string; ip?: string }[];
};
export type ProofPurpose = "totp.enroll" | "totp.replace" | "passkey.enroll" | "passkey.remove" |
  "passkey.rename" | "password.set" | "password.change" | "backup.regenerate" | "sessions.revoke" | "admin.recovery";
export type Proof = { ok: true; grant: string; purpose: ProofPurpose; expiresAt: number; ceremonyRequired?: boolean };
export type ProofInput = { purpose: ProofPurpose; currentPassword?: string; totpCode?: string; backupCode?: string; proofMode?: "passkey" };
export type SignupInput = { inviteCode: string; email: string; name: string; password: string };
export type SignupResult = { ok: true; userId: string; accountId: null; security: { enrollmentRequired: true }; loginRequired: boolean };
export type TotpSetup = { method: "totp"; totpURI: string; backupCodes: string[] };
export type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class AuthClientError extends Error {
  constructor(readonly status: number, readonly code: string, readonly retryAfter = 0) {
    super(code);
    this.name = "AuthClientError";
  }
  get loggedOut() { return this.status === 401; }
}

const messages: Record<string, string> = {
  invalid_proof: "The password or verification code is incorrect. Try again.",
  INVALID_PASSWORD: "The current password is incorrect.",
  INVALID_CODE: "That code is incorrect. Try a new code.",
  INVALID_TOTP: "That code is incorrect. Try a new code.",
  INVALID_BACKUP_CODE: "That backup code is incorrect or already used.",
  invalid_challenge: "This sign-in challenge has expired. Return to sign in.",
  SESSION_NOT_FRESH: "Please sign in again before changing security settings.",
  reauth_required: "Verify your identity again to continue.",
  factor_proof_required: "Enter your current authenticator code or verify with a passkey.",
  another_passkey_required: "Use a different passkey to remove this key.",
  passkey_uv_required: "Verify with your device PIN, fingerprint or face.",
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: "This device already has a passkey. Use another device or security key.",
  security_state_changed: "Security settings changed. Sign in again to continue.",
  security_operation_pending: "Another security operation is in progress. Wait, then try again.",
  mfa_state_inconsistent: "Authenticator setup needs recovery. Contact your admin.",
  invalid_invite: "This invite is invalid or expired. Ask your admin for a new invite.",
  invite_exhausted: "This invite has already been used. Ask your admin for a new invite.",
  user_exists: "An account already exists for this email. Sign in instead.",
  mailbox_exists: "This mailbox already exists. Ask your admin for access.",
  auth_integration_pending: "Sign-in is temporarily unavailable. Please try again later.",
  provisioning_failed: "Account creation could not finish. Contact your admin before retrying.",
  INVALID_TOKEN: "This reset link is invalid, expired or already used. Ask your admin for a new link.",
  invalid_request: "Check the form fields and try again."
};
export function authErrorMessage(error: unknown, genericLogin = false): string {
  if (!(error instanceof AuthClientError)) return "Unable to connect. Please try again.";
  if (error.status === 429) return `Too many attempts. Try again in ${error.retryAfter || 60} seconds.`;
  if (genericLogin) return "Unable to sign in. Check your credentials and try again.";
  if (error.loggedOut) return "Your session ended. Please sign in again.";
  return messages[error.code] ?? (error.status === 403 ? "This action needs permission or fresh identity verification." : "The request failed. Please try again.");
}
export function isPasskeyCancellation(error: unknown) {
  return error instanceof AuthClientError && ["AUTH_CANCELLED", "ERROR_CEREMONY_ABORTED", "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "NotAllowedError", "AbortError"].includes(error.code);
}
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 10 || password.length > 256) return "Use a password between 10 and 256 characters.";
  return password === confirmation ? null : "The passwords do not match.";
}

export function createAuthClient(fetcher: AuthFetch = (input, init) => fetch(input, init)) {
  async function request<T>(path: string, body?: unknown, proof?: Proof, method = body === undefined ? "GET" : "POST"): Promise<T> {
    const response = await fetcher(path, {
      method, credentials: "include", cache: "no-store",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(proof ? { "x-noctua-reauth": proof.grant } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new AuthClientError(response.status, data?.code ?? "request_failed", Number(response.headers.get("Retry-After")) || 0);
    return data as T;
  }

  // The pinned passkey plugin ignores per-call fetchOptions on options requests.
  // A dedicated client per ceremony carries this header on BOTH requests without
  // exposing another concurrent ceremony's proof through a mutable singleton.
  async function betterClient(proof?: Proof, signal?: AbortSignal) {
    const [{ createAuthClient: createBetterClient }, { passkeyClient }, { twoFactorClient }] = await Promise.all([
      import("better-auth/client"), import("@better-auth/passkey/client"), import("better-auth/client/plugins")
    ]);
    let retryAfter = 0;
    const client = createBetterClient({
      basePath: "/api/ba", plugins: [passkeyClient(), twoFactorClient()],
      fetchOptions: { credentials: "include", retry: 0, signal, headers: proof ? { "x-noctua-reauth": proof.grant } : {}, customFetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await fetcher(input, init);
        retryAfter = Number(response.headers.get("Retry-After")) || 0;
        return response;
      }) as typeof fetch }
    });
    return { client, retryAfter: () => retryAfter };
  }
  function unwrap<T>(result: { data: unknown; error: { status: number; code?: string } | null }, retryAfter = 0): T {
    if (result.error) throw new AuthClientError(result.error.status, result.error.code ?? "request_failed", retryAfter);
    return result.data as T;
  }
  return {
    me: () => request<AuthMe>("/api/auth/me"),
    methods: () => request<{ ok: true; methods: { password: boolean; passkey: boolean; imap: boolean } }>("/api/auth/methods"),
    logout: async () => {
      // Needs the session, so it runs before the logout request.
      await forgetPushSubscriptionOnServer(fetcher);
      const result = await request<{ ok: true }>("/api/auth/logout", undefined, undefined, "POST");
      publishLocalePreference(null);
      return result;
    },
    switchAccount: (accountId: string) => request<{ ok: true; accountId: string }>("/api/auth/switch-account", { accountId }),
    signup: (body: SignupInput) => request<SignupResult>("/api/auth/signup", body),
    signIn: (email: string, password: string, method: "password" | "imap" = "password") => request<{ twoFactorRedirect?: boolean }>(`/api/ba/sign-in/${method === "imap" ? "imap" : "email"}`, { email, password }),
    async verifyTotp(code: string, proof?: Proof) {
      // SDK is used for the installed TOTP contract; wrapper errors stay local.
      const sdk = await betterClient(proof);
      return unwrap(await sdk.client.twoFactor.verifyTotp({ code }), sdk.retryAfter());
    },
    verifyBackupCode: (code: string) => request("/api/ba/two-factor/verify-backup-code", { code }),
    enableTotp: (password: string, proof: Proof) => request<TotpSetup>("/api/ba/two-factor/enable", { ...(password ? { password } : {}), method: "totp" }, proof),
    reauth: (body: ProofInput) => request<Proof>("/api/auth/reauth", body),
    replaceTotp: (currentPassword: string, proof: Proof) => request<Proof & { enrollmentRequired: true }>("/api/auth/totp/replace", { ...(currentPassword ? { currentPassword } : {}) }, proof),
    security: () => request<SecurityInfo>("/api/auth/security"),
    changePassword: (body: { currentPassword?: string; newPassword: string }, proof: Proof) => request<{ ok: true }>("/api/auth/security/password", body, proof),
    regenerateBackupCodes: (currentPassword: string, proof: Proof) => request<{ ok: true; backupCodes: string[] }>("/api/auth/security/backup-codes", { ...(currentPassword ? { currentPassword } : {}) }, proof),
    revokeSessions: (body: { sessionId: string } | { all: true }, proof: Proof) => request<{ ok: true }>("/api/auth/security/sessions/revoke", body, proof),
    renamePasskey: (passkeyId: string, name: string, proof: Proof) => request<{ ok: true }>("/api/auth/security/passkeys/rename", { passkeyId, name }, proof),
    removePasskey: (passkeyId: string, proof: Proof) => request<{ ok: true }>("/api/auth/security/passkeys/remove", { passkeyId }, proof),
    resetPassword: (token: string, newPassword: string) => request<{ status: true }>("/api/ba/reset-password", { token, newPassword }),
    async passkeySignIn(options?: { autoFill?: boolean; proof?: Proof; signal?: AbortSignal }) {
      const sdk = await betterClient(options?.proof, options?.signal);
      if (options?.signal?.aborted) throw new AuthClientError(400, "AUTH_CANCELLED");
      return unwrap<Proof | { twoFactorRedirect?: boolean }>(await sdk.client.signIn.passkey({ autoFill: options?.autoFill }), sdk.retryAfter());
    },
    async addPasskey(name: string, proof: Proof) {
      const sdk = await betterClient(proof);
      return unwrap(await sdk.client.passkey.addPasskey({ name }), sdk.retryAfter());
    },
    async conditionalAvailable() {
      return typeof PublicKeyCredential !== "undefined" && typeof PublicKeyCredential.isConditionalMediationAvailable === "function" && await PublicKeyCredential.isConditionalMediationAvailable();
    },
    async cancelPasskey() {
      const { WebAuthnAbortService } = await import("@simplewebauthn/browser");
      WebAuthnAbortService.cancelCeremony();
    }
  };
}
export type NoctuaAuthClient = ReturnType<typeof createAuthClient>;
export const authClient = createAuthClient();
