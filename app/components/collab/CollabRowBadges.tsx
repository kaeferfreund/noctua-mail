"use client";
import { useTranslations } from "next-intl";
import { useContext } from "react";
import type { Message } from "@/lib/data";
import {
  CollabRowsContext,
  memberName,
  memberInitials,
  STATUS_STYLES,
  type CollabMember,
} from "./types";
export default function CollabRowBadges({
  message,
  members: explicitMembers,
}: {
  message: Pick<Message, "threadId" | "collab">;
  members?: CollabMember[];
}) {
  const t = useTranslations("Collaboration");
  const context = useContext(CollabRowsContext);
  const cached = context.threadCollabById.get(message.threadId);
  const state =
    cached && (!message.collab || cached.updatedAt > message.collab.updatedAt)
      ? cached
      : message.collab;
  if (!state || (state.status === "open" && !state.assigneeUserId)) return null;
  const name = state.assigneeUserId
    ? memberName(explicitMembers ?? context.members, state.assigneeUserId, t("formerMember"))
    : null;
  return (
    <span
      data-collab-thread={message.threadId}
      className="inline-flex shrink-0 items-center gap-1 text-[10px] leading-4"
    >
      {name && (
        <span
          title={name}
          aria-label={t("assignee.named", {name})}
          className="inline-flex size-5 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground"
        >
          {!(explicitMembers ?? context.members).some(
            (member) =>
              member.userId === state.assigneeUserId && !member.disabled,
          )
            ? "?"
            : memberInitials(name)}
        </span>
      )}
      {state.status !== "open" && (
        <span
          className="rounded px-1.5 py-0.5"
          style={STATUS_STYLES[state.status]}
        >
          {t(`status.${state.status}`)}
        </span>
      )}
    </span>
  );
}
