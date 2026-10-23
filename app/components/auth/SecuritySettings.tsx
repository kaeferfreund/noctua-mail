"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/i18n/format";

import { useCallback, useEffect, useRef, useState } from "react";
import { validatePassword, AuthUiError } from "@/lib/i18n/authMessages";
import { Button } from "@/app/components/ui/button";
import { AuthClientError, authClient, type NoctuaAuthClient, type Proof, type ProofPurpose, type SecurityInfo } from "@/lib/authClient";
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
  const t = useTranslations("Auth");
  const locale = useLocale();
  const dateTime = (value: number | string) => formatDate(new Date(value), locale, {hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
  const unauthorized = useRef(onUnauthorized);
  useEffect(() => { unauthorized.current = onUnauthorized; }, [onUnauthorized]);
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [continuation, setContinuation] = useState<{ proof: Proof; password: string } | null>(null);
  const [notice, setNotice] = useState<"passwordChanged" | "oldCodes" | "passkeyAdded" | "sessionsSignedOut" | null>(null);
  const action = useAuthAction(onUnauthorized);
  const reload = useCallback(() => client.security().then(next => {
    setInfo(next); setLoadError(null);
  }, error => {
    setLoadError(error);
    if (error instanceof AuthClientError && error.loggedOut) unauthorized.current();
  }), [client]);
  useEffect(() => { void reload(); }, [reload]);
  const start = (purpose: ProofPurpose, apply: Operation["apply"]) => {
    setNotice(null); action.setError(null); setOperation({ purpose, apply });
  };
  if (continuation) return <EnrollmentScreen client={client} continuation={continuation} onLogout={onUnauthorized} onComplete={async () => { setContinuation(null); await reload(); await onChanged?.(); }} />;
  return <section data-shell="" className="space-y-6 text-foreground" aria-label={t("security.title")}>
    <p className="text-sm text-muted-foreground">{t("security.help")}</p>
    <AuthError error={loadError ?? action.error} />
    {Boolean(loadError) && <Button variant="outline" onClick={() => { void reload(); }}>{t("security.retry")}</Button>}
    {notice && <p role="status">{t(`security.${notice}`)}</p>}
    {!info && !loadError && <p role="status">{t("security.loading")}</p>}
    {codes.length > 0 && <BackupCodes codes={codes} onDone={() => setCodes([])} />}
    {info && <>
      {(info.reauthRequired || info.mfaStateInconsistent) && <p role="alert">{t("security.reauthHelp")}</p>}
      <form className="space-y-3 rounded-lg border p-4" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        const password = String(data.get("newPassword")); const error = validatePassword(password, String(data.get("confirmation")));
        if (error) { action.setError(error); return; }
        start(info.hasPassword ? "password.change" : "password.set", async (grant, currentPassword) => {
          await client.changePassword({ newPassword: password, currentPassword }, grant); form.reset();
          setNotice("passwordChanged"); await onChanged?.();
        });
      }}>
        <h2 className="font-medium">{t("appPassword")}</h2>
        <AuthField name="newPassword" label={t("newPassword")} type="password" autoComplete="new-password" minLength={10} maxLength={256} required />
        <AuthField name="confirmation" label={t("confirmPassword")} type="password" autoComplete="new-password" required />
        <Button type="submit">{info.hasPassword ? t("changePassword") : t("security.setPassword")}</Button>
      </form>
      <section className="space-y-3 rounded-lg border p-4" aria-label={t("security.authenticator")}>
        <h2 className="font-medium">{t("security.authenticatorTitle")}</h2>
        <p>{t("security.authenticatorHelp")}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => start("totp.replace", async (grant, password) => {
            const proof = await client.replaceTotp(password, grant);
            if (onReplacement) onReplacement({ proof, password }); else setContinuation({ proof, password });
          })}>{t("replaceAuthenticator")}</Button>
          <Button variant="outline" onClick={() => start("backup.regenerate", async (grant, password) => {
            const result = await client.regenerateBackupCodes(password, grant); setCodes(result.backupCodes);
            setNotice("oldCodes");
          })}>{t("security.regenerate")}</Button>
        </div>
      </section>
      <section className="space-y-3 rounded-lg border p-4" aria-label={t("security.passkeys")}>
        <h2 className="font-medium">{t("security.passkeys")}</h2>
        {info.passkeys.length === 0 && <p>{t("security.noPasskeys")}</p>}
        {info.passkeys.map(key => <form key={key.id} className="space-y-2 border-b pb-3" onSubmit={event => {
          event.preventDefault(); const name = String(new FormData(event.currentTarget).get("name")).trim();
          if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) { action.setError(new AuthUiError("security.invalidPasskeyName")); return; }
          start("passkey.rename", async grant => { await client.renamePasskey(key.id, name, grant); });
        }}>
          <AuthField name="name" label={t("security.passkeyName", {name: key.name || t("security.unnamed")})} defaultValue={key.name ?? ""} required maxLength={100} autoComplete="off" />
          <p className="text-xs text-muted-foreground">{key.deviceType} · {key.backedUp ? t("security.backedUp") : t("security.deviceOnly")}</p>
          <div className="flex gap-2"><Button variant="outline" type="submit">{t("security.renamePasskey")}</Button>
            <Button variant="outline" type="button" onClick={() => start("passkey.remove", async grant => { await client.removePasskey(key.id, grant); })}>{t("security.removePasskey")}</Button></div>
        </form>)}
        <form className="space-y-2" onSubmit={event => {
          event.preventDefault(); const form = event.currentTarget; const name = String(new FormData(form).get("name")).trim();
          if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) { action.setError(new AuthUiError("security.enterPasskeyName")); return; }
          start("passkey.enroll", async grant => { await client.addPasskey(name, grant); form.reset(); setNotice("passkeyAdded"); });
        }}>
          <AuthField name="name" label={t("security.newPasskeyName")} required maxLength={100} autoComplete="off" />
          <Button type="submit">{t("security.addPasskey")}</Button>
        </form>
      </section>
      <section className="space-y-3 rounded-lg border p-4" aria-label={t("security.sessions")}>
        <h2 className="font-medium">{t("security.sessions")}</h2>
        <ul className="space-y-3">{info.sessions.map(session => <li key={session.id} className="space-y-1">
          <p>{session.current ? t("security.currentSession") : t("security.otherSession")} · {session.userAgent || t("security.unknownDevice")}</p>
          <p className="text-xs text-muted-foreground">{t("security.lastActive", {time: dateTime(session.updatedAt)})}{session.ip ? ` · ${session.ip}` : ""}</p>
          <Button variant="outline" onClick={() => start("sessions.revoke", async grant => {
            await client.revokeSessions({ sessionId: session.id }, grant);
            if (session.current) onUnauthorized();
          })}>{session.current ? t("security.signOutSession") : t("security.revokeSession")}</Button>
        </li>)}</ul>
        <Button variant="outline" onClick={() => start("sessions.revoke", async grant => { await client.revokeSessions({ all: true }, grant); setNotice("sessionsSignedOut"); })}>{t("security.signOutOthers")}</Button>
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
