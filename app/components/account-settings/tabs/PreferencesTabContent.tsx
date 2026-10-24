"use client";

import { useLocale, useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import LanguageSelector from "@/app/components/i18n/LanguageSelector";
import type { Account, UserAccountPrefs, UserAccountPrefsPatch } from "@/lib/data";
import { ACCOUNT_DATE_FORMAT_OPTIONS } from "@/lib/dateFormatting";
import { Button } from "@/app/components/ui/button";
import MailtoHandlerSection from "@/app/components/account-settings/MailtoHandlerSection";
import SenderPreferences, { applySenderPatch, touchesSenderPrefs } from "@/app/components/account-settings/tabs/SenderPreferences";
import { nativeControlClass } from "@/app/components/account-settings/Field";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { useSenderMessages } from "@/lib/i18n/useSenderMessages";
import { senderSettingsError } from "@/lib/senderMessages";
import { notifySenderPreferencesChanged } from "@/lib/ui/senderSettings";
import { validSignatureTemplate } from "@/lib/signatureTemplates";

type PreferenceOption = { value: string; label: string; literal?: boolean };
type PreferenceField = {
  group: "layout" | "appearance" | "calendar" | "threading" | "notifications";
  key: "defaultView" | "dateFormat" | "topicColorRows" | "senderIcons" | "weekStartsOn" | "includeAcrossFolders" | "newMail";
  options: PreferenceOption[]; boolean?: boolean;
};
const yesNo = [{ value: "true", label: "yes" }, { value: "false", label: "no" }];
const fields: PreferenceField[] = [
  { group: "layout", key: "defaultView", options: ["threads", "card", "table", "compact"].map(value => ({ value, label: value })) },
  { group: "appearance", key: "dateFormat", options: ACCOUNT_DATE_FORMAT_OPTIONS.map(option => ({ ...option, literal: option.value !== "locale", label: option.value === "locale" ? "locale" : option.label })) },
  { group: "appearance", key: "topicColorRows", options: yesNo, boolean: true },
  { group: "appearance", key: "senderIcons", options: yesNo, boolean: true },
  { group: "calendar", key: "weekStartsOn", options: [{ value: "monday", label: "monday" }, { value: "sunday", label: "sunday" }] },
  { group: "threading", key: "includeAcrossFolders", options: yesNo, boolean: true },
  { group: "notifications", key: "newMail", options: yesNo, boolean: true }
];
// Error codes of the prefs route that only the sender section can cause.
const SENDER_ERROR_CODES = new Set(["invalid_preferences", "signature_template_invalid"]);

export default function PreferencesTabContent({ editingAccount, onClose, apiFetch = fetch, senderPreferences = false }: {
  editingAccount: Account; onClose: () => void; apiFetch?: AdminFetch;
  /** Show the personal From/signature section (its fields replace the plain signature select). */
  senderPreferences?: boolean;
}) {
  const t = useTranslations("Settings");
  const adminT = useTranslations("Admin");
  const locale = useLocale();
  const { messages: senderMessages } = useSenderMessages();
  const [prefs, setPrefs] = useState<UserAccountPrefs>({});
  const [patch, setPatch] = useState<UserAccountPrefsPatch>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const url = `/api/accounts/${encodeURIComponent(editingAccount.id)}/prefs`;
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setSaved(false); setPatch({});
    void adminRequest<{ prefs: UserAccountPrefs }>(apiFetch, url).then(data => {
      if (active) { setPrefs(data.prefs); setPatch({}); setLoading(false); }
    }).catch(error => { if (active) { setError(error); setLoading(false); } });
    return () => { active = false; };
  }, [apiFetch, url]);
  const save = async () => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const data = await adminRequest<{ prefs: UserAccountPrefs }>(apiFetch, url, jsonMutation("PUT", patch));
      setPrefs(data.prefs); setPatch({}); setSaved(true);
      // The collaboration settings resolver can subscribe without persisting
      // personal values back into the team-level /settings route. Sender changes
      // also tell other windows (compose) to reload their sender settings.
      if (touchesSenderPrefs(patch)) notifySenderPreferencesChanged(editingAccount.id, data.prefs);
      else window.dispatchEvent(new CustomEvent("noctua:account-prefs-changed", { detail: { accountId: editingAccount.id, prefs: data.prefs } }));
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  };
  const signatureValue = patch.defaultSignatureId !== undefined ? patch.defaultSignatureId : prefs.defaultSignatureId;
  const senderValid = validSignatureTemplate(applySenderPatch(prefs, patch).signatureOverride ?? "");
  const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const errorText = SENDER_ERROR_CODES.has(errorCode) ? senderSettingsError(error, senderMessages) : formatAdminError(error, adminT, locale);
  const change = (next: UserAccountPrefsPatch) => { setSaved(false); setPatch(previous => ({ ...previous, ...next })); };
  return <div className="flex h-full min-h-0 flex-col gap-4">
    <div className="min-h-0 flex-1 space-y-4 overflow-auto">
      <LanguageSelector authenticated />
      <p className="text-sm text-muted-foreground">{t("preferences.help")}</p>
      {loading && <p role="status">{t("preferences.loading")}</p>}
      {Boolean(error) && <p role="alert" className="text-destructive">{errorText}</p>}
      {saved && <p role="status">{t("preferences.saved")}</p>}
      <fieldset disabled={loading || busy} className="m-0 grid min-w-0 gap-4 border-0 p-0 sm:grid-cols-2">
        {fields.map(field => {
          const changes = patch[field.group] as Record<string, unknown> | null | undefined;
          const stored = prefs[field.group] as Record<string, unknown> | undefined;
          const value = changes && field.key in changes ? changes[field.key] : stored?.[field.key];
          return <label key={`${field.group}.${field.key}`} className="grid min-w-0 gap-1 text-sm">{t(`preferences.fields.${field.key}`)}
            <select className={nativeControlClass} value={value == null ? "inherit" : String(value)} onChange={event => {
              const value = event.target.value;
              setSaved(false);
              setPatch(previous => ({ ...previous, [field.group]: { ...previous[field.group], [field.key]: value === "inherit" ? null : field.boolean ? value === "true" : value } }));
            }}><option value="inherit">{t("preferences.inherit")}</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.literal ? option.label : t(`preferences.options.${option.label as "yes" | "no" | "threads" | "card" | "table" | "compact" | "locale" | "monday" | "sunday"}`)}</option>)}</select>
          </label>;
        })}
        {!senderPreferences && <label className="grid min-w-0 gap-1 text-sm">{t("preferences.signature")}<select className={nativeControlClass} value={signatureValue ?? "inherit"} onChange={event => {
          setSaved(false); setPatch(previous => ({ ...previous, defaultSignatureId: event.target.value === "inherit" ? null : event.target.value }));
        }}><option value="inherit">{t("preferences.inherit")}</option><option value="">{t("preferences.noSignature")}</option>
          {signatureValue && !editingAccount.settings?.signatures?.some(signature => signature.id === signatureValue) && <option value={signatureValue}>{t("preferences.unavailableSignature")}</option>}
          {editingAccount.settings?.signatures?.map(signature => <option key={signature.id} value={signature.id}>{signature.name}</option>)}
        </select></label>}
      </fieldset>
      {senderPreferences && <SenderPreferences editingAccount={editingAccount} apiFetch={apiFetch} prefs={prefs} patch={patch} disabled={loading || busy} onChange={change} />}
      <MailtoHandlerSection />
    </div>
    <div className="flex flex-wrap justify-end gap-3 border-t pt-3"><Button variant="outline" onClick={onClose}>{t("preferences.close")}</Button>
      <Button disabled={loading || busy || !senderValid || !Object.keys(patch).length} onClick={() => void save()}>{busy ? t("preferences.saving") : t("preferences.save")}</Button></div>
  </div>;
}
