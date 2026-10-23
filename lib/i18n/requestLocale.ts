import { NextResponse } from "next/server";
import { requireActiveUserSession } from "@/lib/auth";
import { getUserById } from "@/lib/serverDb";
import { isUiLocale, type UiLocalePreference } from "./config";
import { resolveLocale } from "./resolveLocale";

/** Only a live Noctua session can supply a personal preference; no mailbox needed. */
export async function resolveRequestLocale(headers: Headers, cookie?: string) {
  const session = await requireActiveUserSession(new Request("http://localhost/i18n", { headers }), { allowRestricted: true });
  const user = session instanceof NextResponse ? null : await getUserById(session.userId);
  const uiLocale: UiLocalePreference = isUiLocale(user?.uiLocale) ? user.uiLocale : null;
  const deviceLocale = isUiLocale(cookie) ? cookie : null;
  return { locale: resolveLocale({ uiLocale, cookie: deviceLocale, acceptLanguage: headers.get("accept-language") }), uiLocale, deviceLocale };
}
