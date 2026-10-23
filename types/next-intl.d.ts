import type messages from "../messages/de.json";
import type { UiLocale } from "../lib/i18n/config";

declare module "next-intl" {
  interface AppConfig {
    Locale: UiLocale;
    Messages: typeof messages;
  }
}
