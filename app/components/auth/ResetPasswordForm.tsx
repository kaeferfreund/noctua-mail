"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { validatePassword } from "@/lib/i18n/authMessages";
import { Button } from "@/app/components/ui/button";
import { AuthClientError, authClient, type NoctuaAuthClient } from "@/lib/authClient";
import { AuthError, AuthField, AuthFrame, useAuthAction } from "./AuthPrimitives";

export default function ResetPasswordForm({ client = authClient }: { client?: NoctuaAuthClient }) {
  const t = useTranslations("Auth");
  const token = useRef<string | null>(null);
  const initialized = useRef(false);
  const lifetime = useRef(0);
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "success" | "uncertain">("loading");
  const action = useAuthAction();
  useEffect(() => {
    const generation = ++lifetime.current;
    // Read once, including React StrictMode's effect replay. Never put a capability
    // in a router prop, browser storage, diagnostic or subsequent history entry.
    if (!initialized.current) {
      initialized.current = true;
      const params = new URLSearchParams(window.location.search);
      token.current = params.get("token");
      const invalid = params.has("error") || !token.current;
      window.history.replaceState(null, "", "/reset-password");
      // URL capabilities must be captured after mount and before client navigation.
      setState(invalid ? "invalid" : "ready");
    }
    return () => { queueMicrotask(() => {
      // StrictMode immediately replays setup; a real unmount erases the token.
      // This ref is a lifetime counter, intentionally checked after effect replay.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (lifetime.current === generation) token.current = null;
    }); };
  }, []);
  return <AuthFrame title={state === "success" ? t("reset.changed") : t("reset.title")} description={t("reset.help")}>
    {state === "invalid" && <p role="alert">{t("reset.invalid")}</p>}
    {state === "success" && <p role="status">{t("reset.success")}</p>}
    {state === "uncertain" && <p role="alert">{t("reset.uncertain")}</p>}
    {state === "ready" && <form className="space-y-4" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
      const password = String(data.get("password")); const error = validatePassword(password, String(data.get("confirmation")));
      if (error) { action.setError(error); return; }
      void action.run(async () => {
        if (!token.current) { setState("invalid"); return; }
        try {
          await client.resetPassword(token.current, password);
          token.current = null; form.reset(); setState("success");
        } catch (failure) {
          form.reset();
          if (failure instanceof AuthClientError && failure.code === "INVALID_TOKEN") { token.current = null; setState("invalid"); }
          else if (!(failure instanceof AuthClientError) || failure.status >= 500) { token.current = null; setState("uncertain"); }
          else throw failure;
        }
      });
    }}>
      <AuthField name="password" label={t("newPassword")} type="password" autoComplete="new-password" minLength={10} maxLength={256} required disabled={action.disabled} />
      <AuthField name="confirmation" label={t("confirmPassword")} type="password" autoComplete="new-password" required disabled={action.disabled} />
      <AuthError error={action.error} />
      <Button disabled={action.disabled}>{action.pending ? t("reset.changing") : t("changePassword")}</Button>
    </form>}
    <Link href="/" prefetch={false} className="text-sm underline">{t("returnToLogin")}</Link>
  </AuthFrame>;
}
