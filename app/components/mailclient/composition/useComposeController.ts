import { senderMessages } from "@/lib/senderMessages";
import { prepareSignatureTemplate, renderSignatureTemplate, replaceSignatureBlock } from "@/lib/signatureTemplates";
import type { SenderSettings } from "@/lib/ui/senderSettings";
import type React from "react";
import { useMemo } from "react";
import type { Account, AccountDateFormat, Message, SenderIdentity } from "@/lib/data";
import { formatAccountMediumDateTime } from "@/lib/dateFormatting";
import { assembleQuotedHtml } from "@/lib/html";
import { areMarkdownConvertersReady, loadMarkdownConverters } from "@/lib/markdownConvert";
import { buildComposePayload as buildComposePayloadFn } from "./composeContentBuilder";
import { computeComposeInitState } from "./composeInitState";
import type { ComposeMode, ComposeTab } from "./composeTypes";
import type { ComposeState } from "./useComposeState";
import { useMarkdownConverters } from "./useMarkdownConverters";

type UseComposeControllerParams = {
  compose: ComposeState;
  currentAccount: Account | null;
  defaultSignatureId: string;
  sender?: SenderSettings | null;
  accountDateFormat: AccountDateFormat;
  stripHtml: (value: string) => string;
  normalizeHtmlDerivedText: (value: string) => string;
  setDraftSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setDraftSavedAt: React.Dispatch<React.SetStateAction<number | null>>;
  setDraftSaveError: React.Dispatch<React.SetStateAction<string | null>>;
  findMessageByMessageId?: (messageId: string) => Message | undefined;
};

