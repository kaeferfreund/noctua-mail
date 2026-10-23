"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { senderMessages, isSenderMessageId, type SenderCopy, type SenderMessageId } from "@/lib/senderMessages";

export function useSenderMessages() {
  const t = useTranslations();
  const resolve = useCallback((id: SenderMessageId, values?: Record<string, string>) => t(id, values), [t]);
  const messages = useMemo(() => Object.fromEntries(Object.entries(senderMessages).map(([key, id]) =>
    [key, resolve(id, { sender: "{sender}", email: "{email}" })])) as SenderCopy, [resolve]);
  // Unknown text belongs to legacy controls; do not treat it as a catalog ID.
  const renderMessage = useCallback((message: string) => isSenderMessageId(message) ? resolve(message) : message, [resolve]);
  return { messages, renderMessage, resolve };
}
