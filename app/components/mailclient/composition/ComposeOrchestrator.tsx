"use client";

import { senderMessages } from "@/lib/senderMessages";

import { loadSenderSettings as loadSenderSettingsSnapshot, SENDER_SETTINGS_CHANGED, SENDER_SETTINGS_STORAGE_KEY, type SenderSettings } from "@/lib/ui/senderSettings";
import { resolveSignatureTemplate } from "@/lib/signatureTemplates";
import { readSenderError } from "./senderErrors";
import { getSendWarnings, type SendOutcome } from "./sendOutcome";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { useMobileComposeView } from "@/app/hooks/useMobileComposeView";
import { createPortal } from "react-dom";
import type React from "react";
import type { Account, AccountDateFormat, Attachment, Folder, Message, RecipientSuggestion } from "@/lib/data";
import {
  buildComposeInvitePayload,
  normalizeComposeInviteDraft,
  createDefaultComposeInviteDraft,
  type ComposeInviteDraft
} from "@/lib/composeInvite";
import { extractComposeInviteDraftFromSource } from "@/lib/composeInviteMetadata";
import {
  buildAccountDraftDiscardPath,
  buildAccountMessageSourcePath,
  buildAccountSmtpSendPath
} from "@/lib/accountApiPaths";
import { hasHtmlContent } from "@/lib/ui/messageView";
import {
  removeDetachedComposeHandoff,
  pruneExpiredDetachedComposeHandoffs,
  writeDetachedComposeHandoff,
  type DetachedComposeOutcome
} from "@/lib/ui/detachedComposeHandoff";
import { openDetachedWindowConfirmed } from "@/lib/ui/openDetachedWindow";
import { formatComposePageTitle } from "@/lib/appBranding";
import { decidePostSendSentSync, type SyncMode } from "@/lib/syncPolicy";
import { logSyncPolicyCall } from "@/lib/syncPolicyLogging";
import { buildSendPayload } from "./buildSendPayload";
import ComposeInlineCard from "./ComposeInlineCard";
import ComposeMessageField from "./ComposeMessageField";
import ComposeMinimized from "./ComposeMinimized";
import ComposeModal from "./ComposeModal";
import { ComposeContextProvider, type ComposeContextValue } from "./ComposeContext";
import { getDraftChangeState } from "./draftSaveUtils";
import { normalizeHtmlDerivedText } from "./composeTextNormalization";
import { resetComposeSession } from "./resetComposeSession";
import { useComposeController } from "./useComposeController";
import { useComposeDraftAutoSave } from "./useComposeDraftAutoSave";
import {
  getComposeAttachmentLoadState,
  pruneUnreferencedInlineAttachments,
  useComposeHandlers
} from "./useComposeHandlers";
import { useComposeState } from "./useComposeState";
import { useComposeTranslation } from "./useComposeTranslation";
import { useComposeViewEffects } from "./useComposeViewEffects";
import { useDraftManager } from "./useDraftManager";
import type { ComposeMode } from "./composeTypes";

const ATTACHMENT_LOAD_BLOCK_MESSAGE = {
  loading: "Attachments are still loading. Try again in a moment.",
  error: "Some attachments could not be loaded. Retry or remove them first."
} as const;

type Signature = {
  id: string;
  name: string;
  body: string;
};

type SyncFolderWithBackground = (
  folderId: string,
  allowRefresh?: boolean,
  mode?: SyncMode,
  options?: {
    backfillUids?: number[];
    fullSyncReason?: string;
    triggerId?: string;
    [key: string]: unknown;
  }
) => Promise<unknown> | unknown;

type PushNoticeInput = {
  type: "info" | "success" | "warning" | "error";
  icon?: "mail";
  title: string;
  description?: string;
  messageId?: string;
  ids?: string[];
  durationMs?: number;
};

export type ComposeOpenPrefill = {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  // Note: `mailto:` URLs may carry `in-reply-to`/`references` headers, but they
  // are intentionally NOT plumbed here. buildSendPayload only emits those
  // headers when shouldThreadComposeForMode(mode) is true (reply/forward/edit),
  // and the mailto entry point uses mode "new". Adding the fields would set
  // composeReplyHeaders state but they'd silently drop on send — worse than not
  // claiming the feature. Plumb through a "newReply" mode if we ever need it.
};

export type ComposeOrchestratorHandle = {
  /**
   * Render the inline compose card. Returned from the handle so MailClient can
   * place it both at the top of the thread and inline beneath a reply target
   * via ThreadView's render-prop.
   */
  renderInlineCard: (wrapperClassName?: string) => React.ReactNode;
  /** Reset all compose state — used when the active account changes. */
  resetSession: () => void;
  /**
   * Open the compose surface. Hydrates attachments for edit/forward modes and
   * picks the preferred tab from the per-message tab state before handing off
   * to the underlying controller. When `prefill` is provided (only honored for
   * mode === "new" without a source message), the fields are applied after the
   * controller initializes blank state — used by the `mailto:` entry point.
   */
  openCompose: (
    mode: ComposeMode,
    message?: Message,
    asNew?: boolean,
    prefill?: ComposeOpenPrefill
  ) => Promise<void>;
  /** Restore a saved handoff while retaining reply/forward send semantics. */
  openDetachedCompose: (
    draft: Message | null,
    context: { mode: ComposeMode; sourceMessage: Message | null; identityId?: string; signatureInitialized?: boolean }
  ) => Promise<void>;
  /** Imperative setter used by MailClient's list selection auto-minimize. */
  setComposeView: React.Dispatch<React.SetStateAction<"inline" | "modal" | "minimized">>;
};

