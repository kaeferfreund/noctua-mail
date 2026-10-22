import type { Account, AccountRole, User } from "@/lib/data";
export type AdminUser = Partial<Omit<User, "id" | "email" | "role">> & Pick<User, "id" | "email" | "role"> & {
  accounts?: { id: string; name: string; email: string; role?: AccountRole; isOwner?: boolean; ownerUserId?: string; accessRole?: AccountRole }[];
  passkeys?: { id: string; name?: string | null }[];
};
export type Member = { userId: string; email: string; name: string | null; role: AccountRole; isOwner: boolean; disabled?: boolean };
export type AdminAccount = Account & { members: Member[] };
