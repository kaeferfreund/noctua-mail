import { useTranslations } from "next-intl";
import type React from "react";
import { Clock, Edit3, Forward, Reply, ReplyAll, Search, Send, Trash2 } from "lucide-react";
import type { Message } from "@/lib/data";
import { hasSendableRecipients } from "../utils/messageHelpers";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import { useDraftScheduleAction } from "../scheduledSend/ScheduledSend";

type ComposeMode = "new" | "reply" | "replyAll" | "forward" | "edit" | "editAsNew";
type MessageQuickAction =
  | "editDraft"
  | "sendDraft"
  | "scheduleDraft"
  | "reply"
  | "replyAll"
  | "forward"
  | "showRelated"
  | "delete";

type MessageQuickActionsProps = {
  message: Message;
  iconSize?: number;
  origin?: "list" | "thread" | "table";
  isDraft: boolean;
  actionVisibility?: Partial<Record<MessageQuickAction, boolean>>;
  pendingMessageActions: Set<string>;
  openCompose: (mode: ComposeMode, message?: Message, asNew?: boolean) => void;
  handleDeleteMessage: (message: Message, options?: { allowThreadDeletion?: boolean }) => void;
  onShowRelated: (message: Message) => void;
  onSendDraft?: (message: Message) => void | Promise<void>;
  isTrashFolder: (folderId?: string) => boolean;
};

export default function MessageQuickActions({
  message,
  iconSize = 12,
  origin = "list",
  isDraft,
  actionVisibility,
  pendingMessageActions,
  openCompose,
  handleDeleteMessage,
  onShowRelated,
  onSendDraft,
  isTrashFolder
}: MessageQuickActionsProps) {
  const t = useTranslations("Reader");
  const tSchedule = useTranslations("Compose.schedule");
  const scheduleDraft = useDraftScheduleAction(message);
  const allowThreadDeletion = origin !== "thread";
  const buttonSize = origin === "thread" ? "2" : "1";
  const isVisible = (action: MessageQuickAction, defaultValue = true) =>
    actionVisibility?.[action] ?? defaultValue;

  if (isDraft) {
    const canSendDraft = hasSendableRecipients(message);
    return (
      <>
        {isVisible("editDraft") ? (
          <TooltipIconButton
            size={buttonSize}
            variant="ghost"
            color="gray"
            tooltip={t("editDraft")}
            disabled={pendingMessageActions.has(message.id)}
            onClick={(event) => {
              event.stopPropagation();
              openCompose("edit", message);
            }}
          >
            <Edit3 size={iconSize} />
          </TooltipIconButton>
        ) : null}
        {isVisible("sendDraft") && onSendDraft ? (
          <TooltipIconButton
            size={buttonSize}
            variant="ghost"
            color="gray"
            tooltip={t("sendDraft")}
            disabled={pendingMessageActions.has(message.id) || !canSendDraft}
            onClick={(event) => {
              event.stopPropagation();
              void onSendDraft(message);
            }}
          >
            <Send size={iconSize} />
          </TooltipIconButton>
        ) : null}
        {isVisible("scheduleDraft") && scheduleDraft ? (
          <TooltipIconButton
            size={buttonSize}
            variant="ghost"
            color="gray"
            tooltip={tSchedule("title")}
            aria-label={tSchedule("title")}
            data-message-action="schedule"
            disabled={pendingMessageActions.has(message.id) || !canSendDraft || scheduleDraft.busy}
            onClick={(event) => {
              event.stopPropagation();
              scheduleDraft.open();
            }}
          >
            <Clock size={iconSize} />
          </TooltipIconButton>
        ) : null}
        {isVisible("showRelated") ? (
          <TooltipIconButton
            size={buttonSize}
            variant="ghost"
            color="gray"
            data-message-action="related"
            tooltip={t("findRelated")}
            disabled={pendingMessageActions.has(message.id)}
            onClick={(event) => {
              event.stopPropagation();
              onShowRelated(message);
            }}
          >
            <Search size={iconSize} />
          </TooltipIconButton>
        ) : null}
        {isVisible("delete") ? (
          <TooltipIconButton
            size={buttonSize}
            variant="ghost"
            color="gray"
            tooltip={isTrashFolder(message.folderId) ? t("deletePermanent") : t("moveTrash")}
            data-message-action="delete"
            aria-label={t("delete")}
            disabled={pendingMessageActions.has(message.id)}
            onClick={(event) => {
              event.stopPropagation();
              handleDeleteMessage(message, { allowThreadDeletion });
            }}
          >
            <Trash2 size={iconSize} />
          </TooltipIconButton>
        ) : null}
      </>
    );
  }

  return (
    <>
      {isVisible("reply") ? (
        <TooltipIconButton
          size={buttonSize}
          variant="ghost"
          color="gray"
          tooltip={t("reply")}
          disabled={pendingMessageActions.has(message.id)}
          onClick={(event) => {
            event.stopPropagation();
            openCompose("reply", message);
          }}
        >
          <Reply size={iconSize} />
        </TooltipIconButton>
      ) : null}
      {isVisible("replyAll") ? (
        <TooltipIconButton
          size={buttonSize}
          variant="ghost"
          color="gray"
          tooltip={t("replyAll")}
          disabled={pendingMessageActions.has(message.id)}
          onClick={(event) => {
            event.stopPropagation();
            openCompose("replyAll", message);
          }}
        >
          <ReplyAll size={iconSize} />
        </TooltipIconButton>
      ) : null}
      {isVisible("forward") ? (
        <TooltipIconButton
          size={buttonSize}
          variant="ghost"
          color="gray"
          tooltip={t("forward")}
          disabled={pendingMessageActions.has(message.id)}
          onClick={(event) => {
            event.stopPropagation();
            openCompose("forward", message);
          }}
        >
          <Forward size={iconSize} />
        </TooltipIconButton>
      ) : null}
      {isVisible("showRelated") ? (
        <TooltipIconButton
          size={buttonSize}
          variant="ghost"
          color="gray"
          data-message-action="related"
          tooltip={t("findRelated")}
          disabled={pendingMessageActions.has(message.id)}
          onClick={(event) => {
            event.stopPropagation();
            onShowRelated(message);
          }}
        >
          <Search size={iconSize} />
        </TooltipIconButton>
      ) : null}
      {isVisible("delete") ? (
        <TooltipIconButton
          size={buttonSize}
          variant="ghost"
          color="gray"
          tooltip={isTrashFolder(message.folderId) ? t("deletePermanent") : t("moveTrash")}
          data-message-action="delete"
          aria-label={t("delete")}
          disabled={pendingMessageActions.has(message.id)}
          onClick={(event) => {
            event.stopPropagation();
            handleDeleteMessage(message, { allowThreadDeletion });
          }}
        >
          <Trash2 size={iconSize} />
        </TooltipIconButton>
      ) : null}
    </>
  );
}
