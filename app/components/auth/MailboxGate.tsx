"use client";

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
  return <AuthFrame authenticated title={state === "none" ? "No mailbox yet" : state === "unselected" ? "Choose a mailbox" : "Loading your account"}>
    {state === "none" && (onAdd ? <><p>Create a mailbox, then grant its members access in Admin.</p><Button onClick={onAdd}>Add a mailbox</Button></> : <p>Ask your admin to give you access to a mailbox.</p>)}
    {state === "unselected" && <ul className="space-y-2">{accounts.map(account => <li key={account.id}><Button variant="outline" onClick={() => onSwitch(account.id)}>{account.name || account.email} · {account.email}</Button></li>)}</ul>}
    <AuthError error={error} />
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={onRetry}>Retry</Button>
      {state && <><Button variant="outline" onClick={onSecurity}>Profile &amp; security</Button>{onAdmin && <Button variant="outline" onClick={onAdmin}>Admin</Button>}<Button variant="ghost" onClick={onLogout}>Log out</Button></>}
    </div>
  </AuthFrame>;
}
