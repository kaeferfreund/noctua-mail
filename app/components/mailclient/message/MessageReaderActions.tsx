"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Account, Message } from "@/lib/data";
import { buildAccountMessageActionPath, buildAccountMessagePath } from "@/lib/accountApiPaths";
import { roleAtLeast } from "@/lib/accountRole";
import type { NoticeInput } from "../types";

/** Reader actions that need the mail client (notices, compose, API); absent in hosts without them. */
export type MessageReaderActions = {
  canAiReply: (message: Message) => boolean;
  isAiReplyPending: (messageId: string) => boolean;
  draftAiReply: (message: Message) => Promise<void>;
};

const MessageReaderActionsContext = createContext<MessageReaderActions | null>(null);

export function MessageReaderActionsProvider({ value, children }: { value: MessageReaderActions; children: ReactNode }) {
  return <MessageReaderActionsContext.Provider value={value}>{children}</MessageReaderActionsContext.Provider>;
}

export function useMessageReaderActions() {
  return useContext(MessageReaderActionsContext);
}

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * „KI-Antwort“: the server writes and saves a reply draft (doc/AI-REPLY.md),
 * which then opens in the composer for review. One request per message at a time.
 */
export function useMessageReaderActionsValue(input: {
  aiReplyAvailable: boolean;
  accounts: Account[];
  apiFetch: ApiFetch;
  pushNotice: (notice: NoticeInput) => void;
  editDraft: (draft: Message) => void;
}): MessageReaderActions {
  const { aiReplyAvailable, accounts, apiFetch, pushNotice, editDraft } = input;
  const t = useTranslations("Reader");
  const locale = useLocale();
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const inFlight = useRef(new Set<string>());

  const canAiReply = useCallback((message: Message) => aiReplyAvailable && !message.draft &&
    roleAtLeast(accounts.find(account => account.id === message.accountId)?.accessRole, "editor"), [accounts, aiReplyAvailable]);

  const draftAiReply = useCallback(async (message: Message) => {
    if (inFlight.current.has(message.id)) return;
    inFlight.current.add(message.id);
    setPending(new Set(inFlight.current));
    try {
      const response = await apiFetch(buildAccountMessageActionPath(message.accountId, message.id, "ai-reply"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale })
      }).catch(() => null);
      const data = (await response?.json().catch(() => null)) as { ok?: boolean; draftId?: string | null; message?: Message | null } | null;
      if (!response?.ok || !data?.ok) {
        const title = response?.status === 503 ? t("aiReplyUnavailable") : response?.status === 429 ? t("aiReplyRateLimited") : t("aiReplyFailed");
        pushNotice({ type: "error", title });
        return;
      }
      let draft = data.message ?? null;
      if (!draft && data.draftId) {
        const loaded = await apiFetch(buildAccountMessagePath(message.accountId, data.draftId), { cache: "no-store" }).catch(() => null);
        draft = loaded?.ok ? ((await loaded.json().catch(() => null)) as { message?: Message } | null)?.message ?? null : null;
      }
      if (draft) editDraft(draft);
      else pushNotice({ type: "error", title: t("aiReplyFailed") });
    } finally {
      inFlight.current.delete(message.id);
      setPending(new Set(inFlight.current));
    }
  }, [apiFetch, editDraft, locale, pushNotice, t]);

  const isAiReplyPending = useCallback((messageId: string) => pending.has(messageId), [pending]);

  return useMemo(() => ({ canAiReply, isAiReplyPending, draftAiReply }), [canAiReply, draftAiReply, isAiReplyPending]);
}
