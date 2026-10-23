import { describe, expect, it } from "bun:test";
import { createTranslator } from "next-intl";
import { AuthClientError, authErrorMessage, validateNewPassword } from "@/lib/authClient";
import { AdminApiError } from "@/app/hooks/useAdminApi";
import en from "@/messages/en.json";
import de from "@/messages/de.json";
import { formatAuthError, validatePassword } from "./authMessages";
import { formatAdminError } from "./adminMessages";

const auth = (locale: "en" | "de") => createTranslator({locale, messages: locale === "en" ? en : de, namespace: "Auth"});
const admin = (locale: "en" | "de") => createTranslator({locale, messages: locale === "en" ? en : de, namespace: "Admin"});

describe("localized authentication presentation", () => {
  it("retains English copy and error priority for stable auth codes", () => {
    const codes = ["invalid_proof", "INVALID_PASSWORD", "INVALID_CODE", "INVALID_TOTP", "INVALID_BACKUP_CODE", "invalid_challenge", "SESSION_NOT_FRESH", "reauth_required", "factor_proof_required", "another_passkey_required", "passkey_uv_required", "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED", "security_state_changed", "security_operation_pending", "mfa_state_inconsistent", "invalid_invite", "invite_exhausted", "user_exists", "mailbox_exists", "auth_integration_pending", "provisioning_failed", "INVALID_TOKEN", "invalid_request", "UNKNOWN"];
    for (const code of codes) for (const status of [400, 401, 403, 429]) for (const generic of [false, true]) {
      const error = new AuthClientError(status, code, 17);
      expect(formatAuthError(error, auth("en"), generic)).toBe(authErrorMessage(error, generic));
    }
    expect(formatAuthError(new Error("network"), auth("en"))).toBe(authErrorMessage(new Error("network")));
  });
  it("keeps password validation behavior and relocalizes the same stored error", () => {
    for (const [password, confirmation] of [["short", "short"], ["a".repeat(257), "a".repeat(257)], ["synthetic-password", "mismatch"], ["synthetic-password", "synthetic-password"]]) {
      const error = validatePassword(password, confirmation);
      expect(error ? formatAuthError(error, auth("en")) : null).toBe(validateNewPassword(password, confirmation));
      if (error) expect(formatAuthError(error, auth("de"))).not.toBe(formatAuthError(error, auth("en")));
    }
  });
  it("uses named ICU parameters for rate limits without changing the error code", () => {
    const error = new AuthClientError(429, "INVALID_PASSWORD", 1);
    expect(formatAuthError(error, auth("de"))).toBe("Zu viele Versuche. Versuche es in einer Sekunde erneut.");
    expect(error.code).toBe("INVALID_PASSWORD");
  });
  it("localizes known admin codes and preserves unknown upstream diagnostics", () => {
    const error = new AdminApiError(409, "last_manager", "The last enabled manager cannot be removed or demoted.");
    expect(formatAdminError(error, admin("en"), "en")).toBe(error.message);
    expect(formatAdminError(error, admin("de"), "de")).toContain("Verwaltungsrechten");
    const upstream = new AdminApiError(502, "SMTP_UNAVAILABLE", "Synthetic SMTP diagnostic");
    expect(formatAdminError(upstream, admin("de"), "de")).toBe(upstream.message);
  });
});
