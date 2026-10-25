import type { Account, AccountRole, User } from "@/lib/data";
export type AdminUser = Partial<Omit<User, "id" | "email" | "role">> & Pick<User, "id" | "email" | "role"> & {
  accounts?: { id: string; name: string; email: string; role: AccountRole; isOwner: boolean }[];
  passkeys?: { id: string; name: string | null; createdAt: number | null }[];
};
export type Member = { userId: string; email: string; name: string | null; role: AccountRole; isOwner: boolean; disabled?: boolean };
export type AdminAccount = Account & { members: Member[] };

export type MemberCandidate = { id: string; name: string | null; email: string };
export type AdminInvite = { id: string; email: string | null; issuedBy: string | null; issuerDeleted?: boolean; createdAt: number; expiresAt: number | null; status: "issued" | "redeemed" | "revoked" | "expired" };
