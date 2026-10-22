"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { authClient, type NoctuaAuthClient, type Proof } from "@/lib/authClient";
import { AuthError, AuthField, AuthFrame, useAuthAction } from "./AuthPrimitives";
import EnrollmentScreen from "./EnrollmentScreen";

export default function TwoFactorChallenge({ onAuthenticated, onBack, client = authClient }: {
  onAuthenticated: () => void | Promise<void>;
  onBack: () => void;
  client?: NoctuaAuthClient;
}) {
  const [backup, setBackup] = useState(false);
  const [lostPhone, setLostPhone] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [continuation, setContinuation] = useState<{ proof: Proof; password: string } | null>(null);
  const action = useAuthAction();
  if (continuation) return <EnrollmentScreen client={client} continuation={continuation} onComplete={onAuthenticated} onLogout={async () => { await client.logout(); onBack(); }} />;
  return <AuthFrame title={replacing ? "Replace your lost authenticator" : "Verify your sign-in"} description={replacing ? "Enter an unused replacement code. The backup code used to sign in cannot be used again." : "Enter your authenticator code to finish signing in."}>
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const code = String(data.get("code"));
      void action.run(async () => {
        if (replacing) {
          const password = String(data.get("password"));
          const grant = await client.reauth({ purpose: "totp.replace", currentPassword: password, backupCode: code });
          const proof = await client.replaceTotp(password, grant);
          form.reset(); setContinuation({ proof, password });
        } else {
          if (backup) await client.verifyBackupCode(code); else await client.verifyTotp(code);
          form.reset();
          if (lostPhone) setReplacing(true); else await onAuthenticated();
        }
      });
    }}>
      <fieldset disabled={action.disabled} className="space-y-4">
        {replacing && <AuthField name="password" label="Current password" type="password" autoComplete="current-password" required />}
        <AuthField key={`${backup}-${replacing}`} name="code" label={replacing ? "Unused replacement backup code" : backup ? "Backup code" : "Authenticator code"} inputMode={backup || replacing ? "text" : "numeric"} autoComplete="one-time-code" pattern={backup || replacing ? undefined : "[0-9]{6}"} required />
        <AuthError error={action.error} />
        <Button type="submit">{action.pending ? "Verifying…" : replacing ? "Replace authenticator" : "Verify"}</Button>
        {!replacing && <>
          <Button type="button" variant="outline" onClick={() => { setBackup(!backup); setLostPhone(false); action.setError(null); }}>{backup ? "Use authenticator code" : "Use a backup code"}</Button>
          <Button type="button" variant="ghost" onClick={() => { setBackup(true); setLostPhone(true); action.setError(null); }}>I lost my phone</Button>
          {lostPhone && <p className="text-sm">First sign in with a backup code. Then use a different code to authorize replacement.</p>}
        </>}
        <Button type="button" variant="ghost" onClick={onBack}>Back to sign in</Button>
      </fieldset>
    </form>
  </AuthFrame>;
}
