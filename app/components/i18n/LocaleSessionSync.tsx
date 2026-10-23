"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { localePreferenceEvent } from "@/lib/i18n/localeEvents";
import type { UiLocalePreference } from "@/lib/i18n/config";

/** A successful identity fetch can change the server locale without changing the URL. */
export default function LocaleSessionSync({ uiLocale }: { uiLocale: UiLocalePreference }) {
  const router = useRouter();
  useEffect(() => {
    const changed = (event: Event) => {
      const next = (event as CustomEvent<{ uiLocale: UiLocalePreference }>).detail.uiLocale;
      if (next !== uiLocale) router.refresh();
    };
    window.addEventListener(localePreferenceEvent, changed);
    return () => window.removeEventListener(localePreferenceEvent, changed);
  }, [router, uiLocale]);
  return null;
}
