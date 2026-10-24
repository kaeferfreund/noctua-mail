import type { Folder, Message } from "@/lib/data";
import { getFolders, getMessageById } from "@/lib/serverDb";
import { findJunkFolder, findTrashFolder, isSpamFolder, isTrashFolder } from "@/lib/specialFolders";
import { markMessageNotSuspicious, recordSpamDecision } from "./examples";
import type { SpamLabel } from "./types";

/**
 * Learning from folder moves (briefs/spam/move-learning.md): a user who drags
 * a mail into Junk has said "Als Spam", one who moves it out of Junk has said
 * "Kein Spam". Every user-driven move path (move route and its job runner,
 * archive route) calls `learnFromMessageMove` once after the IMAP move and the
 * local relocation succeeded. System moves — the classifier's auto-move,
 * `scripts/spam-apply.ts`, sync relocations — and the explicit spam/not-spam
 * routes never call it: they store their own example (or none), so a message
 * gets at most one example per decision. A repeated call for the same move is
 * harmless as well: `saveSpamExample` replaces the sender+subject entry.
 */
export type MoveLearningDecision = SpamLabel | null;

export type MessageMoveForLearning = {
  accountId: string;
  messageId: string;
  sourceFolderId: string;
  destinationFolderId: string;
  /** The acting user, like the spam routes record it; null for a move without a session. */
  userId: string | null;
};

const isJunkFolder = (folderId: string, folders: Folder[], accountId: string) =>
  folderId === findJunkFolder(folders, accountId)?.id || isSpamFolder(folderId, folders);

const isTrash = (folderId: string, folders: Folder[], accountId: string) =>
  folderId === findTrashFolder(folders, accountId)?.id || isTrashFolder(folderId, folders);

/**
 * Pure classification: into Junk → "spam"; out of Junk to a non-Junk, non-Trash
 * folder → "ham"; Junk → Trash and non-Junk → non-Junk → nothing.
 */
export function classifyMoveForLearning(
  move: Pick<MessageMoveForLearning, "accountId" | "sourceFolderId" | "destinationFolderId">,
  folders: Folder[]
): MoveLearningDecision {
  if (move.sourceFolderId === move.destinationFolderId) return null;
  const sourceJunk = isJunkFolder(move.sourceFolderId, folders, move.accountId);
  const destinationJunk = isJunkFolder(move.destinationFolderId, folders, move.accountId);
  if (destinationJunk) return sourceJunk ? null : "spam";
  if (!sourceJunk) return null;
  return isTrash(move.destinationFolderId, folders, move.accountId) ? null : "ham";
}

/**
 * Records the decision a completed move implies. Never throws: the move has
 * already happened and must not be reported as failed.
 */
export async function learnFromMessageMove(
  move: MessageMoveForLearning,
  preloaded?: { folders?: Folder[]; message?: Message | null }
): Promise<MoveLearningDecision> {
  try {
    const folders = preloaded?.folders ?? await getFolders(move.accountId);
    const decision = classifyMoveForLearning(move, folders);
    if (!decision) return null;
    const message = preloaded?.message ?? await getMessageById(move.accountId, move.messageId);
    if (!message) return null;
    if (decision === "spam") {
      await recordSpamDecision({ accountId: move.accountId, message, label: "spam", source: "move-junk", userId: move.userId });
      // Same effect as "Als Spam": the sender loses trusted-sender status everywhere; lazy like the route (AI SDK).
      await import("./service")
        .then(({ revokeSenderTrust }) => revokeSenderTrust(move.accountId, message.from))
        .catch((error) => console.warn("[spam] failed to revoke sender trust", { accountId: move.accountId, error: String(error) }));
    } else {
      await recordSpamDecision({ accountId: move.accountId, message, label: "ham", source: "move-from-junk", userId: move.userId });
      await markMessageNotSuspicious(move.accountId, message.id);
    }
    return decision;
  } catch (error) {
    console.warn("[spam] failed to learn from move", { accountId: move.accountId, messageId: move.messageId, error: String(error) });
    return null;
  }
}

/** One batch of completed moves of the same account: the folder list is read once. */
export async function learnFromMessageMoves(moves: MessageMoveForLearning[]) {
  const accountId = moves[0]?.accountId;
  if (!accountId) return;
  let folders: Folder[];
  try {
    folders = await getFolders(accountId);
  } catch (error) {
    console.warn("[spam] failed to learn from moves", { accountId, error: String(error) });
    return;
  }
  for (const move of moves) {
    if (move.accountId !== accountId || !classifyMoveForLearning(move, folders)) continue;
    await learnFromMessageMove(move, { folders });
  }
}
