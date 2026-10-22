"use client";

import { useEffect, useState } from "react";
import type { Account, UserAccountPrefs, UserAccountPrefsPatch } from "@/lib/data";
import { ACCOUNT_DATE_FORMAT_OPTIONS } from "@/lib/dateFormatting";
import { Button } from "@/app/components/ui/button";
import MailtoHandlerSection from "@/app/components/account-settings/MailtoHandlerSection";
import { adminRequest, errorMessage, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";

type PreferenceField = {
  group: "layout" | "appearance" | "calendar" | "threading" | "notifications";
  key: string; label: string; options: { value: string; label: string }[]; boolean?: boolean;
};
const yesNo = [{ value: "true", label: "Yes" }, { value: "false", label: "No" }];
const fields: PreferenceField[] = [
  { group: "layout", key: "defaultView", label: "Default layout", options: ["threads", "card", "table", "compact"].map(value => ({ value, label: value })) },
  { group: "appearance", key: "dateFormat", label: "Date format", options: ACCOUNT_DATE_FORMAT_OPTIONS },
  { group: "appearance", key: "topicColorRows", label: "Color rows by topic", options: yesNo, boolean: true },
  { group: "appearance", key: "senderIcons", label: "Show sender icons", options: yesNo, boolean: true },
  { group: "calendar", key: "weekStartsOn", label: "Week starts on", options: [{ value: "monday", label: "Monday" }, { value: "sunday", label: "Sunday" }] },
  { group: "threading", key: "includeAcrossFolders", label: "Include threads across folders", options: yesNo, boolean: true },
  { group: "notifications", key: "newMail", label: "New mail notifications", options: yesNo, boolean: true }
];
export default function PreferencesTabContent({ editingAccount, onClose, apiFetch = fetch }: {
  editingAccount: Account; onClose: () => void; apiFetch?: AdminFetch;
}) {
  const [prefs, setPrefs] = useState<UserAccountPrefs>({});
  const [patch, setPatch] = useState<UserAccountPrefsPatch>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const url = `/api/accounts/${encodeURIComponent(editingAccount.id)}/prefs`;
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setSaved(false); setPatch({});
    void adminRequest<{ prefs: UserAccountPrefs }>(apiFetch, url).then(data => {
      if (active) { setPrefs(data.prefs); setPatch({}); setLoading(false); }
    }).catch(error => { if (active) { setError(errorMessage(error)); setLoading(false); } });
    return () => { active = false; };
  }, [apiFetch, url]);
  const save = async () => {
    setBusy(true); setError(""); setSaved(false);
    try {
      const data = await adminRequest<{ prefs: UserAccountPrefs }>(apiFetch, url, jsonMutation("PUT", patch));
      setPrefs(data.prefs); setPatch({}); setSaved(true);
      // The collaboration settings resolver can subscribe without persisting
      // personal values back into the team-level /settings route.
      window.dispatchEvent(new CustomEvent("noctua:account-prefs-changed", { detail: { accountId: editingAccount.id, prefs: data.prefs } }));
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const signatureValue = patch.defaultSignatureId !== undefined ? patch.defaultSignatureId : prefs.defaultSignatureId;
  return <div className="flex h-full min-h-0 flex-col gap-4">
    <div className="min-h-0 flex-1 space-y-4 overflow-auto">
      <p className="text-sm text-muted-foreground">Personal preferences for this mailbox. Inherit uses the mailbox default; only changed preferences are saved.</p>
      {loading && <p role="status">Loading preferences…</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {saved && <p role="status">Preferences saved.</p>}
      <fieldset disabled={loading || busy} className="grid gap-4 sm:grid-cols-2">
        {fields.map(field => {
          const changes = patch[field.group] as Record<string, unknown> | null | undefined;
          const stored = prefs[field.group] as Record<string, unknown> | undefined;
          const value = changes && field.key in changes ? changes[field.key] : stored?.[field.key];
          return <label key={`${field.group}.${field.key}`} className="grid gap-1 text-sm">{field.label}
            <select className="rounded-md border bg-background p-2" value={value == null ? "inherit" : String(value)} onChange={event => {
              const value = event.target.value;
              setSaved(false);
              setPatch(previous => ({ ...previous, [field.group]: { ...previous[field.group], [field.key]: value === "inherit" ? null : field.boolean ? value === "true" : value } }));
            }}><option value="inherit">Inherit mailbox default</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </label>;
        })}
        <label className="grid gap-1 text-sm">Default signature<select className="rounded-md border bg-background p-2" value={signatureValue ?? "inherit"} onChange={event => {
          setSaved(false); setPatch(previous => ({ ...previous, defaultSignatureId: event.target.value === "inherit" ? null : event.target.value }));
        }}><option value="inherit">Inherit mailbox default</option><option value="">No signature</option>
          {signatureValue && !editingAccount.settings?.signatures?.some(signature => signature.id === signatureValue) && <option value={signatureValue}>Unavailable signature</option>}
          {editingAccount.settings?.signatures?.map(signature => <option key={signature.id} value={signature.id}>{signature.name}</option>)}
        </select></label>
      </fieldset>
      <MailtoHandlerSection />
    </div>
    <div className="flex justify-end gap-3 border-t pt-3"><Button variant="outline" onClick={onClose}>Close</Button>
      <Button disabled={loading || busy || !Object.keys(patch).length} onClick={() => void save()}>{busy ? "Saving…" : "Save preferences"}</Button></div>
  </div>;
}
