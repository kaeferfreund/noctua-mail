"use client";

import { useSenderMessages } from "@/lib/i18n/useSenderMessages";

import { senderSettingsError, identityStatus } from "@/lib/senderMessages";

import { useEffect, useState } from "react";
import type { Account, SenderIdentity } from "@/lib/data";
import { Button } from "@/app/components/ui/button";
import Field, { nativeControlClass } from "../Field";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { notifySenderSettingsChanged } from "@/lib/ui/senderSettings";

type IdentityForm = { email: string; displayName: string; replyTo: string; signatureId: string; enabled: boolean };
const empty: IdentityForm = { email: "", displayName: "", replyTo: "", signatureId: "", enabled: true };

export default function IdentitiesTabContent({ editingAccount, apiFetch = fetch }: { editingAccount: Account; apiFetch?: AdminFetch }) {
  const { messages: senderMessages } = useSenderMessages();
  const [identities, setIdentities] = useState<SenderIdentity[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const manager = editingAccount.accessRole === "manager";
  const url = `/api/accounts/${encodeURIComponent(editingAccount.id)}/identities`;
  useEffect(() => {
    let active = true;
    void adminRequest<{ identities: SenderIdentity[] }>(apiFetch, url).then(data => {
      if (active) { setIdentities(data.identities); setLoading(false); }
    }).catch(error => { if (active) { setError(error); setLoading(false); } });
    return () => { active = false; };
  }, [apiFetch, url]);
  const mutate = async (id: string | null, patch: Record<string, unknown>) => {
    if (!manager) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      await adminRequest(apiFetch, id ? `${url}/${encodeURIComponent(id)}` : url, jsonMutation(id ? "PATCH" : "POST", patch));
      const data = await adminRequest<{ identities: SenderIdentity[] }>(apiFetch, url);
      setIdentities(data.identities); setEditing(null); setSaved(true);
      notifySenderSettingsChanged(editingAccount.id);
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  };
  return <div className="flex h-full flex-col gap-4 overflow-auto p-2">
    <p>{senderMessages.identitiesHelp}</p>
    {loading && <p role="status">{senderMessages.identitiesLoading}</p>}
    {Boolean(error) && <p role="alert">{senderSettingsError(error, senderMessages)}</p>}
    {saved && <p role="status">{senderMessages.identitySaved}</p>}
    {!manager && <p>{senderMessages.managerOnly}</p>}
    {identities.map(identity => <section key={identity.id} aria-label={identity.email} className="space-y-2 rounded-md border p-3">
      <p>{identityStatus(`${identity.displayName} <${identity.email}>`, identity.isDefault, identity.enabled, senderMessages)}</p>
      {identity.replyTo && <p>{senderMessages.replyToLabel} {identity.replyTo}</p>}
      {manager && <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => { setEditing(identity.id); setForm({ email: identity.email, displayName: identity.displayName, replyTo: identity.replyTo ?? "", signatureId: identity.signatureId ?? "", enabled: identity.enabled }); }}>{senderMessages.edit}</Button>
        <Button variant="outline" disabled={busy || identity.isDefault} title={identity.isDefault ? senderMessages.chooseDefaultBeforeDisable : undefined} onClick={() => void mutate(identity.id, { enabled: !identity.enabled })}>{identity.enabled ? senderMessages.disable : senderMessages.enable}</Button>
        <label><input type="radio" name="mailbox-default-identity" aria-label={senderMessages.identityDefaultFor.replace("{email}", () => identity.email)} checked={identity.isDefault} disabled={busy || !identity.enabled} onChange={() => { if (!identity.isDefault) void mutate(identity.id, { isDefault: true }); }} /> {senderMessages.mailboxDefault}</label>
      </div>}
    </section>)}
    {manager && <Button variant="outline" disabled={loading || busy} onClick={() => { setEditing("new"); setForm(empty); }}>{senderMessages.addIdentity}</Button>}
    {manager && editing && <form className="grid gap-3" onSubmit={event => {
      event.preventDefault();
      void mutate(editing === "new" ? null : editing, { ...(editing === "new" ? { email: form.email } : {}), displayName: form.displayName,
        ...(editing === "new" ? { ...(form.replyTo ? { replyTo: form.replyTo } : {}), ...(form.signatureId ? { signatureId: form.signatureId } : {}) } : { replyTo: form.replyTo || null, signatureId: form.signatureId || null }), enabled: form.enabled });
    }}>
      <fieldset disabled={busy} className="grid gap-3">
        <Field label={senderMessages.email}><input type="email" required className={nativeControlClass} disabled={editing !== "new"} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label={senderMessages.displayName}><input className={nativeControlClass} maxLength={256} value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} /></Field>
        <Field label={senderMessages.replyTo} hint={senderMessages.replyToHelp}><input type="email" className={nativeControlClass} value={form.replyTo} onChange={event => setForm({ ...form, replyTo: event.target.value })} /></Field>
        <Field label={senderMessages.signatureTemplate}><select className={nativeControlClass} value={form.signatureId} onChange={event => setForm({ ...form, signatureId: event.target.value })}><option value="">{senderMessages.identitySignatureDefault}</option>{editingAccount.settings?.signatures?.map(signature => <option key={signature.id} value={signature.id}>{signature.name}</option>)}</select></Field>
        <label><input type="checkbox" checked={form.enabled} disabled={identities.some(identity => identity.id === editing && identity.isDefault)} onChange={event => setForm({ ...form, enabled: event.target.checked })} /> {senderMessages.enabled}</label>
        <div className="flex gap-2"><Button type="submit">{busy ? senderMessages.saving : senderMessages.saveIdentity}</Button><Button type="button" variant="outline" onClick={() => setEditing(null)}>{senderMessages.cancel}</Button></div>
      </fieldset>
    </form>}
  </div>;
}
