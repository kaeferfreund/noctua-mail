import { createTranslator } from "next-intl";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import { timeZone, type UiLocale } from "./config";

// Explicit imports keep both catalogs in the standalone server and allow shared callers.
export const catalogs = { de, en };
export function getMessages(locale: UiLocale): typeof de {
  return catalogs[locale];
}
function createLocaleTranslator(locale: UiLocale) {
  return createTranslator({ locale, messages: getMessages(locale), timeZone });
}

// One translator per locale: catalogs and time zone are static, and a shared instance
// keeps next-intl's compiled-message cache instead of re-parsing on every call.
const translators = new Map<UiLocale, ReturnType<typeof createLocaleTranslator>>();
export function getTranslator(locale: UiLocale) {
  let translator = translators.get(locale);
  if (!translator) {
    translator = createLocaleTranslator(locale);
    translators.set(locale, translator);
  }
  return translator;
}
