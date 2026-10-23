import { readAuthJson } from "@/app/api/_helpers/readAuthJson";
import { NextResponse } from "next/server";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { setUserUiLocale } from "@/lib/serverDb";
import { isUiLocale, localeCookie, localeCookieMaxAge } from "@/lib/i18n/config";

export async function PUT(request: Request) {
  const originError = requireJsonSameOrigin(request);
  if (originError) return originError;
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const payload = await readAuthJson(request).catch(() => null);
    if (payload instanceof NextResponse) return payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      Object.keys(payload).length !== 1 || !("uiLocale" in payload) ||
      (payload.uiLocale !== null && !isUiLocale(payload.uiLocale))) {
      return NextResponse.json({ ok: false, code: "invalid_request" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const stored = await setUserUiLocale(session.userId, payload.uiLocale);
    if (!stored) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    const response = NextResponse.json({ ok: true, uiLocale: stored.uiLocale }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(localeCookie, stored.uiLocale ?? "", {
      path: "/", sameSite: "lax", secure: new URL(request.url).protocol === "https:",
      maxAge: stored.uiLocale === null ? 0 : localeCookieMaxAge
    });
    return response;
  });
}
