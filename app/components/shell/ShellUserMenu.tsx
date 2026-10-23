"use client";

import { Braces, EllipsisVertical, Eraser, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import dynamic from "next/dynamic";
import LazyDialogLoading from "@/app/components/LazyDialogLoading";
import type { Account } from "@/lib/data";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/app/components/ui/sidebar";
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
  loading: () => <LazyDialogLoading label="Admin" />
});

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
  const { theme, setTheme } = useTheme();
  const identity = userEmail ?? "";
  const triggerLabel = userName?.trim() || identity.split("@")[0] || "Account";
  const initials = mailboxInitials({ name: triggerLabel, email: identity });

  return (
    <>
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label="User menu" title={identity || undefined}>
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
          <DropdownMenuContent side="right" align="end" className="min-w-56">
            <DropdownMenuLabel className="truncate">{identity || "Signed in"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onOpenSecurity}>
                <UserRound />
                Profile &amp; security
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!currentAccount} onSelect={onOpenSettings}>
                <Settings />
                Settings
              </DropdownMenuItem>
              {isAdminUser ? (
                <DropdownMenuItem onSelect={onOpenAdmin}>
                  <ShieldCheck />
                  Admin
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Developer tools</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onShowThreadJson}>
                <Braces />
                Show thread JSON
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEvictThreadCache}>
                <Eraser />
                Evict thread cache
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="md:hidden"><DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup><DropdownMenuSeparator />
            </div>
            <DropdownMenuItem onSelect={onLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
    </>
  );
}
