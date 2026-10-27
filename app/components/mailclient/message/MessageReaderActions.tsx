"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Account, AccountDateFormat, Message } from "@/lib/data";
import { buildAccountMessageActionPath, buildAccountMessagePath } from "@/lib/accountApiPaths";
import { roleAtLeast } from "@/lib/accountRole";
import { getMessageDateDisplay } from "@/lib/dateFormatting";
import { isUiLocale } from "@/lib/i18n/config";
import { messageDeepLink } from "@/lib/navigation/deepLinks";
import { buildMessageCopyText } from "@/lib/ui/messageCopyText";
import { isMessageContentUnloaded } from "@/lib/ui/messageView";
import type { NoticeInput } from "../types";
import { AiReplyPromptProvider } from "./AiReplyPrompt";

/** Reader actions that need the mail client (notices, compose, API); absent in hosts without them. */
export type MessageReaderActions = {
  canAiReply: (message: Message) => boolean;
  isAiReplyPending: (messageId: string) => boolean;
  /** `instruction`: what the reply should say (already normalized, max 200 characters); absent = the plain closing reply. */
  draftAiReply: (message: Message, instruction?: string) => Promise<void>;
  /** The message's shell URL: opens it in the browser and resolves in MCP (`resolve_link`). */
  copyLink: (message: Message) => Promise<void>;
  /** Headers, text body and attachment names as plain text. */
  copyContent: (message: Message) => Promise<void>;
};

const MessageReaderActionsContext = createContext<MessageReaderActions | null>(null);

export function MessageReaderActionsProvider({ value, children }: { value: MessageReaderActions; children: ReactNode }) {
  return (
    <MessageReaderActionsContext.Provider value={value}>
      <AiReplyPromptProvider draft={value.draftAiReply}>{children}</AiReplyPromptProvider>
    </MessageReaderActionsContext.Provider>
  );
}

export function useMessageReaderActions() {
  return useContext(MessageReaderActionsContext);
}

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Copy actions report through notices. „KI-Antwort“: the server writes and saves a reply draft (doc/AI-REPLY.md),
 * which then opens in the composer for review. One request per message at a time.
 */
export function useMessageReaderActionsValue(input: {
  aiReplyAvailable: boolean;
  accounts: Account[];
  accountDateFormat?: AccountDateFormat;
  apiFetch: ApiFetch;
  pushNotice: (notice: NoticeInput) => void;
  editDraft: (draft: Message) => void;
}): MessageReaderActions {
  const { aiReplyAvailable, accounts, accountDateFormat, apiFetch, pushNotice, editDraft } = input;
  const t = useTranslations("Reader");
  const tFields = useTranslations("Compose.generated.forwardFields");
  const locale = useLocale();
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const inFlight = useRef(new Set<string>());

  const canAiReply = useCallback((message: Message) => aiReplyAvailable && !message.draft &&
    roleAtLeast(accounts.find(account => account.id === message.accountId)?.accessRole, "editor"), [accounts, aiReplyAvailable]);

  const draftAiReply = useCallback(async (message: Message, instruction?: string) => {
    if (inFlight.current.has(message.id)) return;
    inFlight.current.add(message.id);
    setPending(new Set(inFlight.current));
    try {
      const response = await apiFetch(buildAccountMessageActionPath(message.accountId, message.id, "ai-reply"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(instruction ? { locale, instruction } : { locale })
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

  const copy = useCallback(async (text: () => Promise<string>, copied: string, failed: string) => {
    try {
      await navigator.clipboard.writeText(await text());
      pushNotice({ type: "success", title: copied });
    } catch {
      pushNotice({ type: "error", title: failed });
    }
  }, [pushNotice]);

  const copyLink = useCallback((message: Message) => copy(async () => messageDeepLink(message, window.location.origin),
    t("linkCopied"), t("linkCopyFailed")), [copy, t]);

  const copyContent = useCallback((message: Message) => copy(async () => {
    // List rows carry no body: read it from the detail route like the reader does.
    let full = message;
    if (isMessageContentUnloaded(message)) {
      const response = await apiFetch(buildAccountMessagePath(message.accountId, message.id), { cache: "no-store" });
      // apiFetch does not throw on HTTP errors; an error body is { ok: false, message: "<string>" }.
      const loaded = response.ok ? ((await response.json()) as { message?: unknown }).message : null;
      if (!loaded || typeof loaded !== "object") throw new Error("message_unavailable");
      full = loaded as Message;
    }
    const date = getMessageDateDisplay(full.dateValue, full.date, accountDateFormat, isUiLocale(locale) ? locale : undefined).text;
    return buildMessageCopyText(full, { date, labels: { from: tFields("from"), to: tFields("to"), cc: tFields("cc"), date: tFields("date"),
      subject: tFields("subject"), attachments: t("attachments") } });
  }, t("contentCopied"), t("contentCopyFailed")), [accountDateFormat, apiFetch, copy, locale, t, tFields]);

  return useMemo(() => ({ canAiReply, isAiReplyPending, draftAiReply, copyLink, copyContent }),
    [canAiReply, copyContent, copyLink, draftAiReply, isAiReplyPending]);
}
