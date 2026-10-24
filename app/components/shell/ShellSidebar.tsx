"use client";

import { formatNumber } from "@/lib/i18n/format";
import styles from "./ShellSidebar.module.css";
import { useLocale, useTranslations } from "next-intl";

import { memo, useMemo, useRef, useState, type ReactNode } from "react";
import { FileText, Mail, Plus, RefreshCw, SquarePen, UserRound } from "lucide-react";
import { Theme } from "@radix-ui/themes";
import type { UserMailboxSummary } from "@/lib/mailboxSummary";
import type { Topic } from "@/lib/data";
import { DEFAULT_APP_TITLE } from "@/lib/appBranding";
import { Button } from "@/app/components/ui/button";
import ShellUserMenu, { type ShellUserMenuProps } from "./ShellUserMenu";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { TooltipProvider } from "@/app/components/ui/tooltip";
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
import { buildSenderIconSrc } from "@/app/components/mailclient/SenderIcon";
import type { BuildIdentity } from "@/lib/buildVersion";
import { groupMailboxes, mailboxInitials, mailboxLabel, partitionMailboxes, type ShellAccount, type ShellView, type ShellViews } from "./types";
import { useStableHandlers } from "@/app/hooks/useStableHandlers";

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
    /** May return the switch promise; the clicked row shows a pending state until it settles. */
    onSwitch: (accountId: string) => void | Promise<unknown>;
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

/** Active mailbox and view rows share the accent fill, which reads stronger
 * than the neutral hover fill in both colour schemes. */
const ACTIVE_ROW_CLASS = "data-[active=true]:bg-[var(--iris-3)] data-[active=true]:text-[var(--iris-11)]";
/** A clicked mailbox row before the switch commits: the accent fill at once
 * (also under the pointer), pulsing while the mailbox loads. */
const PENDING_ROW_CLASS = "aria-busy:bg-[var(--iris-3)] aria-busy:text-[var(--iris-11)] aria-busy:animate-pulse aria-busy:cursor-progress";

type MailboxRowProps = {
  account: ShellAccount;
  summary: UserMailboxSummary | undefined;
  isActive: boolean;
  isPending: boolean;
  onSwitch: (accountId: string) => void;
};

/** Right padding that keeps the label clear of the badge: the badge shows
 * at most two counts plus the watcher dot, each only when it carries news. */
function mailboxBadgePadding(counts: number, showWatcher: boolean): string | undefined {
  if (counts === 0) return showWatcher ? "pr-8" : undefined;
  if (counts === 1) return showWatcher ? "pr-16" : "pr-14";
  return showWatcher ? "pr-28" : "pr-24";
}

/** One badge count: icon and number when it carries news, otherwise a
 * screen-reader-only label so the row still announces every count. */
function MailboxCount({ label, title, icon, value }: { label: string; title?: string; icon?: ReactNode; value?: number }) {
  if (icon === undefined || value === undefined) return <span className="sr-only" aria-label={label}>{label}</span>;
  return (
    <span className="flex items-center gap-0.5" aria-label={label} title={title}>
      {icon}{value}
    </span>
  );
}

