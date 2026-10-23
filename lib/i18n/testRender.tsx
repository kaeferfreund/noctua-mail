import { render as testingLibraryRender, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import I18nProvider from "@/app/components/i18n/I18nProvider";
import { getMessages } from "./translator";
import type { UiLocale, UiLocalePreference } from "./config";

export function I18nTestProvider({ children, locale = "en", uiLocale = null, deviceLocale = null, refresh = () => {} }: {
  children: ReactNode; locale?: UiLocale; uiLocale?: UiLocalePreference; deviceLocale?: UiLocalePreference; refresh?: () => void;
}) {
  const router: AppRouterInstance = { bfcacheId: "test", refresh, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
  return <AppRouterContext.Provider value={router}>
    <I18nProvider locale={locale} messages={getMessages(locale)} uiLocale={uiLocale} deviceLocale={deviceLocale}>{children}</I18nProvider>
  </AppRouterContext.Provider>;
}

/** Opt in only for DOM tests whose component tree consumes i18n. */
export function render(ui: ReactElement, options?: RenderOptions) {
  return testingLibraryRender(ui, { wrapper: I18nTestProvider, ...options });
}