export function useComposeController({
  compose,
  currentAccount,
  defaultSignatureId,
  sender,
  accountDateFormat,
  stripHtml,
  normalizeHtmlDerivedText,
  setDraftSaving,
  setDraftSavedAt,
  setDraftSaveError,
  findMessageByMessageId
}: UseComposeControllerParams) {
  // Recompute the orchestrator's render-time draft status after the lazy load.
  useMarkdownConverters(compose.composeOpen);
  const {
    composeDirtyRef,
    composeSignatureRef,
    composeEditorSnapshotRef,
    lastDraftHashRef,
    currentDraftHashRef,
    composeBaselineHashRef,
    composeEditorInitRef,
    composeLastEditedRef,
    composeBodyDebounceRef,
    composeMarkdownRef
  } = compose;

  const applySignatureToCompose = (signature: { id: string; body: string } | null, selectedIdentity?: SenderIdentity) => {
    const identity = selectedIdentity ?? sender?.identities.find(item => item.id === compose.composeIdentityId);
    const prepared = signature ? prepareSignatureTemplate(signature.body) : null;
    const next = signature ? { id: signature.id, ...renderSignatureTemplate(prepared!.body, sender?.user ?? { email: "" }, identity) } : null;
    const snapshot = compose.composeTab === "html" ? composeEditorSnapshotRef.current?.() : undefined;
    const previous = composeSignatureRef.current;
    if (!previous && !next) return true;
    const tab = compose.composeTab;
    const body = tab === "html" ? snapshot?.html ?? compose.composeHtml : tab === "markdown" ? compose.composeMarkdownRef.current : (compose.composeTextRef.current?.value ?? compose.composeBody);
    const replacement = replaceSignatureBlock(body, tab === "html" ? previous?.html : tab === "markdown" ? previous?.markdown ?? previous?.text : previous?.text, tab === "html" ? next?.html ?? "" : tab === "markdown" ? next?.markdown ?? "" : next?.text ?? "", tab === "html" ? "" : "\n\n");
    if (replacement.conflict && !window.confirm(next ? senderMessages.confirmKeepEditedSignature : senderMessages.confirmKeepEditedWithoutSignature)) return false;
    const value = replacement.conflict ? [body, tab === "html" ? next?.html : tab === "markdown" ? next?.markdown : next?.text].filter(Boolean).join(tab === "html" ? "" : "\n\n") : replacement.body;
    // A signature change is a body edit in the current representation. Cancel
    // delayed keystrokes so they cannot overwrite it after a format switch.
    if (composeBodyDebounceRef.current) {
      clearTimeout(composeBodyDebounceRef.current);
      composeBodyDebounceRef.current = null;
    }
    composeLastEditedRef.current = tab;
    if (tab === "markdown") composeMarkdownRef.current = value;
    if (tab === "html") { compose.setComposeHtml(value); compose.setComposeHtmlText(stripHtml(value)); }
    else if (tab === "markdown") compose.setComposeMarkdown(value);
    else compose.setComposeBody(value);
    if (prepared?.warnings.length) compose.setComposeSenderWarnings(previous => [...new Set([...previous, ...prepared.warnings])]);
    composeEditorInitRef.current = false;
    compose.setComposeEditorReset(prev => prev + 1);
    composeDirtyRef.current = true;
    composeSignatureRef.current = next;
    compose.setComposeSignatureId(next?.id ?? "");
    return true;
  };

  // Cache the assembled quoted HTML across calls — buildComposePayload runs on
  // every keystroke (autosave hashing), and assembleQuotedHtml does CSS scoping
  // that's expensive for large styled emails. Recomputes only when the parts or
  // the quote-html flag actually change.
  const assembledQuotedHtml = useMemo(() => {
    if (!compose.composeQuotedParts) return null;
    return assembleQuotedHtml(compose.composeQuotedParts, compose.composeQuoteHtml);
  }, [compose.composeQuotedParts, compose.composeQuoteHtml]);

  const buildComposePayload = (options?: { preferText?: boolean }) => {
    if (!areMarkdownConvertersReady()) {
      // The orchestrator asks for a hash during render, including while closed
      // or loading. This is an empty status snapshot, never a save/send payload:
      // autosave waits for readiness, manual/handoff saves await the loader,
      // and send awaits flushPendingDraftSaves before calling this builder.
      return { text: "", html: undefined, markdown: undefined, attachments: [],
        composeFormat: compose.composeTab };
    }
    return buildComposePayloadFn(
      {
        composeTab: compose.composeTab,
        composeBody: compose.composeTextRef.current?.value || compose.composeBody,
        composeHtml: compose.composeHtml,
        composeMarkdown: compose.composeMarkdownRef.current,
        composeQuotedHtml: compose.composeQuotedHtml,
        composeQuotedHtmlEdited: compose.composeQuotedHtmlEdited,
        composeIncludeOriginal: compose.composeIncludeOriginal,
        composeStripImages: compose.composeStripImages,
        composeAttachments: compose.composeAttachments,
        composeAssembledQuotedHtml: assembledQuotedHtml
      },
      { stripHtml, normalizeHtmlDerivedText },
      options
    );
  };

  const openCompose = (
    mode: ComposeMode,
    message?: Message,
    asNew = false,
    options?: { preferredComposeTab?: ComposeTab; sender?: SenderSettings; skipSignature?: boolean }
  ) => {
    // Keep initialization synchronous: the caller applies prefill, restored
    // semantics and attachments immediately after this call. The body field
    // gates conversion controls; persistence gates conversion independently.
    void loadMarkdownConverters().catch(() => { /* The field offers retry. */ });
    // Reset refs and async state
    lastDraftHashRef.current = "";
    currentDraftHashRef.current = "";
    composeBaselineHashRef.current = null;
    composeDirtyRef.current = false;
    composeEditorInitRef.current = false;
    const draftSaveTimerRef = compose.draftSaveTimerRef;
    const pendingDraftSaveRef = compose.pendingDraftSaveRef;
    const composeSessionVersionRef = compose.composeSessionVersionRef;
    if (draftSaveTimerRef.current !== null) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    pendingDraftSaveRef.current = null;
    composeSessionVersionRef.current += 1;
    setDraftSaving(false);
    setDraftSavedAt(null);
    setDraftSaveError(null);
    composeSignatureRef.current = null;

    // Reset shared state
    compose.setComposeEditorReset((prev) => prev + 1);
    compose.setComposeAttachments([]);
    compose.setComposeDragActive(false);
    compose.setPendingImageDrop(null);
    compose.setComposeMode(mode);
    compose.setComposeOpenedAt(formatAccountMediumDateTime(Date.now(), accountDateFormat) ?? "");
    compose.setComposeSignatureId(defaultSignatureId ?? "");

    // Compute mode-specific fields
    const fields = computeComposeInitState(
      mode,
      message,
      asNew,
      {
        sender: options?.sender ?? sender ?? undefined,
        skipSignature: options?.skipSignature,
        accountEmail: options?.sender?.account.email ?? currentAccount?.email ?? "",
        ownAddresses: options?.sender?.account.ownAddresses ?? currentAccount?.ownAddresses,
        accountDateFormat,
        preferredComposeTab: options?.preferredComposeTab,
        findMessageByMessageId
      },
      { stripHtml, normalizeHtmlDerivedText }
    );

    compose.setComposeIdentityId(fields.identityId);
    compose.setComposeUnavailableFrom(fields.unavailableFrom);
    compose.setComposeSenderWarnings(fields.warnings);
    composeSignatureRef.current = fields.signature ?? null;
    compose.setComposeSignatureId(fields.signature?.id ?? "");

    // Apply fields to state
    compose.setComposeDraftId(fields.composeDraftId);
    compose.setComposeReplyMessage(fields.composeReplyMessage);
    compose.setComposeReplyHeaders(fields.composeReplyHeaders);
    compose.setComposeTo(fields.composeTo);
    compose.setComposeCc(fields.composeCc);
    compose.setComposeBcc(fields.composeBcc);
    compose.setComposeShowBcc(fields.composeShowBcc);
    compose.setComposeSubject(fields.composeSubject);
    compose.setComposeBody(fields.composeBody);
    compose.setComposeIncludeInvite(fields.composeIncludeInvite);
    compose.setComposeInviteLocation(fields.composeInviteLocation);
    compose.setComposeInviteStart(fields.composeInviteStart);
    compose.setComposeInviteEnd(fields.composeInviteEnd);
    compose.setComposeInviteAllDay(fields.composeInviteAllDay);
    compose.setComposeInviteRecurrenceRule(fields.composeInviteRecurrenceRule);
    compose.setComposeHtml(fields.composeHtml);
    compose.setComposeHtmlText(fields.composeHtmlText);
    compose.setComposeMarkdown(fields.composeMarkdown);
    compose.setComposeQuotedHtml(fields.composeQuotedHtml);
    compose.setComposeQuotedHtmlEdited(fields.composeQuotedHtmlEdited);
    compose.setComposeQuotedParts(fields.composeQuotedParts);
    compose.setComposeTab(fields.composeTab);
    composeLastEditedRef.current = fields.composeTab;
    compose.setComposeStripImages(fields.composeStripImages);
    compose.setComposeIncludeOriginal(fields.composeIncludeOriginal);
    compose.setComposeQuoteHtml(fields.composeQuoteHtml);
    compose.setComposeQuotedText("");

    if (fields.initialDraftHash !== null) {
      lastDraftHashRef.current = fields.initialDraftHash;
    }
    if (fields.initialDraftSavedAt !== null) {
      setDraftSavedAt(fields.initialDraftSavedAt);
    }

    compose.setComposeView("inline");
    compose.setComposeOpen(true);
  };

  const popOutCompose = () => {
    compose.setComposeView("modal");
  };

  const popInCompose = () => {
    compose.setComposeView("inline");
  };

  const minimizeCompose = () => {
    compose.setComposeView("minimized");
  };

  return {
    applySignatureToCompose,
    buildComposePayload,
    openCompose,
    popOutCompose,
    popInCompose,
    minimizeCompose
  };
}
