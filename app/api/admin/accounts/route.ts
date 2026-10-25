import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../_auth";
import { withAuthResponse } from "@/lib/auth";
import { sanitizeAccountForClient } from "@/lib/accountPresentation";
import { listAccountMembers, listMemberAccounts } from "@/lib/accountAccess";
import { createAdminMailbox } from "@/lib/adminMailbox";
import { MailboxCredentialError } from "@/lib/mailboxCredentials";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { getRequestClientId } from "@/app/api/_helpers/clientId";
/** Only mailboxes the admin is a member of (owner or any role); others stay invisible. */
export async function GET(request: Request) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accounts = await Promise.all((await listMemberAccounts(session.userId)).map(async account => {
      const members = await listAccountMembers(account.id);
      return { ...sanitizeAccountForClient(account, { role: "manager", viewerUserId: session.userId, memberCount: members.length }), members };
    }));
    accounts.sort((a,b) => (a.name || a.email).localeCompare(b.name || b.email,"en") || a.email.trim().toLowerCase().localeCompare(b.email.trim().toLowerCase(),"en") || a.id.localeCompare(b.id,"en"));
    return NextResponse.json({ ok: true, accounts });
  });
}
export async function POST(request: Request) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const origin = requireJsonSameOrigin(request); if (origin) return origin;
    try {
      const account = await createAdminMailbox(session.userId, await request.json().catch(() => null), getRequestClientId(request));
      return NextResponse.json({ ok: true, account: sanitizeAccountForClient(account, { role: "manager", viewerUserId: session.userId, memberCount: 1 }) }, { status: 201 });
    } catch (error) { if (error instanceof MailboxCredentialError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status }); throw error; }
  });
}
