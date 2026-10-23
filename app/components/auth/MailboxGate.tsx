"use client";

import { useTranslations } from "next-intl";

import type { Account } from "@/lib/data";
import type { MailboxState } from "@/lib/authClient";
import { Button } from "@/app/components/ui/button";
import { AuthError, AuthFrame } from "./AuthPrimitives";

export default function MailboxGate({ state, accounts, error, onAdd, onSwitch, onRetry, onSecurity, onAdmin, onLogout }: {
  state: MailboxState | null;
  accounts: Account[];
  error?: string | null;
  onAdd?: () => void;
  onSwitch: (id: string) => void;
  onRetry: () => void;
  onSecurity: () => void;
  onAdmin?: () => void;
  onLogout: () => void;
}) {
  const t = useTranslations("Auth");
  return <AuthFrame authenticated title={state === "none" ? t("gate.none") : state === "unselected" ? t("gate.choose") : t("gate.loading")}>
    {state === "none" && (onAdd ? <><p>{t("gate.createHelp")}</p><Button onClick={onAdd}>{t("gate.add")}</Button></> : <p>{t("gate.askAdmin")}</p>)}
    {state === "unselected" && <ul className="space-y-2">{accounts.map(account => <li key={account.id}><Button variant="outline" onClick={() => onSwitch(account.id)}>{account.name || account.email} · {account.email}</Button></li>)}</ul>}
    <AuthError error={error} />
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={onRetry}>{t("retry")}</Button>
      {state && <><Button variant="outline" onClick={onSecurity}>{t("security.title")}</Button>{onAdmin && <Button variant="outline" onClick={onAdmin}>{t("admin")}</Button>}<Button variant="ghost" onClick={onLogout}>{t("logout")}</Button></>}
    </div>
  </AuthFrame>;
}
