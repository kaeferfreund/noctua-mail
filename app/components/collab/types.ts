import { createContext } from "react";
import type { Message, AccountRole } from "@/lib/data";
export type {
  ThreadCollabState,
  ThreadComment,
  ThreadActivity,
  ThreadCollabPatch,
  ThreadStatus,
} from "@/lib/threadCollab";
export type CollabMember = {
  userId: string;
  name: string;
  email: string;
  role: AccountRole;
  isOwner: boolean;
  disabled?: boolean;
};
export type CollabSummary = NonNullable<Message["collab"]>;
export const STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting",
  closed: "Closed",
} as const;
export const STATUS_STYLES = {
  open: { background: "var(--gray-3)", color: "var(--gray-11)" },
  in_progress: { background: "var(--iris-3)", color: "var(--iris-11)" },
  waiting: { background: "var(--amber-3)", color: "var(--amber-11)" },
  closed: { background: "var(--green-3)", color: "var(--green-11)" },
};
export function memberName(members: CollabMember[], userId: string) {
  const member = members.find((m) => m.userId === userId && !m.disabled);
  return member ? member.name.trim() || member.email : "Former member";
}
export function memberInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
export const CollabRowsContext = createContext<{
  members: CollabMember[];
  threadCollabById: Map<string, CollabSummary>;
}>({ members: [], threadCollabById: new Map() });
