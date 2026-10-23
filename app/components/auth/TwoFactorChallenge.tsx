"use client";

import { useTranslations } from "next-intl";

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
  const t = useTranslations("Auth");
  const [backup, setBackup] = useState(false);
  const [lostPhone, setLostPhone] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [continuation, setContinuation] = useState<{ proof: Proof; password: string } | null>(null);
  const action = useAuthAction();
  if (continuation) return <EnrollmentScreen client={client} continuation={continuation} onComplete={onAuthenticated} onLogout={async () => { await client.logout(); onBack(); }} />;
  return <AuthFrame title={replacing ? t("challenge.replaceTitle") : t("challenge.title")} description={replacing ? t("challenge.replaceHelp") : t("challenge.help")}>
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
        {replacing && <AuthField name="password" label={t("currentPassword")} type="password" autoComplete="current-password" required />}
        <AuthField key={`${backup}-${replacing}`} name="code" label={replacing ? t("unusedBackupCode") : backup ? t("challenge.backupCode") : t("authenticatorCode")} inputMode={backup || replacing ? "text" : "numeric"} autoComplete="one-time-code" pattern={backup || replacing ? undefined : "[0-9]{6}"} required />
        <AuthError error={action.error} />
        <Button type="submit">{action.pending ? t("verifying") : replacing ? t("replaceAuthenticator") : t("challenge.verify")}</Button>
        {!replacing && <>
          <Button type="button" variant="outline" onClick={() => { setBackup(!backup); setLostPhone(false); action.setError(null); }}>{backup ? t("useAuthenticator") : t("challenge.useBackup")}</Button>
          <Button type="button" variant="ghost" onClick={() => { setBackup(true); setLostPhone(true); action.setError(null); }}>{t("challenge.lostPhone")}</Button>
          {lostPhone && <p className="text-sm">{t("challenge.lostHelp")}</p>}
        </>}
        <Button type="button" variant="ghost" onClick={onBack}>{t("backToLogin")}</Button>
      </fieldset>
    </form>
  </AuthFrame>;
}
