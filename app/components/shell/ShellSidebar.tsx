"use client";

import { useState } from "react";
import { FileText, Plus, RefreshCw, SquarePen } from "lucide-react";
import { Theme } from "@radix-ui/themes";
import type { Topic } from "@/lib/data";
import { DEFAULT_APP_TITLE } from "@/lib/appBranding";
import { Button } from "@/app/components/ui/button";
import ShellUserMenu, { type ShellUserMenuProps } from "./ShellUserMenu";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import {
  Sidebar,
  useSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/app/components/ui/sidebar";
import FolderSidebarPane, {
  type FolderSidebarPaneProps
} from "@/app/components/mailclient/folder/FolderSidebarPane";
import TopicsSidebarSection from "@/app/components/mailclient/folder/TopicsSidebarSection";
import { groupMailboxes, mailboxInitials, mailboxLabel, partitionMailboxes, type ShellAccount, type ShellView, type ShellViews } from "./types";

export type ShellSidebarProps = {
  onNavigate?: () => void;
  compose: {
    onCompose: () => void;
    draftsCount: number;
    onOpenDrafts: (() => void) | null;
  };
  sync: { isSyncing: boolean; onCheckNewMail: () => void };
  user: ShellUserMenuProps;
  brand: {
    buildVersionLabel: string;
  };
  mailboxes: {
    accounts: ShellAccount[];
    activeAccountId: string;
    onSwitch: (accountId: string) => void;
    onAdd: () => void;
  };
  views: ShellViews;
  topics: {
    topics: Topic[];
    topicMessageCountById?: ReadonlyMap<string, number>;
    activeTopicId: string | null;
    onTopicClick: (topicId: string) => void;
  };
  folders: FolderSidebarPaneProps;
};

export function MailboxRows({
  accounts,
  activeAccountId,
  onSwitch
}: Pick<ShellSidebarProps["mailboxes"], "accounts" | "activeAccountId" | "onSwitch">) {
  return (
    <div className="space-y-1">
      {groupMailboxes(accounts).map((group) => (
        <div key={group.domain ?? "all"}>
          {group.domain ? (
            <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{group.domain}</div>
          ) : null}
          <SidebarMenu>
            {group.accounts.map((account) => (
              <SidebarMenuItem key={account.id}>
                <SidebarMenuButton
                  isActive={account.id === activeAccountId}
                  onClick={() => onSwitch(account.id)}
                  title={account.email}
                  aria-current={account.id === activeAccountId ? "true" : undefined}
                  className="data-[active=true]:bg-[var(--iris-3)] data-[active=true]:text-[var(--iris-11)]"
                >
                  <Avatar size="sm">
                    {account.avatar ? <AvatarImage src={account.avatar} alt="" /> : null}
                    <AvatarFallback>{mailboxInitials(account)}</AvatarFallback>
                  </Avatar>
                  <span>{mailboxLabel(account)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      ))}
    </div>
  );
}

function ViewRow({ view }: { view: ShellView }) {
  const showCount = typeof view.count === "number" && view.count > 0;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={view.active}
        onClick={view.onSelect}
        title={view.rowTitle ?? `${view.name}: ${view.description}`}
      >
        {view.icon}
        <span className={cn(view.emphasize && "font-semibold")}>{view.name}</span>
      </SidebarMenuButton>
      {showCount ? (
        <SidebarMenuBadge
          className="bg-sidebar-accent"
          title={view.countTitle ?? view.rowTitle}
          aria-label={view.countAriaLabel ?? `${view.count} unread`}
        >
          {view.countLabel ?? view.count}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}

/**
 * Sidebar of the desktop shell (design §7.2): brand, "My mailboxes" /
 * "Shared mailboxes", "Views", "Topics" and the folder tree.
 */
export default function ShellSidebar({ brand, mailboxes, views, topics, folders, compose, sync, user, onNavigate }: ShellSidebarProps) {
  const { setOpenMobile } = useSidebar();
  const closeAfter = (action: () => void, navigate = false) => () => {
    setOpenMobile(false);
    if (navigate) onNavigate?.();
    action();
  };
  const [topicsCollapsed, setTopicsCollapsed] = useState(false);
  const { mine, shared } = partitionMailboxes(mailboxes.accounts);
  const viewRows: ShellView[] = [
    ...(views.inbox ? [views.inbox] : []),
    ...views.collab,
    ...views.virtual
  ];

  return (
    <Sidebar variant="inset" collapsible="offcanvas" className="h-dvh">
      {/* The mobile variant renders this subtree in a shadcn Sheet portalled to
          <body>, outside the root `.radix-themes` element. The nested Theme
          re-establishes the Radix tokens (--space-N, --gray-N, --accent-N) for
          the kept components below (folder tree, topics, Radix menus). */}
      <Theme asChild>
        <div className="flex h-full min-h-0 flex-col bg-sidebar text-sm">
          <SidebarHeader className="flex-row items-center gap-2 px-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- plain SVG, served unoptimized */}
            <img src="/icons/logo.svg" alt="" width={28} height={28} className="size-7 rounded-md" />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{DEFAULT_APP_TITLE}</span>
              {brand.buildVersionLabel ? (
                <span
                  className="truncate font-mono text-2xs text-muted-foreground"
                  title={`Build ${brand.buildVersionLabel}`}
                >
                  {brand.buildVersionLabel}
                </span>
              ) : null}
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <div className="flex items-center gap-2">
                <Button className="flex-1 justify-start" onClick={closeAfter(compose.onCompose)} aria-label="New mail">
                  <SquarePen />Compose
                </Button>
                <Button variant="outline" size="icon" aria-label="Check all folders for new mail"
                  title="Check all folders for new mail" disabled={sync.isSyncing} onClick={sync.onCheckNewMail}>
                  <RefreshCw className={cn(sync.isSyncing && "animate-spin")} />
                </Button>
              </div>
              {compose.onOpenDrafts && compose.draftsCount > 0 ? (
                <SidebarMenu className="mt-2"><SidebarMenuItem>
                  <SidebarMenuButton onClick={closeAfter(compose.onOpenDrafts, true)}><FileText /><span>Drafts</span></SidebarMenuButton>
                  <SidebarMenuBadge>{compose.draftsCount}</SidebarMenuBadge>
                </SidebarMenuItem></SidebarMenu>
              ) : null}
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>My mailboxes</SidebarGroupLabel>
              <SidebarGroupAction title="Add mailbox" aria-label="Add mailbox" onClick={closeAfter(mailboxes.onAdd)}>
                <Plus />
              </SidebarGroupAction>
              <SidebarGroupContent>
                {mine.length > 0 ? (
                  <MailboxRows
                    accounts={mine}
                    activeAccountId={mailboxes.activeAccountId}
                    onSwitch={(id) => { setOpenMobile(false); onNavigate?.(); mailboxes.onSwitch(id); }}
                  />
                ) : (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No mailbox yet</p>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
            {shared.length > 0 ? (
              <SidebarGroup>
                <SidebarGroupLabel>Shared mailboxes</SidebarGroupLabel>
                <SidebarGroupContent>
                  <MailboxRows
                    accounts={shared}
                    activeAccountId={mailboxes.activeAccountId}
                    onSwitch={(id) => { setOpenMobile(false); onNavigate?.(); mailboxes.onSwitch(id); }}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
            {viewRows.length > 0 ? (
              <SidebarGroup>
                <SidebarGroupLabel>Views</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {viewRows.map((view) => (
                      <ViewRow key={view.id} view={{ ...view, onSelect: closeAfter(view.onSelect, true) }} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
            {topics.topics.length > 0 ? (
              <SidebarGroup aria-label="Topics">
                <TopicsSidebarSection
                  topics={topics.topics}
                  topicMessageCountById={topics.topicMessageCountById}
                  activeTopicId={topics.activeTopicId}
                  collapsed={topicsCollapsed}
                  onToggleCollapsed={() => setTopicsCollapsed((value) => !value)}
                  onTopicClick={(id) => { setOpenMobile(false); onNavigate?.(); topics.onTopicClick(id); }}
                />
              </SidebarGroup>
            ) : null}
            <FolderSidebarPane {...folders} setActiveFolderId={(next) => { setOpenMobile(false); onNavigate?.(); folders.setActiveFolderId(next); }} />
          </SidebarContent>
          <SidebarFooter><ShellUserMenu {...user} onOpenSettings={closeAfter(user.onOpenSettings)} onOpenAdmin={closeAfter(user.onOpenAdmin)} /></SidebarFooter>
        </div>
      </Theme>
    </Sidebar>
  );
}
