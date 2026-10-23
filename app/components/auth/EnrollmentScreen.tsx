"use client";

import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { authClient, type NoctuaAuthClient, type Proof, type TotpSetup } from "@/lib/authClient";
import { AuthError, AuthField, AuthFrame, BackupCodes, useAuthAction } from "./AuthPrimitives";
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
  const [qr, setQr] = useState("");
  const [addingKey, setAddingKey] = useState(false);
  const action = useAuthAction(onLogout);
  const begin = async (nextProof: Proof, password: string) => {
    setSetup(null); setVerified(false); setSaved(false); setQr("");
    const nextSetup = await client.enableTotp(password, nextProof);
    setProof(nextProof); setSetup(nextSetup);
  };
  useEffect(() => {
    if (!setup?.totpURI || verified) return;
    let active = true;
    void import("qrcode").then(qrcode => qrcode.toDataURL(setup.totpURI, { margin: 4, width: 240 })).then(url => { if (active) setQr(url); }).catch(() => { /* Manual secret remains available. */ });
    return () => { active = false; };
  }, [setup?.totpURI, verified]);
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
        await client.verifyTotp(code, proof); setProof(null); setVerified(true); setQr(""); setSetup({ ...setup, totpURI: "" }); form.reset();
      });
    }}>
      <p>{t("enroll.scanHelp")}</p>
      {/* A local data URL keeps the seed off third-party image/QR services. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- private local QR data URL */}
      {qr && <img src={qr} alt={t("enroll.qrAlt")} width={240} height={240} />}
      <AuthField label={t("enroll.secret")} value={secret ?? ""} readOnly autoComplete="off" />
      <AuthField name="code" label={t("authenticatorCode")} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />
      <Button disabled={action.disabled}>{t("enroll.verify")}</Button>
      <Button type="button" variant="ghost" disabled={action.disabled} onClick={() => { setSetup(null); setProof(null); setQr(""); }}>{t("enroll.restart")}</Button>
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
