import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { localeCookie, timeZone } from "@/lib/i18n/config";
import { resolveRequestLocale } from "@/lib/i18n/requestLocale";
import { getMessages } from "@/lib/i18n/translator";
import { cache } from "react";

export const getLocaleSettings = cache(async () => {
  const settings = await resolveRequestLocale(new Headers(await headers()), (await cookies()).get(localeCookie)?.value);
  return { ...settings, messages: getMessages(settings.locale), timeZone };
});

export default getRequestConfig(async () => {
  const { locale, messages, timeZone } = await getLocaleSettings();
  return { locale, messages, timeZone };
});