/** One mailbox row; memoized so a switch re-renders only the rows whose state changed. */
const MailboxRow = memo(function MailboxRow({ account, summary, isActive, isPending, onSwitch }: MailboxRowProps) {
  const t = useTranslations("Shell");
  // The badge shows only news (unread, assigned to me) and an unhealthy
  // watcher; zero counts, the unassigned count and the unread-unavailable case
  // stay in the hover and as screen-reader-only labels.
  const showUnread = summary !== undefined && summary.unread !== null && summary.unread > 0;
  const showAssigned = summary !== undefined && summary.assignedToMe > 0;
  const showWatcher = summary !== undefined && summary.watcher.state !== "idling";
  // A custom avatar wins; otherwise the mailbox's own address goes through the
  // message list's sender-icon route (domain favicon, Gravatar), and the
  // initials stay while it loads or when no logo exists.
  const avatarSrc = account.avatar || ((account.settings?.appearance?.senderIcons ?? true)
    ? buildSenderIconSrc(account.id, { from: account.name, fromEmail: account.email, fallback: "none" })
    : undefined);
  const watcherLabel = summary ? t("mailboxes.watcher", {state: t(`mailboxes.watcherStates.${summary.watcher.state}`)}) : "";
  return (
    <SidebarMenuItem>
      {/* aria-current follows the committed mailbox only; a click shows
          aria-busy on its row until the switch settles. */}
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => onSwitch(account.id)}
        title={summary
          ? t("mailboxes.summary", { email: account.email, unread: summary.unread ?? "—", assignedToMe: summary.assignedToMe, unassignedOpen: summary.unassignedOpen, state: t(`mailboxes.watcherStates.${summary.watcher.state}`) })
          : account.email}
        aria-current={isActive ? "true" : undefined}
        aria-busy={isPending ? "true" : undefined}
        className={cn(ACTIVE_ROW_CLASS, PENDING_ROW_CLASS, mailboxBadgePadding(Number(showUnread) + Number(showAssigned), showWatcher))}
      >
        <Avatar size="sm">
          {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
          <AvatarFallback>{mailboxInitials(account)}</AvatarFallback>
        </Avatar>
        <span>{mailboxLabel(account)}</span>
      </SidebarMenuButton>
      {summary && (
        <SidebarMenuBadge className="right-1 w-auto min-w-0 gap-1.5 px-0.5 text-2xs">
          <MailboxCount
            label={summary.unread === null ? t("mailboxes.unreadUnavailable") : t("mailboxes.unread", {count: summary.unread})}
            {...(showUnread && { title: t("mailboxes.unreadTitle"), icon: <Mail className="size-2.5" aria-hidden="true" />, value: summary.unread! })}
          />
          <MailboxCount
            label={t("mailboxes.assigned", {count: summary.assignedToMe})}
            {...(showAssigned && { title: t("mailboxes.assignedTitle"), icon: <UserRound className="size-2.5" aria-hidden="true" />, value: summary.assignedToMe })}
          />
          <MailboxCount label={t("mailboxes.unassigned", {count: summary.unassignedOpen})} />
          {showWatcher ? (
            <span role="img" data-watcher-state={summary.watcher.state} aria-label={watcherLabel} title={watcherLabel}
              className={cn("size-1.5 rounded-full",
                summary.watcher.state === "auth_failed" || summary.watcher.state === "backoff" ? "bg-amber-500" : "bg-muted-foreground/50")} />
          ) : null}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
});

export function MailboxRows({
  accounts,
  activeAccountId,
  pendingAccountId = null,
  onSwitch,
  summaries
}: Pick<ShellSidebarProps["mailboxes"], "accounts" | "activeAccountId" | "summaries"> & {
  pendingAccountId?: string | null;
  onSwitch: (accountId: string) => void;
}) {
  const t = useTranslations("Shell");
  const summaryById = useMemo(() => new Map(summaries?.map(summary => [summary.accountId, summary])), [summaries]);
  const groups = useMemo(() => groupMailboxes(accounts), [accounts]);
  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <div key={group.domain ?? "all"}>
          {group.domain || accounts.length > 6 ? (
            <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{group.domain ?? t("mailboxes.other")}</div>
          ) : null}
          <SidebarMenu>
            {group.accounts.map((account) => (
              <MailboxRow
                key={account.id}
                account={account}
                summary={summaryById.get(account.id)}
                isActive={account.id === activeAccountId}
                isPending={account.id === pendingAccountId}
                onSwitch={onSwitch}
              />
            ))}
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
  const { isMobile, state } = useSidebar();
  const showCount = typeof view.count === "number" && view.count > 0;
  return (
    <SidebarMenuItem className={styles.viewRow}>
      {/* A row-bound tooltip instead of a native title: it opens beside the
          row under the pointer or keyboard focus and stays inside the viewport.
          It is not rendered in the phone sheet (no room beside it) or while
          the offcanvas sidebar is collapsed (no row on screen): without a
          preflight `[hidden]` rule the content's `hidden` attribute would not
          hide it. `hidden: false` drops the icon-rail default attribute. */}
      <SidebarMenuButton
        className={cn(styles.viewButton, ACTIVE_ROW_CLASS)}
        data-view-id={view.id}
        isActive={view.active}
        onClick={view.onSelect}
        tooltip={isMobile || state === "collapsed" ? undefined : {
          children: view.rowTitle ?? tv("rowTitle", { name: view.name, description: view.description }),
          hidden: false,
          collisionPadding: 8,
          className: styles.viewTooltip
        }}
      >
        {view.icon}
        <span className={cn(styles.viewLabel, view.emphasize && "font-semibold")}>{view.name}</span>
      </SidebarMenuButton>
      {showCount ? (
        <SidebarMenuBadge
          className={styles.viewCount}
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
  const { mine, shared } = useMemo(() => partitionMailboxes(mailboxes.accounts), [mailboxes.accounts]);
  // The clicked mailbox row shows a pending state right away; only the latest
  // click's settle clears it, so a superseded switch (A -> B -> A) cannot clear
  // the newer one.
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const switchToken = useRef(0);
  const { switchMailbox } = useStableHandlers({
    switchMailbox: (id: string) => {
      setOpenMobile(false);
      onNavigate?.();
      const token = ++switchToken.current;
      setPendingAccountId(id);
      void Promise.resolve(mailboxes.onSwitch(id)).finally(() => {
        if (switchToken.current === token) setPendingAccountId(null);
      });
    }
  });
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
                    pendingAccountId={pendingAccountId}
                    onSwitch={switchMailbox}
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
                    pendingAccountId={pendingAccountId}
                    onSwitch={switchMailbox}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
            {viewRows.length > 0 ? (
              <SidebarGroup>
                <SidebarGroupLabel>{t("views")}</SidebarGroupLabel>
                <SidebarGroupContent>
                  {/* The row descriptions are plain text: closing them as soon as
                      the pointer leaves a row means the next row's description
                      replaces it at once, without Radix's grace area keeping the
                      previous row's text over a neighbouring row. A pointer
                      passing over the list opens nothing until it rests on a row;
                      once a description is open, the neighbouring row's replaces
                      it without a new delay. */}
                  <TooltipProvider disableHoverableContent delayDuration={400} skipDelayDuration={150}>
                    <SidebarMenu>
                      {viewRows.map((view) => (
                        <ViewRow key={view.id} view={{ ...view, onSelect: closeAfter(view.onSelect, true) }} />
                      ))}
                    </SidebarMenu>
                  </TooltipProvider>
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
