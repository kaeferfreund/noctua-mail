import type { useTranslations } from "next-intl";
import { AuthClientError, validateNewPassword } from "@/lib/authClient";

type Translator = ReturnType<typeof useTranslations<"Auth">>;
type MessageKey = Parameters<Translator>[0];
// UI validation keeps a key in state, so changing language also refreshes errors.
export class AuthUiError extends Error {
  constructor(readonly messageKey: MessageKey) { super(messageKey); }
}
const errorKeys = {
  invalid_proof: "errors.invalidProof",
  INVALID_PASSWORD: "errors.invalidPassword",
  INVALID_CODE: "errors.invalidCode",
  INVALID_TOTP: "errors.invalidCode",
  INVALID_BACKUP_CODE: "errors.invalidBackup",
  invalid_challenge: "errors.expiredChallenge",
  SESSION_NOT_FRESH: "errors.freshSession",
  reauth_required: "errors.reauth",
  factor_proof_required: "errors.factorProof",
  another_passkey_required: "errors.anotherPasskey",
  passkey_uv_required: "errors.deviceVerification",
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: "errors.deviceRegistered",
  security_state_changed: "errors.securityChanged",
  security_operation_pending: "errors.securityPending",
  mfa_state_inconsistent: "errors.recoveryRequired",
  invalid_invite: "errors.invalidInvite",
  invite_exhausted: "errors.usedInvite",
  user_exists: "errors.userExists",
  mailbox_exists: "errors.mailboxExists",
  auth_integration_pending: "errors.unavailable",
  provisioning_failed: "errors.provisioning",
  INVALID_TOKEN: "errors.invalidToken",
  invalid_request: "errors.invalidRequest"
} satisfies Record<string, MessageKey>;

export function formatAuthError(error: unknown, t: Translator, genericLogin = false): string {
  if (error instanceof AuthUiError) return t(error.messageKey);
  // Text supplied by the surrounding controller is outside this UI boundary.
  if (typeof error === "string") return error;
  if (!(error instanceof AuthClientError)) return t("errors.connection");
  if (error.status === 429) return t("errors.rateLimited", {seconds: error.retryAfter || 60});
  if (genericLogin) return t("errors.login");
  if (error.loggedOut) return t("errors.loggedOut");
  const key = errorKeys[error.code as keyof typeof errorKeys];
  return t(key ?? (error.status === 403 ? "errors.forbidden" : "errors.request"));
}

export function validatePassword(password: string, confirmation: string): AuthUiError | null {
  if (!validateNewPassword(password, confirmation)) return null;
  return new AuthUiError(password.length < 10 || password.length > 256 ? "errors.passwordLength" : "errors.passwordMismatch");
}
