import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import { APP_BAR_COLORS } from "@/lib/ui/theme";
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
    // Home-screen web app on iOS (needed there for Web Push). The page runs
    // under the translucent status bar (viewport-fit=cover); the shell pads by
    // the safe-area tokens and paints the opaque --status-bar-bg band behind
    // the white clock (app/globals.css). iOS reads this only when the app is
    // added to the home screen.
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: DEFAULT_APP_TITLE }
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_BAR_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: APP_BAR_COLORS.dark }
  ]
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
