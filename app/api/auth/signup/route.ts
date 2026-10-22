import { NextResponse } from "next/server";
import { buildSessionPayload, setSessionCookie } from "@/lib/auth";
import {
  DuplicateUserEmailError,
  addUserAccountLink,
  claimInviteCode,
  getAccounts,
  getInviteCodes,
  getUsers,
  insertUser,
  saveAccounts
} from "@/lib/db";
import type { Account, User } from "@/lib/data";
import { verifyImapCredentials } from "@/lib/mail/imapAuth";
import { shouldStorePasswordInDb } from "@/lib/secret";
import { accountIdFromEmail } from "@/lib/accountId";
import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";
import { randomUUID } from "crypto";

// Signup is more expensive than login (DB writes + IMAP verify + invite
// claim) and successful signups are inherently rare, so the budget is
// tighter than the login limiter's 5/min.
const signupLimiter = createRateLimiter({ windowMs: 60_000, max: 3 });

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (signupLimiter.isLimited(ip)) {
    return NextResponse.json(
      { ok: false, message: "Too many signup attempts — try again later" },
      { status: 429 }
    );
  }

  const clientId = request.headers.get("x-noctua-client") ?? undefined;
  const payload = (await request.json()) as { inviteCode: string; account: Account; password?: string };
  const code = payload.inviteCode?.trim();
  const desktopMode = process.env.NOCTUA_DESKTOP_MODE === "true";

  // Use IMAP password as the user password (fallback to payload.password for backwards compatibility)
  const imapPassword = payload.account?.imap?.password || payload.password || "";
  const smtpPassword = payload.account?.smtp?.password || imapPassword;

  if ((!desktopMode && !code) || !payload.account || !imapPassword) {
    return NextResponse.json({ ok: false, message: "Invalid payload - IMAP password required" }, { status: 400 });
  }

  // In desktop mode, invite codes are not required — the app is single-user
  // and there is no multi-tenant signup flow.
  let claimedInviteRole: "admin" | "user" = "admin";
  if (!desktopMode) {
    // Pre-check invite code (non-atomic, just for fast rejection with clear error messages)
    const invites = await getInviteCodes();
    const invite = invites.find((i) => i.code === code);
    if (!invite) {
      return NextResponse.json({ ok: false, message: "Invalid invite code" }, { status: 400 });
    }
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      return NextResponse.json({ ok: false, message: "Invite code already used" }, { status: 400 });
    }
    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      return NextResponse.json({ ok: false, message: "Invite code expired" }, { status: 400 });
    }
    claimedInviteRole = invite.role;
  }

  // Validate email
  if (!payload.account.email?.trim()) {
    return NextResponse.json({ ok: false, message: "Email address is required" }, { status: 400 });
  }

  // Generate deterministic account ID from email (server-side, don't trust client)
  const accountId = accountIdFromEmail(payload.account.email);

  const account: Account = {
    ...payload.account,
    id: accountId,
    ownerUserId: undefined,
    imap: {
      ...payload.account.imap,
      password: imapPassword
    },
    smtp: {
      ...payload.account.smtp,
      password: smtpPassword
    }
  };

  const ok = await verifyImapCredentials(account, imapPassword, clientId);
  if (!ok) {
    return NextResponse.json({ ok: false, message: "Invalid IMAP credentials" }, { status: 401 });
  }

  const userId = randomUUID();

  // In web mode, atomically claim the invite code (prevents double-use under concurrency).
  // In desktop mode, skip — no invite codes are used.
  if (!desktopMode) {
    const claimedInvite = await claimInviteCode(code!, userId);
    if (!claimedInvite) {
      return NextResponse.json({ ok: false, message: "Invite code already used or expired" }, { status: 400 });
    }
    claimedInviteRole = claimedInvite.role;
  }

  const [users, accounts] = await Promise.all([getUsers(), getAccounts()]);

  const assignedRole: "admin" | "user" = users.length === 0 ? "admin" : claimedInviteRole;
  let user: User;
  try {
    user = await insertUser({ id: userId, email: account.email, role: assignedRole });
  } catch (error) {
    if (error instanceof DuplicateUserEmailError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 409 });
    }
    throw error;
  }
  const nextAccounts = [
    ...accounts,
    {
      ...account,
      ownerUserId: userId,
      imap: {
        ...account.imap,
        password: shouldStorePasswordInDb() ? imapPassword : ""
      },
      smtp: {
        ...account.smtp,
        password: shouldStorePasswordInDb() ? smtpPassword : ""
      }
    }
  ];

  await saveAccounts(nextAccounts);
  await addUserAccountLink(userId, accountId, "manager");

  const session = buildSessionPayload({
    userId,
    role: user.role,
    account: nextAccounts.find((a) => a.id === accountId)!,
    imapPass: imapPassword,
    smtpPass: smtpPassword
  });
  const response = NextResponse.json({ ok: true, accountId });
  setSessionCookie(response, session);
  return response;
}
