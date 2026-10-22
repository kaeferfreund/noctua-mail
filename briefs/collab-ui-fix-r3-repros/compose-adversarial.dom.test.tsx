// Runs only under `bun run test:dom`, which preloads lib/testSetupDom.ts to
// register happy-dom before any component module loads.
import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { SidebarInset, SidebarProvider } from "@/app/components/ui/sidebar";
import type { Message } from "@/lib/data";
import ComposeOrchestrator from "@/app/components/mailclient/composition/ComposeOrchestrator";

// FocusScope restores focus and removes itself from Radix's shared stack in a
// zero-delay timer on unmount. Flush that task inside act before the next test
// focuses an opener; otherwise the previous dialog can steal that focus.
afterEach(async () => {
  cleanup();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
});

type ApiCall = { url: string; method: string; body?: unknown; signal?: AbortSignal | null };

type RenderComposeOptions = {
  isMobile?: boolean;
  onOutcome?: (outcome: string, id: string | null, warnings?: string[]) => void;
  onNotice?: (notice: { type: string; title: string; description?: string }) => void;
  refreshMailboxData?: () => Promise<void>;
  onSidebarToggle?: (open: boolean) => void;
  smtpResponse?: Response | (() => Response | Promise<Response>);
  reportError?: (message: string) => void;
  readErrorMessage?: (response: Response) => Promise<string>;
  updateKeywordFlag?: (message: Message, keyword: string, value: boolean) => void | Promise<void>;
  ensureMessageContent?: (message: Message) => Promise<Message | null | undefined>;
  attachmentResponse?: () => Response | Promise<Response>;
  holdDraftSaves?: boolean;
  detachedWindow?: boolean;
  showComposeInline?: boolean;
  showComposeModal?: boolean;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Every caller passes a path string today, but reading `.url`/`.href` keeps the
 * stub from silently matching nothing (and the test from silently passing) if
 * one ever switches to a Request or URL — `String(new Request(...))` is
 * "[object Request]".
 */
function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Renders the real ComposeOrchestrator with stub collaborators. Everything the
 * send path touches arrives through props, so the draft-save and SMTP calls can
 * be driven from the test without touching the network.
 */
function renderCompose(options: RenderComposeOptions = {}) {
  const calls: ApiCall[] = [];
  const draftSaveGate = deferred<void>();

  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const body = typeof init?.body === "string"
      ? JSON.parse(init.body) as unknown
      : undefined;
    calls.push({ url, method: init?.method ?? "GET", body, signal: init?.signal });

    if (url.includes("/attachments/") && options.attachmentResponse) {
      return options.attachmentResponse();
    }
    if (url.includes("/drafts/save")) {
      // Hold the save open so the pre-send flush blocks, reproducing the slow
      // IMAP APPEND the user hit.
      if (options.holdDraftSaves ?? true) await draftSaveGate.promise;
      return jsonResponse({ draftId: "draft-1", message: null });
    }
    if (url.includes("/smtp/send")) {
      if (typeof options.smtpResponse === "function") {
        return options.smtpResponse();
      }
      if (options.smtpResponse) return options.smtpResponse;
      return jsonResponse({ ok: true, sentFolderId: null, sentMessageUid: null });
    }
    return jsonResponse({ ok: true });
  };

  const handleRef = React.createRef<React.ElementRef<typeof ComposeOrchestrator>>();

  const props = {
    activeAccountId: "acc-test",
    currentAccount: null,
    accountDateFormat: "locale" as const,
    defaultSignatureId: "",
    accountSignatures: [],
    darkMode: false,
    isMobile: options.isMobile ?? false,
    activeThread: [],
    messageById: new Map(),
    viewMessage: null,
    searchScope: "folder",
    activeFolderId: "folder-inbox",
    isDraftsFolder: () => false,
    setMessages: () => {},
    setViewMessage: () => {},
    setActiveMessageId: () => {},
    suppressDraftDeleteReconcile: () => {},
    removeDraftFromUi: () => {},
    reconcileSavedDraftInUi: () => {},
    refreshFolders: async () => {},
    refreshMailboxData: options.refreshMailboxData ?? (async () => {}),
    pushNotice: options.onNotice ?? (() => {}),
    onDetachedComposeOutcome: options.onOutcome,
    evictThreadCache: () => {},
    updateFlagState: () => {},
    updateKeywordFlag: options.updateKeywordFlag ?? (() => {}),
    accountFolders: [],
    findSentFolder: () => null,
    syncFolderWithBackgroundRef: { current: async () => {} },
    getPreferredComposeTab: () => undefined,
    isDraftMessage: () => false,
    ensureMessageContent: options.ensureMessageContent ?? (async () => null),
    applyRecipientSelection: (current: string) => current,
    loadRecipientOptions: async () => [],
    clearRecipientSuggestionCache: () => {},
    getComposeToken: (value: string) => value,
    formatRelativeTime: () => "just now",
    fromValue: "me@example.test",
    apiFetch,
    reportError: options.reportError ?? (() => {}),
    readErrorMessage: options.readErrorMessage ?? (async () => "error"),
    stripHtml: (value: string) => value,
    showComposeInline: options.showComposeInline ?? false,
    showComposeModal: options.showComposeModal ?? true,
    showComposeMinimized: false,
    detachedWindow: options.detachedWindow ?? false
  } as unknown as React.ComponentProps<typeof ComposeOrchestrator>;

  // The orchestrator is a sibling of the shell; its inline portal must
  // not rely on a React keydown handler on the shell to guard Bold.
  const renderTree = (inlineCard: React.ReactNode = null) => (
    <Theme>
      {options.onSidebarToggle && <SidebarProvider onOpenChange={options.onSidebarToggle}>
        <SidebarInset>{inlineCard}</SidebarInset>
      </SidebarProvider>}
      <ComposeOrchestrator ref={handleRef} {...props} />
    </Theme>
  );
  const view = render(options.onSidebarToggle ? renderTree() : <Theme>
    <ComposeOrchestrator ref={handleRef} {...props} />
  </Theme>);

  const sendButton = () =>
    [...view.baseElement.querySelectorAll("button")].find((button) =>
      /^(Send|Sending\.\.\.)$/.test((button.textContent ?? "").trim())
    );

  const countSmtpSends = () => calls.filter((call) => call.url.includes("/smtp/send")).length;
  const countDraftSaves = () => calls.filter((call) => call.url.includes("/drafts/save")).length;

  return {
    view,
    mountInlineCard: () => view.rerender(renderTree(handleRef.current?.renderInlineCard())),
    props,
    handleRef,
    calls,
    draftSaveGate,
    sendButton,
    countSmtpSends,
    countDraftSaves
  };
}



