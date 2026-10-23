"use client";

import { useEffect, useState } from "react";
import type { Account, SenderIdentity } from "@/lib/data";
import { Button } from "@/app/components/ui/button";
import Field from "../Field";
import { adminRequest, errorMessage, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { notifySenderSettingsChanged } from "@/lib/ui/senderSettings";

type IdentityForm = { email: string; displayName: string; replyTo: string; signatureId: string; enabled: boolean };
const empty: IdentityForm = { email: "", displayName: "", replyTo: "", signatureId: "", enabled: true };
const control = "w-full rounded-md border bg-background p-2";

export default function IdentitiesTabContent({ editingAccount, apiFetch = fetch }: { editingAccount: Account; apiFetch?: AdminFetch }) {
  const [identities, setIdentities] = useState<SenderIdentity[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const manager = editingAccount.accessRole === "manager";
  const url = `/api/accounts/${encodeURIComponent(editingAccount.id)}/identities`;
  useEffect(() => {
    let active = true;
    void adminRequest<{ identities: SenderIdentity[] }>(apiFetch, url).then(data => {
      if (active) { setIdentities(data.identities); setLoading(false); }
    }).catch(error => { if (active) { setError(errorMessage(error)); setLoading(false); } });
    return () => { active = false; };
  }, [apiFetch, url]);
  const mutate = async (id: string | null, patch: Record<string, unknown>) => {
    if (!manager) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      await adminRequest(apiFetch, id ? `${url}/${encodeURIComponent(id)}` : url, jsonMutation(id ? "PATCH" : "POST", patch));
      const data = await adminRequest<{ identities: SenderIdentity[] }>(apiFetch, url);
      setIdentities(data.identities); setEditing(null); setSaved(true);
      notifySenderSettingsChanged(editingAccount.id);
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <div className="flex h-full flex-col gap-4 overflow-auto p-2">
    <p>Addresses this mailbox can send from. Sending authorization must be checked with the mail provider before enabling an address.</p>
    {loading && <p role="status">Loading identities…</p>}
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">Identity saved.</p>}
    {!manager && <p>Only mailbox managers can change sender identities.</p>}
    {identities.map(identity => <section key={identity.id} aria-label={identity.email} className="space-y-2 rounded-md border p-3">
      <p>{identity.displayName} &lt;{identity.email}&gt;{identity.isDefault ? " — Mailbox default" : ""}{!identity.enabled ? " — Disabled" : ""}</p>
      {identity.replyTo && <p>Reply-To: {identity.replyTo}</p>}
      {manager && <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => { setEditing(identity.id); setForm({ email: identity.email, displayName: identity.displayName, replyTo: identity.replyTo ?? "", signatureId: identity.signatureId ?? "", enabled: identity.enabled }); }}>Edit</Button>
        <Button variant="outline" disabled={busy || identity.isDefault} title={identity.isDefault ? "Choose another mailbox default before disabling this identity." : undefined} onClick={() => void mutate(identity.id, { enabled: !identity.enabled })}>{identity.enabled ? "Disable" : "Enable"}</Button>
        <label><input type="radio" name="mailbox-default-identity" aria-label={`Mailbox default for ${identity.email}`} checked={identity.isDefault} disabled={busy || !identity.enabled} onChange={() => { if (!identity.isDefault) void mutate(identity.id, { isDefault: true }); }} /> Mailbox default</label>
      </div>}
    </section>)}
    {manager && <Button variant="outline" disabled={loading || busy} onClick={() => { setEditing("new"); setForm(empty); }}>Add identity</Button>}
    {manager && editing && <form className="grid gap-3" onSubmit={event => {
      event.preventDefault();
      void mutate(editing === "new" ? null : editing, { ...(editing === "new" ? { email: form.email } : {}), displayName: form.displayName,
        ...(editing === "new" ? { ...(form.replyTo ? { replyTo: form.replyTo } : {}), ...(form.signatureId ? { signatureId: form.signatureId } : {}) } : { replyTo: form.replyTo || null, signatureId: form.signatureId || null }), enabled: form.enabled });
    }}>
      <fieldset disabled={busy} className="grid gap-3">
        <Field label="Email"><input type="email" required className={control} disabled={editing !== "new"} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="Display name"><input className={control} maxLength={256} value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} /></Field>
        <Field label="Reply-To" hint="Optional single address; replies go here instead of From."><input type="email" className={control} value={form.replyTo} onChange={event => setForm({ ...form, replyTo: event.target.value })} /></Field>
        <Field label="Signature template"><select className={control} value={form.signatureId} onChange={event => setForm({ ...form, signatureId: event.target.value })}><option value="">Mailbox default</option>{editingAccount.settings?.signatures?.map(signature => <option key={signature.id} value={signature.id}>{signature.name}</option>)}</select></Field>
        <label><input type="checkbox" checked={form.enabled} disabled={identities.some(identity => identity.id === editing && identity.isDefault)} onChange={event => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label>
        <div className="flex gap-2"><Button type="submit">{busy ? "Saving…" : "Save identity"}</Button><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div>
      </fieldset>
    </form>}
  </div>;
}
