"use client";

<<<<<<< origin/feat/sender-identities-3
import { useEffect, useState, type ReactNode } from "react";
=======
import { useLocale, useTranslations } from "next-intl";

import { useEffect, useState } from "react";
>>>>>>> HEAD
import LanguageSelector from "@/app/components/i18n/LanguageSelector";
import type { Account, UserAccountPrefs, UserAccountPrefsPatch } from "@/lib/data";
import { ACCOUNT_DATE_FORMAT_OPTIONS } from "@/lib/dateFormatting";
import { Button } from "@/app/components/ui/button";
import MailtoHandlerSection from "@/app/components/account-settings/MailtoHandlerSection";
import { formatAdminError } from "@/lib/i18n/adminMessages";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";

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
export default function PreferencesTabContent({ editingAccount, onClose, apiFetch = fetch, senderPreferences }: {
  editingAccount: Account; onClose: () => void; apiFetch?: AdminFetch; senderPreferences?: ReactNode;
}) {
  const t = useTranslations("Settings");
  const adminT = useTranslations("Admin");
  const locale = useLocale();
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
      // personal values back into the team-level /settings route.
      window.dispatchEvent(new CustomEvent("noctua:account-prefs-changed", { detail: { accountId: editingAccount.id, prefs: data.prefs } }));
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  };
  const signatureValue = patch.defaultSignatureId !== undefined ? patch.defaultSignatureId : prefs.defaultSignatureId;
  return <div className="flex h-full min-h-0 flex-col gap-4">
    <div className="min-h-0 flex-1 space-y-4 overflow-auto">
      <LanguageSelector authenticated />
      <p className="text-sm text-muted-foreground">{t("preferences.help")}</p>
      {loading && <p role="status">{t("preferences.loading")}</p>}
      {Boolean(error) && <p role="alert" className="text-destructive">{formatAdminError(error, adminT, locale)}</p>}
      {saved && <p role="status">{t("preferences.saved")}</p>}
      <fieldset disabled={loading || busy} className="grid gap-4 sm:grid-cols-2">
        {fields.map(field => {
          const changes = patch[field.group] as Record<string, unknown> | null | undefined;
          const stored = prefs[field.group] as Record<string, unknown> | undefined;
          const value = changes && field.key in changes ? changes[field.key] : stored?.[field.key];
          return <label key={`${field.group}.${field.key}`} className="grid gap-1 text-sm">{t(`preferences.fields.${field.key}`)}
            <select className="rounded-md border bg-background p-2" value={value == null ? "inherit" : String(value)} onChange={event => {
              const value = event.target.value;
              setSaved(false);
              setPatch(previous => ({ ...previous, [field.group]: { ...previous[field.group], [field.key]: value === "inherit" ? null : field.boolean ? value === "true" : value } }));
            }}><option value="inherit">{t("preferences.inherit")}</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.literal ? option.label : t(`preferences.options.${option.label as "yes" | "no" | "threads" | "card" | "table" | "compact" | "locale" | "monday" | "sunday"}`)}</option>)}</select>
          </label>;
        })}
<<<<<<< origin/feat/sender-identities-3
        {!senderPreferences && <label className="grid gap-1 text-sm">Default signature<select className="rounded-md border bg-background p-2" value={signatureValue ?? "inherit"} onChange={event => {
=======
        <label className="grid gap-1 text-sm">{t("preferences.signature")}<select className="rounded-md border bg-background p-2" value={signatureValue ?? "inherit"} onChange={event => {
>>>>>>> HEAD
          setSaved(false); setPatch(previous => ({ ...previous, defaultSignatureId: event.target.value === "inherit" ? null : event.target.value }));
        }}><option value="inherit">{t("preferences.inherit")}</option><option value="">{t("preferences.noSignature")}</option>
          {signatureValue && !editingAccount.settings?.signatures?.some(signature => signature.id === signatureValue) && <option value={signatureValue}>{t("preferences.unavailableSignature")}</option>}
          {editingAccount.settings?.signatures?.map(signature => <option key={signature.id} value={signature.id}>{signature.name}</option>)}
        </select></label>}
      </fieldset>
      {senderPreferences}
      <MailtoHandlerSection />
    </div>
    <div className="flex justify-end gap-3 border-t pt-3"><Button variant="outline" onClick={onClose}>{t("preferences.close")}</Button>
      <Button disabled={loading || busy || !Object.keys(patch).length} onClick={() => void save()}>{busy ? t("preferences.saving") : t("preferences.save")}</Button></div>
  </div>;
}
