"use client";

import { useTranslations } from "next-intl";
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
}: {
  collab: ThreadCollabController;
  role?: AccountRole;
  onNote: () => void;
  onActivity: () => void;
}) {
  const t = useTranslations("Collaboration");
  const commentCount = collab.state?.commentCount ?? 0;
  const readOnly = collab.readDenied || !role || role === "viewer";
  return (
    <div
      onKeyDown={(e) => e.stopPropagation()}
      className="flex min-w-0 flex-col gap-2"
      aria-label={t("bar.label")}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
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
        >
          {t("bar.noteCount", {count: commentCount})}
        </Button>
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNote}
            disabled={!collab.state}
          >
            {t("bar.note")}</Button>
        )}
      </div>
      {collab.loading && (
        <span role="status" className="text-xs text-muted-foreground">
          {t("bar.loading")}</span>
      )}
      {collab.error && (
        <div role="alert" className="text-sm text-destructive">
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
