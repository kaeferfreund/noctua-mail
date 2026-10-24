"use client";

import { useTranslations } from "next-intl";

import { Braces, EllipsisVertical, Eraser, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import dynamic from "next/dynamic";
import LazyDialogLoading from "@/app/components/LazyDialogLoading";
import type { Account } from "@/lib/data";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/app/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/app/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/app/components/ui/dropdown-menu";
import { mailboxInitials } from "./types";

const AdminPanel = dynamic(() => import("@/app/components/admin/AdminPanel"), {
  ssr: false,
  loading: () => <LazyDialogLoading kind="admin" />
});

/** Menu rows reach the 44px touch target on phones; desktop keeps the compact menu. */
const PHONE_ROW = "max-md:min-h-11";

export type ShellUserMenuProps = {
  /** E-mail of the signed-in user; null until /api/auth/me has answered. */
  userEmail: string | null;
  userName?: string | null;
  currentAccount: Account | null;
  isAdminUser: boolean;
  onOpenSettings: () => void;
  onOpenSecurity?: () => void;
  /** Open the mailbox-independent Admin panel owned by MailClient. */
  onOpenAdmin: () => void;
  onShowThreadJson: () => void;
  onEvictThreadCache: () => void;
  onLogout: () => void;
};

export default function ShellUserMenu({
  userEmail,
  userName,
  currentAccount,
  isAdminUser,
  onOpenSettings,
  onOpenSecurity,
  onOpenAdmin,
  onShowThreadJson,
  onEvictThreadCache,
  onLogout
}: ShellUserMenuProps) {
  const t = useTranslations("Shell");
  const { theme, setTheme } = useTheme();
  // On phones the trigger sits in the drawer footer with no room to its right:
  // the menu opens above it, right-aligned and kept 16px inside the viewport.
  const { isMobile } = useSidebar();
  const identity = userEmail ?? "";
  const triggerLabel = userName?.trim() || identity.split("@")[0] || t("account");
  const initials = mailboxInitials({ name: triggerLabel, email: identity });

  return (
    <>
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label={t("userMenu")} title={identity || undefined}>
              <Avatar size="sm">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{triggerLabel}</span>
                <span className="truncate text-xs text-muted-foreground">{identity}</span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" collisionPadding={isMobile ? 16 : undefined}
            data-phone={isMobile || undefined} className="min-w-56 max-md:max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel className="truncate">{identity || t("signedIn")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className={PHONE_ROW} onSelect={onOpenSecurity}>
                <UserRound />
                {t("security")}
              </DropdownMenuItem>
              <DropdownMenuItem className={PHONE_ROW} disabled={!currentAccount} onSelect={onOpenSettings}>
                <Settings />
                {t("settings")}</DropdownMenuItem>
              {isAdminUser ? (
                <DropdownMenuItem className={PHONE_ROW} onSelect={onOpenAdmin}>
                  <ShieldCheck />
                  {t("admin")}</DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("developer.title")}</DropdownMenuLabel>
              <DropdownMenuItem className={PHONE_ROW} onSelect={onShowThreadJson}>
                <Braces />
                {t("developer.threadJson")}</DropdownMenuItem>
              <DropdownMenuItem className={PHONE_ROW} onSelect={onEvictThreadCache}>
                <Eraser />
                {t("developer.evictCache")}</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="md:hidden"><DropdownMenuLabel>{t("theme.label")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                <DropdownMenuRadioItem className={PHONE_ROW} value="light">{t("theme.light")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem className={PHONE_ROW} value="dark">{t("theme.dark")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem className={PHONE_ROW} value="system">{t("theme.system")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup><DropdownMenuSeparator />
            </div>
            <DropdownMenuItem className={PHONE_ROW} onSelect={onLogout}>
              <LogOut />
              {t("logout")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
    </>
  );
}
