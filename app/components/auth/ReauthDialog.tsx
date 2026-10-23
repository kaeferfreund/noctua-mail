"use client";

import { useTranslations } from "next-intl";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { AuthClientError, authClient, type NoctuaAuthClient, type Proof, type ProofPurpose } from "@/lib/authClient";
import { AuthUiError } from "@/lib/i18n/authMessages";
import { AuthError, AuthField, useAuthAction } from "./AuthPrimitives";

type Props = {
  purpose: ProofPurpose;
  onCancel: () => void;
  onVerified: (proof: Proof, password: string) => Promise<void>;
  onUnauthorized?: () => void;
  client?: NoctuaAuthClient;
};
export default function ReauthDialog({ purpose, onCancel, onVerified, onUnauthorized, client = authClient }: Props) {
  const t = useTranslations("Auth");
  const [mode, setMode] = useState<"totp" | "passkey" | "backup">("totp");
  const action = useAuthAction(onUnauthorized);
  const passwordRequired = mode !== "passkey" || !["passkey.enroll", "passkey.remove", "passkey.rename"].includes(purpose);
  const enrolling = purpose === "totp.enroll";
  return <Dialog open onOpenChange={open => { if (!open && !action.pending) onCancel(); }}>
    <DialogContent data-shell="" className="max-h-[90dvh] overflow-y-auto" showCloseButton={!action.pending}>
      <DialogHeader><DialogTitle>{t("reauth.title")}</DialogTitle><DialogDescription>{t("reauth.help")}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        const password = String(data.get("currentPassword") ?? "");
        void action.run(async () => {
          let proof = await client.reauth({ purpose, ...(password ? { currentPassword: password } : {}),
            ...(!enrolling && mode === "totp" ? { totpCode: String(data.get("code")) } : {}),
            ...(mode === "backup" ? { backupCode: String(data.get("code")) } : {}),
            ...(mode === "passkey" ? { proofMode: "passkey" as const } : {}) });
          if (proof.ceremonyRequired) proof = await client.passkeySignIn({ proof }) as Proof;
          // Never spend a ceremony intent as an operation grant.
          if (!proof.grant || proof.purpose !== purpose || proof.ceremonyRequired) throw new AuthUiError("reauth.incomplete");
          form.reset();
          await onVerified(proof, password);
        });
      }}>
        <fieldset disabled={action.disabled} className="space-y-4">
          {passwordRequired && <AuthField name="currentPassword" label={t("currentPassword")} type="password" autoComplete="current-password" required />}
          {!enrolling && mode !== "passkey" && <AuthField key={mode} name="code" label={mode === "backup" ? t("unusedBackupCode") : t("authenticatorCode")} inputMode={mode === "totp" ? "numeric" : "text"} autoComplete="one-time-code" pattern={mode === "totp" ? "[0-9]{6}" : undefined} required />}
          {!enrolling && <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setMode(mode === "passkey" ? "totp" : "passkey")}>{mode === "passkey" ? t("useAuthenticator") : t("reauth.passkey")}</Button>
            {purpose === "totp.replace" && <Button type="button" variant="outline" onClick={() => setMode("backup")}>{t("reauth.unusedCode")}</Button>}
          </div>}
          {mode === "backup" && <p className="text-sm text-muted-foreground">{t("reauth.backupHelp")}</p>}
          <AuthError error={action.error} />
          {action.error instanceof AuthClientError && action.error.code === "SESSION_NOT_FRESH" && <Button type="button" variant="outline" onClick={() => { void action.run(async () => { await client.logout(); onUnauthorized?.(); }); }}>{t("reauth.loginAgain")}</Button>}
          <Button type="submit">{action.pending ? t("verifying") : t("reauth.continue")}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>{t("cancel")}</Button>
        </fieldset>
      </form>
    </DialogContent>
  </Dialog>;
}
