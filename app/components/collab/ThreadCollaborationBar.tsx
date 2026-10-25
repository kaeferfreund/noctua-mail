"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, MessageSquarePlus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import type { AccountRole } from "@/lib/data";
import type { ThreadCollabController } from "@/app/hooks/useThreadCollab";
import AssigneeCombobox from "./AssigneeCombobox";
import StatusSelect from "./StatusSelect";
export default function ThreadCollaborationBar({
  collab,
  role,
  onNote,
  onActivity,
  actions,
}: {
  collab: ThreadCollabController;
  role?: AccountRole;
  onNote: () => void;
  onActivity: () => void;
  /** Reader controls at the end of the row; they keep the first line while the bar's own controls wrap. */
  actions?: ReactNode;
}) {
  const t = useTranslations("Collaboration");
  const commentCount = collab.state?.commentCount ?? 0;
  const readOnly = collab.readDenied || !role || role === "viewer";
  return (
    <div
      className="flex min-w-0 flex-col gap-2"
      aria-label={t("bar.label")}
    >
      <div className="flex min-w-0 items-start gap-2">
        {/* Phones keep the row on one line: notes become icon buttons, the assignee truncates. */}
        <div onKeyDown={(e) => e.stopPropagation()} className="flex min-w-0 flex-1 flex-wrap items-center gap-2 max-md:flex-nowrap">
          <AssigneeCombobox
            value={collab.state?.assigneeUserId ?? null}
            members={collab.members}
            me={collab.me}
            disabled={readOnly || collab.pending || !collab.state}
            onChange={(id) => {
              void collab.update({ assigneeUserId: id });
            }}
          />
          <StatusSelect
            value={collab.state?.status ?? "open"}
            disabled={readOnly || collab.pending || !collab.state}
            onChange={(status) => {
              void collab.update({ status });
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onActivity}
            aria-label={t("bar.internalNoteCount", {count: commentCount})}
            className="max-md:h-8"
          >
            <MessageSquare className="md:hidden" aria-hidden />
            <span className="md:hidden">{commentCount}</span>
            <span className="hidden md:inline">{t("bar.noteCount", {count: commentCount})}</span>
          </Button>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNote}
              disabled={!collab.state}
              aria-label={t("bar.note")}
              className="max-md:size-8 max-md:px-0"
            >
              <MessageSquarePlus className="md:hidden" aria-hidden />
              <span className="hidden md:inline">{t("bar.note")}</span>
            </Button>
          )}
        </div>
        {actions && <div className="ml-auto flex h-7 shrink-0 items-center gap-3">{actions}</div>}
      </div>
      {collab.loading && (
        <span role="status" className="text-xs text-muted-foreground">
          {t("bar.loading")}</span>
      )}
      {collab.error && (
        <div role="alert" className="text-sm text-destructive" onKeyDown={(e) => e.stopPropagation()}>
          {collab.error}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void collab.reload().catch(() => {});
            }}
          >
            {t("bar.retry")}</Button>
        </div>
      )}
    </div>
  );
}
