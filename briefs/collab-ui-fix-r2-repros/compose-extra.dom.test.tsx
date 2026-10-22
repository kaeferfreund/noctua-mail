// Runs only under `bun run test:dom`, which preloads lib/testSetupDom.ts to
// register happy-dom before any component module loads.
import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { SidebarInset, SidebarProvider } from "@/app/components/ui/sidebar";
import type { Message } from "@/lib/data";
import ComposeOrchestrator from "/home/monkey/code/noctua-mail/wt-review-collab/app/components/mailclient/composition/ComposeOrchestrator";

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


it("C5: completion of account A must not unlock a pending send in account B", async () => {
  const first = deferred<Response>();
  const second = deferred<Response>();
  const third = deferred<Response>();
  let sends = 0;
  const { view, props, handleRef, sendButton, countSmtpSends } = renderCompose({holdDraftSaves: false, smtpResponse: () => [first, second, third][sends++].promise});
  await act(async () => { await handleRef.current!.openCompose("new", undefined, false, {to: "a@example.test"}); });
  await act(async () => { fireEvent.click(sendButton()!); });
  await waitFor(() => expect(countSmtpSends()).toBe(1));
  // MailClient calls resetSession on every account change (MailClient.tsx:4747).
  await act(async () => {
    handleRef.current!.resetSession();
    view.rerender(<Theme><ComposeOrchestrator ref={handleRef} {...props} activeAccountId="account-b" /></Theme>);
  });
  await act(async () => { await handleRef.current!.openCompose("new", undefined, false, {to: "b@example.test"}); });
  await act(async () => { fireEvent.click(sendButton()!); });
  await waitFor(() => expect(countSmtpSends()).toBe(2));
  expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { first.resolve(new Response('{"message":"Synthetic failure"}', {status:500})); });
  const unlocked = !(sendButton() as HTMLButtonElement).disabled;
  await act(async () => { fireEvent.click(sendButton()!); });
  await act(async () => { second.resolve(jsonResponse({ok:true})); third.resolve(jsonResponse({ok:true})); });
  console.log("C5 observed", {unlocked, sends:countSmtpSends()});
  expect(unlocked).toBe(false);
  expect(countSmtpSends()).toBe(2);
});
for (const surface of ['inline','mobile'] as const) {
 it(`C1: ${surface} delivery receipt survives failed replacement hydration`,async()=>{
  let rejectHydration!: (error:Error)=>void;
  const hydration=new Promise<Message>((_,reject)=>{rejectHydration=reject});
  const errors:string[]=[];
  const h=renderCompose({onSidebarToggle:surface==='inline'?()=>{}:undefined,holdDraftSaves:false,isMobile:surface==='mobile',showComposeInline:surface==='inline',showComposeModal:surface==='mobile',smtpResponse:()=>jsonResponse({ok:true,sentCopy:'failed'}),ensureMessageContent:()=>hydration,reportError:m=>errors.push(m)});
  await act(async()=>{await h.handleRef.current!.openCompose('new',undefined,false,{to:'synthetic@example.test'});});
  if(surface==='inline')await act(async()=>{h.mountInlineCard();});
  await act(async()=>{fireEvent.click(h.sendButton()!);});
  expect(h.countSmtpSends()).toBe(1);
  let opening:Promise<void>|undefined;
  act(()=>{opening=h.handleRef.current!.openCompose('forward',{id:'next',accountId:'acc-test',threadId:'t-next',body:'',htmlBody:'',subject:'Next synthetic message'} as Message);});
  expect(h.sendButton()).toBeUndefined();
  expect(h.view.getByText('Delivery succeeded. Do not send it again.')).toBeTruthy();
  await act(async()=>{rejectHydration(new Error('Synthetic hydration failure'));await opening;});
  expect(h.sendButton()).toBeUndefined();
  expect(h.countSmtpSends()).toBe(1);
  expect(errors).toContain('Failed to open composer: Synthetic hydration failure');
 });
}
it('New: account switch cancels pending source hydration',async()=>{
 const hydration=deferred<Message>();
 const h=renderCompose({holdDraftSaves:false,ensureMessageContent:()=>hydration.promise});
 const source={id:'source-a',accountId:'acc-test',folderId:'folder-inbox',threadId:'thread-a',messageId:'<a@example.test>',from:'sender@example.test',to:'me@example.test',cc:'',subject:'Private synthetic A subject',date:'2026-08-14T10:00:00.000Z',dateValue:1,preview:'',body:'',htmlBody:''} as Message;
 let opening:Promise<void>|undefined;
 act(()=>{opening=h.handleRef.current!.openCompose('forward',source);});
 await act(async()=>{
  h.handleRef.current!.resetSession();
  h.view.rerender(<Theme><ComposeOrchestrator ref={h.handleRef} {...h.props} activeAccountId="account-b" /></Theme>);
 });
 await act(async()=>{hydration.resolve({...source,body:'Private synthetic A content'});await opening;});
 const subject=h.view.baseElement.querySelector<HTMLInputElement>('#compose-modal-subject');
 await act(async()=>{fireEvent.change(h.view.baseElement.querySelector('#compose-modal-to')!,{target:{value:'recipient@example.test'}});});
 await act(async()=>{fireEvent.click(h.sendButton()!);});
 const sent=h.calls.find(call=>call.url.includes('/smtp/send'));
 console.log('Pending hydration after account switch', {subject:subject?.value,sendUrl:sent?.url,leakedContent:JSON.stringify(sent?.body).includes('Private synthetic A')});
 expect(subject === null).toBe(true);
});
