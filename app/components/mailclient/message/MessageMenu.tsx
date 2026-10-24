import { messageDeepLink } from "@/lib/navigation/deepLinks";
import { useTranslations } from "next-intl";
import type React from "react";
import { Fragment, useContext, useState } from "react";
import {
  Archive,
  ArrowRightLeft,
  CheckSquare,
  Circle,
  CircleDot,
  Copy,
  Download,
  Edit3,
  FileText,
  Flag,
  Forward,
  Mail,
  MailCheck,
  MailOpen,
  MailX,
  MoreVertical,
  SquareArrowOutUpRight,
  ListTree,
  Link,
  Search,
  RefreshCw,
  Reply,
  ReplyAll,
  Send,
  Shield,
  ShieldOff,
  Square,
  SquareCheckBig,
  Tags,
  Trash2
} from "lucide-react";
import { Theme } from "@radix-ui/themes";
import mobileStyles from "@/app/components/shell/MobileFrames.module.css";
import type { Message, Topic, Folder } from "@/lib/data";
import {
  hasTodoFlag,
  hasDoneFlag,
  getUnsubscribeCapability,
  hasSendableRecipients
} from "../utils/messageHelpers";
import type { RowReadAction } from "../messagelist/selectionActions";
import styles from "./MessageMenu.module.css";
import TopicBadge from "../TopicBadge";
import MoveToSubmenu from "./MoveToSubmenu";
import TooltipIconButton, { useQuietMenuFocusReturn } from "@/app/components/TooltipIconButton";
import { useMessageMenuPrimitives } from "./messageMenuPrimitives";
import { MessageMenuControlContext } from "./messageMenuControl";

type ComposeMode = "new" | "reply" | "replyAll" | "forward" | "edit" | "editAsNew";
type MessageMenuAction =
  | "editDraft"
  | "sendDraft"
  | "discardDraft"
  | "reply"
  | "replyAll"
  | "forward"
  | "editAsNew"
  | "markRead"
  | "flag"
  | "todo"
  | "unmarkTodo"
  | "answered"
  | "spam"
  | "archive"
  | "category"
  | "moveTo"
  | "copyToAccount"
  | "moveToAccount"
  | "delete"
  | "unsubscribe"
  | "showRelated"
  | "showThread"
  | "topics"
  | "copyLink"
  | "openWindow"
  | "openHtmlWindow"
  | "downloadEml"
  | "resync";