const sourceMessage = (overrides: Partial<Message> = {}) => ({
  id: "synthetic-source", accountId: "acc-test", folderId: "folder-inbox", threadId: "synthetic-thread",
  messageId: "<synthetic@example.test>", from: "sender@example.test", to: "me@example.test", cc: "",
  subject: "Obsolete synthetic source", date: "2026-10-22T10:00:00.000Z", dateValue: 1,
  preview: "", body: "", htmlBody: "", ...overrides,
} as Message);

function rerenderScope(h: ReturnType<typeof renderCompose>, accountId: string, ownerUserId?: string) {
  h.view.rerender(<Theme><ComposeOrchestrator ref={h.handleRef} {...h.props} activeAccountId={accountId} ownerUserId={ownerUserId} /></Theme>);
}
async function startSend(h: ReturnType<typeof renderCompose>, to: string, count: number) {
  await act(async () => { await h.handleRef.current!.openCompose("new", undefined, false, { to }); });
  await act(async () => { fireEvent.click(h.sendButton()!); });
  await waitFor(() => expect(h.countSmtpSends()).toBe(count));
}

it("R2-1: same-account session replacement keeps the newer send locked when the old send fails", async () => {
  const first = deferred<Response>(), second = deferred<Response>();
  const errors: string[] = [];
  let calls = 0;
  const h = renderCompose({ holdDraftSaves: false, reportError: error => errors.push(error),
    smtpResponse: () => ++calls === 1 ? first.promise : second.promise });
  await startSend(h, "first@example.test", 1);
  await act(async () => { h.handleRef.current!.resetSession(); });
  await startSend(h, "second@example.test", 2);
  await act(async () => { first.resolve(new Response('{"message":"Synthetic first failure"}', {status:500})); });
  expect(errors).toHaveLength(1);
  expect(h.sendButton()!.disabled).toBe(true);
  await act(async () => { fireEvent.click(h.sendButton()!); });
  expect(h.countSmtpSends()).toBe(2);
  await act(async () => { second.resolve(jsonResponse({ok:true})); });
  expect(h.sendButton()!.disabled).toBe(false);
});

