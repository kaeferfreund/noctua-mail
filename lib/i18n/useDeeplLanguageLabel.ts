"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { isSupportedDeeplTargetLang } from "@/lib/deeplLanguages";

/** Localized DeepL target-language name; unknown codes are shown verbatim. */
export function useDeeplLanguageLabel() {
  const t = useTranslations("Settings.translation.languages");
  return useCallback((code: string) => (isSupportedDeeplTargetLang(code) ? t(code) : code), [t]);
}