type MessageMenuProps = {
  message: Message;
  origin?: "list" | "thread" | "table";
  isDraft: boolean;
  readAction?: RowReadAction;
  actionVisibility?: Partial<Record<MessageMenuAction, boolean>>;
  actionEnabled?: Partial<Record<MessageMenuAction, boolean>>;
  pendingMessageActions: Set<string>;
  openCompose: (mode: ComposeMode, message?: Message, asNew?: boolean) => void;
  updateFlagState: (
    message: Message,
    flag: "seen" | "answered" | "flagged" | "draft" | "deleted",
    value: boolean
  ) => void;
  toggleTodoFlag: (message: Message) => void;
  clearTodoFlag: (message: Message) => void;
  handleMarkSpam: (message: Message) => void;
  handleMarkNotSpam: (message: Message) => void;
  handleArchiveMessage: (message: Message) => void;
  handleSetCategory: (
    message: Message,
    category: "newsletter" | "notification" | "transactional" | null
  ) => void;
  handleDeleteMessage: (message: Message, options?: { allowThreadDeletion?: boolean }) => void;
  handleUnsubscribe: (message: Message) => void;
  handleDownloadEml: (message: Message) => void;
  handleResyncMessage: (message: Message) => void;
  handleOpenInNewWindow: (message: Message) => void;
  handleOpenHtmlInNewWindow: (message: Message) => void;
  onShowRelated: (message: Message) => void;
  onShowThread: (message: Message) => void;
  onSendDraft?: (message: Message) => void | Promise<void>;
  onDiscardDraft?: (message: Message) => void | Promise<void>;
  allTopics: Topic[];
  onFetchSuggestions: (message: Message) => Promise<Topic[]>;
  onAssignTopics: (message: Message) => void;
  onToggleTopic: (message: Message, topicId: string) => void;
  onGetRecentFolders: () => Folder[];
  onMoveToFolder: (message: Message, folderId: string) => void;
  onMoveTo: (message: Message) => void;
  hasOtherAccounts?: boolean;
  onCopyToAccount?: (message: Message) => void;
  onMoveToAccount?: (message: Message) => void;
  isTrashFolder: (folderId?: string) => boolean;
  isSpamFolder: (folderId?: string) => boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function MessageMenu({
  message,
  origin = "list",
  isDraft,
  readAction,
  actionVisibility,
  actionEnabled,
  pendingMessageActions,
  openCompose,
  updateFlagState,
  toggleTodoFlag,
  clearTodoFlag,
  handleMarkSpam,
  handleMarkNotSpam,
  handleArchiveMessage,
  handleSetCategory,
  handleDeleteMessage,
  handleUnsubscribe,
  handleDownloadEml,
  handleResyncMessage,
  handleOpenInNewWindow,
  handleOpenHtmlInNewWindow,
  onShowRelated,
  onShowThread,
  onSendDraft,
  onDiscardDraft,
  allTopics,
  onFetchSuggestions,
  onAssignTopics,
  onToggleTopic,
  onGetRecentFolders,
  onMoveToFolder,
  onMoveTo,
  hasOtherAccounts,
  onCopyToAccount,
  onMoveToAccount,
  isTrashFolder,
  isSpamFolder,
  onOpenChange
}: MessageMenuProps) {
  const t = useTranslations("Reader");
  const { isMobile, DropdownMenu } = useMessageMenuPrimitives();
  const control = useContext(MessageMenuControlContext);
  const quietFocusReturn = useQuietMenuFocusReturn();
  const [copyResult, setCopyResult] = useState<"copied" | "failed" | null>(null);
  const [suggestions, setSuggestions] = useState<Topic[]>([]);
  const rowReadAction = origin === "thread" ? undefined : readAction;
  const seen = rowReadAction?.seen ?? Boolean(message.seen);
  const showDeleteInMenu = origin !== "table";
  const allowThreadDeletion = origin !== "thread";
  const inSpamFolder = isSpamFolder(message.folderId);
  const canSendDraft = hasSendableRecipients(message);
  const hasTodo = hasTodoFlag(message);
  const hasDone = hasDoneFlag(message);
  const selectedCategory =
    message.category === "newsletter" ||
    message.category === "notification" ||
    message.category === "transactional"
      ? message.category
      : null;
  const isVisible = (action: MessageMenuAction, defaultValue = true) =>
    actionVisibility?.[action] ?? defaultValue;
  const isDisabled = (action: MessageMenuAction, defaultValue = false) =>
    defaultValue || actionEnabled?.[action] === false;
  const buildItem = (
    action: MessageMenuAction,
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    disabled?: boolean
  ) => (
    <DropdownMenu.Item
      key={action}
      onSelect={() => onClick()}
      disabled={disabled}
    >
      <span className={styles.menuIcon}>{icon}</span>
      <span className={styles.menuLabel}>{label}</span>
    </DropdownMenu.Item>
  );
  const menuRadioLabel = (checked: boolean, label: string) => (
    <span className={styles.menuLabelRow}>
      <span className={styles.menuIcon} aria-hidden>
        {checked ? <CircleDot size={14} /> : <Circle size={14} />}
      </span>
      <span className={styles.menuLabel}>{label}</span>
    </span>
  );
  const todoItems = isVisible("todo")
    ? hasTodo
      ? [
          buildItem(
            "todo",
            t("markDone"),
            <CheckSquare size={14} />,
            () => toggleTodoFlag(message),
            isDisabled("todo")
          ),
          buildItem(
            "unmarkTodo",
            t("unmarkTodo"),
            <Square size={14} />,
            () => clearTodoFlag(message),
            isDisabled("todo")
          )
        ]
      : [
          buildItem(
            "todo",
            t("markTodo"),
            hasDone ? <SquareCheckBig size={14} /> : <Square size={14} />,
            () => toggleTodoFlag(message),
            isDisabled("todo")
          )
        ]
    : [];

  return (
    <DropdownMenu.Root
      open={control?.open}
      onOpenChange={(open) => {
        control?.onOpenChange(open);
        onOpenChange?.(open);
      }}
    >
      <DropdownMenu.Trigger asChild>
        <TooltipIconButton
          variant="ghost"
          size="1"
          tooltip={t("messageActions")}
          data-message-action="menu"
          aria-label={t("messageActions")}
          className={isMobile ? mobileStyles.messageMore : undefined}
          disabled={pendingMessageActions.has(message.id)}
          onClick={(event) => event.stopPropagation()}
          onFocus={quietFocusReturn.onTriggerFocus}
        >
          <MoreVertical size={14} />
        </TooltipIconButton>
      </DropdownMenu.Trigger>
      <Theme asChild><DropdownMenu.Content
        align="end"
        sideOffset={6}
        onCloseAutoFocus={quietFocusReturn.onCloseAutoFocus}
        className={`${styles.menuContent} ${isMobile ? mobileStyles.messageMenu : ""}`}
      >
        {[
          [
            isDraft
              ? isVisible("editDraft")
                ? buildItem("editDraft", t("editDraft"), <Edit3 size={14} />, () =>
                  openCompose("edit", message)
                  )
                : null
              : null,
            isDraft && onSendDraft && isVisible("sendDraft")
              ? buildItem(
                  "sendDraft",
                  t("sendDraft"),
                  <Send size={14} />,
                  () => void onSendDraft(message),
                  !canSendDraft
                )
              : null,
            isDraft && onDiscardDraft && isVisible("discardDraft")
              ? buildItem("discardDraft", t("discardDraft"), <Trash2 size={14} />, () =>
                  void onDiscardDraft(message)
                )
              : null,
            isVisible("reply")
              ? buildItem("reply", t("reply"), <Reply size={14} />, () =>
                  openCompose("reply", message)
                , isDisabled("reply"))
              : null,
            isVisible("replyAll")
              ? buildItem("replyAll", t("replyAll"), <ReplyAll size={14} />, () =>
                  openCompose("replyAll", message)
                , isDisabled("replyAll"))
              : null,
            isVisible("forward")
              ? buildItem("forward", t("forward"), <Forward size={14} />, () =>
                  openCompose("forward", message)
                , isDisabled("forward"))
              : null,
            isVisible("editAsNew")
              ? buildItem("editAsNew", t("editAsNew"), <FileText size={14} />, () =>
                  openCompose("editAsNew", message, true)
                , isDisabled("editAsNew"))
              : null
          ].filter(Boolean),
          [
            isVisible("markRead")
              ? buildItem(
                  "markRead",
                  seen ? t("markUnread") : t("markRead"),
                  seen ? <MailOpen size={14} /> : <Mail size={14} />,
                  () => rowReadAction ? rowReadAction.onSelect() : updateFlagState(message, "seen", !message.seen),
                  isDisabled("markRead")
                )
              : null,
            isVisible("flag")
              ? buildItem(
                  "flag",
                  message.flagged ? t("unflag") : t("flag"),
                  <Flag size={14} />,
                  () => updateFlagState(message, "flagged", !message.flagged),
                  isDisabled("flag")
                )
              : null,
            ...todoItems,
            isVisible("answered")
              ? buildItem(
                  "answered",
                  message.answered ? t("unmarkAnswered") : t("markAnswered"),
                  <MailCheck size={14} />,
                  () => updateFlagState(message, "answered", !message.answered),
                  isDisabled("answered")
                )
              : null
          ],
          [
            isVisible("spam")
              ? buildItem(
                  "spam",
                  inSpamFolder ? t("notSpam") : t("markSpam"),
                  inSpamFolder ? <Shield size={14} /> : <ShieldOff size={14} />,
                  () => (inSpamFolder ? handleMarkNotSpam(message) : handleMarkSpam(message)),
                  isDisabled("spam")
                )
              : null,
            isVisible("archive")
              ? buildItem(
                  "archive",
                  t("archive"),
                  <Archive size={14} />,
                  () => handleArchiveMessage(message),
                  isDisabled("archive")
                )
              : null,
            isVisible("category")
              ? (
                  <DropdownMenu.Sub key="category">
                    <DropdownMenu.SubTrigger disabled={isDisabled("category")}>
                      <span className={styles.menuIcon}>
                        <Tags size={14} />
                      </span>
                      <span className={styles.menuLabel}>{t("category")}</span>
                    </DropdownMenu.SubTrigger>
                    <Theme asChild><DropdownMenu.SubContent className={`${styles.menuContent} ${isMobile ? mobileStyles.messageMenu : ""}`}>
                      <DropdownMenu.Item
                        onSelect={(event) => {
                          event.preventDefault();
                          handleSetCategory(message, null);
                        }}
                      >
                        {menuRadioLabel(selectedCategory === null, t("inboxNone"))}
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        onSelect={(event) => {
                          event.preventDefault();
                          handleSetCategory(message, "newsletter");
                        }}
                      >
                        {menuRadioLabel(selectedCategory === "newsletter", t("newsletters"))}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={(event) => {
                          event.preventDefault();
                          handleSetCategory(message, "notification");
                        }}
                      >
                        {menuRadioLabel(selectedCategory === "notification", t("notifications"))}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={(event) => {
                          event.preventDefault();
                          handleSetCategory(message, "transactional");
                        }}
                      >
                        {menuRadioLabel(selectedCategory === "transactional", t("transactional"))}
                      </DropdownMenu.Item>
                    </DropdownMenu.SubContent></Theme>
                  </DropdownMenu.Sub>
                )
              : null,
            isVisible("topics")
              ? (
                  <DropdownMenu.Sub
                    key="topics"
                    onOpenChange={(open) => { if (open) onFetchSuggestions(message).then(setSuggestions); }}
                  >
                    <DropdownMenu.SubTrigger disabled={isDisabled("topics")}>
                      <span className={styles.menuIcon}><Tags size={14} /></span>
                      <span className={styles.menuLabel}>{t("topics")}</span>
                    </DropdownMenu.SubTrigger>
                    <Theme asChild><DropdownMenu.SubContent className={`${styles.menuContent} ${isMobile ? mobileStyles.messageMenu : ""}`}>
                      {suggestions.length > 0 && (
                        <DropdownMenu.Label>{t("suggested")}</DropdownMenu.Label>
                      )}
                      {suggestions.map((topic: Topic) => {
                        const assigned = message.topics?.some((t) => t.id === topic.id) ?? false;
                        const score = topic.suggestionScore;
                        const scoreLabel = score === undefined ? null
                          : Number.isInteger(score) ? String(score)
                          : score.toFixed(2);
                        return (
                          <DropdownMenu.Item
                            key={topic.id}
                            onSelect={(e) => { e.preventDefault(); onToggleTopic(message, topic.id); }}
                          >
                            <span className={styles.menuIcon}>
                              {assigned ? <CircleDot size={14} /> : <Circle size={14} />}
                            </span>
                            <TopicBadge topic={topic} size="1" />
                            {scoreLabel !== null && (
                              <span style={{ marginLeft: "auto", fontSize: "0.75em", opacity: 0.45 }}>
                                {scoreLabel}
                              </span>
                            )}
                          </DropdownMenu.Item>
                        );
                      })}
                      {(() => {
                        const suggestionIds = new Set(suggestions.map((t) => t.id));
                        const rest = allTopics.filter((t) => !suggestionIds.has(t.id)).slice(0, 10);
                        if (rest.length === 0) return null;
                        return (
                          <>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Label>{t("allTopics")}</DropdownMenu.Label>
                            {rest.map((topic) => {
                              const assigned = message.topics?.some((t) => t.id === topic.id) ?? false;
                              return (
                                <DropdownMenu.Item
                                  key={topic.id}
                                  onSelect={(e) => { e.preventDefault(); onToggleTopic(message, topic.id); }}
                                >
                                  <span className={styles.menuIcon}>
                                    {assigned ? <CircleDot size={14} /> : <Circle size={14} />}
                                  </span>
                                  <TopicBadge topic={topic} size="1" />
                                </DropdownMenu.Item>
                              );
                            })}
                          </>
                        );
                      })()}
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item onSelect={() => onAssignTopics(message)}>
                        <span className={styles.menuIcon}><Tags size={14} /></span>
                        <span className={styles.menuLabel}>{t("manageTopics")}</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.SubContent></Theme>
                  </DropdownMenu.Sub>
                )
              : null,
            isVisible("unsubscribe") && getUnsubscribeCapability(message)
              ? buildItem(
                  "unsubscribe",
                  t("unsubscribe"),
                  <MailX size={14} />,
                  () => handleUnsubscribe(message),
                  isDisabled("unsubscribe")
                )
              : null,
            isVisible("moveTo")
              ? (
                  <MoveToSubmenu
                    key="moveTo"
                    onGetRecentFolders={onGetRecentFolders}
                    onMoveToFolder={(folderId) => onMoveToFolder(message, folderId)}
                    onMoveToOther={() => onMoveTo(message)}
                    disabled={isDisabled("moveTo")}
                  />
                )
              : null,
            hasOtherAccounts && onCopyToAccount && isVisible("copyToAccount")
              ? buildItem(
                  "copyToAccount",
                  t("copyAccount"),
                  <Copy size={14} />,
                  () => onCopyToAccount(message),
                  isDisabled("copyToAccount")
                )
              : null,
            hasOtherAccounts && onMoveToAccount && isVisible("moveToAccount")
              ? buildItem(
                  "moveToAccount",
                  t("moveAccount"),
                  <ArrowRightLeft size={14} />,
                  () => onMoveToAccount(message),
                  isDisabled("moveToAccount")
                )
              : null,
            showDeleteInMenu && isVisible("delete")
              ? buildItem(
                  "delete",
                  isTrashFolder(message.folderId) ? t("deletePermanent") : t("moveTrash"),
                  <Trash2 size={14} />,
                  () => handleDeleteMessage(message, { allowThreadDeletion }),
                  isDisabled("delete")
                )
              : null
          ].filter(Boolean),
          [
            isVisible("showRelated")
              ? buildItem(
                  "showRelated",
                  t("findRelated"),
                  <Search size={14} />,
                  () => onShowRelated(message),
                  isDisabled("showRelated")
                )
              : null,
            isVisible("showThread")
              ? buildItem(
                  "showThread",
                  t("showThread"),
                  <ListTree size={14} />,
                  () => onShowThread(message),
                  isDisabled("showThread")
                )
              : null,
            isVisible("copyLink") ? buildItem("copyLink", t(copyResult === "copied" ? "linkCopied" : copyResult === "failed" ? "linkCopyFailed" : "copyLink"), <Link size={14} />, () => {
              void (async () => {
                try { await navigator.clipboard.writeText(messageDeepLink(message, window.location.origin)); setCopyResult("copied"); }
                catch { setCopyResult("failed"); }
              })();
            }) : null,
            isVisible("openWindow")
              ? buildItem(
                  "openWindow",
                  t("openWindow"),
                  <SquareArrowOutUpRight size={14} />,
                  () => handleOpenInNewWindow(message),
                  isDisabled("openWindow")
                )
              : null,
            isVisible("openHtmlWindow")
              ? buildItem(
                  "openHtmlWindow",
                  t("openHtmlWindow"),
                  <SquareArrowOutUpRight size={14} />,
                  () => handleOpenHtmlInNewWindow(message),
                  isDisabled("openHtmlWindow")
                )
              : null,
            isVisible("downloadEml")
              ? buildItem(
                  "downloadEml",
                  t("downloadEml"),
                  <Download size={14} />,
                  () => handleDownloadEml(message),
                  isDisabled("downloadEml")
                )
              : null,
            isVisible("resync")
              ? buildItem(
                  "resync",
                  t("resync"),
                  <RefreshCw size={14} />,
                  () => handleResyncMessage(message),
                  isDisabled("resync")
                )
              : null
          ]
        ]
          .filter((group) => group.length > 0)
          .map((group, idx, all) => (
            <Fragment key={`group-${idx}`}>
              {group}
              {idx < all.length - 1 && <DropdownMenu.Separator />}
            </Fragment>
          ))}
      </DropdownMenu.Content></Theme>
    </DropdownMenu.Root>
  );
}