export type ComposeOrchestratorProps = {
  // Account context
  ownerUserId?: string;
  senderSettingsLoader?: (apiFetch: ComposeOrchestratorProps["apiFetch"], accountId: string) => SenderSettings | Promise<SenderSettings>;
  activeAccountId: string;
  currentAccount: Account | null;
  accountDateFormat: AccountDateFormat;
  defaultSignatureId: string;
  accountSignatures: Signature[];
  darkMode: boolean;
  isMobile?: boolean;

  // External data
  activeThread: Message[];
  messageById: Map<string, Message>;
  viewMessage: Message | null;
  searchScope: string;
  activeFolderId: string | null;
  isDraftsFolder: (folderId?: string | null) => boolean;

  // Callbacks / state setters from outside
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setViewMessage: React.Dispatch<React.SetStateAction<Message | null>>;
  setActiveMessageId: React.Dispatch<React.SetStateAction<string>>;
  suppressDraftDeleteReconcile: (draftId: string | null) => void;
  removeDraftFromUi: (draftId: string | null) => void;
  reconcileSavedDraftInUi: (savedDraft: Message, previousDraftId: string | null) => void;
  refreshFolders: () => Promise<unknown>;
  refreshMailboxData: () => Promise<unknown>;

  // Send-path collaborators
  pushNotice: (input: PushNoticeInput) => void;
  evictThreadCache: (threadId: string) => void;
  updateFlagState: (
    message: Message,
    flag: "seen" | "answered" | "flagged" | "draft" | "deleted",
    value: boolean
  ) => Promise<unknown> | unknown;
  updateKeywordFlag: (message: Message, keyword: string, value: boolean) => Promise<unknown> | unknown;
  accountFolders: Folder[];
  findSentFolder: () => Folder | null;
  syncFolderWithBackgroundRef: React.RefObject<SyncFolderWithBackground>;

  // openCompose wrapper collaborators
  //
  // Returns the editor-eligible body panel the user has selected for
  // `messageId` in the message-view pane ("html" / "text" / "markdown"),
  // or undefined if no selection has been made or the selection is
  // "source" (which has no compose-editor analogue). Used so the
  // compose surface matches the rendering the user was just looking
  // at. The underlying map lives in `MessageViewOrchestrator`.
  getPreferredComposeTab: (messageId: string) => "html" | "text" | "markdown" | undefined;
  isDraftMessage: (message: Message) => boolean;
  ensureMessageContent: (
    message: Message,
    options?: { manual?: boolean }
  ) => Promise<Message | null | undefined>;

  // Recipient / formatting helpers
  applyRecipientSelection: (
    current: string,
    selection: RecipientSuggestion,
    setter: React.Dispatch<React.SetStateAction<string>>,
    focusAfter?: "to" | "cc" | "bcc" | null
  ) => string;
  loadRecipientOptions: (query: string, signal: AbortSignal) => Promise<RecipientSuggestion[]>;
  clearRecipientSuggestionCache: (accountId: string) => void;
  getComposeToken: (value: string) => string;
  formatRelativeTime: (timestamp: number | null) => string;
  fromValue: string;

  // Utilities
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  reportError: (message: string) => void;
  readErrorMessage: (res: Response) => Promise<string>;
  stripHtml: (value: string) => string;

  // Visibility flags (derived in MailClient so they can drive layout)
  showComposeInline: boolean;
  showComposeModal: boolean;
  showComposeMinimized: boolean;

  /**
   * Fires whenever `draftSavedAt` changes so MailClient can drive its
   * second-by-second relative-time refresh. MailClient renders the
   * "saved N seconds ago" indicator and needs to re-render on every
   * tick while a saved draft exists.
   */
  onDraftSavedAtChange?: (timestamp: number | null) => void;

  /**
   * Fires whenever the compose state values that MailClient consumes
   * reactively change (thread focus, active message suppression, inline
   * compose placement, thread auto-collapse on compose focus). MailClient
   * mirrors these in its own `useState` so that existing memos and effects
   * keep their dependency semantics.
   */
  onComposeMirrorChange?: (mirror: ComposeMirror) => void;

  /** Run the compose session inside its own browser/native window. */
  detachedWindow?: boolean;

  /** Called synchronously before a detached window closes successfully. */
  onDetachedComposeOutcome?: (
    outcome: DetachedComposeOutcome,
    draftId: string | null,
    warnings?: string[]
  ) => void;
};

/**
 * The subset of compose state that MailClient needs to react to for layout
 * and selection-related effects. Emitted via `onComposeMirrorChange`.
 */
export type ComposeMirror = {
  composeOpen: boolean;
  composeView: "inline" | "modal" | "minimized";
  composeMode: ComposeMode;
  composeSubject: string;
  composeDraftId: string | null;
  composeReplyMessage: Message | null;
  hasUnsavedChanges: boolean;
  draftSaving: boolean;
  sendingMail: boolean;
  discardingDraft: boolean;
};

