"use client";

import { formatNumber } from "@/lib/i18n/format";
import styles from "./ShellSidebar.module.css";
import { useLocale, useTranslations } from "next-intl";

import { useState, type ReactNode } from "react";
import { FileText, Mail, Plus, RefreshCw, SquarePen, UserRound, UsersRound } from "lucide-react";
import { Theme } from "@radix-ui/themes";
import type { UserMailboxSummary } from "@/lib/mailboxSummary";
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
import BuildInfo from "@/app/components/mailclient/status/BuildInfo";
import type { BuildIdentity } from "@/lib/buildVersion";
import { groupMailboxes, mailboxInitials, mailboxLabel, partitionMailboxes, type ShellAccount, type ShellView, type ShellViews } from "./types";

export type ShellSidebarProps = {
  onNavigate?: () => void;
  /** In-app notices docked above the account card (AppShell decides when). */
  notices?: ReactNode;
  compose: {
    onCompose: () => void;
    draftsCount: number;
    onOpenDrafts: (() => void) | null;
  };
  sync: { isSyncing: boolean; onCheckNewMail: () => void };
  user: ShellUserMenuProps;
  brand: {
    buildInfo: BuildIdentity | null;
  };
  mailboxes: {
    accounts: ShellAccount[];
    summaries?: readonly UserMailboxSummary[];
    activeAccountId: string;
    onSwitch: (accountId: string) => void;
    onAdd?: () => void;
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
  onSwitch,
  summaries
}: Pick<ShellSidebarProps["mailboxes"], "accounts" | "activeAccountId" | "onSwitch" | "summaries">) {
  const t = useTranslations("Shell");
  const summaryById = new Map(summaries?.map(summary => [summary.accountId, summary]));
  return (
    <div className="space-y-1">
      {groupMailboxes(accounts).map((group) => (
        <div key={group.domain ?? "all"}>
          {group.domain || accounts.length > 6 ? (
            <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{group.domain ?? t("mailboxes.other")}</div>
          ) : null}
          <SidebarMenu>
            {group.accounts.map((account) => {
              const summary = summaryById.get(account.id);
              return (
              <SidebarMenuItem key={account.id}>
                <SidebarMenuButton
                  isActive={account.id === activeAccountId}
                  onClick={() => onSwitch(account.id)}
                  title={summary
                    ? t("mailboxes.summary", { email: account.email, unread: summary.unread ?? "—", assignedToMe: summary.assignedToMe, unassignedOpen: summary.unassignedOpen, state: t(`mailboxes.watcherStates.${summary.watcher.state}`) })
                    : account.email}
                  aria-current={account.id === activeAccountId ? "true" : undefined}
                  className={cn("data-[active=true]:bg-[var(--iris-3)] data-[active=true]:text-[var(--iris-11)]", summary && "pr-32")}
                >
                  <Avatar size="sm">
                    {account.avatar ? <AvatarImage src={account.avatar} alt="" /> : null}
                    <AvatarFallback>{mailboxInitials(account)}</AvatarFallback>
                  </Avatar>
                  <span>{mailboxLabel(account)}</span>
                </SidebarMenuButton>
                {summary && (
                  <SidebarMenuBadge className="right-1 w-auto gap-1.5 text-2xs">
                    <span className="flex items-center gap-0.5" aria-label={summary.unread === null ? t("mailboxes.unreadUnavailable") : t("mailboxes.unread", {count: summary.unread})} title={t("mailboxes.unreadTitle")}>
                      <Mail className="size-2.5" aria-hidden="true" />{summary.unread ?? "—"}
                    </span>
                    <span className="flex items-center gap-0.5" aria-label={t("mailboxes.assigned", {count: summary.assignedToMe})} title={t("mailboxes.assignedTitle")}>
                      <UserRound className="size-2.5" aria-hidden="true" />{summary.assignedToMe}
                    </span>
                    <span className="flex items-center gap-0.5" aria-label={t("mailboxes.unassigned", {count: summary.unassignedOpen})} title={t("mailboxes.unassignedTitle")}>
                      <UsersRound className="size-2.5" aria-hidden="true" />{summary.unassignedOpen}
                    </span>
                    <span role="img" data-watcher-state={summary.watcher.state} aria-label={t("mailboxes.watcher", {state: t(`mailboxes.watcherStates.${summary.watcher.state}`)})} title={t("mailboxes.watcher", {state: t(`mailboxes.watcherStates.${summary.watcher.state}`)})}
                      className={cn("size-1.5 rounded-full", summary.watcher.state === "idling" ? "bg-emerald-500" :
                        summary.watcher.state === "auth_failed" || summary.watcher.state === "backoff" ? "bg-amber-500" : "bg-muted-foreground/50")} />
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ); })}
          </SidebarMenu>
        </div>
      ))}
    </div>
  );
}

export function ViewRow({ view }: { view: ShellView }) {
  const locale = useLocale();
  const t = useTranslations("Shell");
  const tv = useTranslations("Views");
  const showCount = typeof view.count === "number" && view.count > 0;
  return (
    <SidebarMenuItem className={styles.viewRow}>
      <SidebarMenuButton
        className={styles.viewButton}
        data-view-id={view.id}
        isActive={view.active}
        onClick={view.onSelect}
        title={view.rowTitle ?? tv("rowTitle", { name: view.name, description: view.description })}
      >
        {view.icon}
        <span className={cn(styles.viewLabel, view.emphasize && "font-semibold")}>{view.name}</span>
      </SidebarMenuButton>
      {showCount ? (
        <SidebarMenuBadge
          className={cn("bg-sidebar-accent", styles.viewCount)}
          title={view.countTitle ?? view.rowTitle}
          aria-label={view.countAriaLabel ?? t("mailboxes.unread", {count: view.count ?? 0})}
        >
          {formatNumber(view.count!, locale, { notation: "compact", maximumFractionDigits: 1 })}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}

/**
 * Sidebar of the desktop shell (design §7.2): brand, "My mailboxes" /
 * "Shared mailboxes", "Views", "Topics" and the folder tree.
 */
export default function ShellSidebar({ brand, mailboxes, views, topics, folders, compose, sync, user, notices, onNavigate }: ShellSidebarProps) {
  const t = useTranslations("Shell");
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
              <BuildInfo info={brand.buildInfo} className="truncate text-2xs text-muted-foreground tabular-nums" />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <div className="flex items-center gap-2">
                <Button className="flex-1 justify-start" onClick={closeAfter(compose.onCompose)} aria-label={t("compose.new")} data-shell-action="compose">
                  <SquarePen />{t("compose.label")}</Button>
                <Button variant="outline" size="icon" aria-label={t("sync.allFolders")}
                  title={t("sync.allFolders")} disabled={sync.isSyncing} onClick={sync.onCheckNewMail}>
                  <RefreshCw className={cn(sync.isSyncing && "animate-spin")} />
                </Button>
              </div>
              {compose.onOpenDrafts && compose.draftsCount > 0 ? (
                <SidebarMenu className="mt-2"><SidebarMenuItem>
                  <SidebarMenuButton onClick={closeAfter(compose.onOpenDrafts, true)}><FileText /><span>{t("drafts")}</span></SidebarMenuButton>
                  <SidebarMenuBadge>{compose.draftsCount}</SidebarMenuBadge>
                </SidebarMenuItem></SidebarMenu>
              ) : null}
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>{t("mailboxes.mine")}</SidebarGroupLabel>
              {mailboxes.onAdd && <SidebarGroupAction title={t("mailboxes.add")} aria-label={t("mailboxes.add")} onClick={closeAfter(mailboxes.onAdd)}>
                <Plus />
              </SidebarGroupAction>}
              <SidebarGroupContent>
                {mine.length > 0 ? (
                  <MailboxRows
                    accounts={mine}
                    summaries={mailboxes.summaries}
                    activeAccountId={mailboxes.activeAccountId}
                    onSwitch={(id) => { setOpenMobile(false); onNavigate?.(); mailboxes.onSwitch(id); }}
                  />
                ) : (
                  <p className="px-2 py-1 text-xs text-muted-foreground">{t("mailboxes.none")}</p>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
            {shared.length > 0 ? (
              <SidebarGroup>
                <SidebarGroupLabel>{t("mailboxes.shared")}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <MailboxRows
                    accounts={shared}
                    summaries={mailboxes.summaries}
                    activeAccountId={mailboxes.activeAccountId}
                    onSwitch={(id) => { setOpenMobile(false); onNavigate?.(); mailboxes.onSwitch(id); }}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
            {viewRows.length > 0 ? (
              <SidebarGroup>
                <SidebarGroupLabel>{t("views")}</SidebarGroupLabel>
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
              <SidebarGroup aria-label={t("topics")}>
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
          {/* Notices sit in the footer flow rather than over the folder list:
              the list's viewport shrinks, so every folder (and drop target)
              stays reachable by scrolling and nothing above it moves. */}
          <SidebarFooter>{notices}<ShellUserMenu {...user} onOpenSettings={closeAfter(user.onOpenSettings)} onOpenAdmin={closeAfter(user.onOpenAdmin)} /></SidebarFooter>
        </div>
      </Theme>
    </Sidebar>
  );
}
