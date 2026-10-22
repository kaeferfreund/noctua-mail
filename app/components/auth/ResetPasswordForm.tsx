"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { AuthClientError, authClient, validateNewPassword, type NoctuaAuthClient } from "@/lib/authClient";
import { AuthError, AuthField, AuthFrame, useAuthAction } from "./AuthPrimitives";

export default function ResetPasswordForm({ client = authClient }: { client?: NoctuaAuthClient }) {
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
  return <AuthFrame title={state === "success" ? "Password changed" : "Reset your password"} description="Reset links are handed over personally and expire after 15 minutes.">
    {state === "invalid" && <p role="alert">This reset link is missing, expired or already used. Ask your admin for a new link.</p>}
    {state === "success" && <p role="status">Your password has changed. Sign in with your new password and existing authenticator.</p>}
    {state === "uncertain" && <p role="alert">The reset could not be confirmed. Your new password may already be active. Try signing in or ask your admin for a new link.</p>}
    {state === "ready" && <form className="space-y-4" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
      const password = String(data.get("password")); const error = validateNewPassword(password, String(data.get("confirmation")));
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
      <AuthField name="password" label="New password" type="password" autoComplete="new-password" minLength={10} maxLength={256} required disabled={action.disabled} />
      <AuthField name="confirmation" label="Confirm new password" type="password" autoComplete="new-password" required disabled={action.disabled} />
      <AuthError error={action.error} />
      <Button disabled={action.disabled}>{action.pending ? "Changing password…" : "Change password"}</Button>
    </form>}
    <Link href="/" prefetch={false} className="text-sm underline">Return to sign in</Link>
  </AuthFrame>;
}
