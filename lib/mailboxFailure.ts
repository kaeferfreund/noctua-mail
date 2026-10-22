import type { AccountRole } from "./data";
export function mailboxFailure(accountId: string, role?: AccountRole) {
  const manager = role === "manager";
  return { ok: false, code: "mailbox_credentials_invalid", accountId,
    message: manager ? "Mailbox credentials need repair" : "Mailbox unavailable; contact a manager",
    repairAllowed: manager, reauthRequired: manager,
    ...(!manager ? { managerContact: "Contact a mailbox manager" } : {}) };
}

/** Shared REST mapping for thrown IMAP failures; personal-auth 401 is never used. */
export async function mailboxErrorResponse(error: unknown, accountId: string, role?: AccountRole) {
  const { getImapHttpError, isImapConnectFailure } = await import("./mail/imapError");
  const { NextResponse } = await import("next/server");
  if (getImapHttpError(error)) {
    const dto = mailboxFailure(accountId, role);
    const { listAccountMembers } = await import("./accountAccess");
    const managers = (await listAccountMembers(accountId)).filter(m => m.role === "manager" && !m.disabled)
      .map(({ name, email }) => ({ name, email }));
    return NextResponse.json({ ...dto, ...(role !== "manager" ? { managerContact: managers } : {}) }, { status: 503 });
  }
  return isImapConnectFailure(error) ? NextResponse.json({ ok: false, message: "Could not reach the mail server. It may be temporarily unavailable." }, { status: 503 }) : null;
}
