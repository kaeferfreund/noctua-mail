import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAccounts, getUserAccounts, getUsers } from "@/lib/db";
import { requireAdminSessionOr403 } from "../_auth";
import { handleAdminUser } from "../_users";

export async function POST(request:Request) {return handleAdminUser(request,"invite");}

export async function GET(request: Request) {
  const auth = await requireAdminSessionOr403(request);
  if (auth instanceof NextResponse) return auth;
  return withAuthResponse(auth, async () => {

    const [users, accounts, links] = await Promise.all([getUsers(), getAccounts(), getUserAccounts()]);
    const accountById = new Map(accounts.map(account => [account.id, account]));
    const memberships = new Map(links.map(link => [JSON.stringify([link.userId, link.accountId]), link.role]));
    const accountIdsByUserId = new Map<string, Set<string>>();

    const ensureAccountSet = (userId: string) => {
      let accountIds = accountIdsByUserId.get(userId);
      if (!accountIds) {
        accountIds = new Set<string>();
        accountIdsByUserId.set(userId, accountIds);
      }
      return accountIds;
    };

    links.forEach((link) => {
      const userId = String(link.userId ?? "").trim();
      const accountId = String(link.accountId ?? "").trim();
      if (!userId || !accountId || !accountById.has(accountId)) return;
      ensureAccountSet(userId).add(accountId);
    });

    accounts.forEach((account) => {
      const ownerUserId = account.ownerUserId?.trim();
      if (!ownerUserId || !accountById.has(account.id)) return;
      ensureAccountSet(ownerUserId).add(account.id);
    });

    const usersWithAccounts = [...users]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((user) => {
        const accountIds = [...(accountIdsByUserId.get(user.id) ?? new Set<string>())];
        const userAccounts = accountIds
          .map((accountId) => {
            const account=accountById.get(accountId);
            if (!account) return undefined;
            const isOwner=account.ownerUserId===user.id;
            const role=isOwner?"manager":memberships.get(JSON.stringify([user.id,accountId]));
            if (!role) return undefined;
            return {id:account.id,name:account.name,email:account.email,role,isOwner};
          })
          .filter((account): account is NonNullable<typeof account> => Boolean(account))
          .sort((a, b) => a.email.localeCompare(b.email));
        return {
          ...user,
          accounts: userAccounts
        };
      });

    return NextResponse.json({
      ok: true,
      users: usersWithAccounts
    });
  });
}
