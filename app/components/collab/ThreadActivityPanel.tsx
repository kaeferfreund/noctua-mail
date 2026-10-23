"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/i18n/format";
import { useEffect, useState, type Ref } from "react";
import type { AccountRole } from "@/lib/data";
import { Button } from "@/app/components/ui/button";
import { MarkdownPanel } from "@/app/components/mailclient/RenderHelpers";
import {
  memberInitials,
  memberName,
  THREAD_STATUSES,
  type CollabMember,
  type ThreadComment,
  type ThreadActivity,
  type ThreadStatus,
} from "./types";
export function focusThreadActivity(region: HTMLElement | null) {
  region?.focus({ preventScroll: true });
  region?.scrollIntoView({ behavior: "smooth" });
}

type Translator = ReturnType<typeof useTranslations<"Collaboration">>;

function relativeTime(time: number, t: Translator) {
  const seconds = Math.max(0, (Date.now() - time) / 1000);
  return seconds < 60
    ? t("time.justNow")
    : seconds < 3600
      ? t("time.minutes", {count: Math.floor(seconds / 60)})
      : seconds < 86400
        ? t("time.hours", {count: Math.floor(seconds / 3600)})
        : t("time.days", {count: Math.floor(seconds / 86400)});
}
function activityLabel(item: ThreadActivity, members: CollabMember[], t: Translator) {
  switch (item.type) {
    case "assigned":
      return t("activity.assigned", {name: memberName(members, String(item.payload.assigneeUserId ?? item.payload.to ?? ""), t("formerMember"))});
    case "unassigned":
      return t("activity.unassigned");
    case "status_changed":
      return t("activity.status", {status: THREAD_STATUSES.includes((item.payload.status ?? item.payload.to) as ThreadStatus) ? t(`status.${(item.payload.status ?? item.payload.to) as ThreadStatus}`) : t("activity.updatedStatus")});
    case "reply_sent":
      return t("activity.reply");
    case "comment_deleted":
      return t("activity.noteDeleted");
    case "comment_edited":
      return t("activity.noteEdited");
    default:
      return t("activity.updated");
  }
}
export default function ThreadActivityPanel({
  comments,
  activity,
  members,
  me,
  role,
  pending,
  onDelete,
  ref,
}: {
  ref?: Ref<HTMLElement>;
  comments: ThreadComment[];
  activity: ThreadActivity[];
  members: CollabMember[];
  me: string | null;
  role?: AccountRole;
  pending?: boolean;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const t = useTranslations("Collaboration");
  const locale = useLocale();
  const dateTime = (value: number | string) => formatDate(new Date(value), locale, {hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
  const [, tick] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => tick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const items = [
    ...comments
      .filter((c) => c.deletedAt === null)
      .map((comment) => ({
        id: `comment:${comment.id}`,
        time: comment.createdAt,
        comment,
        activity: null,
      })),
    ...activity
      .filter((a) => a.type !== "comment_added")
      .map((a) => ({
        id: `activity:${a.id}`,
        time: a.createdAt,
        comment: null,
        activity: a,
      })),
  ].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={t("activity.region")}
      className="min-w-0 border-t border-border p-4"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <h3 className="mb-3 text-sm font-semibold">{t("activity.title")}</h3>
      {error && <p role="alert">{t("note.deleteFailed")}</p>}
      {!items.length && (
        <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>
      )}
      <ol className="flex list-none flex-col gap-4 p-0">
        {items.map((item) => {
          const userId =
            item.comment?.authorUserId ?? item.activity?.actorUserId;
          const name = userId ? memberName(members, userId, t("formerMember")) : t("activity.system");
          const canDelete =
            item.comment &&
            (role === "manager" ||
              (role === "editor" && me === item.comment.authorUserId));
          return (
            <li key={item.id} className="flex min-w-0 gap-2">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs"
              >
                {memberInitials(name)}
              </span>
              <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{name}</span>
                  <time
                    dateTime={new Date(item.time).toISOString()}
                    title={dateTime(item.time)}
                  >
                    {relativeTime(item.time, t)}
                  </time>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      disabled={pending}
                      onClick={async () => {
                        if (!(await onDelete(item.comment!.id)))
                          setError(true);
                        else setError(false);
                      }}
                      aria-label={t("note.deleteBy", {name})}
                    >
                      {t("note.delete")}</Button>
                  )}
                </div>
                {item.comment ? (
                  <MarkdownPanel body={item.comment.body} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {activityLabel(item.activity!, members, t)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
