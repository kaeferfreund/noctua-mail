export const locales = ["de", "en"] as const;
export type UiLocale = (typeof locales)[number];
export type UiLocalePreference = UiLocale | null;
export const defaultLocale: UiLocale = "de";
export const timeZone = "Europe/Berlin";
export const formattingLocales = { de: "de-DE", en: "en-GB" } as const;
export const localeCookie = "noctua-ui-locale";
export const localeCookieMaxAge = 60 * 60 * 24 * 365;

export function isUiLocale(value: unknown): value is UiLocale {
  return value === "de" || value === "en";
}
