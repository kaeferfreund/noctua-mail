"use client";

import "./globals.css";
import CrashScreen from "@/app/components/CrashScreen";
import { defaultLocale } from "@/lib/i18n/config";

/** Replaces the root layout when the layout itself crashes; its locale settings are gone with it. */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang={defaultLocale}>
      <body>
        <CrashScreen error={error} source="global" locale={defaultLocale} />
      </body>
    </html>
  );
}
