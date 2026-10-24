"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { isUiLocale, localeCookie, localeCookieMaxAge, type UiLocalePreference } from "@/lib/i18n/config";
import { useLocalePreferences } from "./I18nProvider";
import { nativeControlBaseClass } from "@/app/components/account-settings/Field";

export default function LanguageSelector({ authenticated = false }: { authenticated?: boolean }) {
  const t = useTranslations("Settings.language");
  const initial = useLocalePreferences();
  const [preference, setPreference] = useState<UiLocalePreference>(authenticated ? initial.uiLocale : initial.deviceLocale);
  const [loading, setLoading] = useState(authenticated);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  const id = useId();
  // Login happens inside the persistent client shell. Read the newly signed-in
  // user's preference when opening personal settings, even without navigation.
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void fetch("/api/auth/me", { cache: "no-store", credentials: "include" }).then(async response => {
      if (!response.ok) throw new Error("preferences_unavailable");
      const data = await response.json();
      if (active) setPreference(isUiLocale(data.user?.uiLocale) ? data.user.uiLocale : null);
    }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authenticated]);

  async function change(value: UiLocalePreference) {
    setSaving(true); setFailed(false);
    try {
      if (authenticated) {
        const response = await fetch("/api/auth/preferences", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uiLocale: value }) });
        if (!response.ok) throw new Error("preference_update_failed");
      }
      // Automatic removes the device override, so Accept-Language takes effect.
      document.cookie = `${localeCookie}=${value ?? ""}; Path=/; SameSite=Lax; Max-Age=${value ? localeCookieMaxAge : 0}${location.protocol === "https:" ? "; Secure" : ""}`;
      setPreference(value);
      // RSC refresh merges the new provider props without remounting the shell,
      // its selected mailbox/thread, compose state or anonymous auth form.
      startTransition(() => router.refresh());
    } catch { setFailed(true); }
    finally { setSaving(false); }
  }
  // A restricted enrollment screen can share AuthFrame, but its device cookie
  // cannot override a signed-in fixed preference, and cannot bypass MFA to save one.
  if (!authenticated && initial.uiLocale !== null) return null;
  return <div className="grid gap-1 text-sm">
    <label htmlFor={id}>{t("label")}</label>
    <select id={id} className={nativeControlBaseClass} value={preference ?? "automatic"} disabled={loading || saving || pending} onChange={event => void change(isUiLocale(event.target.value) ? event.target.value : null)}>
      <option value="de">{t("german")}</option>
      <option value="en">{t("english")}</option>
      <option value="automatic">{t("automatic")}</option>
    </select>
    {(saving || pending) && <p role="status">{t("saving")}</p>}
    {failed && <p role="alert">{t("error")}</p>}
  </div>;
}
