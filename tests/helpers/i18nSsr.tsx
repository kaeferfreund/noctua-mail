// Runs in a separate Bun process: the request-config mock must never affect
// other tests' server module graphs or Next's real request-scoped resolution.
import { mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { useLocale, useTimeZone, useTranslations } from "next-intl";
import { resolveLocale } from "../../lib/i18n/resolveLocale";
import { getMessages } from "../../lib/i18n/translator";
import { timeZone } from "../../lib/i18n/config";

const input = JSON.parse(process.argv[2]);
const locale = resolveLocale(input);
mock.module("@/i18n/request", () => ({ getLocaleSettings: async () => ({
  locale, messages: getMessages(locale), timeZone, uiLocale: input.uiLocale ?? null, deviceLocale: input.cookie ?? null
}) }));
mock.module("@/app/components/i18n/LocaleSessionSync", () => ({default: () => null}));
function Probe() {
  const t = useTranslations("Settings.language");
  return <p data-locale={useLocale()} data-zone={useTimeZone()}>{t("label")}</p>;
}
const { default: RootLayout, generateMetadata } = await import("../../app/layout");
process.stdout.write(JSON.stringify({ html: renderToStaticMarkup(await RootLayout({ children: <Probe /> })), metadata: await generateMetadata() }));
