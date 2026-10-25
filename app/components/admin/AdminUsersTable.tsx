"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Crown, Fingerprint, KeyRound, MoreHorizontal, ShieldCheck, type LucideIcon } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { nativeControlBaseClass } from "@/app/components/account-settings/Field";
import tableStyles from "@/app/components/account-settings/SettingsTable.module.css";
import StatusBadge from "@/app/components/account-settings/StatusBadge";
import type { AdminUser } from "./types";

export type UserActionType = "role" | "status" | "delete" | "recovery" | "mfa-reset" | "sessions" | "passkey";
type Props = { users: AdminUser[]; busy: boolean; onAction: (user: AdminUser, type: UserActionType, role?: "admin" | "user") => void };

/** Mailbox lists longer than this collapse behind a "+n more" toggle, so a row stays a few lines tall. */
const MAILBOX_PREVIEW = 4;

function securityValue(value: boolean | undefined) { return value === undefined ? "users.unknown" : value ? "users.yes" : "users.no"; }

/** A small sign-in factor badge: icon and short name; a missing factor is outlined (and struck through unless the text is a count). The full wording is for screen readers and on hover. */
function SecurityBadge({ icon: Icon, text, label, active, count = false }: { icon: LucideIcon; text: string; label: string; active: boolean; count?: boolean }) {
  return <Badge variant={active ? "secondary" : "outline"} title={label} className={active ? "font-normal" : "font-normal text-muted-foreground"}>
    <Icon aria-hidden="true" /><span aria-hidden="true" className={active || count ? undefined : "line-through"}>{text}</span><span className="sr-only">{label}</span>
  </Badge>;
}

function UserMailboxes({ accounts }: { accounts: NonNullable<AdminUser["accounts"]> }) {
  const t = useTranslations("Admin");
  const [expanded, setExpanded] = useState(false);
  if (!accounts.length) return <span className="text-muted-foreground">—</span>;
  const collapsible = accounts.length > MAILBOX_PREVIEW;
  const shown = collapsible && !expanded ? accounts.slice(0, MAILBOX_PREVIEW - 1) : accounts;
  return <div className="grid w-64 gap-1 text-xs">
    <ul className="m-0 grid list-none gap-1 p-0">{shown.map(account => <li key={account.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5">
      <span className="min-w-0 truncate" title={account.name ? `${account.name} <${account.email}>` : account.email}>
        <span data-user-text>{account.email}</span>{account.name && <span data-user-text className="text-muted-foreground"> · {account.name}</span>}
      </span>
      <Badge variant="outline" className="h-4 px-1.5 text-[11px] font-normal text-muted-foreground" title={t("role")}>{t(`roles.${account.role}`)}</Badge>
      {account.isOwner === true ? <span className="inline-flex" title={t("owner")}><Crown aria-hidden="true" className="size-3.5 text-amber-600 dark:text-amber-400" /><span className="sr-only">{t("owner")}</span></span> : <span />}
    </li>)}</ul>
    {collapsible && <Button variant="link" size="xs" className="h-auto justify-self-start p-0" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? t("users.fewerMailboxes") : t("users.moreMailboxes", {count: accounts.length - shown.length})}
    </Button>}
  </div>;
}

/** Admin user list: identity and status, role, sign-in factors, mailboxes; two common actions and a menu for the rare and sensitive ones. */
export default function AdminUsersTable({ users, busy, onAction }: Props) {
  const t = useTranslations("Admin");
  return <div data-admin-users-table className={`${tableStyles.tableScroll} ${tableStyles.stickyFirst}`}>
    <table>
      <thead><tr><th>{t("users.nameEmail")}</th><th>{t("role")}</th><th>{t("users.security")}</th><th>{t("tabs.mailboxes")}</th><th>{t("actions")}</th></tr></thead>
      <tbody>{users.map(user => {
        const passkeys = user.passkeyCount ?? user.passkeys?.length;
        return <tr key={user.id}>
          <td data-align="top" className="max-w-56"><div className={tableStyles.primary} data-user-text>{user.name || "—"}</div><div className={tableStyles.secondary} data-user-text>{user.email}</div>
            <div className="mt-1.5"><StatusBadge enabled={user.disabled === false}>{user.disabled ? t("users.disabled") : user.disabled === false ? t("users.enabled") : t("users.unknown")}</StatusBadge></div></td>
          <td data-align="top"><select className={nativeControlBaseClass} aria-label={t("users.roleFor", {email: user.email})} value={user.role} disabled={busy} onChange={event => onAction(user, "role", event.target.value as "admin" | "user")}><option value="user">{t("roles.user")}</option><option value="admin">{t("roles.admin")}</option></select></td>
          <td data-align="top"><div className="flex max-w-32 flex-wrap gap-1">
            <SecurityBadge icon={KeyRound} active={user.hasPassword === true} text={t("users.passwordShort")} label={t("users.password", {value: t(securityValue(user.hasPassword))})} />
            <SecurityBadge icon={ShieldCheck} active={user.twoFactorEnabled === true} text={t("users.totpShort")} label={t("users.totp", {value: t(securityValue(user.twoFactorEnabled))})} />
            <SecurityBadge icon={Fingerprint} count active={Boolean(passkeys)} text={passkeys === undefined ? t("users.passkey") : t("users.passkeysShort", {count: passkeys})} label={t("users.passkeys", {value: passkeys ?? t("users.unknown")})} />
          </div></td>
          <td data-align="top"><UserMailboxes accounts={user.accounts ?? []} /></td>
          {/* Two stacked actions with the menu beside the first; DOM order stays status, sessions, menu. */}
          <td data-align="top"><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction(user, "status")}>{user.disabled ? t("users.enable") : t("users.disable")}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction(user, "sessions")}>{t("actionTitles.sessions")}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" className="col-start-2 row-start-1" disabled={busy} aria-label={t("users.moreActions", {email: user.email})} title={t("users.moreActions", {email: user.email})}><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-48">
                <DropdownMenuItem onSelect={() => onAction(user, "recovery")}>{t("users.recovery")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onAction(user, "mfa-reset")}>{t("actionTitles.mfa-reset")}</DropdownMenuItem>
                <DropdownMenuItem disabled={!user.passkeys?.length} onSelect={() => onAction(user, "passkey")}>{t("actionTitles.passkey")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onAction(user, "delete")}>{t("actionTitles.delete")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
