"use client";

import { useSenderMessages } from "@/lib/i18n/useSenderMessages";

import { senderSettingsError } from "@/lib/senderMessages";

import { useEffect, useState } from "react";
import type { Account, UserAccountPrefsPatch } from "@/lib/data";
import { Button } from "@/app/components/ui/button";
import Field from "../Field";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { loadSenderSettings, notifySenderPreferencesChanged, type SenderSettings } from "@/lib/ui/senderSettings";
import { renderSignatureTemplate, resolveSignatureTemplate, validSignatureTemplate } from "@/lib/signatureTemplates";

export default function SenderPreferences({ editingAccount, apiFetch = fetch }: { editingAccount: Account; apiFetch?: AdminFetch }) {
  const { messages: senderMessages, renderMessage } = useSenderMessages();
  const [data, setData] = useState<SenderSettings | null>(null);
  const [patch, setPatch] = useState<UserAccountPrefsPatch>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    void loadSenderSettings(apiFetch, editingAccount.id).then(data => { if (active) setData(data); }).catch(error => { if (active) setError(error); });
    return () => { active = false; };
  }, [apiFetch, editingAccount.id]);
  const prefs = { ...data?.prefs };
  for (const key of ["defaultIdentityId", "defaultSignatureId", "signatureOverride"] as const) {
    if (key in patch) { if (patch[key] === null) delete prefs[key]; else prefs[key] = patch[key] ?? undefined; }
  }
  const identity = data?.identities.find(item => item.enabled && item.id === prefs.defaultIdentityId) ?? data?.identities.find(item => item.enabled && item.isDefault);
  const template = resolveSignatureTemplate(data?.account.settings, prefs, identity);
  const valid = validSignatureTemplate(prefs.signatureOverride ?? "");
  const preview = valid && data ? renderSignatureTemplate(template.body, data.user, identity).text : "";
  const change = (next: UserAccountPrefsPatch) => { setPatch(previous => ({ ...previous, ...next })); setSaved(false); };
  const save = async () => {
    if (!valid) return;
    setBusy(true); setError(null);
    try {
      const result = await adminRequest<{ prefs: SenderSettings["prefs"] }>(apiFetch, `/api/accounts/${encodeURIComponent(editingAccount.id)}/prefs`, jsonMutation("PUT", patch));
      setData(previous => previous ? { ...previous, prefs: result.prefs } : previous); setPatch({}); setSaved(true);
      notifySenderPreferencesChanged(editingAccount.id, result.prefs);
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  };
  return <section aria-label={senderMessages.senderPreferencesTitle} className="space-y-3 rounded-md border p-3">
    <p>{senderMessages.senderPreferencesHelp}</p>
    {!data && !error && <p role="status">{senderMessages.senderPreferencesLoading}</p>}
    {Boolean(error) && <p role="alert">{senderSettingsError(error, senderMessages)}</p>}
    {saved && <p role="status">{senderMessages.senderPreferencesSaved}</p>}
    <fieldset disabled={!data || busy} className="grid gap-3">
      <Field label={senderMessages.defaultFrom}><select value={prefs.defaultIdentityId ?? "inherit"} onChange={event => change({ defaultIdentityId: event.target.value === "inherit" ? null : event.target.value })}>
        <option value="inherit">{senderMessages.mailboxDefault}</option>
        {prefs.defaultIdentityId && !data?.identities.some(item => item.id === prefs.defaultIdentityId && item.enabled) && <option value={prefs.defaultIdentityId} disabled>{senderMessages.unavailableIdentity}</option>}
        {data?.identities.filter(item => item.enabled).map(item => <option key={item.id} value={item.id}>{item.displayName} &lt;{item.email}&gt;</option>)}
      </select></Field>
      <Field label={senderMessages.personalTemplate}><select value={prefs.defaultSignatureId ?? "inherit"} onChange={event => change({ defaultSignatureId: event.target.value === "inherit" ? null : event.target.value })}>
        <option value="inherit">{senderMessages.inheritTemplate}</option><option value="">{senderMessages.noSignature}</option>
        {data?.account.settings?.signatures?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></Field>
      <Field label={senderMessages.personalSignature} hint={senderMessages.personalSignatureHelp}><select value={prefs.signatureOverride === undefined ? "inherit" : "custom"} onChange={event => change({ signatureOverride: event.target.value === "inherit" ? null : "" })}><option value="inherit">{senderMessages.inheritSignature}</option><option value="custom">{senderMessages.usePersonalText}</option></select></Field>
      {prefs.signatureOverride !== undefined && <Field label={senderMessages.personalSignatureText}><textarea rows={5} value={prefs.signatureOverride} onChange={event => change({ signatureOverride: event.target.value })} /></Field>}
      <p className="text-sm">{senderMessages.placeholdersHelp}</p>
      {!valid && <p role="alert">{senderMessages.invalidTemplate}</p>}
      {data?.warnings.map(warning => <p key={`sender-${warning}`} role="alert">{renderMessage(warning)}</p>)}
      {template.warnings.map(warning => <p key={warning} role="alert">{renderMessage(warning)}</p>)}
      <Field label={senderMessages.signaturePreview}><pre className="whitespace-pre-wrap">{preview || senderMessages.noSignature}</pre></Field>
      <Button disabled={busy || !valid || !Object.keys(patch).length} onClick={() => void save()}>{busy ? senderMessages.saving : senderMessages.saveSenderPreferences}</Button>
    </fieldset>
  </section>;
}
