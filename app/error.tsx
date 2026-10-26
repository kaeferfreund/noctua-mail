"use client";

import { useLocale } from "next-intl";
import CrashScreen from "@/app/components/CrashScreen";
import { isUiLocale, defaultLocale } from "@/lib/i18n/config";

/** Error boundary around every page below the root layout, including the MailClient tree. */
export default function AppError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale();
  return <CrashScreen error={error} source="boundary" locale={isUiLocale(locale) ? locale : defaultLocale} />;
}
