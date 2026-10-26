"use client";

import { useTranslations } from "next-intl";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { authClient, type NoctuaAuthClient, type Proof, type TotpSetup } from "@/lib/authClient";
import { AuthError, AuthField, AuthFrame, BackupCodes, useAuthAction } from "./AuthPrimitives";
import { QrCode } from "@/app/components/ui/qr-code";
import ReauthDialog from "./ReauthDialog";

export default function EnrollmentScreen({ onComplete, onLogout, client = authClient, continuation }: {
  onComplete: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  client?: NoctuaAuthClient;
  continuation?: { proof: Proof; password: string };
}) {
  const t = useTranslations("Auth");
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [proof, setProof] = useState<Proof | null>(continuation?.proof ?? null);
  const [verified, setVerified] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addingKey, setAddingKey] = useState(false);
  const action = useAuthAction(onLogout);
  const begin = async (nextProof: Proof, password: string) => {
    setSetup(null); setVerified(false); setSaved(false);
    const nextSetup = await client.enableTotp(password, nextProof);
    setProof(nextProof); setSetup(nextSetup);
  };
  const secret = setup && !verified ? new URL(setup.totpURI).searchParams.get("secret") : null;
  return <AuthFrame title={saved ? t("enroll.ready") : verified ? t("enroll.saveCodes") : t("enroll.title")} description={t("enroll.help")}>
    {!setup && !saved && <form className="space-y-4" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const password = String(new FormData(form).get("password"));
      void action.run(async () => {
        const nextProof = proof ?? await client.reauth({ purpose: "totp.enroll", currentPassword: password });
        // Failed downstream attempts spend proof; a reload always obtains fresh proof.
        setProof(null);
        await begin(nextProof, password); form.reset();
      });
    }}>
      <p>{t("enroll.restartHelp")}</p>
      <AuthField name="password" label={t("currentPassword")} type="password" autoComplete="current-password" required />
      <Button disabled={action.disabled}>{t("enroll.start")}</Button>
    </form>}
    {setup && !verified && <form className="space-y-4" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const code = String(new FormData(form).get("code"));
      void action.run(async () => {
        if (!proof) return;
        await client.verifyTotp(code, proof); setProof(null); setVerified(true); setSetup({ ...setup, totpURI: "" }); form.reset();
      });
    }}>
      <p>{t("enroll.scanHelp")}</p>
      <QrCode value={setup.totpURI} label={t("enroll.qrAlt")} className="size-60" />
      <AuthField label={t("enroll.secret")} value={secret ?? ""} readOnly autoComplete="off" />
      <AuthField name="code" label={t("authenticatorCode")} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />
      <Button disabled={action.disabled}>{t("enroll.verify")}</Button>
      <Button type="button" variant="ghost" disabled={action.disabled} onClick={() => { setSetup(null); setProof(null); }}>{t("enroll.restart")}</Button>
    </form>}
    {setup && verified && !saved && <BackupCodes codes={setup.backupCodes} onDone={() => { setSetup(null); setSaved(true); }} />}
    {saved && <div className="space-y-3">
      <p>{t("enroll.passkeyHelp")}</p>
      <Button variant="outline" onClick={() => setAddingKey(true)}>{t("enroll.addPasskey")}</Button>
      <Button disabled={action.disabled} onClick={() => { void action.run(async () => { await onComplete(); }); }}>{t("enroll.continue")}</Button>
    </div>}
    <AuthError error={action.error} />
    <Button variant="ghost" disabled={action.disabled} onClick={() => { void action.run(async () => { await onLogout(); }); }}>{t("logout")}</Button>
    {addingKey && <ReauthDialog purpose="passkey.enroll" client={client} onUnauthorized={onLogout} onCancel={() => setAddingKey(false)} onVerified={async grant => {
      await client.addPasskey(t("enroll.defaultPasskeyName"), grant); setAddingKey(false);
    }} />}
  </AuthFrame>;
}
