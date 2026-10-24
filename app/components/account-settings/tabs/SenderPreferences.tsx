"use client";

import { useSenderMessages } from "@/lib/i18n/useSenderMessages";

import { senderSettingsError } from "@/lib/senderMessages";

import { useEffect, useState } from "react";
import type { Account, UserAccountPrefs, UserAccountPrefsPatch } from "@/lib/data";
import Field, { nativeControlClass } from "../Field";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
import { loadSenderSettings, type SenderSettings } from "@/lib/ui/senderSettings";
import { renderSignatureTemplate, resolveSignatureTemplate, validSignatureTemplate } from "@/lib/signatureTemplates";

const SENDER_PREF_KEYS = ["defaultIdentityId", "defaultSignatureId", "signatureOverride"] as const;

/** Stored prefs with the unsaved sender keys of `patch` applied (null removes an override). */
export function applySenderPatch(stored: UserAccountPrefs, patch: UserAccountPrefsPatch): UserAccountPrefs {
  const prefs = { ...stored };
  for (const key of SENDER_PREF_KEYS) {
    if (key in patch) { if (patch[key] === null) delete prefs[key]; else prefs[key] = patch[key] ?? undefined; }
  }
  return prefs;
}
export const touchesSenderPrefs = (patch: UserAccountPrefsPatch) => SENDER_PREF_KEYS.some(key => key in patch);

/**
 * Personal From and signature section of the Preferences tab. The tab owns the
 * stored prefs, the unsaved patch and the single save; this section only loads
 * the identities and the signature preview context.
 */
export default function SenderPreferences({ editingAccount, apiFetch = fetch, prefs: stored, patch, disabled = false, onChange }: {
  editingAccount: Account; apiFetch?: AdminFetch; prefs: UserAccountPrefs; patch: UserAccountPrefsPatch;
  disabled?: boolean; onChange: (next: UserAccountPrefsPatch) => void;
}) {
  const { messages: senderMessages, renderMessage } = useSenderMessages();
  const [data, setData] = useState<SenderSettings | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    void loadSenderSettings(apiFetch, editingAccount.id).then(data => { if (active) setData(data); }).catch(error => { if (active) setError(error); });
    return () => { active = false; };
  }, [apiFetch, editingAccount.id]);
  const prefs = applySenderPatch(stored, patch);
  const identity = data?.identities.find(item => item.enabled && item.id === prefs.defaultIdentityId) ?? data?.identities.find(item => item.enabled && item.isDefault);
  const template = resolveSignatureTemplate(data?.account.settings, prefs, identity);
  const valid = validSignatureTemplate(prefs.signatureOverride ?? "");
  const preview = valid && data ? renderSignatureTemplate(template.body, data.user, identity).text : "";
  return <section aria-label={senderMessages.senderPreferencesTitle} className="space-y-3 rounded-md border p-3">
    <p>{senderMessages.senderPreferencesHelp}</p>
    {!data && !error && <p role="status">{senderMessages.senderPreferencesLoading}</p>}
    {Boolean(error) && <p role="alert">{senderSettingsError(error, senderMessages)}</p>}
    <fieldset disabled={!data || disabled} className="m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0">
      <Field label={senderMessages.defaultFrom}><select className={nativeControlClass} value={prefs.defaultIdentityId ?? "inherit"} onChange={event => onChange({ defaultIdentityId: event.target.value === "inherit" ? null : event.target.value })}>
        <option value="inherit">{senderMessages.mailboxDefault}</option>
        {prefs.defaultIdentityId && !data?.identities.some(item => item.id === prefs.defaultIdentityId && item.enabled) && <option value={prefs.defaultIdentityId} disabled>{senderMessages.unavailableIdentity}</option>}
        {data?.identities.filter(item => item.enabled).map(item => <option key={item.id} value={item.id}>{item.displayName} &lt;{item.email}&gt;</option>)}
      </select></Field>
      <Field label={senderMessages.personalTemplate}><select className={nativeControlClass} value={prefs.defaultSignatureId ?? "inherit"} onChange={event => onChange({ defaultSignatureId: event.target.value === "inherit" ? null : event.target.value })}>
        <option value="inherit">{senderMessages.inheritTemplate}</option><option value="">{senderMessages.noSignature}</option>
        {data?.account.settings?.signatures?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></Field>
      <Field label={senderMessages.personalSignature} hint={senderMessages.personalSignatureHelp}><select className={nativeControlClass} value={prefs.signatureOverride === undefined ? "inherit" : "custom"} onChange={event => onChange({ signatureOverride: event.target.value === "inherit" ? null : "" })}><option value="inherit">{senderMessages.inheritSignature}</option><option value="custom">{senderMessages.usePersonalText}</option></select></Field>
      {prefs.signatureOverride !== undefined && <Field label={senderMessages.personalSignatureText}><textarea rows={5} className={nativeControlClass} value={prefs.signatureOverride} onChange={event => onChange({ signatureOverride: event.target.value })} /></Field>}
      <p className="text-sm">{senderMessages.placeholdersHelp}</p>
      {!valid && <p role="alert">{senderMessages.invalidTemplate}</p>}
      {data?.warnings.map(warning => <p key={`sender-${warning}`} role="alert">{renderMessage(warning)}</p>)}
      {template.warnings.map(warning => <p key={warning} role="alert">{renderMessage(warning)}</p>)}
      <Field label={senderMessages.signaturePreview}><pre className="whitespace-pre-wrap">{preview || senderMessages.noSignature}</pre></Field>
    </fieldset>
  </section>;
}
