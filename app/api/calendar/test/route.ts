import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { testCaldavConnection } from "@/lib/caldav/client";
import { readJsonBody } from "@/app/api/_helpers/readJsonBody";

/**
 * Tests CalDAV credentials for one mailbox. Only managers of that mailbox may
 * change its calendar settings, so only they may probe a CalDAV server here.
 */
export async function POST(request: Request) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  // The mailbox id travels in the body, so it is read (size-capped) before the role check.
  const json = await readJsonBody<{
    accountId?: unknown;
    url?: unknown;
    user?: unknown;
    password?: unknown;
  }>(request);
  if (!json.ok) return json.response;
  const body = json.value;
  const accountId = typeof body?.accountId === "string" ? body.accountId.trim() : "";
  const accountContext = await requireAccountContext(request, accountId, {
    minRole: "manager",
    missingAccountMessage: "Missing accountId"
  });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {

    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const user = typeof body?.user === "string" ? body.user.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!url || !user) {
      return NextResponse.json({ ok: false, message: "Missing URL or username" }, { status: 400 });
    }

    try {
      const result = await testCaldavConnection({ url, user, password });
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      return NextResponse.json({ ok: false, message }, { status: 200 });
    }
  });
}
