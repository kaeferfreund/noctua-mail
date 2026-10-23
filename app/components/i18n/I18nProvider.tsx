"use client";

import { createContext, useContext, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import type catalog from "@/messages/de.json";
import { timeZone, type UiLocale, type UiLocalePreference } from "@/lib/i18n/config";

const Preferences = createContext<{ uiLocale: UiLocalePreference; deviceLocale: UiLocalePreference }>({ uiLocale: null, deviceLocale: null });
export const useLocalePreferences = () => useContext(Preferences);

export default function I18nProvider({ locale, messages, uiLocale, deviceLocale, children }: {
  locale: UiLocale; messages: typeof catalog; uiLocale: UiLocalePreference; deviceLocale: UiLocalePreference; children: ReactNode;
}) {
  return <Preferences.Provider value={{ uiLocale, deviceLocale }}>
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>{children}</NextIntlClientProvider>
  </Preferences.Provider>;
}
