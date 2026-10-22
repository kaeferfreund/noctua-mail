"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { authClient, isPasskeyCancellation, validateNewPassword, type NoctuaAuthClient } from "@/lib/authClient";
import { AuthError, AuthField, AuthFrame, useAuthAction } from "./AuthPrimitives";
import TwoFactorChallenge from "./TwoFactorChallenge";

export default function LoginScreen({ onAuthenticated, client = authClient }: {
  onAuthenticated: () => void | Promise<void>;
  client?: NoctuaAuthClient;
}) {
  const [screen, setScreen] = useState<"login" | "signup" | "challenge">("login");
  const [imapAvailable, setImapAvailable] = useState(false);
  const [method, setMethod] = useState<"password" | "imap">("password");
  const [notice, setNotice] = useState("");
  const action = useAuthAction();
  const conditional = useRef<AbortController | null>(null);
  const cancelConditional = async () => {
    conditional.current?.abort(); conditional.current = null; await client.cancelPasskey();
  };
  useEffect(() => {
    let active = true;
    void client.methods().then(data => { if (active) setImapAvailable(data.methods.imap); }).catch(() => { /* optional method remains hidden */ });
    return () => { active = false; };
  }, [client]);
  useEffect(() => {
    if (screen !== "login") return;
    const controller = new AbortController(); conditional.current = controller;
    void (async () => {
      try {
        if (!await client.conditionalAvailable() || controller.signal.aborted) return;
        const result = await client.passkeySignIn({ autoFill: true, signal: controller.signal });
        if (controller.signal.aborted) return;
        if ("twoFactorRedirect" in result && result.twoFactorRedirect) setScreen("challenge");
        else await onAuthenticated();
      } catch { /* Conditional mediation is optional. Explicit form reports errors. */ }
    })();
    return () => { controller.abort(); void client.cancelPasskey(); };
  }, [client, onAuthenticated, screen]);

  if (screen === "challenge") return <TwoFactorChallenge client={client} onAuthenticated={onAuthenticated} onBack={() => { setScreen("login"); action.setError(null); }} />;
  const signup = screen === "signup";
  return <AuthFrame title={signup ? "Create your account" : "Sign in to Noctua"} description={signup ? "Use the invite your admin gave you. Choose a separate app password." : "Your personal identity gives you access to your mailboxes."}>
    {notice && <p role="status">{notice}</p>}
    <form className="space-y-4" key={screen + method} onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
      const password = String(data.get("password"));
      if (signup) {
        const error = validateNewPassword(password, String(data.get("confirmation")));
        if (error) { action.setError(error); return; }
      }
      void action.run(async () => {
        await cancelConditional();
        if (signup) {
          const result = await client.signup({ inviteCode: String(data.get("inviteCode")).trim(), email: String(data.get("email")).trim(), name: String(data.get("name")).trim(), password });
          form.reset();
          if (result.loginRequired) { setNotice("Your account was created. Sign in to set up your authenticator."); setScreen("login"); }
          else await onAuthenticated();
        } else {
          const result = await client.signIn(String(data.get("email")).trim(), password, method);
          form.reset();
          if (result.twoFactorRedirect) setScreen("challenge"); else await onAuthenticated();
        }
      });
    }}>
      <fieldset disabled={action.disabled} className="space-y-4">
        {signup && <AuthField name="inviteCode" label="Invite code" autoComplete="off" required />}
        <AuthField name="email" label="Email" type="email" autoComplete={signup ? "email" : "username webauthn"} maxLength={320} required />
        {signup && <AuthField name="name" label="Name" autoComplete="name" maxLength={256} required />}
        <AuthField name="password" label={signup || method === "password" ? "App password" : "Personal mailbox password"} type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 10 : undefined} maxLength={signup ? 256 : undefined} required />
        {signup && <AuthField name="confirmation" label="Confirm app password" type="password" autoComplete="new-password" required />}
        <AuthError error={action.error} genericLogin={!signup} />
        <Button type="submit" className="w-full">{action.pending ? "Working…" : signup ? "Create account" : "Sign in"}</Button>
        {!signup && <>
          <Button type="button" variant="outline" className="w-full" onClick={() => { void action.run(async () => {
            await cancelConditional();
            try {
              const result = await client.passkeySignIn();
              if ("twoFactorRedirect" in result && result.twoFactorRedirect) setScreen("challenge"); else await onAuthenticated();
            } catch (error) { if (!isPasskeyCancellation(error)) throw error; }
          }); }}>Sign in with a passkey</Button>
          {imapAvailable && <Button type="button" variant="ghost" onClick={() => { setMethod(method === "password" ? "imap" : "password"); action.setError(null); }}>{method === "password" ? "Use my personal mailbox password" : "Use my app password"}</Button>}
        </>}
        <Button type="button" variant="link" onClick={() => { void cancelConditional(); setScreen(signup ? "login" : "signup"); action.setError(null); }}>{signup ? "Back to sign in" : "Sign up with an invite code"}</Button>
      </fieldset>
    </form>
  </AuthFrame>;
}
