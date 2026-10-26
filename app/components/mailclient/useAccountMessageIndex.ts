import { useMemo } from "react";
import type { Message } from "@/lib/data";

/** Immutable indexes for the committed account's list; consumers only look up rows. */
export function useAccountMessageIndex(messages: Message[], accountId: string) {
  return useMemo(() => {
    const messageById = new Map<string, Message>();
    const messageByMessageId = new Map<string, Message>();
    for (const message of messages) {
      if (message.accountId !== accountId) continue;
      messageById.set(message.id, message);
      if (message.messageId) messageByMessageId.set(message.messageId, message);
    }
    return { messageById, messageByMessageId };
  }, [messages, accountId]);
}