function ComposeOrchestratorImpl(
  {
    activeAccountId,
    senderSettingsLoader = loadSenderSettingsSnapshot,
    ownerUserId,
    currentAccount,
    accountDateFormat,
    defaultSignatureId,
    accountSignatures,
    darkMode,
    isMobile = false,
    activeThread,
    messageById,
    viewMessage,
    searchScope,
    activeFolderId,
    isDraftsFolder,
    setMessages,
    setViewMessage,
    setActiveMessageId,
    suppressDraftDeleteReconcile,
    removeDraftFromUi,
    reconcileSavedDraftInUi,
    refreshFolders,
    refreshMailboxData,
    pushNotice,
    evictThreadCache,
    accountFolders,
    findSentFolder,
    syncFolderWithBackgroundRef,
    getPreferredComposeTab,
    isDraftMessage,
    ensureMessageContent,
    applyRecipientSelection,
    loadRecipientOptions,
    clearRecipientSuggestionCache,
    getComposeToken,
    formatRelativeTime,
    fromValue,
    apiFetch,
    reportError,
    readErrorMessage,
    stripHtml,
    showComposeInline,
    showComposeModal,
    showComposeMinimized,
    onDraftSavedAtChange,
    onComposeMirrorChange,
    detachedWindow = false,
    onDetachedComposeOutcome
  }: ComposeOrchestratorProps,
  ref: React.ForwardedRef<ComposeOrchestratorHandle>
) {
  const [sender, setSender] = useState<SenderSettings | null>(null);
  const [senderLoading, setSenderLoading] = useState(true);
  const [retrySender, setRetrySender] = useState<(() => void) | null>(null);
  const [senderError, setSenderError] = useState<string | null>(null);
  const signatureConfigKey = JSON.stringify([accountSignatures, defaultSignatureId]);
  const composeState = useComposeState();
  const previousSenderAccountRef = useRef(activeAccountId);
  useEffect(() => {
    let active = true;
    const refresh = async (event?: Event) => {
      const accountId = (event as CustomEvent | undefined)?.detail?.accountId;
      if (accountId && accountId !== activeAccountId) return;
      setSenderLoading(true);
      try {
        const snapshot = await senderSettingsLoader(apiFetch, activeAccountId);
        if (active) { setSender(snapshot); setSenderError(null); setRetrySender(null); }
      } catch (error) {
        if (active) { setSender(null); setSenderError(error instanceof Error ? error.message : senderMessages.identityLoadFailed); setRetrySender(() => () => { if (active) void refresh(); }); }
      } finally { if (active) setSenderLoading(false); }
    };
    const storageRefresh = (event: StorageEvent) => {
      if (event.key !== SENDER_SETTINGS_STORAGE_KEY || !event.newValue) return;
      try {
        const receipt = JSON.parse(event.newValue) as { accountId?: string };
        if (receipt.accountId === activeAccountId) void refresh();
      } catch { /* Ignore malformed refresh receipts. */ }
    };
    // Refresh explicit mailbox switches, while keeping initial login/settings warm-up lazy.
    const changedAccount = Boolean(previousSenderAccountRef.current && activeAccountId && previousSenderAccountRef.current !== activeAccountId);
    previousSenderAccountRef.current = activeAccountId;
    if (changedAccount) void refresh();
    // Every open also loads its own snapshot before initialization.
    window.addEventListener("storage", storageRefresh);
    window.addEventListener(SENDER_SETTINGS_CHANGED, refresh);
    window.addEventListener("noctua:account-prefs-changed", refresh);
    return () => { active = false; window.removeEventListener("storage", storageRefresh); window.removeEventListener(SENDER_SETTINGS_CHANGED, refresh); window.removeEventListener("noctua:account-prefs-changed", refresh); };
  }, [activeAccountId, ownerUserId, apiFetch, signatureConfigKey, senderSettingsLoader]);
  const mobileView = useMobileComposeView(isMobile, composeState.composeView, composeState.setComposeView);
  const compose = { ...composeState, ...mobileView };
  const [detachingCompose, setDetachingCompose] = useState(false);
  const detachingComposeRef = useRef(false);
  const [deliveredWarnings, setDeliveredWarnings] = useState<string[]>([]);
  const deliveredRef = useRef(false);
  const closingDetachedComposeRef = useRef(false);
  const discardingDraftRequestRef = useRef(false);
  const composeScopeRef = useRef({ accountId: activeAccountId, ownerUserId });
  composeScopeRef.current = { accountId: activeAccountId, ownerUserId };
  const sendOperationRef = useRef<{ accountId: string; sessionVersion: number } | null>(null);
  const composeInitRef = useRef<{ token: number; key: string | null }>({ token: 0, key: null });
  const {
    composeIdentityId,
    composeOpen,
    setComposeOpen,
    composeView,
    setComposeView,
    composeDraftId,
    setComposeDraftId,
    composeMode,
    composeTo,
    setComposeTo,
    composeCc,
    setComposeCc,
    composeBcc,
    setComposeBcc,
    composeSubject,
    setComposeSubject,
    composeBody,
    setComposeBody,
    composeBodyDebounceRef,
    composeBodyLastUpdateRef,
    composeIncludeInvite,
    setComposeIncludeInvite,
    composeInviteLocation,
    setComposeInviteLocation,
    composeInviteStart,
    setComposeInviteStart,
    composeInviteEnd,
    setComposeInviteEnd,
    composeInviteAllDay,
    setComposeInviteAllDay,
    composeInviteRecurrenceRule,
    setComposeInviteRecurrenceRule,
    composeHtml,
    setComposeHtml,
    composeHtmlText,
    setComposeHtmlText,
    composeMarkdown,
    composeMarkdownRef,
    setComposeMarkdown,
    composeOpenedAt,
    composeSignatureId,
    setComposeSignatureId,
    signatureMenuOpen,
    setSignatureMenuOpen,
    composeReplyMessage,
    composeTab,
    setComposeTab,
    composeShowBcc,
    setComposeShowBcc,
    composeStripImages,
    setComposeStripImages,
    composeIncludeOriginal,
    setComposeIncludeOriginal,
    composeQuoteHtml,
    setComposeQuoteHtml,
    composeQuotedHtml,
    setComposeQuotedHtml,
    composeQuotedText,
    setComposeQuotedText,
    composeReplyHeaders,
    composeAttachments,
    setComposeAttachments,
    composeDragActive,
    setComposeDragActive,
    pendingImageDrop,
    setPendingImageDrop,
    composeEditorReset,
    setComposeEditorReset,
    composeQuotedParts,
    setComposeQuotedParts,
    composeQuotedHtmlEdited,
    composeSize,
    setComposeSize,
    composeResizing,
    setComposeResizing,
    composeResizeRef,
    composeModalRef,
    composeTextRef,
    composeSelectionRef,
    composeDragDepthRef,
    composeCardRef,
    sendingMail,
    setSendingMail,
    sendingMailRef,
    draftSaving,
    setDraftSaving,
    draftSavedAt,
    setDraftSavedAt,
    draftSaveError,
    setDraftSaveError,
    discardingDraft,
    setDiscardingDraft,
    draftSaveTimerRef,
    draftSaveInFlightRef,
    pendingDraftSaveRef,
    composeSessionVersionRef,
    composeDraftIdRef,
    lastDraftHashRef,
    currentDraftHashRef,
    composeBaselineHashRef,
    composeDirtyRef,
    composeEditorInitRef,
    composeLastEditedRef
  } = compose;

  const composeRef = useRef(compose);
  composeRef.current = compose;

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      // Intentionally read the latest timer at unmount; it may have been
      // replaced after this cleanup was registered.
      if (composeBodyDebounceRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        clearTimeout(composeBodyDebounceRef.current);
      }
    };
  }, [composeBodyDebounceRef]);

  // Keep the draft-id ref in sync with the state value.
  useEffect(() => {
    composeDraftIdRef.current = composeDraftId;
  }, [composeDraftId, composeDraftIdRef]);

  // Propagate `draftSavedAt` changes so MailClient can drive its
  // "saved N seconds ago" relative-time indicator.
  useEffect(() => {
    onDraftSavedAtChange?.(draftSavedAt);
  }, [draftSavedAt, onDraftSavedAtChange]);

  const senderCanCompose = sender?.account.id === activeAccountId &&
    (sender.account.accessRole === "editor" || sender.account.accessRole === "manager") && currentAccount?.accessRole !== "viewer";
  const availableSignatures = sender?.account.settings?.signatures ?? accountSignatures;
  const selectedSignature =
    availableSignatures.find((signature) => signature.id === composeSignatureId) ?? null;

  const composeTranslation = useComposeTranslation({
    activeAccountId,
    enabled: Boolean(currentAccount?.deepl?.enabled && currentAccount?.deepl?.hasApiKey),
    composeTab,
    composeBody,
    composeHtml,
    composeHtmlText,
    composeTextRef,
    composeMarkdownRef,
    composeBodyDebounceRef,
    composeDirtyRef,
    composeLastEditedRef,
    composeSessionVersionRef,
    setComposeBody,
    setComposeHtml,
    setComposeHtmlText,
    setComposeMarkdown,
    setComposeEditorReset,
    stripHtml,
    apiFetch
  });
  const resetComposeTranslation = composeTranslation.reset;

  const {
    addComposeFiles,
    addDroppedFiles,
    removeComposeAttachment,
    handleInlineImage,
    handleComposeDragEnter,
    handleComposeDragLeave,
    handleComposeDragOver,
    handleComposeDrop,
    handleComposeAttachmentPick,
    loadComposeSourceAttachments,
    startComposeAttachmentLoads,
    retryComposeAttachmentLoad,
    abortComposeAttachmentLoads
  } = useComposeHandlers({
    composeDirtyRef,
    composeDragDepthRef,
    setComposeDragActive,
    setComposeAttachments,
    setPendingImageDrop,
    apiFetch
  });

  // Prune inline attachments whose referenced data URLs no longer appear in the
  // HTML body — prevents stale inline uploads from being sent.
  useEffect(() => {
    if (composeTab !== "html") return;
    const referencedHtml = `${composeHtml}${
      composeIncludeOriginal && !composeQuotedHtmlEdited ? composeQuotedHtml : ""
    }`;
    setComposeAttachments((prev) => {
      return pruneUnreferencedInlineAttachments(prev, referencedHtml);
    });
  }, [
    composeHtml,
    composeIncludeOriginal,
    composeQuotedHtml,
    composeQuotedHtmlEdited,
    composeTab,
    setComposeAttachments
  ]);

  const attachmentLoadState = getComposeAttachmentLoadState(composeAttachments);

  // Every way of closing the composer (cancel, discard, send, session reset,
  // hand-off) ends here, so background downloads never outlive it.
  useEffect(() => {
    if (!composeOpen) abortComposeAttachmentLoads();
  }, [abortComposeAttachmentLoads, composeOpen]);
  useEffect(() => abortComposeAttachmentLoads, [abortComposeAttachmentLoads]);

  const currentComposeInviteDraft =useMemo<ComposeInviteDraft | null>(
    () =>
      composeIncludeInvite
        ? normalizeComposeInviteDraft({
            location: composeInviteLocation,
            start: composeInviteStart,
            end: composeInviteEnd,
            allDay: composeInviteAllDay,
            recurrenceRule: composeInviteRecurrenceRule
          })
        : null,
    [
      composeIncludeInvite,
      composeInviteAllDay,
      composeInviteEnd,
      composeInviteLocation,
      composeInviteRecurrenceRule,
      composeInviteStart
    ]
  );

  const {
    applySignatureToCompose,
    buildComposePayload,
    openCompose: openComposeInternal,
    popOutCompose,
    popInCompose,
    minimizeCompose
  } = useComposeController({
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
    findMessageByMessageId: (messageId: string) =>
      activeThread.find((msg) => msg.messageId === messageId)
  });

  useComposeViewEffects({
    showComposeInline,
    composeReplyMessageId: composeReplyMessage?.id ?? null,
    composeCardRef,
    composeTab,
    composeOpen,
    composeView,
    composeMode,
    activeFolderId: activeFolderId ?? "",
    composeModalRef,
    composeTextRef,
    composeResizeRef,
    composeResizing,
    setComposeOpen,
    setComposeSize,
    setComposeResizing
  });

  const {
    saveDraft,
    handleDiscardDraft,
    handleSaveDraft,
    saveDraftForHandoff,
    flushPendingDraftSaves
  } = useDraftManager({
    activeAccountId,
    identityId: composeIdentityId,
    identityReady: Boolean(sender?.identities.some(item => item.id === composeIdentityId && item.enabled)) && !senderLoading && senderCanCompose,
    onEffectiveIdentity: compose.setComposeIdentityId,
    composeOpen,
    composeTab,
    composeTo,
    composeCc,
    composeBcc,
    composeSubject,
    composeInvite: currentComposeInviteDraft,
    composeQuotedHtmlEdited,
    composeReplyHeaders,
    composeDraftId,
    setComposeDraftId,
    setDraftSaving,
    setDraftSavedAt,
    setDraftSaveError,
    setDiscardingDraft,
    setComposeOpen,
    setComposeView,
    composeDraftIdRef,
    lastDraftHashRef,
    currentDraftHashRef,
    composeBaselineHashRef,
    composeDirtyRef,
    composeLastEditedRef,
    composeTextRef,
    composeSelectionRef,
    pendingDraftSaveRef,
    draftSaveInFlightRef,
    composeSessionVersionRef,
    viewMessage,
    setMessages,
    setViewMessage,
    setActiveMessageId,
    searchScope,
    activeFolderId,
    isDraftsFolder,
    suppressDraftDeleteReconcile,
    removeDraftFromUi,
    reconcileSavedDraftInUi,
    refreshFolders,
    refreshMailboxData,
    apiFetch,
    reportError,
    readErrorMessage,
    buildComposePayload
  });

  useComposeDraftAutoSave({
    composeOpen: composeOpen && !deliveredWarnings.length && !senderLoading && Boolean(sender?.identities.some(item => item.id === composeIdentityId && item.enabled)) && senderCanCompose,
    identityId: composeIdentityId,
    sendingMail,
    draftSaving,
    composeTo,
    composeCc,
    composeBcc,
    composeSubject,
    composeInvite: currentComposeInviteDraft,
    composeBody,
    composeHtml,
    composeHtmlText,
    composeMarkdown,
    composeQuotedHtml,
    composeQuoteHtml,
    composeIncludeOriginal,
    composeStripImages,
    composeQuotedHtmlEdited,
    composeTab,
    composeDraftId,
    composeReplyHeaders,
    composeAttachments,
    lastDraftHashRef,
    currentDraftHashRef,
    composeBaselineHashRef,
    composeDirtyRef,
    composeLastEditedRef,
    draftSaveTimerRef,
    buildComposePayload,
    saveDraft
  });

  const cancelDraftAutoSave = useCallback(() => {
    if (draftSaveTimerRef.current !== null) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    pendingDraftSaveRef.current = null;
    composeSessionVersionRef.current += 1;
    setDraftSaving(false);
  }, [
    composeSessionVersionRef,
    draftSaveTimerRef,
    pendingDraftSaveRef,
    setDraftSaving
  ]);

  const handleDiscardDraftWithCancel = useCallback(async () => {
    if (discardingDraftRequestRef.current || sendingMailRef.current) return;
    discardingDraftRequestRef.current = true;
    // Cancel a pending debounced auto-save before discarding, mirroring the
    // send path. Without this, a timer scheduled just before the user clicks
    // Discard can fire mid-discard and enqueue a fresh save, re-creating the
    // draft after it was discarded. We clear only the timer here (not the
    // session version) so the discard's own `flushPendingDraftSaves` can still
    // settle any already-running save and learn the final draft id; the
    // version bump that neutralizes a late save happens inside the discard.
    const discardedDraftId = composeDraftIdRef.current;
    if (draftSaveTimerRef.current !== null) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    try {
      const discarded = await handleDiscardDraft();
      if (discarded && detachedWindow) {
        onDetachedComposeOutcome?.("discarded", discardedDraftId);
        window.close();
      }
    } finally {
      discardingDraftRequestRef.current = false;
    }
  }, [
    detachedWindow,
    composeDraftIdRef,
    draftSaveTimerRef,
    handleDiscardDraft,
    onDetachedComposeOutcome,
    sendingMailRef
  ]);

  const openComposeInNewWindow = useCallback(async () => {
    if (deliveredRef.current) return;
    if (
      detachedWindow ||
      !activeAccountId ||
      detachingComposeRef.current ||
      sendingMailRef.current ||
      discardingDraftRequestRef.current
    ) return;
    if (attachmentLoadState) {
      reportError(ATTACHMENT_LOAD_BLOCK_MESSAGE[attachmentLoadState]);
      return;
    }
    detachingComposeRef.current = true;
    setDetachingCompose(true);
    const handoffId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const createdAtMs = Date.now();
    const baseHandoff = {
      version: 1 as const,
      accountId: activeAccountId,
      ownerUserId,
      identityId: composeIdentityId,
      signatureInitialized: true,
      mode: composeMode,
      sourceMessageId: composeReplyMessage?.id ?? null,
      draftId: composeDraftIdRef.current,
      createdAtMs,
      updatedAtMs: createdAtMs
    };
    try {
      pruneExpiredDetachedComposeHandoffs(createdAtMs);
      writeDetachedComposeHandoff(handoffId, {
        ...baseHandoff,
        status: "preparing"
      });
      const openResult = await openDetachedWindowConfirmed(
        `/compose/window?handoff=${encodeURIComponent(handoffId)}`,
        { width: 1040, height: 840, title: formatComposePageTitle(composeSubject) }
      );
      if (!openResult.opened) {
        removeDetachedComposeHandoff(handoffId);
        pushNotice({
          type: "warning",
          title: "Could not open composer window",
          description: openResult.error
            ? "The desktop window could not be created. Your message remains open here."
            : "Allow pop-ups to open the composer in a new window."
        });
        return;
      }

      const handoff = await saveDraftForHandoff();
      if (!handoff.saved || (handoff.hasContent && !handoff.draftId)) {
        writeDetachedComposeHandoff(handoffId, {
          ...baseHandoff,
          status: "error",
          draftId: handoff.draftId,
          message: "The draft could not be saved before opening the new window.",
          updatedAtMs: Date.now()
        });
        return;
      }
      writeDetachedComposeHandoff(handoffId, {
        ...baseHandoff,
        status: "ready",
        draftId: handoff.draftId,
        updatedAtMs: Date.now()
      });
      cancelDraftAutoSave();
      setComposeOpen(false);
      setComposeView("inline");
    } catch (error) {
      removeDetachedComposeHandoff(handoffId);
      reportError("The composer handoff could not be created.");
      if (error instanceof Error) {
        console.error("[noctua] detached composer handoff failed:", error);
      }
    } finally {
      detachingComposeRef.current = false;
      setDetachingCompose(false);
    }
  }, [
    activeAccountId,
    ownerUserId,
    attachmentLoadState,
    composeIdentityId,
    cancelDraftAutoSave,
    composeDraftIdRef,
    composeMode,
    composeReplyMessage,
    composeSubject,
    detachedWindow,
    pushNotice,
    reportError,
    saveDraftForHandoff,
    sendingMailRef,
    setComposeOpen,
    setComposeView
  ]);

  const closeDetachedCompose = useCallback(async () => {
    if (
      !detachedWindow ||
      closingDetachedComposeRef.current ||
      sendingMailRef.current ||
      discardingDraftRequestRef.current
    ) return;
    if (attachmentLoadState) {
      reportError(ATTACHMENT_LOAD_BLOCK_MESSAGE[attachmentLoadState]);
      return;
    }
    closingDetachedComposeRef.current = true;
    setDetachingCompose(true);
    try {
      const saved = await saveDraftForHandoff();
      if (!saved.saved || (saved.hasContent && !saved.draftId)) {
        reportError("The draft could not be saved. Keep this window open and try again.");
        closingDetachedComposeRef.current = false;
        setDetachingCompose(false);
        return;
      }
      cancelDraftAutoSave();
      onDetachedComposeOutcome?.("saved", saved.draftId);
      window.close();
    } catch {
      closingDetachedComposeRef.current = false;
      setDetachingCompose(false);
      reportError("The draft could not be saved. Keep this window open and try again.");
    }
  }, [
    attachmentLoadState,
    cancelDraftAutoSave,
    detachedWindow,
    onDetachedComposeOutcome,
    reportError,
    saveDraftForHandoff,
    sendingMailRef
  ]);

  const resetAfterSend = useCallback(() => {
    setComposeOpen(false);
    setComposeDraftId(null);
    setComposeAttachments([]);
    lastDraftHashRef.current = "";
    currentDraftHashRef.current = "";
    composeBaselineHashRef.current = null;
    setComposeView("inline");
    resetComposeTranslation();
  }, [
    composeBaselineHashRef,
    resetComposeTranslation,
    currentDraftHashRef,
    lastDraftHashRef,
    setComposeAttachments,
    setComposeDraftId,
    setComposeOpen,
    setComposeView
  ]);

  const handleSendMail = async () => {
    // The draft flush below can take seconds while an auto-save's IMAP APPEND
    // settles. Claim the send here, synchronously, so clicks landing in that
    // window bail out instead of each starting their own SMTP send — the
    // button's `disabled` alone is too late, it only applies once React has
    // re-rendered.
    if (sendingMailRef.current || deliveredRef.current) return;
    if (senderLoading || sender?.account.id !== activeAccountId || !senderCanCompose || !sender.identities.some(item => item.id === composeIdentityId && item.enabled)) {
      setSenderError(senderMessages.chooseEnabledSender); return;
    }
    setSenderError(null);
    if (attachmentLoadState) {
      reportError(ATTACHMENT_LOAD_BLOCK_MESSAGE[attachmentLoadState]);
      return;
    }
    const composeInviteDraft = currentComposeInviteDraft;
    if (!composeTo.trim() && !composeCc.trim() && !composeBcc.trim()) {
      reportError("Please add at least one recipient.");
      return;
    }
    const invitePayload =
      composeIncludeInvite ? buildComposeInvitePayload(composeInviteDraft) : undefined;
    if (composeIncludeInvite && !invitePayload) {
      reportError("Please complete the event invitation details before sending.");
      return;
    }
    sendingMailRef.current = true;
    setSendingMail(true);
    const sendOperation = { accountId: activeAccountId, sessionVersion: composeSessionVersionRef.current };
    sendOperationRef.current = sendOperation;
    const isSendSession = () => sendOperationRef.current === sendOperation &&
      composeScopeRef.current.accountId === sendOperation.accountId &&
      composeScopeRef.current.ownerUserId === ownerUserId &&
      composeSessionVersionRef.current === sendOperation.sessionVersion;
    let delivered = false;
    let acceptedWarnings: string[] = [];
    let acceptedDraftId: string | null = null;
    try {
      // Stop new debounced saves from being scheduled, then let any save that
      // is already running (or queued) finish before we touch the draft. A
      // forward/reply auto-saves a draft on open; if its IMAP APPEND is still
      // in flight when send fires, cancelling outright would orphan that draft
      // on the server (the discard below would run against a not-yet-known
      // draft id). Flushing first lets the save settle and populate
      // `composeDraftIdRef`, so the discard can delete both copies.
      if (draftSaveTimerRef.current !== null) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
      await flushPendingDraftSaves();
      if (!isSendSession()) return;
      cancelDraftAutoSave();
      sendOperation.sessionVersion = composeSessionVersionRef.current;
      const { text, html, markdown, attachments, composeFormat } = buildComposePayload();
      const smtpPayload = buildSendPayload(composeMode, {
        identityId: composeIdentityId,
        composeTo,
        composeCc,
        composeBcc,
        composeSubject,
        text,
        markdown,
        html,
        attachments,
        invite: invitePayload ?? undefined,
        composeFormat,
        composeReplyHeaders,
        composeReplyMessage,
        accountFromValue: fromValue
      });
      const sendDraftId = composeDraftIdRef.current;
      const res = await apiFetch(buildAccountSmtpSendPath(activeAccountId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtpPayload)
      });
      if (res.ok) {
        const sendResult = (await res.json().catch(() => null)) as
          | (SendOutcome & {
              ok?: boolean;
              identityId?: string;
              sentFolderId?: string | null;
              sentMessageUid?: number | null;
              messageId?: string | null;
              inviteScheduled?: boolean;
              inviteEventId?: string | null;
              inviteWarning?: string | null;
            })
          | null;
        delivered = true;
        if (isSendSession()) { deliveredRef.current = true; if (sendResult?.identityId) compose.setComposeIdentityId(sendResult.identityId); }
        acceptedWarnings = getSendWarnings(sendResult);
        if (sendResult?.inviteWarning) acceptedWarnings.push(sendResult.inviteWarning);
        if (isSendSession()) setDeliveredWarnings(acceptedWarnings);
        pushNotice({ type: "success", title: "Email sent.", description: composeSubject.trim().slice(0, 180) || undefined });
        acceptedWarnings.forEach(description => pushNotice({ type: "warning", title: "Email sent with a warning", description }));
        if (composeReplyMessage) {
          const threadId =
            composeReplyMessage.threadId ??
            composeReplyMessage.messageId ??
            composeReplyMessage.id;
          evictThreadCache(threadId);
        }
        // Capture after the draft flush, before SMTP: another composer may
        // replace the shared draft ref while delivery is in flight.
        const sentDraftId = sendDraftId;
        acceptedDraftId = sentDraftId;
        if (sentDraftId && activeAccountId) {
          suppressDraftDeleteReconcile(sentDraftId);
          removeDraftFromUi(sentDraftId);
          try {
            await apiFetch(buildAccountDraftDiscardPath(activeAccountId, sentDraftId), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({})
            });
          } catch {
            // ignore draft cleanup errors
          }
        }
        const sentView = composeView;
        if (isSendSession()) {
          resetAfterSend();
          if (acceptedWarnings.length && !detachedWindow) { setComposeView(sentView); setComposeOpen(true); }
        }
        // The server owns answered/forwarded flags; refresh its authoritative state.
        const sentFolder =
          accountFolders.find((folder) => folder.id === sendResult?.sentFolderId) ?? findSentFolder();
        const sentSyncDecision = decidePostSendSentSync({
          sentFolderId: sentFolder?.id ?? null
        });
        const sentSyncTriggerId = logSyncPolicyCall({
          caller: "post-send-sent-refresh",
          policy: "decidePostSendSentSync",
          accountId: activeAccountId,
          folderId: sentFolder?.id ?? null,
          input: {
            sentFolderId: sentFolder?.id ?? null
          },
          decision: sentSyncDecision
        });
        if (sentSyncDecision.kind === "folder") {
          const sentMessageUid =
            typeof sendResult?.sentMessageUid === "number" && Number.isFinite(sendResult.sentMessageUid)
              ? sendResult.sentMessageUid
              : null;
          await syncFolderWithBackgroundRef.current?.(
            sentSyncDecision.folderId,
            false,
            sentMessageUid !== null ? "new" : sentSyncDecision.mode,
            {
              backfillUids: sentMessageUid !== null ? [sentMessageUid] : undefined,
              fullSyncReason: sentSyncDecision.reason,
              triggerId: sentSyncTriggerId
            }
          );
        }
        await refreshFolders();
        if (sentFolder && activeFolderId === sentFolder.id && searchScope === "folder") {
          await refreshMailboxData();
        }
        if (
          composeReplyMessage &&
          (!sentFolder || activeFolderId !== sentFolder.id || searchScope !== "folder")
        ) {
          await refreshMailboxData();
        }
        clearRecipientSuggestionCache(activeAccountId);
      } else {
        const message = await readSenderError(res, readErrorMessage);
        if (isSendSession()) setSenderError(message);
        reportError(message);
      }
    } catch (error) {
      if (delivered) {
        const warning = "Email sent, but mailbox refresh failed. Refresh the mailbox to see the latest state.";
        acceptedWarnings.push(warning);
        if (isSendSession()) {
          setDeliveredWarnings([...acceptedWarnings]);
          if (!detachedWindow) { setComposeView(composeView); setComposeOpen(true); }
        }
        pushNotice({ type: "warning", title: "Email sent", description: warning });
      } else reportError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Failed to send email."
      );
    } finally {
      // An account reset can release A and let B claim this shared flag.
      // Only the operation that still owns it may release B's send guard.
      if (sendOperationRef.current === sendOperation) {
        sendOperationRef.current = null;
        sendingMailRef.current = false;
        setSendingMail(false);
      }
      if (delivered && detachedWindow) {
        onDetachedComposeOutcome?.("sent", acceptedDraftId, acceptedWarnings);
        window.close();
      }
    }
  };

  const applyComposePrefill = (prefill: ComposeOpenPrefill) => {
    if (prefill.to) compose.setComposeTo(prefill.to);
    if (prefill.cc) compose.setComposeCc(prefill.cc);
    if (prefill.bcc) {
      compose.setComposeBcc(prefill.bcc);
      compose.setComposeShowBcc(true);
    }
    if (prefill.subject) compose.setComposeSubject(prefill.subject);
    if (prefill.body) {
      const signature = compose.composeSignatureRef.current;
      compose.setComposeBody([prefill.body, signature?.text].filter(Boolean).join("\n\n"));
      // The HTML editor reads from composeHtml — escape minimally so user-entered
      // angle brackets render as text, not as HTML tags.
      const escapedHtml = prefill.body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      compose.setComposeHtml(`<p>${escapedHtml}</p>${signature?.html ?? ""}`);
      compose.setComposeHtmlText([prefill.body, signature?.text].filter(Boolean).join("\n\n"));
      compose.setComposeMarkdown([prefill.body, signature?.markdown ?? signature?.text].filter(Boolean).join("\n\n"));
      compose.setComposeEditorReset((prev) => prev + 1);
    }
  };

  const initializeCompose = async (
    mode: ComposeMode,
    message?: Message,
    asNew = false,
    prefill?: ComposeOpenPrefill,
    restoredIdentityId?: string,
    skipSignature = false
  ) => {
    // Opening a forward or draft awaits network fetches. Impatient repeat
    // clicks must not each open their own compose session (every one would
    // auto-save its own draft), and a different open must supersede this one.
    const initKey = JSON.stringify([ownerUserId, activeAccountId, mode, message?.id, asNew]);
    if (message && composeInitRef.current.key === initKey) return;
    const initToken = composeInitRef.current.token + 1;
    composeInitRef.current = { token: initToken, key: message ? initKey : null };
    let initSessionVersion = composeSessionVersionRef.current;
    const isStale = () => composeInitRef.current.token !== initToken ||
      composeScopeRef.current.accountId !== activeAccountId ||
      composeScopeRef.current.ownerUserId !== ownerUserId ||
      composeSessionVersionRef.current !== initSessionVersion;

    try {
      setSenderLoading(true);
      setSenderError(null);
      setRetrySender(null);
      let snapshot: SenderSettings;
      try {
        const request = senderSettingsLoader(apiFetch, activeAccountId);
        snapshot = request instanceof Promise ? await request : request;
        if (isStale()) return;
        if (ownerUserId && snapshot.user.id !== ownerUserId) return;
        if (restoredIdentityId) snapshot = { ...snapshot, prefs: { ...snapshot.prefs, defaultIdentityId: restoredIdentityId } };
        setSender(snapshot); setSenderError(null);
      } catch (error) {
        if (!isStale()) {
          setSender(null); setSenderError(error instanceof Error ? error.message : senderMessages.identityLoadFailed);
          setRetrySender(() => () => { if (!isStale()) void openCompose(mode, message, asNew, prefill, restoredIdentityId, skipSignature); });
        }
        throw error;
      } finally { if (!isStale()) setSenderLoading(false); }

      // Reset the delivery receipt only in the same batch that replaces all fields.
      const openInitializedCompose = (source?: Message, options?: Parameters<typeof openComposeInternal>[3]) => {
        openComposeInternal(mode, source, asNew, { ...options, sender: snapshot, skipSignature });
        initSessionVersion = composeSessionVersionRef.current;
        deliveredRef.current = false;
        setDeliveredWarnings([]);
      };
      abortComposeAttachmentLoads();
      resetComposeTranslation();
      if (!message) {
        openInitializedCompose();
        if (prefill) applyComposePrefill(prefill);
        return true;
      }

      const preferredComposeTab = getPreferredComposeTab(message.id);

      const getComposeSourceMessage = (clickedMessage: Message) => {
        const cachedMessage = messageById.get(clickedMessage.id);
        if (!cachedMessage) return clickedMessage;

        const scoreMessage = (candidate: Message) =>
          (hasHtmlContent(candidate.htmlBody) ? 2 : 0) +
          ((candidate.body ?? "").trim().length > 0 ? 1 : 0);

        return scoreMessage(clickedMessage) >= scoreMessage(cachedMessage)
          ? clickedMessage
          : cachedMessage;
      };

      const hydrateDraftComposeMetadata = async (msg: Message) => {
        if (!isDraftMessage(msg)) return msg;
        if (msg.draftInvite) return msg;
        const source = msg.source ?? (msg.hasSource
          ? await apiFetch(buildAccountMessageSourcePath(msg.accountId, msg.id))
              .then(async (response) => {
                if (!response.ok) return "";
                const data = (await response.json().catch(() => null)) as { source?: string } | null;
                return data?.source ?? "";
              })
              .catch(() => "")
          : "");
        const draftInvite = source ? extractComposeInviteDraftFromSource(source) : null;
        return draftInvite ? { ...msg, source, draftInvite } : msg;
      };

      const afterOpen = async (msg: Message) => {
        const messageWithDraftMetadata = await hydrateDraftComposeMetadata(msg);
        if (isStale()) return;
        if (mode === "edit" || mode === "forward") {
          const {
            attachments,
            deferred,
            message: hydratedMessage
          } = await loadComposeSourceAttachments(messageWithDraftMetadata);
          if (isStale()) return;
          openInitializedCompose(hydratedMessage, { preferredComposeTab });
          setComposeAttachments(attachments);
          startComposeAttachmentLoads(messageWithDraftMetadata, deferred);
          return true;
        }

        if (isStale()) return;
        openInitializedCompose(messageWithDraftMetadata, { preferredComposeTab });
        return true;
      };

      const resolved = getComposeSourceMessage(message);
      const hasText = Boolean((resolved.body ?? "").trim());
      const hasHtml = hasHtmlContent(resolved.htmlBody);
      if (hasText || hasHtml) {
        return await afterOpen(resolved);
      }

      const hydrated = await ensureMessageContent(resolved, { manual: true });
      if (isStale()) return;
      return await afterOpen(hydrated ?? resolved);
    } finally {
      if (composeInitRef.current.token === initToken) composeInitRef.current.key = null;
    }
  };

  // Most UI entry points intentionally open compose fire-and-forget. Keep that
  // public action rejection-safe while allowing the detached-window bootstrap
  // below to observe initialization failures and replace its loading surface
  // with an error state.
  const openCompose = async (
    mode: ComposeMode,
    message?: Message,
    asNew = false,
    prefill?: ComposeOpenPrefill,
    restoredIdentityId?: string,
    skipSignature = false
  ) => {
    try {
      await initializeCompose(mode, message, asNew, prefill, restoredIdentityId, skipSignature);
    } catch (error) {
      console.error("[noctua] failed to open composer:", error);
      reportError(
        error instanceof Error && error.message.trim()
          ? `Failed to open composer: ${error.message}`
          : "Failed to open composer."
      );
    }
  };

  const openDetachedCompose = async (
    draft: Message | null,
    context: { mode: ComposeMode; sourceMessage: Message | null; identityId?: string; signatureInitialized?: boolean }
  ) => {
    if (!draft) {
      if (!await initializeCompose(context.mode, context.sourceMessage ?? undefined, false, undefined, context.identityId, context.signatureInitialized)) return;
      if (context.identityId) compose.setComposeIdentityId(context.identityId);
    } else {
      // Draft fields and attachments must be initialized through edit mode,
      // but reply/forward behavior is semantic state that is not encoded
      // completely in the RFC draft. Restore it explicitly after hydration.
      if (!await initializeCompose("edit", draft)) return;
      compose.setComposeMode(context.mode);
      compose.setComposeReplyMessage(context.sourceMessage);
    }
    setComposeView("inline");
  };

  const currentDraftChangeState = (() => {
    const preferText = composeTab === "html" && composeLastEditedRef.current === "text";
    const composePayload = buildComposePayload({ preferText });
    return getDraftChangeState({
      identityId: composeIdentityId,
      draftId: composeDraftId,
      lastSavedHash: lastDraftHashRef.current,
      to: composeTo,
      cc: composeCc,
      bcc: composeBcc,
      subject: composeSubject,
      text: composePayload.text,
      html: composePayload.html,
      attachments: composePayload.attachments,
      invite: currentComposeInviteDraft
    });
  })();
  const canSaveCurrentDraft =
    composeOpen &&
    Boolean(composeDraftId) &&
    !attachmentLoadState && !senderLoading && senderCanCompose &&
    Boolean(sender?.identities.some(item => item.id === composeIdentityId && item.enabled)) &&
    currentDraftChangeState.canManualSave;
  const hasUnsavedChanges =
    composeOpen &&
    composeDirtyRef.current &&
    (currentDraftChangeState.hasContent || Boolean(composeDraftId));

  // Mirror the slice of compose state consumed by the owning window. The
  // detached host also uses the persistence flags for native-close protection.
  useEffect(() => {
    onComposeMirrorChange?.({
      composeOpen,
      composeView,
      composeMode,
      composeSubject,
      composeDraftId,
      composeReplyMessage,
      hasUnsavedChanges,
      draftSaving,
      sendingMail,
      discardingDraft
    });
  }, [
    composeOpen,
    composeView,
    composeMode,
    composeSubject,
    composeDraftId,
    composeReplyMessage,
    hasUnsavedChanges,
    draftSaving,
    sendingMail,
    discardingDraft,
    onComposeMirrorChange
  ]);

  const markComposeDirty = useCallback(() => {
    composeDirtyRef.current = true;
  }, [composeDirtyRef]);

  const jumpToMessage = useCallback(
    (messageId: string) => {
      const msg = messageById.get(messageId) ?? null;
      setViewMessage(msg);
      setActiveMessageId(messageId);
    },
    [messageById, setActiveMessageId, setViewMessage]
  );

  const jumpToMessageFromModal = useCallback(
    (messageId: string) => {
      jumpToMessage(messageId);
      setComposeView("inline");
    },
    [jumpToMessage, setComposeView]
  );

  const visibleComposeAttachments = composeAttachments.filter((item) => !item.inline);

  const composeMessageField = (
    <ComposeMessageField
      darkMode={darkMode}
      composeMode={composeMode}
      composeTab={composeTab}
      composeBody={composeBody}
      composeHtml={composeHtml}
      composeHtmlText={composeHtmlText}
      composeMarkdown={composeMarkdown}
      composeInvite={currentComposeInviteDraft}
      composeIncludeOriginal={composeIncludeOriginal}
      composeQuoteHtml={composeQuoteHtml}
      composeQuotedHtml={composeQuotedHtml}
      composeQuotedText={composeQuotedText}
      composeQuotedParts={composeQuotedParts}
      composeStripImages={composeStripImages}
      composeEditorReset={composeEditorReset}
      visibleComposeAttachments={visibleComposeAttachments}
      composeTranslation={composeTranslation.ui}
      onComposeTranslate={composeTranslation.translate}
      onComposeTranslateRevert={composeTranslation.revert}
      onComposeTranslateDismiss={composeTranslation.dismissError}
      onComposeTranslateLangChange={composeTranslation.setTargetLang}
      composeSignatureId={composeSignatureId}
      signatureMenuOpen={signatureMenuOpen}
      selectedSignature={selectedSignature}
      accountSignatures={availableSignatures}
      composeTextRef={composeTextRef}
      composeBodyDebounceRef={composeBodyDebounceRef}
      composeBodyLastUpdateRef={composeBodyLastUpdateRef}
      composeMarkdownRef={composeMarkdownRef}
      composeDirtyRef={composeDirtyRef}
      composeEditorInitRef={composeEditorInitRef}
      composeSignatureRef={compose.composeSignatureRef}
      composeEditorSnapshotRef={compose.composeEditorSnapshotRef}
      composeLastEditedRef={composeLastEditedRef}
      composeSessionVersionRef={composeSessionVersionRef}
      stripHtml={stripHtml}
      setComposeBody={setComposeBody}
      setComposeHtml={setComposeHtml}
      setComposeHtmlText={setComposeHtmlText}
      setComposeMarkdown={setComposeMarkdown}
      setComposeInviteEnabled={(enabled) => {
        setComposeIncludeInvite(enabled);
        if (!enabled) {
          setComposeInviteLocation("");
          setComposeInviteStart("");
          setComposeInviteEnd("");
          setComposeInviteAllDay(false);
          setComposeInviteRecurrenceRule("");
          composeDirtyRef.current = true;
          return;
        }
        const nextDraft = createDefaultComposeInviteDraft();
        setComposeInviteLocation(nextDraft.location ?? "");
        setComposeInviteStart(nextDraft.start);
        setComposeInviteEnd(nextDraft.end);
        setComposeInviteAllDay(nextDraft.allDay);
        setComposeInviteRecurrenceRule(nextDraft.recurrenceRule ?? "");
        composeDirtyRef.current = true;
      }}
      setComposeInviteLocation={(value) => {
        setComposeInviteLocation(value);
        composeDirtyRef.current = true;
      }}
      setComposeInviteStart={(value) => {
        setComposeInviteStart(value);
        composeDirtyRef.current = true;
      }}
      setComposeInviteEnd={(value) => {
        setComposeInviteEnd(value);
        composeDirtyRef.current = true;
      }}
      setComposeInviteAllDay={(value) => {
        setComposeInviteAllDay(value);
        composeDirtyRef.current = true;
      }}
      setComposeInviteRecurrenceRule={(value) => {
        setComposeInviteRecurrenceRule(value);
        composeDirtyRef.current = true;
      }}
      setComposeTab={setComposeTab}
      setComposeEditorReset={setComposeEditorReset}
      setComposeIncludeOriginal={setComposeIncludeOriginal}
      setComposeQuoteHtml={setComposeQuoteHtml}
      setComposeQuotedHtml={setComposeQuotedHtml}
      setComposeQuotedText={setComposeQuotedText}
      setComposeQuotedHtmlEdited={compose.setComposeQuotedHtmlEdited}
      setComposeQuotedParts={setComposeQuotedParts}
      setComposeStripImages={setComposeStripImages}
      setComposeSignatureId={setComposeSignatureId}
      setSignatureMenuOpen={setSignatureMenuOpen}
      applySignatureToCompose={applySignatureToCompose}
      handleInlineImage={handleInlineImage}
      handleComposeAttachmentPick={handleComposeAttachmentPick}
      removeComposeAttachment={removeComposeAttachment}
      retryComposeAttachmentLoad={retryComposeAttachmentLoad}
      pendingImageDrop={pendingImageDrop}
      setPendingImageDrop={setPendingImageDrop}
      addComposeFiles={addComposeFiles}
      addDroppedFiles={addDroppedFiles}
    />
  );

  const contextValue: ComposeContextValue = {
    composeOpen,
    composeView,
    composeMode,
    composeDraftId,
    composeTo,
    composeCc,
    composeBcc,
    composeSubject,
    composeShowBcc,
    composeOpenedAt,
    activeAccountId,
    fromValue: sender?.identities.find(item => item.id === composeIdentityId) ? (() => {
      const identity = sender.identities.find(item => item.id === composeIdentityId)!;
      return identity.displayName ? `${identity.displayName} <${identity.email}>` : identity.email;
    })() : compose.composeUnavailableFrom ?? fromValue,
    identities: sender?.account.id === activeAccountId ? sender.identities : [],
    identityId: composeIdentityId,
    identityDisabled: senderLoading || !senderCanCompose || sendingMail || draftSaving,
    sendDisabled: senderLoading || !senderCanCompose || !sender?.identities.some(item => item.id === composeIdentityId && item.enabled),
    onSenderRetry: senderError && !senderLoading ? retrySender ?? undefined : undefined,
    senderMessage: senderError ?? draftSaveError ?? (!senderLoading && !sender?.identities.some(item => item.id === composeIdentityId && item.enabled) ? senderMessages.unavailableDraft : compose.composeSenderWarnings.join(" ")),
    onIdentityChange: (id) => {
      const identity = sender?.identities.find(item => item.id === id && item.enabled);
      if (!identity || sendingMail || !senderCanCompose) return;
      compose.setComposeIdentityId(id); compose.setComposeUnavailableFrom(undefined);
      composeDirtyRef.current = true; setSenderError(null); setDraftSaveError(null);
      const template = resolveSignatureTemplate(sender?.account.settings, sender?.prefs ?? {}, identity);
      // Render using the newly chosen identity without changing the active mailbox.
      applySignatureToCompose(template.body ? { id: template.id, body: template.body } : null, identity);
    },
    inReplyToMessage: composeReplyMessage,
    composeInviteDraft: currentComposeInviteDraft,
    composeFieldsReset: composeEditorReset,
    composeDragActive,
    composeSize,
    canSaveDraft: canSaveCurrentDraft,
    attachmentLoadState,
    deliveredWarnings,
    draftSaving,
    draftSaveError,
    draftSavedAt,
    sendingMail,
    discardingDraft,
    detachingCompose,
    detachedWindow,
    composeModalRef,
    composeResizeRef,
    setComposeTo,
    setComposeCc,
    setComposeBcc,
    setComposeSubject,
    setComposeShowBcc,
    setComposeOpen,
    setComposeView,
    setComposeResizing,
    setComposeAttachments,
    popOutCompose,
    popInCompose,
    minimizeCompose,
    openComposeInNewWindow,
    closeDetachedCompose,
    handleSendMail,
    handleSaveDraft,
    handleDiscardDraft: handleDiscardDraftWithCancel,
    markComposeDirty,
    applyRecipientSelection,
    loadRecipientOptions,
    jumpToMessage: jumpToMessageFromModal,
    getComposeToken,
    formatRelativeTime,
    handleComposeDragEnter,
    handleComposeDragLeave,
    handleComposeDragOver,
    handleComposeDrop,
    composeMessageField,
    composeCardRef
  };

  // Inline card variant uses `jumpToMessage` (no view switch) while the modal
  // variant docks back into the thread view after jumping.
  const inlineContextValue: ComposeContextValue = { ...contextValue, jumpToMessage };

  // The inline card stays in this component's render tree so state updates
  // propagate via context; its DOM is portalled into a caller-supplied slot.
  const [inlineSlotEl, setInlineSlotEl] = useState<HTMLDivElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      renderInlineCard: (wrapperClassName?: string) => (
        <InlineComposeSlot
          wrapperClassName={wrapperClassName}
          setSlot={setInlineSlotEl}
          externalRef={composeCardRef}
        />
      ),
      resetSession: () => {
        setRetrySender(null);
        setSenderError(null);
        composeInitRef.current = { token: composeInitRef.current.token + 1, key: null };
        sendOperationRef.current = null;
        deliveredRef.current = false;
        setDeliveredWarnings([]);
        resetComposeSession(composeRef.current);
        resetComposeTranslation();
      },
      openCompose,
      openDetachedCompose,
      setComposeView
    })
  );

  return (
    <ComposeContextProvider value={contextValue}>
      {senderError && retrySender && !composeOpen && <div role="alert">
        {senderError} <button type="button" disabled={senderLoading} onClick={retrySender}>{senderMessages.retrySender}</button>
      </div>}
      <ComposeModal isMobile={isMobile} open={isMobile ? composeOpen : showComposeModal} />
      <ComposeMinimized open={!isMobile && showComposeMinimized} />
      {!isMobile && inlineSlotEl &&
        createPortal(
          <ComposeContextProvider value={inlineContextValue}>
            <ComposeInlineCard />
          </ComposeContextProvider>,
          inlineSlotEl
        )}
    </ComposeContextProvider>
  );
}

function InlineComposeSlot({
  wrapperClassName,
  setSlot,
  externalRef
}: {
  wrapperClassName?: string;
  setSlot: (el: HTMLDivElement | null) => void;
  externalRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      externalRef.current = el;
      setSlot(el);
    },
    [externalRef, setSlot]
  );
  return <div ref={setRef} className={wrapperClassName} />;
}

const ComposeOrchestrator = forwardRef<ComposeOrchestratorHandle, ComposeOrchestratorProps>(
  ComposeOrchestratorImpl
);
ComposeOrchestrator.displayName = "ComposeOrchestrator";

export default ComposeOrchestrator;
