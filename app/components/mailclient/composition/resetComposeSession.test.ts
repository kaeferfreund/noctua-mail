import { describe, expect, it } from "bun:test";
import type { Dispatch, SetStateAction } from "react";
import type { Attachment, Message } from "@/lib/data";
import type {
  ComposeMode,
  ComposeQuotedParts,
  ComposeReplyHeaders,
  ComposeTab,
  ComposeView,
  PendingImageDrop
} from "./composeTypes";
import type { ResettableComposeState } from "./resetComposeSession";
import { resetComposeSession } from "./resetComposeSession";

function createSetter<T>(store: { value: T }): Dispatch<SetStateAction<T>> {
  return (next) => {
    store.value = typeof next === "function" ? (next as (prev: T) => T)(store.value) : next;
  };
}

describe("resetComposeSession", () => {
  it("clears compose state and transient draft tracking", () => {
    const state = {
      composeOpen: true,
      composeView: "minimized" as ComposeView,
      composeDraftId: "draft-1" as string | null,
      composeMode: "reply" as ComposeMode,
      composeTo: "alice@example.test",
      composeCc: "cc@example.test",
      composeBcc: "bcc@example.test",
      composeSubject: "Subject",
      composeBody: "Body",
      composeIncludeInvite: true,
      composeInviteLocation: "Room 1",
      composeInviteStart: "2026-03-27T09:00",
      composeInviteEnd: "2026-03-27T10:00",
      composeInviteAllDay: true,
      composeInviteRecurrenceRule: "FREQ=WEEKLY",
      composeHtml: "<p>Body</p>",
      composeHtmlText: "Body",
      composeMarkdown: "**Body**",
      composeOpenedAt: "Yesterday",
      composeSignatureId: "sig-1",
      signatureMenuOpen: true,
      composeReplyMessage: { id: "message-1" } as unknown as Message | null,
      composeTab: "markdown" as ComposeTab,
      composeShowBcc: true,
      composeStripImages: true,
      composeIncludeOriginal: false,
      composeQuoteHtml: false,
      composeQuotedHtml: "<blockquote>quoted</blockquote>",
      composeQuotedText: "quoted",
      composeQuotedHtmlEdited: true,
      composeReplyHeaders: { inReplyTo: "message-id" } as ComposeReplyHeaders | null,
      composeAttachments: [{ id: "att-1" }] as unknown as Attachment[],
      composeDragActive: true,
      pendingImageDrop: { files: [] as File[], x: 1, y: 2 } as PendingImageDrop | null,
      composeEditorReset: 4,
      composeQuotedParts: { styles: "", headerHtml: "", bodyHtml: "" } as ComposeQuotedParts | null,
      composeResizing: true,
      sendingMail: true,
      draftSaving: true,
      draftSavedAt: 123 as number | null,
      draftSaveError: "boom" as string | null,
      discardingDraft: true
    };

    const compose: ResettableComposeState = {
      setComposeOpen: createSetter({ get value() { return state.composeOpen; }, set value(value) { state.composeOpen = value; } }),
      setComposeView: createSetter<ComposeView>({ get value() { return state.composeView; }, set value(value) { state.composeView = value; } }),
      setComposeDraftId: createSetter<string | null>({ get value() { return state.composeDraftId; }, set value(value) { state.composeDraftId = value; } }),
      setComposeMode: createSetter<ComposeMode>({ get value() { return state.composeMode; }, set value(value) { state.composeMode = value; } }),
      setComposeTo: createSetter({ get value() { return state.composeTo; }, set value(value) { state.composeTo = value; } }),
      setComposeCc: createSetter({ get value() { return state.composeCc; }, set value(value) { state.composeCc = value; } }),
      setComposeBcc: createSetter({ get value() { return state.composeBcc; }, set value(value) { state.composeBcc = value; } }),
      setComposeSubject: createSetter({ get value() { return state.composeSubject; }, set value(value) { state.composeSubject = value; } }),
      setComposeBody: createSetter({ get value() { return state.composeBody; }, set value(value) { state.composeBody = value; } }),
      setComposeIncludeInvite: createSetter({ get value() { return state.composeIncludeInvite; }, set value(value) { state.composeIncludeInvite = value; } }),
      setComposeInviteLocation: createSetter({ get value() { return state.composeInviteLocation; }, set value(value) { state.composeInviteLocation = value; } }),
      setComposeInviteStart: createSetter({ get value() { return state.composeInviteStart; }, set value(value) { state.composeInviteStart = value; } }),
      setComposeInviteEnd: createSetter({ get value() { return state.composeInviteEnd; }, set value(value) { state.composeInviteEnd = value; } }),
      setComposeInviteAllDay: createSetter({ get value() { return state.composeInviteAllDay; }, set value(value) { state.composeInviteAllDay = value; } }),
      setComposeInviteRecurrenceRule: createSetter({ get value() { return state.composeInviteRecurrenceRule; }, set value(value) { state.composeInviteRecurrenceRule = value; } }),
      setComposeHtml: createSetter({ get value() { return state.composeHtml; }, set value(value) { state.composeHtml = value; } }),
      setComposeHtmlText: createSetter({ get value() { return state.composeHtmlText; }, set value(value) { state.composeHtmlText = value; } }),
      setComposeMarkdown: createSetter({ get value() { return state.composeMarkdown; }, set value(value) { state.composeMarkdown = value; } }),
      composeMarkdownRef: { current: "**Body**" },
      setComposeOpenedAt: createSetter({ get value() { return state.composeOpenedAt; }, set value(value) { state.composeOpenedAt = value; } }),
      setComposeSignatureId: createSetter({ get value() { return state.composeSignatureId; }, set value(value) { state.composeSignatureId = value; } }),
      setSignatureMenuOpen: createSetter({ get value() { return state.signatureMenuOpen; }, set value(value) { state.signatureMenuOpen = value; } }),
      setComposeReplyMessage: createSetter<Message | null>({ get value() { return state.composeReplyMessage; }, set value(value) { state.composeReplyMessage = value; } }),
      setComposeTab: createSetter<ComposeTab>({ get value() { return state.composeTab; }, set value(value) { state.composeTab = value; } }),
      setComposeShowBcc: createSetter({ get value() { return state.composeShowBcc; }, set value(value) { state.composeShowBcc = value; } }),
      setComposeStripImages: createSetter({ get value() { return state.composeStripImages; }, set value(value) { state.composeStripImages = value; } }),
      setComposeIncludeOriginal: createSetter({ get value() { return state.composeIncludeOriginal; }, set value(value) { state.composeIncludeOriginal = value; } }),
      setComposeQuoteHtml: createSetter({ get value() { return state.composeQuoteHtml; }, set value(value) { state.composeQuoteHtml = value; } }),
      setComposeQuotedHtml: createSetter({ get value() { return state.composeQuotedHtml; }, set value(value) { state.composeQuotedHtml = value; } }),
      setComposeQuotedText: createSetter({ get value() { return state.composeQuotedText; }, set value(value) { state.composeQuotedText = value; } }),
      setComposeQuotedHtmlEdited: createSetter({ get value() { return state.composeQuotedHtmlEdited; }, set value(value) { state.composeQuotedHtmlEdited = value; } }),
      setComposeReplyHeaders: createSetter<ComposeReplyHeaders | null>({ get value() { return state.composeReplyHeaders; }, set value(value) { state.composeReplyHeaders = value; } }),
      setComposeAttachments: createSetter<Attachment[]>({ get value() { return state.composeAttachments; }, set value(value) { state.composeAttachments = value; } }),
      setComposeDragActive: createSetter({ get value() { return state.composeDragActive; }, set value(value) { state.composeDragActive = value; } }),
      setPendingImageDrop: createSetter<PendingImageDrop | null>({ get value() { return state.pendingImageDrop; }, set value(value) { state.pendingImageDrop = value; } }),
      setComposeEditorReset: createSetter({ get value() { return state.composeEditorReset; }, set value(value) { state.composeEditorReset = value; } }),
      setComposeQuotedParts: createSetter<ComposeQuotedParts | null>({ get value() { return state.composeQuotedParts; }, set value(value) { state.composeQuotedParts = value; } }),
      setComposeResizing: createSetter({ get value() { return state.composeResizing; }, set value(value) { state.composeResizing = value; } }),
      setSendingMail: createSetter({ get value() { return state.sendingMail; }, set value(value) { state.sendingMail = value; } }),
      sendingMailRef: { current: true },
      setDraftSaving: createSetter({ get value() { return state.draftSaving; }, set value(value) { state.draftSaving = value; } }),
      setDraftSavedAt: createSetter<number | null>({ get value() { return state.draftSavedAt; }, set value(value) { state.draftSavedAt = value; } }),
      setDraftSaveError: createSetter<string | null>({ get value() { return state.draftSaveError; }, set value(value) { state.draftSaveError = value; } }),
      setDiscardingDraft: createSetter({ get value() { return state.discardingDraft; }, set value(value) { state.discardingDraft = value; } }),
      composeBodyDebounceRef: { current: setTimeout(() => undefined, 0) },
      draftSaveTimerRef: { current: Number(setTimeout(() => undefined, 0)) },
      draftSaveInFlightRef: { current: true },
      pendingDraftSaveRef: { current: { payload: { to: "", subject: "", text: "" }, hash: "hash-1" } },
      composeSessionVersionRef: { current: 4 },
      composeDraftIdRef: { current: "draft-1" },
      lastDraftHashRef: { current: "last-hash" },
      currentDraftHashRef: { current: "current-hash" },
      composeBaselineHashRef: { current: "baseline-hash" },
      composeDirtyRef: { current: true },
      composeEditorInitRef: { current: true },
      composeLastEditedRef: { current: "text" },
      composeSignatureRef: { current: { id: "sig-1", text: "Sig", html: "<p>Sig</p>" } },
      composeSelectionRef: { current: { start: 1, end: 2, value: "Body" } },
      composeDragDepthRef: { current: 2 },
      composeResizeRef: { current: { startX: 1, startY: 2, startWidth: 3, startHeight: 4 } }
    };

    resetComposeSession(compose);

    expect(state.composeOpen).toBe(false);
    expect(state.composeView).toBe("inline");
    expect(state.composeDraftId).toBeNull();
    expect(state.composeMode).toBe("new");
    expect(state.composeTo).toBe("");
    expect(state.composeCc).toBe("");
    expect(state.composeBcc).toBe("");
    expect(state.composeSubject).toBe("");
    expect(state.composeBody).toBe("");
    expect(state.composeIncludeInvite).toBe(false);
    expect(state.composeInviteLocation).toBe("");
    expect(state.composeInviteStart).toBe("");
    expect(state.composeInviteEnd).toBe("");
    expect(state.composeInviteAllDay).toBe(false);
    expect(state.composeInviteRecurrenceRule).toBe("");
    expect(state.composeHtml).toBe("");
    expect(state.composeHtmlText).toBe("");
    expect(state.composeMarkdown).toBe("");
    expect(state.composeOpenedAt).toBe("");
    expect(state.composeSignatureId).toBe("");
    expect(state.signatureMenuOpen).toBe(false);
    expect(state.composeReplyMessage).toBeNull();
    expect(state.composeTab).toBe("html");
    expect(state.composeShowBcc).toBe(false);
    expect(state.composeStripImages).toBe(false);
    expect(state.composeIncludeOriginal).toBe(true);
    expect(state.composeQuoteHtml).toBe(true);
    expect(state.composeQuotedHtml).toBe("");
    expect(state.composeQuotedText).toBe("");
    expect(state.composeQuotedHtmlEdited).toBe(false);
    expect(state.composeReplyHeaders).toBeNull();
    expect(state.composeAttachments).toEqual([]);
    expect(state.composeDragActive).toBe(false);
    expect(state.pendingImageDrop).toBeNull();
    expect(state.composeEditorReset).toBe(5);
    expect(state.composeQuotedParts).toBeNull();
    expect(state.composeResizing).toBe(false);
    expect(state.sendingMail).toBe(false);
    expect(state.draftSaving).toBe(false);
    expect(state.draftSavedAt).toBeNull();
    expect(state.draftSaveError).toBeNull();
    expect(state.discardingDraft).toBe(false);

    expect(compose.sendingMailRef.current).toBe(false);
    expect(compose.composeBodyDebounceRef.current).toBeNull();
    expect(compose.draftSaveTimerRef.current).toBeNull();
    expect(compose.draftSaveInFlightRef.current).toBe(false);
    expect(compose.pendingDraftSaveRef.current).toBeNull();
    expect(compose.composeSessionVersionRef.current).toBe(5);
    expect(compose.composeDraftIdRef.current).toBeNull();
    expect(compose.lastDraftHashRef.current).toBe("");
    expect(compose.currentDraftHashRef.current).toBe("");
    expect(compose.composeBaselineHashRef.current).toBeNull();
    expect(compose.composeDirtyRef.current).toBe(false);
    expect(compose.composeEditorInitRef.current).toBe(false);
    expect(compose.composeLastEditedRef.current).toBe("html");
    expect(compose.composeSignatureRef.current).toBeNull();
    expect(compose.composeSelectionRef.current).toBeNull();
    expect(compose.composeDragDepthRef.current).toBe(0);
    expect(compose.composeResizeRef.current).toBeNull();
    expect(compose.composeMarkdownRef.current).toBe("");
  });
});
