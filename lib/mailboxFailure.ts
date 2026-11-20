import type { AccountRole } from "./data";
export function mailboxFailure(accountId: string, role?: AccountRole, managerContact: Array<{ name: string | null; email: string }> = []) {
  const manager = role === "manager";
  return { ok: false, code: "mailbox_credentials_invalid", accountId,
    message: manager ? "Mailbox credentials need repair" : "Mailbox unavailable; contact a manager",
    repairAllowed: manager, reauthRequired: manager,
    ...(!manager ? { managerContact } : {}) };
}

/** Resolve contacts before a stream's final authorization check. Shared by REST and SSE. */
export async function mailboxFailureDto(accountId: string, role?: AccountRole) {
  const { listAccountMembers } = await import("./accountAccess");
  const managers = role === "manager" ? [] : (await listAccountMembers(accountId))
    .filter(m => m.role === "manager" && !m.disabled).map(({ name, email }) => ({ name, email }));
  return mailboxFailure(accountId, role, managers);
}

/** Shared REST mapping for thrown IMAP failures; personal-auth 401 is never used. */
export async function mailboxErrorResponse(error: unknown, accountId: string, role?: AccountRole) {
  const { getImapHttpError, isImapConnectFailure, MAIL_SERVER_UNREACHABLE_MESSAGE } = await import("./mail/imapError");
  const { NextResponse } = await import("next/server");
  if (getImapHttpError(error)) return NextResponse.json(await mailboxFailureDto(accountId, role), { status: 503 });
  return isImapConnectFailure(error) ? NextResponse.json({ ok: false, message: MAIL_SERVER_UNREACHABLE_MESSAGE }, { status: 503 }) : null;
}
