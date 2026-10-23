import type { Message } from "@/lib/data";

export type ContinueAfterRemoval = (removedIds: string[], navigationRows?: Message[]) => boolean;

/** Next rendered row, then previous, then the end of the reading sequence. */
export function nextMessageAfterRemoval(rows: Message[], removed: Set<string>): Message | null {
  const indices = rows.flatMap((row, index) => removed.has(row.id) ? [index] : []);
  if (!indices.length) return null;
  return rows.slice(Math.max(...indices) + 1).find(row => !removed.has(row.id))
    ?? rows.slice(0, Math.min(...indices)).reverse().find(row => !removed.has(row.id))
    ?? null;
}
