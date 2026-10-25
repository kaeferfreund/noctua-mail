"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/app/components/ui/dialog";
import { QrCode } from "@/app/components/ui/qr-code";
import { inviteSignupUrl, isWebUrl } from "@/lib/inviteLink";

export type AdminSecret = { kind: "recovery" | "invite"; value: string };

/** Shows a one-time secret (invite code or recovery link) once, with a QR code for a phone. */
export default function AdminSecretDialog({ secret, onClose }: { secret: AdminSecret; onClose: () => void }) {
  const t = useTranslations("Admin");
  const [copied, setCopied] = useState<"copied" | "copyFailed" | null>(null);
  // The sign-up link is built from the origin the admin is using, never from configuration.
  const qrValue = secret.kind === "invite" ? inviteSignupUrl(window.location.origin, secret.value) : isWebUrl(secret.value) ? secret.value : null;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent aria-describedby={undefined} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <DialogTitle>{t(`secret.${secret.kind}`)}</DialogTitle>
      <DialogDescription>{t("secret.help")}</DialogDescription>
      <code className="block rounded-md bg-muted px-3 py-2 font-mono text-base break-all text-foreground select-all">{secret.value}</code>
      {qrValue && <figure className="grid justify-items-center gap-2">
        <QrCode value={qrValue} label={t("secret.qrLabel")} className="size-56 rounded-md" />
        <figcaption className="text-center text-muted-foreground">{t(`secret.qrHelp.${secret.kind}`)}</figcaption>
      </figure>}
      <Button onClick={() => { void navigator.clipboard.writeText(secret.value).then(() => setCopied("copied")).catch(() => setCopied("copyFailed")); }}>{t("secret.copy")}</Button>
      {copied && <p role="status">{t(`secret.${copied}`)}</p>}
      <Button variant="outline" onClick={onClose}>{t("secret.done")}</Button>
    </DialogContent>
  </Dialog>;
}
