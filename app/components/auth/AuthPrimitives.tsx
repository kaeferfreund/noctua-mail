"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { formatAuthError } from "@/lib/i18n/authMessages";
import LanguageSelector from "@/app/components/i18n/LanguageSelector";
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { AuthClientError } from "@/lib/authClient";

export function AuthFrame({ title, description, children, authenticated = false }: { title: string; description?: string; children: ReactNode; authenticated?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [title]);
  return <div data-shell="" className="flex min-h-(--app-height) items-center justify-center bg-muted/40 pt-[calc(1rem+var(--sat))] pr-[calc(1rem+var(--sar))] pb-[calc(1rem+var(--sab))] pl-[calc(1rem+var(--sal))] text-foreground">
    <Card className="w-full max-w-sm">
      <CardHeader>
        <h1 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{title}</h1>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}<LanguageSelector authenticated={authenticated} /></CardContent>
    </Card>
  </div>;
}
export function AuthField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} {...props} /></div>;
}
export function AuthError({ error, genericLogin = false }: { error: unknown; genericLogin?: boolean }) {
  const t = useTranslations("Auth");
  if (!error) return null;
  return <Alert variant="destructive"><AlertDescription>{formatAuthError(error, t, genericLogin)}
    {error instanceof AuthClientError && error.loggedOut && <p><Link href="/" prefetch={false} className="underline">{t("returnToLogin")}</Link></p>}
  </AlertDescription></Alert>;
}
export function useAuthAction(onUnauthorized?: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const busy = useRef(false);
  const retryAt = useRef(0);
  const [rateLimited, setRateLimited] = useState(false);
  useEffect(() => {
    if (!rateLimited) return;
    const timer = window.setTimeout(() => { retryAt.current = 0; setRateLimited(false); }, Math.max(0, retryAt.current - Date.now()));
    return () => window.clearTimeout(timer);
  }, [rateLimited]);
  const run = async (action: () => Promise<void>) => {
    if (busy.current || retryAt.current > Date.now()) return;
    busy.current = true; setPending(true); setError(null);
    try { await action(); } catch (failure) {
      setError(failure);
      if (failure instanceof AuthClientError && failure.status === 429) {
        retryAt.current = Date.now() + (failure.retryAfter || 60) * 1000; setRateLimited(true);
      }
      if (failure instanceof AuthClientError && failure.loggedOut) onUnauthorized?.();
    } finally { busy.current = false; setPending(false); }
  };
  return { pending, disabled: pending || rateLimited, error, setError, run };
}
export function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations("Auth");
  const [notice, setNotice] = useState<"copied" | "copyFailed" | null>(null);
  return <section className="space-y-3" aria-label={t("backup.title")}>
    <p>{t("backup.help")}</p>
    <ul className="grid grid-cols-2 gap-2 rounded-lg border p-3 font-mono text-sm">{codes.map(code => <li key={code}>{code}</li>)}</ul>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={async () => {
        try { await navigator.clipboard.writeText(codes.join("\n")); setNotice("copied"); }
        catch { setNotice("copyFailed"); }
      }}>{t("backup.copy")}</Button>
      <Button variant="outline" onClick={() => {
        const url = URL.createObjectURL(new Blob([codes.join("\n")], { type: "text/plain" }));
        const link = document.createElement("a"); link.href = url; link.download = "noctua-backup-codes.txt"; link.click();
        URL.revokeObjectURL(url);
      }}>{t("backup.download")}</Button>
    </div>
    <p role="status">{notice ? t(`backup.${notice}`) : null}</p>
    <Button onClick={onDone}>{t("backup.saved")}</Button>
  </section>;
}
