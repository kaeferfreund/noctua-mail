import type { Message } from "@/lib/data";
import { getThreadCollabStates, type ThreadCollabState } from "@/lib/threadCollab";
type CollabLoader = (accountId: string, threadIds: string[]) => Promise<Map<string, ThreadCollabState>>;
export async function enrichMessagesWithThreadCollab(items: Message[], options: {
  accountId: string;
  loadThreadCollabStates?: CollabLoader;
}) {
  const scoped = items.filter(item => item.accountId === options.accountId && item.threadId?.trim());
  const ids = [...new Set(scoped.map(item => item.threadId.trim()))];
  if (!ids.length)
    return;
  const states = await (options.loadThreadCollabStates ?? getThreadCollabStates)(options.accountId, ids);
  for (const item of scoped) {
    const state = states.get(item.threadId.trim());
    item.collab = {
      status: state?.status ?? "open", assigneeUserId: state?.assigneeUserId ?? null,
      commentCount: state?.commentCount ?? 0, updatedAt: state?.updatedAt ?? 0
    };
  }
}