it("R2-1: A-to-B-to-A does not revive ownership of the first A send or its receipt", async () => {
  const first = deferred<Response>(), second = deferred<Response>();
  let calls = 0;
  const h = renderCompose({ holdDraftSaves:false, smtpResponse: () => ++calls === 1 ? first.promise : second.promise });
  await startSend(h, "original@example.test", 1);
  await act(async () => { h.handleRef.current!.resetSession(); rerenderScope(h,"account-b"); });
  await act(async () => { h.handleRef.current!.resetSession(); rerenderScope(h,"acc-test"); });
  await startSend(h, "replacement@example.test", 2);
  await act(async () => { first.resolve(jsonResponse({ok:true,sentCopy:"failed"})); });
  expect(h.sendButton()!.disabled).toBe(true);
  expect(h.view.baseElement.querySelector<HTMLInputElement>("#compose-modal-to")!.value).toBe("replacement@example.test");
  expect(h.view.queryByText("Delivery succeeded. Do not send it again.")).toBeNull();
  await act(async () => { fireEvent.click(h.sendButton()!); });
  expect(h.countSmtpSends()).toBe(2);
  await act(async () => { second.resolve(jsonResponse({ok:true})); });
});

it("R2-2: pending body hydration cannot revive a reset session in the same account", async () => {
  const body = deferred<Message>();
  const h = renderCompose({isMobile:true,holdDraftSaves:false,ensureMessageContent:()=>body.promise});
  const source = sourceMessage();
  let opening!: Promise<void>;
  act(() => { opening = h.handleRef.current!.openCompose("forward",source); });
  await act(async () => { h.handleRef.current!.resetSession(); });
  await act(async () => { body.resolve({...source,body:"Obsolete synthetic body"}); await opening; });
  expect(h.view.baseElement.querySelector("#compose-modal-subject")).toBeNull();
  expect(h.countSmtpSends()).toBe(0);
  expect(h.countDraftSaves()).toBe(0);
  await act(async () => { await h.handleRef.current!.openCompose("new",undefined,false,{subject:"Current synthetic session"}); });
  expect(h.view.baseElement.querySelector<HTMLInputElement>("#compose-modal-subject")!.value).toBe("Current synthetic session");
});

it("R2-2: user change in the same mailbox rejects old body hydration without an explicit reset", async () => {
  const body = deferred<Message>();
  const h = renderCompose({isMobile:true,holdDraftSaves:false,ensureMessageContent:()=>body.promise});
  await act(async () => { rerenderScope(h,"acc-test","synthetic-user-a"); });
  const source = sourceMessage();
  let opening!: Promise<void>;
  act(() => { opening = h.handleRef.current!.openCompose("forward",source); });
  await act(async () => { rerenderScope(h,"acc-test","synthetic-user-b"); });
  await act(async () => { body.resolve({...source,body:"Previous user's synthetic content"}); await opening; });
  expect(h.view.baseElement.querySelector("#compose-modal-subject")).toBeNull();
  expect(h.countDraftSaves()).toBe(0);
  await act(async () => { await h.handleRef.current!.openCompose("new",undefined,false,{to:"current@example.test",subject:"Current user's synthetic subject"}); });
  await act(async () => { fireEvent.click(h.sendButton()!); });
  const sent = h.calls.find(call=>call.url.includes("/smtp/send"));
  expect(JSON.stringify(sent?.body)).toContain("Current user's synthetic subject");
  expect(JSON.stringify(sent?.body)).not.toContain("Previous user's synthetic content");
});

it("R2-2: late draft metadata cannot overwrite a newer composer session", async () => {
  const metadata = deferred<Response>();
  const h = renderCompose({isMobile:true,holdDraftSaves:false});
  let metadataReads = 0;
  const originalFetch = h.props.apiFetch;
  const props = {...h.props,isDraftMessage:()=>true,apiFetch:async (input:RequestInfo|URL,init?:RequestInit)=> {
    if (String(input).includes("/source")) { metadataReads++; return metadata.promise; }
    return originalFetch(input,init);
  }};
  await act(async () => { h.view.rerender(<Theme><ComposeOrchestrator ref={h.handleRef} {...props} /></Theme>); });
  let opening!: Promise<void>;
  act(() => { opening = h.handleRef.current!.openCompose("edit",sourceMessage({body:"Synthetic draft",hasSource:true})); });
  await waitFor(() => expect(metadataReads).toBe(1));
  await act(async () => { await h.handleRef.current!.openCompose("new",undefined,false,{subject:"Replacement synthetic session"}); });
  await act(async () => { metadata.resolve(jsonResponse({source:"Subject: Synthetic source\r\n\r\nSynthetic source body"})); await opening; });
  expect(h.view.baseElement.querySelector<HTMLInputElement>("#compose-modal-subject")!.value).toBe("Replacement synthetic session");
  expect(h.countDraftSaves()).toBe(0);
});
