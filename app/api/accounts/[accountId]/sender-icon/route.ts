import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireActiveUserSession } from "@/lib/auth";
import { getAccountById } from "@/lib/db";
import { resolveSenderIcon } from "@/lib/senderIcons";
import { getSenderIdentity } from "@/lib/senderIdentity";
import { findSenderDomainIcon } from "@/lib/domainIcons";
import { domainIconOverrideResponse, senderIconResponse } from "@/app/api/_helpers/iconResponse";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {

    const url = new URL(request.url);
    const accountId = await getAccountIdFromParams(params);
    const from = url.searchParams.get("from") ?? "";
    const fromEmail = url.searchParams.get("fromEmail") ?? "";

    if (!accountId) {
      return NextResponse.json({ ok: false, message: "Missing accountId" }, { status: 400 });
    }

    const access = await requireAccountContext(request, accountId, { minRole: "viewer" });
    if (access instanceof NextResponse) return access;

    const account = await getAccountById(accountId);
    if (!account) {
      return NextResponse.json({ ok: false, message: "Account not found" }, { status: 404 });
    }

    // An admin-uploaded domain icon replaces the fetched favicon. It is local
    // data, so it applies even when the mailbox fetches no sender icons.
    const override = await findSenderDomainIcon(getSenderIdentity({ from, fromEmail }), account.email);
    if (override) return domainIconOverrideResponse(request, override);

    const result = await resolveSenderIcon({
      from,
      fromEmail,
      enabled: account.settings?.appearance?.senderIcons ?? true
    });
    // `fallback=none`: the caller draws its own initials when no logo exists.
    return senderIconResponse(result, url.searchParams.get("fallback") === "none");
  });
}
