import { NextResponse } from "next/server";
import { withAuthResponse, requireActiveUserSession } from "@/lib/auth";
import { sanitizeAccountsForClient } from "@/lib/accountPresentation";
import { handleMailboxCredentialMutation } from "@/app/api/_helpers/mailboxPatch";
export async function GET(request: Request) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => NextResponse.json(await sanitizeAccountsForClient(session.userId)));
}
export async function POST(request: Request) {
  return handleMailboxCredentialMutation(request, "post-existing");
}
