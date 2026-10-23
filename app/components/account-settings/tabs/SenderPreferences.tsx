"use client";

import { useEffect, useState } from "react";
import type { Account, UserAccountPrefsPatch } from "@/lib/data";
import { Button } from "@/app/components/ui/button";
import Field from "../Field";
import { adminRequest, errorMessage, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { loadSenderSettings, notifySenderPreferencesChanged, type SenderSettings } from "@/lib/ui/senderSettings";
import { renderSignatureTemplate, resolveSignatureTemplate, validSignatureTemplate } from "@/lib/signatureTemplates";

export default function SenderPreferences({ editingAccount, apiFetch = fetch }: { editingAccount: Account; apiFetch?: AdminFetch }) {
  const [data, setData] = useState<SenderSettings | null>(null);
  const [patch, setPatch] = useState<UserAccountPrefsPatch>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    void loadSenderSettings(apiFetch, editingAccount.id).then(data => { if (active) setData(data); }).catch(error => { if (active) setError(errorMessage(error)); });
    return () => { active = false; };
  }, [apiFetch, editingAccount.id]);
  const prefs = { ...data?.prefs };
  for (const key of ["defaultIdentityId", "defaultSignatureId", "signatureOverride"] as const) {
    if (key in patch) { if (patch[key] === null) delete prefs[key]; else prefs[key] = patch[key] ?? undefined; }
  }
  const identity = data?.identities.find(item => item.enabled && item.id === prefs.defaultIdentityId) ?? data?.identities.find(item => item.enabled && item.isDefault);
  const template = resolveSignatureTemplate(data?.account.settings, prefs, identity);
  const valid = validSignatureTemplate(template.body);
  const preview = valid && data ? renderSignatureTemplate(template.body, data.user, identity).text : "";
  const change = (next: UserAccountPrefsPatch) => { setPatch(previous => ({ ...previous, ...next })); setSaved(false); };
  const save = async () => {
    setBusy(true); setError("");
    try {
      const result = await adminRequest<{ prefs: SenderSettings["prefs"] }>(apiFetch, `/api/accounts/${encodeURIComponent(editingAccount.id)}/prefs`, jsonMutation("PUT", patch));
      setData(previous => previous ? { ...previous, prefs: result.prefs } : previous); setPatch({}); setSaved(true);
      notifySenderPreferencesChanged(editingAccount.id, result.prefs);
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <section aria-label="Sender preferences" className="space-y-3 rounded-md border p-3">
    <p>Personal From and signature for this mailbox</p>
    {!data && !error && <p role="status">Loading sender preferences…</p>}
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">Sender preferences saved.</p>}
    <fieldset disabled={!data || busy} className="grid gap-3">
      <Field label="Default From"><select value={prefs.defaultIdentityId ?? "inherit"} onChange={event => change({ defaultIdentityId: event.target.value === "inherit" ? null : event.target.value })}>
        <option value="inherit">Mailbox default</option>
        {prefs.defaultIdentityId && !data?.identities.some(item => item.id === prefs.defaultIdentityId && item.enabled) && <option value={prefs.defaultIdentityId} disabled>Unavailable identity</option>}
        {data?.identities.filter(item => item.enabled).map(item => <option key={item.id} value={item.id}>{item.displayName} &lt;{item.email}&gt;</option>)}
      </select></Field>
      <Field label="Personal signature template"><select value={prefs.defaultSignatureId ?? "inherit"} onChange={event => change({ defaultSignatureId: event.target.value === "inherit" ? null : event.target.value })}>
        <option value="inherit">Use identity or mailbox default</option><option value="">No signature</option>
        {data?.account.settings?.signatures?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></Field>
      <Field label="Personal signature" hint="Overrides the template choice. Empty text explicitly means no signature."><select value={prefs.signatureOverride === undefined ? "inherit" : "custom"} onChange={event => change({ signatureOverride: event.target.value === "inherit" ? null : "" })}><option value="inherit">Inherit signature template</option><option value="custom">Use personal text</option></select></Field>
      {prefs.signatureOverride !== undefined && <Field label="Personal signature text"><textarea rows={5} value={prefs.signatureOverride} onChange={event => change({ signatureOverride: event.target.value })} /></Field>}
      <p className="text-sm">Supported placeholders: {"{{user.name}}, {{user.email}}, {{identity.displayName}}, {{identity.email}}"}. Add job titles as plain text.</p>
      {!valid && <p role="alert">Use only the supported signature placeholders (maximum 8 KiB).</p>}
      {data?.warnings.map(warning => <p key={`sender-${warning}`} role="alert">{warning}</p>)}
      {template.warnings.map(warning => <p key={warning} role="alert">{warning}</p>)}
      <Field label="Signature preview"><pre className="whitespace-pre-wrap">{preview || "No signature"}</pre></Field>
      <Button disabled={busy || !valid || !Object.keys(patch).length} onClick={() => void save()}>{busy ? "Saving…" : "Save sender preferences"}</Button>
    </fieldset>
  </section>;
}
