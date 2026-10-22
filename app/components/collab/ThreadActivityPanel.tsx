"use client";
import { useEffect, useState, type Ref } from "react";
import type { AccountRole } from "@/lib/data";
import { Button } from "@/app/components/ui/button";
import { MarkdownPanel } from "@/app/components/mailclient/RenderHelpers";
import {
  memberInitials,
  memberName,
  STATUS_LABELS,
  type CollabMember,
  type ThreadComment,
  type ThreadActivity,
  type ThreadStatus,
} from "./types";
export function focusThreadActivity(region: HTMLElement | null) {
  region?.focus({ preventScroll: true });
  region?.scrollIntoView({ behavior: "smooth" });
}

function relativeTime(time: number) {
  const seconds = Math.max(0, (Date.now() - time) / 1000);
  return seconds < 60
    ? "just now"
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : seconds < 86400
        ? `${Math.floor(seconds / 3600)}h ago`
        : `${Math.floor(seconds / 86400)}d ago`;
}
function activityLabel(item: ThreadActivity, members: CollabMember[]) {
  switch (item.type) {
    case "assigned":
      return `Assigned to ${memberName(members, String(item.payload.assigneeUserId ?? item.payload.to ?? ""))}`;
    case "unassigned":
      return "Removed assignee";
    case "status_changed":
      return `Status: ${STATUS_LABELS[(item.payload.status ?? item.payload.to) as ThreadStatus] ?? "Updated"}`;
    case "reply_sent":
      return "Sent a reply";
    case "comment_deleted":
      return "Deleted an internal note";
    case "comment_edited":
      return "Edited an internal note";
    default:
      return "Updated conversation";
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
  const [, tick] = useState(0);
  const [error, setError] = useState("");
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
      aria-label="Internal notes and activity"
      className="min-w-0 border-t border-border p-4"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <h3 className="mb-3 text-sm font-semibold">Notes & activity</h3>
      {error && <p role="alert">{error}</p>}
      {!items.length && (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      )}
      <ol className="flex list-none flex-col gap-4 p-0">
        {items.map((item) => {
          const userId =
            item.comment?.authorUserId ?? item.activity?.actorUserId;
          const name = userId ? memberName(members, userId) : "System";
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
                    title={new Date(item.time).toLocaleString()}
                  >
                    {relativeTime(item.time)}
                  </time>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      disabled={pending}
                      onClick={async () => {
                        if (!(await onDelete(item.comment!.id)))
                          setError("Could not delete note.");
                        else setError("");
                      }}
                      aria-label={`Delete note by ${name}`}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                {item.comment ? (
                  <MarkdownPanel body={item.comment.body} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {activityLabel(item.activity!, members)}
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
