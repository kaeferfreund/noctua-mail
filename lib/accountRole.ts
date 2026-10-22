import type { AccountRole } from "./data";

export const ACCOUNT_ROLE_ORDER: Record<AccountRole, number> = { viewer: 1, editor: 2, manager: 3 };
export function roleAtLeast(role: AccountRole | null | undefined, min: AccountRole): boolean {
  return !!role && ACCOUNT_ROLE_ORDER[role] >= ACCOUNT_ROLE_ORDER[min];
}
