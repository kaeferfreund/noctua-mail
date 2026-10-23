import { defaultLocale, isUiLocale, type UiLocale } from "./config";

/** Match supported base languages, keeping the header's order for equal quality. */
export function acceptLanguageLocale(header?: string | null): UiLocale {
  const candidates = (header ?? "").split(",").map((entry, index) => {
    const [range, ...parameters] = entry.trim().split(";");
    const language = range.trim().toLowerCase();
    const quality = parameters.length === 1
      ? /^q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i.exec(parameters[0].trim())
      : null;
    const q = parameters.length === 0 ? 1 : quality ? Number(quality[1]) : 0;
    const base = /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(language) ? language.split("-")[0] : null;
    return { locale: isUiLocale(base) ? base : null, q, index };
  }).filter(candidate => candidate.locale && candidate.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return candidates[0]?.locale ?? defaultLocale;
}

/** Pure and shared: persisted preference → validated device cookie → header → fallback. */
export function resolveLocale({ uiLocale, cookie, acceptLanguage }: {
  uiLocale?: unknown; cookie?: unknown; acceptLanguage?: string | null;
}): UiLocale {
  if (isUiLocale(uiLocale)) return uiLocale;
  if (isUiLocale(cookie)) return cookie;
  return acceptLanguageLocale(acceptLanguage);
}
