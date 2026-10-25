import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../_auth";
import { withAuthResponse } from "@/lib/auth";
import { getAccounts } from "@/lib/serverDb";
import { listDomainIconEntries } from "@/lib/domainIcons";

/** Domains of all mailbox addresses with their uploaded icon, if any. */
export async function GET(request: Request) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () =>
    NextResponse.json({ ok: true, domains: await listDomainIconEntries(await getAccounts()) }, { headers: { "Cache-Control": "no-store" } }));
}
