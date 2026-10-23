import { isUiLocale, type UiLocalePreference } from "./config";

export const localePreferenceEvent = "noctua:ui-locale-preference";

/** Identity is fetched by the persistent shell after login/logout, without navigation. */
export function publishLocalePreference(value: unknown) {
  if (typeof window === "undefined") return;
  const uiLocale: UiLocalePreference = isUiLocale(value) ? value : null;
  window.dispatchEvent(new CustomEvent(localePreferenceEvent, { detail: { uiLocale } }));
}
