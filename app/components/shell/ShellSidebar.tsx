"use client";

import { formatNumber } from "@/lib/i18n/format";
import styles from "./ShellSidebar.module.css";
import { useLocale, useTranslations } from "next-intl";

import { Fragment, memo, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FileText, Mail, Plus, RefreshCw, SquarePen, UserRound, Users } from "lucide-react";
import { Theme } from "@radix-ui/themes";
import type { UserMailboxSummary } from "@/lib/mailboxSummary";
import type { Topic } from "@/lib/data";
import { DEFAULT_APP_TITLE } from "@/lib/appBranding";
import { Button } from "@/app/components/ui/button";
import ShellUserMenu, { type ShellUserMenuProps } from "./ShellUserMenu";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage } from "@/app/components/ui/avatar";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import {
  Sidebar,
  useSidebar,
  SidebarContent,
  SidebarGroup,
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
import { MAILBOX_GROUPING_MIN, groupMailboxes, mailboxAvatarUrl, mailboxLabel, sortMailboxes, type ShellAccount, type ShellView, type ShellViews } from "./types";
import { useStableHandlers } from "@/app/hooks/useStableHandlers";
import { useCollapsedDomains, type MailboxSection } from "@/lib/ui/collapsedDomains";
import { versionedIconUrl } from "@/lib/appBranding";
import type { DomainIconVersions } from "@/app/hooks/useDomainIconVersions";

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
    /** Signed-in user; keys the collapsed domain groups on this device. */
    userId?: string | null;
    /** Versions of admin-uploaded domain icons by group domain. */
    domainIcons?: DomainIconVersions;
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
/** On desktop the inset sidebar frame already pads the panel, so mailbox and
 * view rows span their section and the row's own padding is the only one
 * before its content. The phone sheet has no frame; the section keeps its
 * padding there. */
const FLUSH_SECTION_CLASS = "md:px-0";
/** Rows that reach the edges of the scrolling sidebar content draw their
 * focus ring inside, where the scroll container cannot clip it. */
const FLUSH_ROW_RING_CLASS = "ring-inset";
/** Mailbox rows and domain headings share one height: 32 px, 40 px on phones. */
const MAILBOX_ROW_HEIGHT_CLASS = "h-8 max-md:h-10";
/** Rows under a domain heading: the name (or custom avatar) starts where the
 * heading's text does (row padding + icon slot + gap), while the row's hover
 * and active fill still spans the indent. */
const GROUPED_ROW_CLASS = "pl-8";
/** Thin tree guide down the left of a domain group's rows, under the centre
 * of the heading's 16 px icon slot; drawn above the row fills. */
const DOMAIN_GROUP_GUIDE_CLASS = "relative isolate before:pointer-events-none before:absolute before:inset-y-0 before:left-[15px] before:z-10 before:w-px before:bg-sidebar-border";
/** The domain heading toggles its group: menu-row hover and focus ring, and
 * the active fill while it hides the active mailbox. */
const DOMAIN_HEADER_CLASS = "flex w-full items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-sidebar-foreground ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2";

type MailboxRowProps = {
  account: ShellAccount;
  summary: UserMailboxSummary | undefined;
  isActive: boolean;
  isPending: boolean;
  /** Indented under a domain heading. */
  grouped: boolean;
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
const MailboxRow = memo(function MailboxRow({ account, summary, isActive, isPending, grouped, onSwitch }: MailboxRowProps) {
  const t = useTranslations("Shell");
  // The badge shows only news (unread, assigned to me) and an unhealthy
  // watcher; zero counts, the unassigned count and the unread-unavailable case
  // stay in the hover and as screen-reader-only labels.
  const showUnread = summary !== undefined && summary.unread !== null && summary.unread > 0;
  const showAssigned = summary !== undefined && summary.assignedToMe > 0;
  const showWatcher = summary !== undefined && summary.watcher.state !== "idling";
  // Only a custom avatar image; the domain icon sits on the group header.
  const avatarSrc = mailboxAvatarUrl(account);
  const watcherLabel = summary ? t("mailboxes.watcher", {state: t(`mailboxes.watcherStates.${summary.watcher.state}`)}) : "";
  // The live summary carries the current member count; the account list is the fallback.
  const shared = summary?.shared ?? account.shared === true;
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
        className={cn(MAILBOX_ROW_HEIGHT_CLASS, FLUSH_ROW_RING_CLASS, ACTIVE_ROW_CLASS, PENDING_ROW_CLASS, grouped && GROUPED_ROW_CLASS, mailboxBadgePadding(Number(showUnread) + Number(showAssigned), showWatcher))}
      >
        {avatarSrc ? (
          <Avatar size="sm" className="empty:hidden">
            <AvatarImage src={avatarSrc} alt="" />
          </Avatar>
        ) : null}
        <span className="min-w-0 truncate">{mailboxLabel(account)}</span>
        {shared ? (
          <span role="img" data-shared-mailbox="" aria-label={t("mailboxes.sharedMailbox")} title={t("mailboxes.sharedMailbox")}
            className="flex shrink-0 text-muted-foreground">
            <Users className="size-3.5!" aria-hidden="true" />
          </span>
        ) : null}
      </SidebarMenuButton>
      {summary && (
        <SidebarMenuBadge className="right-1 w-auto min-w-0 gap-1.5 px-0.5 text-2xs max-md:peer-data-[size=default]/menu-button:top-2.5">
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

/** One favicon per domain group header, through the sender-icon route of
 * the group's first mailbox with sender icons on; nothing while it loads or
 * when the domain has no logo (`fallback=none` answers 404). An uploaded
 * domain icon (known by its version) replaces the favicon and needs no
 * external fetch, so it shows even when sender icons are off. */
function DomainIcon({ domain, accounts, version }: { domain: string; accounts: readonly ShellAccount[]; version?: string }) {
  const source = accounts.find(account => account.settings?.appearance?.senderIcons ?? true) ?? (version ? accounts[0] : undefined);
  if (!source) return null;
  return (
    <Avatar className="size-4 rounded-sm after:hidden empty:hidden">
      <AvatarImage src={buildSenderIconSrc(source.id, { from: domain, fromEmail: source.email, fallback: "none", version })} alt="" className="rounded-sm" />
    </Avatar>
  );
}

/** Unread and assigned-to-me totals of a collapsed group, each shown only
 * when it carries news (same rule as the mailbox badge). */
function DomainCounts({ accounts, summaryById }: { accounts: readonly ShellAccount[]; summaryById: ReadonlyMap<string, UserMailboxSummary> }) {
  const t = useTranslations("Shell");
  let unread = 0;
  let assignedToMe = 0;
  for (const account of accounts) {
    const summary = summaryById.get(account.id);
    unread += summary?.unread ?? 0;
    assignedToMe += summary?.assignedToMe ?? 0;
  }
  if (unread === 0 && assignedToMe === 0) return null;
  return (
    <span className="flex items-center gap-1.5 text-2xs tabular-nums" data-domain-counts="">
      {unread > 0 ? <MailboxCount label={t("mailboxes.unread", {count: unread})} title={t("mailboxes.unreadTitle")}
        icon={<Mail className="size-2.5" aria-hidden="true" />} value={unread} /> : null}
      {assignedToMe > 0 ? <MailboxCount label={t("mailboxes.assigned", {count: assignedToMe})} title={t("mailboxes.assignedTitle")}
        icon={<UserRound className="size-2.5" aria-hidden="true" />} value={assignedToMe} /> : null}
    </span>
  );
}

export function MailboxRows({
  accounts,
  activeAccountId,
  pendingAccountId = null,
  onSwitch,
  summaries,
  userId,
  section,
  domainIcons
}: Pick<ShellSidebarProps["mailboxes"], "accounts" | "activeAccountId" | "summaries" | "userId" | "domainIcons"> & {
  pendingAccountId?: string | null;
  onSwitch: (accountId: string) => void;
  /** Keys the collapsed domain groups together with the domain. */
  section: MailboxSection;
}) {
  const t = useTranslations("Shell");
  const listId = useId();
  const summaryById = useMemo(() => new Map(summaries?.map(summary => [summary.accountId, summary])), [summaries]);
  const groups = useMemo(() => groupMailboxes(accounts), [accounts]);
  const grouped = accounts.length >= MAILBOX_GROUPING_MIN;
  const { collapsed, toggle } = useCollapsedDomains(userId, section);
  // Headings and row lists are siblings: no wrapper per group adds padding
  // or margins of its own; a heading after the first opens with the gap
  // between groups.
  return (
    <>
      {groups.map((group, index) => {
        // Expanded by default; a collapsed group shows its totals on the
        // heading and is tinted while it hides the active mailbox.
        const domainKey = group.domain ?? "";
        const isCollapsed = grouped && collapsed.has(domainKey);
        const hidesActive = isCollapsed && group.accounts.some(account => account.id === activeAccountId);
        const groupListId = `${listId}-${index}`;
        return (
          <Fragment key={group.domain ?? "all"}>
            {grouped ? (
              <button
                type="button"
                data-slot="domain-group-toggle"
                className={cn(DOMAIN_HEADER_CLASS, MAILBOX_ROW_HEIGHT_CLASS, FLUSH_ROW_RING_CLASS, ACTIVE_ROW_CLASS, index > 0 && "mt-2")}
                aria-expanded={!isCollapsed}
                aria-controls={groupListId}
                data-active={hidesActive ? "true" : undefined}
                onClick={() => toggle(domainKey)}
              >
                {/* The slot keeps the heading text in line with the rows'
                    names while the icon loads, and when there is none. */}
                <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                  {group.domain ? <DomainIcon domain={group.domain} accounts={group.accounts} version={domainIcons?.[group.domain]} /> : null}
                </span>
                {/* A long domain ellipsizes before the counters, which never
                    shrink; the full name stays available as a tooltip. */}
                <span className="min-w-0 truncate" title={group.domain ?? t("mailboxes.other")} data-domain-name="">{group.domain ?? t("mailboxes.other")}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                  {isCollapsed ? <DomainCounts accounts={group.accounts} summaryById={summaryById} /> : null}
                  {isCollapsed ? <ChevronRight className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
                </span>
              </button>
            ) : null}
            <SidebarMenu id={grouped ? groupListId : undefined} hidden={isCollapsed} className={cn(grouped && DOMAIN_GROUP_GUIDE_CLASS, isCollapsed && "hidden")} data-domain-group={grouped ? "" : undefined}>
              {isCollapsed ? null : group.accounts.map((account) => (
                <MailboxRow
                  key={account.id}
                  account={account}
                  summary={summaryById.get(account.id)}
                  isActive={account.id === activeAccountId}
                  isPending={account.id === pendingAccountId}
                  grouped={grouped}
                  onSwitch={onSwitch}
                />
              ))}
            </SidebarMenu>
          </Fragment>
        );
      })}
    </>
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
        className={cn(styles.viewButton, FLUSH_ROW_RING_CLASS, ACTIVE_ROW_CLASS)}
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
 * Sidebar of the desktop shell (design §7.2): brand, one mailbox list (own
 * and shared mailboxes together, shared ones marked), "Views", "Topics" and
 * the folder tree.
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
  const accounts = useMemo(() => sortMailboxes(mailboxes.accounts), [mailboxes.accounts]);
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
    <Sidebar variant="inset" collapsible="offcanvas">
      {/* The mobile variant renders this subtree in a shadcn Sheet portalled to
          <body>, outside the root `.radix-themes` element. The nested Theme
          re-establishes the Radix tokens (--space-N, --gray-N, --accent-N) for
          the kept components below (folder tree, topics, Radix menus). */}
      <Theme asChild>
        <div className="flex h-full min-h-0 flex-col bg-sidebar text-sm">
          <SidebarHeader className="flex-row items-center gap-2 px-3 pt-[calc(--spacing(2)+var(--top-spacer))]">
            {/* eslint-disable-next-line @next/next/no-img-element -- plain SVG, served unoptimized */}
            <img src={versionedIconUrl("/icons/logo.svg")} alt="" width={28} height={28} className="size-7 rounded-md" />
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
            <SidebarGroup className={FLUSH_SECTION_CLASS}>
              <SidebarGroupContent>
                {accounts.length > 0 ? (
                  <MailboxRows
                    section="mine"
                    accounts={accounts}
                    summaries={mailboxes.summaries}
                    activeAccountId={mailboxes.activeAccountId}
                    userId={mailboxes.userId}
                    domainIcons={mailboxes.domainIcons}
                    pendingAccountId={pendingAccountId}
                    onSwitch={switchMailbox}
                  />
                ) : (
                  <>
                    <p className="px-2 py-1 text-xs text-muted-foreground">{t("mailboxes.none")}</p>
                    {/* Only without any mailbox; otherwise admins add mailboxes
                        in Administration > Mailboxes. */}
                    {mailboxes.onAdd ? (
                      <SidebarMenu><SidebarMenuItem>
                        <SidebarMenuButton className={cn(FLUSH_ROW_RING_CLASS, "max-md:h-11")} onClick={closeAfter(mailboxes.onAdd)} data-shell-action="add-mailbox">
                          <Plus /><span>{t("mailboxes.add")}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem></SidebarMenu>
                    ) : null}
                  </>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
            {viewRows.length > 0 ? (
              <SidebarGroup className={FLUSH_SECTION_CLASS}>
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
