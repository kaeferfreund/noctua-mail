"use client";

import { useEffect } from "react";
import { Button, buttonVariants } from "@/app/components/ui/button";
import type { ClientErrorSource } from "@/lib/clientErrors";
import type { UiLocale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/translator";
import { reportClientError } from "@/lib/ui/clientErrorReporter";

/**
 * Shown by app/error.tsx and app/global-error.tsx instead of a blank page.
 * Translated without the next-intl provider: global-error replaces the root
 * layout that owns it.
 */
export default function CrashScreen({ error, source, locale }: { error: Error; source: ClientErrorSource; locale: UiLocale }) {
  useEffect(() => { reportClientError(source, error); }, [error, source]);
  const t = getTranslator(locale);
  return (
    <div role="alert" data-crash-screen="" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
      <h1 className="text-lg font-semibold">{t("Crash.title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("Crash.description")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => window.location.reload()}>{t("Crash.reload")}</Button>
        {/* A full page load without the query string: the deep link may be what crashed, and
            a client-side <Link> would keep the crashed app state. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className={buttonVariants({ variant: "outline" })}>{t("Crash.home")}</a>
      </div>
    </div>
  );
}
