"use client";

export type AdminFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const errors: Record<string, string> = {
  last_admin: "The last enabled administrator cannot be changed.",
  self_admin_mutation_forbidden: "You cannot demote, disable or delete yourself.",
  owner_reassignment_required: "Choose an enabled user to take ownership of the mailboxes.",
  invalid_owner: "Choose another enabled owner.",
  owner_modification_forbidden: "The mailbox owner cannot be modified.",
  cannot_modify_owner: "The mailbox owner cannot be modified.",
  self_role_change_forbidden: "You cannot change your own role.",
  cannot_change_own_role: "You cannot change your own role.",
  owner_immutable: "The mailbox owner cannot be modified.",
  self_role_change: "You cannot change your own role.",
  target_disabled: "Choose an enabled user with completed setup.",
  target_missing: "This user no longer exists. Refresh the user list.",
  above_manager: "Choose viewer, editor or manager for mailbox access.",
  not_member: "This user is no longer a mailbox member. Refresh the member list.",
  last_manager: "The last enabled manager cannot be removed or demoted.",
  reauth_required: "Authenticate again to perform this action.",
  invalid_proof: "Authentication failed or expired. Enter fresh credentials and try again.",
  admin_operation_pending: "Another administration operation is pending. Refresh before retrying.",
  security_operation_pending: "Another security operation is pending. Refresh before retrying.",
  admin_operation_failed: "The operation needs server reconciliation. Refresh status before trying again.",
  user_exists: "A user with that email already exists.",
  target_verification_required: "Confirm the target's identity in person first."
};

export class AdminApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

// Narrow Noctua wrapper seam, shared by admin and mailbox settings; no raw BA calls.
export async function adminRequest<T>(request: AdminFetch, url: string, init?: RequestInit): Promise<T> {
  const response = await request(url, { cache: "no-store", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const code = typeof data.code === "string" ? data.code : "";
    const message = response.status === 429
      ? `Too many attempts. Retry after ${response.headers.get("Retry-After") || "60"} seconds.`
      : errors[code] || data.message || (response.status === 401 ? "Your session expired. Sign in again." : `Request failed (${response.status}${code ? `: ${code}` : ""}).`);
    throw new AdminApiError(response.status, code, message);
  }
  return data as T;
}

export function jsonMutation(method: string, body?: unknown, grant?: string): RequestInit {
  return {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(grant ? { "x-noctua-reauth": grant } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  };
}

export function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Request failed. Please try again."; }
