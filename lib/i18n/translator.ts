import { createTranslator } from "next-intl";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import { timeZone, type UiLocale } from "./config";

// Explicit imports keep both catalogs in the standalone server and allow shared callers.
export const catalogs = { de, en };
export function getMessages(locale: UiLocale): typeof de {
  return catalogs[locale];
}
export function getTranslator(locale: UiLocale) {
  return createTranslator({ locale, messages: getMessages(locale), timeZone });
}
