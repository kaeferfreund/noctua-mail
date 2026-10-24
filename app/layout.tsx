import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import { APP_THEME_COLOR } from "@/lib/ui/theme";
import { DEFAULT_APP_TITLE, versionedIconUrl } from "@/lib/appBranding";
import "./globals.css";
import { getLocaleSettings } from "@/i18n/request";
import { getTranslator } from "@/lib/i18n/translator";
import LocaleSessionSync from "@/app/components/i18n/LocaleSessionSync";
import I18nProvider from "@/app/components/i18n/I18nProvider";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getLocaleSettings();
  return {
    title: DEFAULT_APP_TITLE,
    description: getTranslator(locale)("Pwa.description"),
    manifest: "/manifest.webmanifest",
    // Explicit, versioned URLs instead of app/icon.tsx and app/apple-icon.tsx,
    // whose generated links only change with their source file.
    icons: {
      icon: { url: versionedIconUrl("/icons/badged/256"), sizes: "256x256", type: "image/png" },
      apple: { url: versionedIconUrl("/icons/apple-touch"), sizes: "180x180", type: "image/png" }
    },
    // Home-screen web app on iOS (needed there for Web Push). The opaque
    // "default" status bar keeps the clock readable in the light theme; the
    // shell has no safe-area insets for a translucent bar or viewport-fit=cover.
    appleWebApp: { capable: true, statusBarStyle: "default", title: DEFAULT_APP_TITLE }
  };
}

export const viewport: Viewport = {
  themeColor: APP_THEME_COLOR
};

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  const settings = await getLocaleSettings();
  return (
    // next-themes sets the theme class and color-scheme on <html> before
    // hydration, so the server markup cannot match it.
    <html lang={settings.locale} suppressHydrationWarning>
      <head>
        <Script src="/runtime-config.js" strategy="beforeInteractive" />
      </head>
      <body suppressHydrationWarning>
        <I18nProvider {...settings}>
          <LocaleSessionSync uiLocale={settings.uiLocale} />
          <ThemeProvider attribute="class" storageKey="noctua:theme" enableSystem>
            {/* Radix surface tokens are bridged to the shadcn tokens by the
                .radix-themes rule in globals.css. */}
            <Theme accentColor="iris" grayColor="gray" panelBackground="solid">
              <main>{children}</main>
            </Theme>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
