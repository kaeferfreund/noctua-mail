import type { useTranslations } from "next-intl";
import { AdminApiError } from "@/app/hooks/useAdminApi";

type Translator = ReturnType<typeof useTranslations<"Admin">>;
const errorKeys = {
  last_admin: "errors.lastAdmin",
  self_admin_mutation_forbidden: "errors.selfMutation",
  owner_reassignment_required: "errors.reassignOwner",
  invalid_owner: "errors.invalidOwner",
  foreign_mailbox_membership: "errors.foreignMailboxes",
  owner_modification_forbidden: "errors.immutableOwner",
  cannot_modify_owner: "errors.immutableOwner",
  self_role_change_forbidden: "errors.selfRole",
  cannot_change_own_role: "errors.selfRole",
  owner_immutable: "errors.immutableOwner",
  self_role_change: "errors.selfRole",
  target_disabled: "errors.targetDisabled",
  target_missing: "errors.targetMissing",
  above_manager: "errors.aboveManager",
  not_member: "errors.notMember",
  last_manager: "errors.lastManager",
  reauth_required: "errors.reauth",
  invalid_proof: "errors.invalidProof",
  admin_operation_pending: "errors.adminPending",
  security_operation_pending: "errors.securityPending",
  admin_operation_failed: "errors.operationFailed",
  user_exists: "errors.userExists",
  target_verification_required: "errors.verificationRequired",
  invite_not_issued: "errors.inviteNotIssued"
} satisfies Record<string, Parameters<Translator>[0]>;

export function formatAdminError(error: unknown, t: Translator, locale: "de" | "en"): string {
  if (error instanceof AdminApiError) {
    if (error.status === 429) return locale === "en" ? error.message : t("errors.rateLimited");
    const key = errorKeys[error.code as keyof typeof errorKeys];
    if (key) return t(key);
    if (error.status === 401) return t("errors.loggedOut");
    // Unknown server/upstream diagnostics remain verbatim; slice 4 owns them.
    return error.message;
  }
  return error instanceof Error ? error.message : t("errors.request");
}
