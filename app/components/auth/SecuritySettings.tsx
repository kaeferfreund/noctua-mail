"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { AuthClientError, authClient, validateNewPassword, type NoctuaAuthClient, type Proof, type ProofPurpose, type SecurityInfo } from "@/lib/authClient";
import { AuthError, AuthField, BackupCodes, useAuthAction } from "./AuthPrimitives";
import ReauthDialog from "./ReauthDialog";
import EnrollmentScreen from "./EnrollmentScreen";

type Operation = { purpose: ProofPurpose; apply: (proof: Proof, password: string) => Promise<void> };
export default function SecuritySettings({ client = authClient, onUnauthorized, onReplacement, onChanged }: {
  client?: NoctuaAuthClient;
  onUnauthorized: () => void;
  onReplacement?: (continuation: { proof: Proof; password: string }) => void;
  onChanged?: () => void | Promise<void>;
}) {
  const unauthorized = useRef(onUnauthorized);
  useEffect(() => { unauthorized.current = onUnauthorized; }, [onUnauthorized]);
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [continuation, setContinuation] = useState<{ proof: Proof; password: string } | null>(null);
  const [notice, setNotice] = useState("");
  const action = useAuthAction(onUnauthorized);
  const reload = useCallback(() => client.security().then(next => {
    setInfo(next); setLoadError(null);
  }, error => {
    setLoadError(error);
    if (error instanceof AuthClientError && error.loggedOut) unauthorized.current();
  }), [client]);
  useEffect(() => { void reload(); }, [reload]);
  const start = (purpose: ProofPurpose, apply: Operation["apply"]) => {
    setNotice(""); action.setError(null); setOperation({ purpose, apply });
  };
  if (continuation) return <EnrollmentScreen client={client} continuation={continuation} onLogout={onUnauthorized} onComplete={async () => { setContinuation(null); await reload(); await onChanged?.(); }} />;
  return <section data-shell="" className="space-y-6 text-foreground" aria-label="Profile & security">
    <p className="text-sm text-muted-foreground">Your security settings apply to your personal identity across every mailbox.</p>
    <AuthError error={loadError ?? action.error} />
    {Boolean(loadError) && <Button variant="outline" onClick={() => { void reload(); }}>Retry security settings</Button>}
    {notice && <p role="status">{notice}</p>}
    {!info && !loadError && <p role="status">Loading security settings…</p>}
    {codes.length > 0 && <BackupCodes codes={codes} onDone={() => setCodes([])} />}
    {info && <>
      {(info.reauthRequired || info.mfaStateInconsistent) && <p role="alert">Sign in again to complete verification. Contact your admin if authenticator recovery is needed.</p>}
      <form className="space-y-3 rounded-lg border p-4" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        const password = String(data.get("newPassword")); const error = validateNewPassword(password, String(data.get("confirmation")));
        if (error) { action.setError(error); return; }
        start(info.hasPassword ? "password.change" : "password.set", async (grant, currentPassword) => {
          await client.changePassword({ newPassword: password, currentPassword }, grant); form.reset();
          setNotice("Password changed. Other sessions were signed out."); await onChanged?.();
        });
      }}>
        <h2 className="font-medium">App password</h2>
        <AuthField name="newPassword" label="New password" type="password" autoComplete="new-password" minLength={10} maxLength={256} required />
        <AuthField name="confirmation" label="Confirm new password" type="password" autoComplete="new-password" required />
        <Button type="submit">{info.hasPassword ? "Change password" : "Set app password"}</Button>
      </form>
      <section className="space-y-3 rounded-lg border p-4" aria-label="Authenticator">
        <h2 className="font-medium">Authenticator &amp; backup codes</h2>
        <p>Authenticator verification is required. Replacing it signs out other sessions.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => start("totp.replace", async (grant, password) => {
            const proof = await client.replaceTotp(password, grant);
            if (onReplacement) onReplacement({ proof, password }); else setContinuation({ proof, password });
          })}>Replace authenticator</Button>
          <Button variant="outline" onClick={() => start("backup.regenerate", async (grant, password) => {
            const result = await client.regenerateBackupCodes(password, grant); setCodes(result.backupCodes);
            setNotice("Old backup codes no longer work. Save the new codes.");
          })}>Regenerate backup codes</Button>
        </div>
      </section>
      <section className="space-y-3 rounded-lg border p-4" aria-label="Passkeys">
        <h2 className="font-medium">Passkeys</h2>
        {info.passkeys.length === 0 && <p>No passkeys yet.</p>}
        {info.passkeys.map(key => <form key={key.id} className="space-y-2 border-b pb-3" onSubmit={event => {
          event.preventDefault(); const name = String(new FormData(event.currentTarget).get("name")).trim();
          if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) { action.setError("Use a passkey name between 1 and 100 characters without control characters."); return; }
          start("passkey.rename", async grant => { await client.renamePasskey(key.id, name, grant); });
        }}>
          <AuthField name="name" label={`Passkey name (${key.name || "Unnamed key"})`} defaultValue={key.name ?? ""} required maxLength={100} autoComplete="off" />
          <p className="text-xs text-muted-foreground">{key.deviceType} · {key.backedUp ? "Backed up" : "Device only"}</p>
          <div className="flex gap-2"><Button variant="outline" type="submit">Rename passkey</Button>
            <Button variant="outline" type="button" onClick={() => start("passkey.remove", async grant => { await client.removePasskey(key.id, grant); })}>Remove passkey</Button></div>
        </form>)}
        <form className="space-y-2" onSubmit={event => {
          event.preventDefault(); const form = event.currentTarget; const name = String(new FormData(form).get("name")).trim();
          if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) { action.setError("Enter a passkey name without control characters."); return; }
          start("passkey.enroll", async grant => { await client.addPasskey(name, grant); form.reset(); setNotice("Passkey added."); });
        }}>
          <AuthField name="name" label="New passkey name" required maxLength={100} autoComplete="off" />
          <Button type="submit">Add passkey</Button>
        </form>
      </section>
      <section className="space-y-3 rounded-lg border p-4" aria-label="Sessions">
        <h2 className="font-medium">Sessions</h2>
        <ul className="space-y-3">{info.sessions.map(session => <li key={session.id} className="space-y-1">
          <p>{session.current ? "Current session" : "Other session"} · {session.userAgent || "Unknown device"}</p>
          <p className="text-xs text-muted-foreground">Last active: {session.updatedAt}{session.ip ? ` · ${session.ip}` : ""}</p>
          <Button variant="outline" onClick={() => start("sessions.revoke", async grant => {
            await client.revokeSessions({ sessionId: session.id }, grant);
            if (session.current) onUnauthorized();
          })}>{session.current ? "Sign out this session" : "Revoke session"}</Button>
        </li>)}</ul>
        <Button variant="outline" onClick={() => start("sessions.revoke", async grant => { await client.revokeSessions({ all: true }, grant); setNotice("Other sessions signed out."); })}>Sign out other sessions</Button>
      </section>
    </>}
    {operation && <ReauthDialog key={operation.purpose} purpose={operation.purpose} client={client} onUnauthorized={onUnauthorized} onCancel={() => setOperation(null)} onVerified={async (proof, password) => {
      try {
        await operation.apply(proof, password); setOperation(null); await reload();
      } catch (error) {
        // Downstream failures spend the grant. A retry must collect fresh proof.
        throw error;
      }
    }} />}
  </section>;
}
