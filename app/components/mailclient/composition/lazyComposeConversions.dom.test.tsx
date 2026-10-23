// Runs only under `bun run test:dom`, which preloads lib/testSetupDom.ts to
// register happy-dom before any component module loads.
import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { SidebarInset, SidebarProvider } from "@/app/components/ui/sidebar";
import type { Message } from "@/lib/data";
import { areMarkdownConvertersReady, loadMarkdownConverters } from "@/lib/markdownConvert";
import { useRecipientAliases } from "../useRecipientAliases";
import ComposeOrchestrator from "./ComposeOrchestrator";

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
  onSidebarToggle?: (open: boolean) => void;
  smtpResponse?: Response | (() => Response | Promise<Response>);
  reportError?: (message: string) => void;
  readErrorMessage?: (response: Response) => Promise<string>;
  updateKeywordFlag?: (message: Message, keyword: string, value: boolean) => void | Promise<void>;
  ensureMessageContent?: (message: Message) => Promise<Message | null | undefined>;
  attachmentResponse?: () => Response | Promise<Response>;
  aliasResponse?: () => Response | Promise<Response>;
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

    if (url.endsWith("/identities")) return jsonResponse({ ok: true, identities: [{ id: "primary", accountId: "acc-test", email: "me@example.test", displayName: "Synthetic Sender", enabled: true, isDefault: true }], ownAddresses: ["me@example.test"] });
    if (url.endsWith("/prefs")) return jsonResponse({ ok: true, prefs: {} });
    if (url === "/api/auth/me") return jsonResponse({ ok: true, user: { id: "synthetic-user", name: "Synthetic User", email: "user@example.test" }, accounts: [{ id: "acc-test", email: "me@example.test", name: "Synthetic Mailbox", accessRole: "manager", settings: {} }] });
    if (url.endsWith("/recipient-aliases") && options.aliasResponse) return options.aliasResponse();
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
    senderSettingsLoader: () => ({ account: { id: "acc-test", email: "me@example.test", accessRole: "manager", settings: {} }, identities: [{ id: "primary", accountId: "acc-test", email: "me@example.test", displayName: "Synthetic Sender", enabled: true, isDefault: true }], prefs: {}, user: { email: "user@example.test" }, warnings: [] }),
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
    refreshMailboxData: async () => {},
    pushNotice: () => {},
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

  // Match MailClient's shared alias subscription without changing its shell.
  function ComposeHarness() {
    const { recipientAliases } = useRecipientAliases({ activeAccountId: "acc-test", apiFetch });
    return <>
      <output data-testid="alias-summary">{recipientAliases.map((alias) => alias.name).join(", ")}</output>
      <ComposeOrchestrator ref={handleRef} {...props} />
    </>;
  }

  // The orchestrator is a sibling of the shell; its inline portal must
  // not rely on a React keydown handler on the shell to guard Bold.
  const renderTree = (inlineCard: React.ReactNode = null) => (
    <Theme>
      {options.onSidebarToggle && <SidebarProvider onOpenChange={options.onSidebarToggle}>
        <SidebarInset>{inlineCard}</SidebarInset>
      </SidebarProvider>}
      <ComposeHarness />
    </Theme>
  );
  const view = render(options.onSidebarToggle ? renderTree() : <Theme>
    <ComposeHarness />
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

describe("lazy compose conversions", () => {
  it("autosaves recipient edits made before cold body tools finish loading", async () => {
    const wasReady = areMarkdownConvertersReady();
    const { view, handleRef, calls } = renderCompose({
      holdDraftSaves: false, isMobile: true, showComposeModal: false
    });
    act(() => { void handleRef.current?.openCompose("new", undefined, false, {
      to: "prefilled@example.test", body: "Synthetic <prefill>"
    }); });
    const recipient = view.baseElement.querySelector<HTMLInputElement>("#compose-modal-to");
    expect(recipient).not.toBeNull();
    act(() => { fireEvent.change(recipient!, { target: { value: "edited@example.test" } }); });
    if (!wasReady) {
      expect(view.queryByRole("tab", { name: "Markdown" })).toBeNull();
      expect(calls.filter((call) => call.url.includes("/drafts/save"))).toHaveLength(0);
    }
    await waitFor(() => expect(calls.find((call) => call.url.includes("/drafts/save"))?.body).toMatchObject({
      to: "edited@example.test", text: "Synthetic <prefill>", composeFormat: "html"
    }), { timeout: 5000 });
  });

  it("gates cold compose controls and converts a send clicked before the loader settles", async () => {
    const wasReady = areMarkdownConvertersReady();
    const { view, handleRef, calls, sendButton } = renderCompose({
      holdDraftSaves: false, isMobile: true, showComposeModal: false
    });
    // Do not yield between opening and sending. In a cold process the real
    // dynamic import cannot settle before these synchronous actions finish.
    act(() => { void handleRef.current?.openCompose("new", undefined, false, {
      to: "prefilled@example.test", subject: "Synthetic prefill", body: "Synthetic <prefill>"
    }); });
    if (!wasReady) {
      expect(view.baseElement.querySelector("#compose-modal-to")).not.toBeNull();
      expect(view.queryByRole("tab", { name: "Markdown" })).toBeNull();
      expect(calls.filter((call) => call.url.includes("/drafts/save"))).toHaveLength(0);
    }
    act(() => { fireEvent.click(sendButton()!); });
    await waitFor(() => expect(calls.find((call) => call.url.includes("/smtp/send"))?.body).toMatchObject({
      to: "prefilled@example.test", subject: "Synthetic prefill", text: "Synthetic <prefill>",
      composeFormat: "html"
    }));
    expect(calls.filter((call) => call.url.includes("/drafts/save"))).toHaveLength(0);
  });

  it("opens an HTML draft, then autosaves and sends with the converted text part", async () => {
    const { view, handleRef, calls, sendButton } = renderCompose({ holdDraftSaves: false });
    const draft = {
      id: "lazy-draft", accountId: "acc-test", folderId: "folder-drafts", threadId: "lazy-thread",
      subject: "Synthetic draft", from: "me@example.test", to: "recipient@example.test",
      preview: "Synthetic", date: "2026-10-22", dateValue: 1, body: "Synthetic message",
      htmlBody: "<p><strong>Synthetic</strong> message</p>", xComposeFormat: "html"
    } as Message;
    await act(async () => { await handleRef.current?.openDetachedCompose(draft, {
      mode: "new", sourceMessage: null
    }); });
    const recipient = view.baseElement.querySelector<HTMLInputElement>("#compose-modal-to");
    expect(recipient).not.toBeNull();
    await act(async () => {
      fireEvent.change(recipient!, { target: { value: "changed@example.test" } });
    });
    await waitFor(() => {
      expect(calls.find((call) => call.url.includes("/drafts/save"))?.body).toMatchObject({
        text: "**Synthetic** message", composeFormat: "html"
      });
    }, { timeout: 5000 });
    await act(async () => { fireEvent.click(sendButton()!); });
    await waitFor(() => {
      expect(calls.find((call) => call.url.includes("/smtp/send"))?.body).toMatchObject({
        text: "**Synthetic** message", composeFormat: "html", to: "changed@example.test"
      });
    });
  }, 20000);

  it("requests aliases immediately and updates shared alias UI when they arrive", async () => {
    await loadMarkdownConverters();
    const aliases = deferred<Response>();
    const { view, handleRef, calls } = renderCompose({ isMobile: true, showComposeModal: false, aliasResponse: () => aliases.promise });
    expect(calls.filter((call) => call.url.endsWith("/recipient-aliases"))).toHaveLength(0);
    await act(async () => { await handleRef.current?.openCompose("new"); });
    const recipient = view.baseElement.querySelector<HTMLInputElement>("#compose-modal-to");
    expect(recipient).not.toBeNull();
    expect(calls.filter((call) => call.url.endsWith("/recipient-aliases"))).toHaveLength(1);
    await act(async () => {
      fireEvent.focus(recipient!);
      fireEvent.change(recipient!, { target: { value: "Synthetic" } });
      aliases.resolve(jsonResponse({ ok: true, aliases: [{ id: "synthetic-alias", name: "Synthetic team",
        recipients: "team@example.test", normalizedRecipients: "team@example.test" }] }));
    });
    await waitFor(() => expect(view.getByTestId("alias-summary").textContent).toBe("Synthetic team"));
    // Also covers the idle timer firing after the interaction: the resource
    // remains loaded and must not repeat the compose request.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });
    expect(calls.filter((call) => call.url.endsWith("/recipient-aliases"))).toHaveLength(1);
  });
});
