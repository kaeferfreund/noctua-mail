import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { requireActiveUserSession } from "@/lib/auth";
import { testCaldavConnection } from "@/lib/caldav/client";
import { readJsonBody } from "@/app/api/_helpers/readJsonBody";

export async function POST(request: Request) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {

    const json = await readJsonBody<{
      url?: string;
      user?: string;
      password?: string;
    }>(request);
    if (!json.ok) return json.response;
    const body = json.value;

    const url = body?.url?.trim() ?? "";
    const user = body?.user?.trim() ?? "";
    const password = body?.password ?? "";

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
