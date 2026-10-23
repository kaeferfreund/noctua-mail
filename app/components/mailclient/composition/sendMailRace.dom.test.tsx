// Runs only under `bun run test:dom`, which preloads lib/testSetupDom.ts to
// register happy-dom before any component module loads.
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { SidebarInset, SidebarProvider } from "@/app/components/ui/sidebar";
import type { SenderSettings } from "@/lib/ui/senderSettings";
import type { Message } from "@/lib/data";
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
  sender?: SenderSettings;
  isMobile?: boolean;
  followComposeOpen?: boolean;
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
    senderSettingsLoader: (_: unknown, accountId: string) => options.sender ?? ({ account: { id: accountId, email: "me@example.test", accessRole: "manager", settings: {} }, identities: [{ id: "primary", accountId, email: "me@example.test", displayName: "Synthetic Sender", enabled: true, isDefault: true }], prefs: {}, user: { email: "user@example.test" }, warnings: [] }),
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

  function LiveCompose() {
    const [open, setOpen] = React.useState(false);
    const onMirror = React.useCallback((mirror: { composeOpen: boolean }) => setOpen(mirror.composeOpen), []);
    return <ComposeOrchestrator ref={handleRef} {...props} showComposeModal={open} onComposeMirrorChange={onMirror} />;
  }
  const composer = options.followComposeOpen ? <LiveCompose /> : <ComposeOrchestrator ref={handleRef} {...props} />;

  // The orchestrator is a sibling of the shell; its inline portal must
  // not rely on a React keydown handler on the shell to guard Bold.
  const renderTree = (inlineCard: React.ReactNode = null) => (
    <Theme>
      {options.onSidebarToggle && <SidebarProvider onOpenChange={options.onSidebarToggle}>
        <SidebarInset>{inlineCard}</SidebarInset>
      </SidebarProvider>}
      {composer}
    </Theme>
  );
  const view = render(options.onSidebarToggle ? renderTree() : <Theme>{composer}</Theme>);

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

describe("send while a draft save is still in flight", () => {
  it("sends once when Send is clicked repeatedly during the pre-send draft flush", async () => {
    const { view, handleRef, draftSaveGate, sendButton, countSmtpSends, countDraftSaves } =
      renderCompose();

    await act(async () => {
      handleRef.current?.openCompose("new");
    });

    // Typing marks the compose dirty, which schedules the debounced auto-save.
    const toField = view.baseElement.querySelector<HTMLInputElement>("#compose-modal-to");
    expect(toField).not.toBeNull();
    await act(async () => {
      fireEvent.change(toField!, { target: { value: "someone@example.test" } });
    });

    // Wait for the auto-save to actually be in flight; it now blocks on the gate.
    await waitFor(() => expect(countDraftSaves()).toBe(1), { timeout: 5000 });

    // The frustrated-user sequence: the button looks unresponsive because the
    // flush is blocked, so it gets clicked three times.
    const labels: Array<{ label: string; disabled: boolean }> = [];
    for (let click = 0; click < 3; click += 1) {
      const button = sendButton();
      expect(button).toBeDefined();
      labels.push({
        label: (button!.textContent ?? "").trim(),
        disabled: (button as HTMLButtonElement).disabled
      });
      await act(async () => {
        fireEvent.click(button!);
      });
    }

    // Let the draft save settle so the flush completes and the send proceeds.
    await act(async () => {
      draftSaveGate.resolve();
    });

    // Settle on observable state rather than a delay: the handler clears
    // `sendingMail` in its finally, so an enabled button means the send ran to
    // completion. Any duplicate handler was parked on the same gate and calls
    // apiFetch well before it finishes, so its call is already counted here.
    await waitFor(
      () => {
        const button = sendButton();
        expect(button).toBeDefined();
        expect((button as HTMLButtonElement).disabled).toBe(false);
      },
      { timeout: 5000 }
    );

    // The bug: every click that landed during the flush sent its own copy.
    expect(countSmtpSends()).toBe(1);

    // The UX symptom behind it: the button kept reading "Send" and stayed
    // clickable for the whole flush, so it looked unresponsive.
    expect(labels[0]).toEqual({ label: "Send", disabled: false });
    expect(labels[1]).toEqual({ label: "Sending...", disabled: true });
    expect(labels[2]).toEqual({ label: "Sending...", disabled: true });

    cleanup();
  }, 20000);

  it("surfaces an SMTP timeout and re-enables Send after the request fails", async () => {
    const errors: string[] = [];
    const timeoutMessage =
      "Connecting to the mail provider timed out. Keep this draft and try again later.";
    const { view, handleRef, draftSaveGate, sendButton, countSmtpSends } = renderCompose({
      smtpResponse: new Response(
        JSON.stringify({
          ok: false,
          message: timeoutMessage,
          code: "smtp_connection_timeout"
        }),
        { status: 504, headers: { "Content-Type": "application/json" } }
      ),
      reportError: (message) => errors.push(message),
      readErrorMessage: async (response) => {
        const body = (await response.json()) as { message?: string };
        return body.message ?? `Request failed (${response.status})`;
      }
    });

    await act(async () => {
      handleRef.current?.openCompose("new");
    });

    const toField = view.baseElement.querySelector<HTMLInputElement>("#compose-modal-to");
    expect(toField).not.toBeNull();
    await act(async () => {
      fireEvent.change(toField!, { target: { value: "someone@example.test" } });
    });
    await act(async () => {
      fireEvent.click(sendButton()!);
    });

    await act(async () => {
      draftSaveGate.resolve();
    });

    await waitFor(() => expect(errors).toEqual([timeoutMessage]), { timeout: 5000 });
    expect(countSmtpSends()).toBe(1);
    expect((sendButton()?.textContent ?? "").trim()).toBe("Send");
    expect((sendButton() as HTMLButtonElement).disabled).toBe(false);

    cleanup();
  }, 20000);
});

describe("detached compose semantics", () => {
  it("renders the existing inline compose card without the modal header", async () => {
    const { view, props, handleRef } = renderCompose({
      detachedWindow: true,
      showComposeInline: true,
      showComposeModal: false
    });
    const inlineCard = handleRef.current?.renderInlineCard();
    view.rerender(
      <Theme>
        <ComposeOrchestrator ref={handleRef} {...props} />
        {inlineCard}
      </Theme>
    );

    await act(async () => {
      await handleRef.current?.openDetachedCompose(null, {
        mode: "new",
        sourceMessage: null
      });
    });

    await waitFor(() => {
      expect(view.baseElement.querySelector("#compose-inline-to")).not.toBeNull();
    });
    expect(view.baseElement.querySelector("#compose-modal-to")).toBeNull();
    expect(view.getByText("New message")).toBeTruthy();
    expect(view.queryByLabelText("Close composer")).toBeNull();
    expect(view.queryByLabelText("Open composer in new window")).toBeNull();
    expect(view.getByLabelText("Open in modal")).toBeTruthy();

    cleanup();
  });

  it("retains forward metadata when a saved handoff is reopened", async () => {
    const forwardedFlags: Array<{ messageId: string; keyword: string; value: boolean }> = [];
    const { view, handleRef, calls, sendButton } = renderCompose({
      updateKeywordFlag: (message, keyword, value) => {
        forwardedFlags.push({ messageId: message.id, keyword, value });
      }
    });
    const source = {
      id: "source-1",
      accountId: "acc-test",
      folderId: "folder-inbox",
      threadId: "thread-1",
      messageId: "<source-1@example.test>",
      subject: "Original",
      from: "sender@example.test",
      to: "me@example.test",
      preview: "Original body",
      date: "2026-08-14T10:00:00.000Z",
      dateValue: 1,
      body: "Original body"
    } as Message;
    const draft = {
      ...source,
      id: "draft-forward-1",
      from: "me@example.test",
      folderId: "folder-drafts",
      draft: true,
      to: "recipient@example.test",
      subject: "Fwd: Original",
      body: "Forwarded note",
      xComposeFormat: "text",
      xForwardedMessageId: source.messageId
    } as Message;

    await act(async () => {
      await handleRef.current?.openDetachedCompose(draft, {
        mode: "forward",
        sourceMessage: source
      });
    });
    await act(async () => {
      fireEvent.click(sendButton()!);
    });

    await waitFor(() => {
      expect(calls.filter((call) => call.url.includes("/smtp/send"))).toHaveLength(1);
    });
    const smtpCall = calls.find((call) => call.url.includes("/smtp/send"));
    expect(smtpCall?.body).toMatchObject({
      to: "recipient@example.test",
      xForwardedMessageId: "<source-1@example.test>"
    });
    // SMTP completion owns the server flag; the client refreshes instead of sending a second mutation.
    expect(forwardedFlags).toEqual([]);

    cleanup();
  });
});

describe("forwarding a mail with a large attachment", () => {
  const source = {
    id: "source-big",
    accountId: "acc-test",
    folderId: "folder-inbox",
    threadId: "thread-big",
    messageId: "<source-big@example.test>",
    subject: "Big file",
    from: "sender@example.test",
    to: "me@example.test",
    preview: "See attached",
    date: "2026-08-14T10:00:00.000Z",
    dateValue: 1,
    body: "See attached",
    attachments: [
      {
        id: "att-big",
        filename: "big.pdf",
        contentType: "application/pdf",
        size: 25_000_000,
        inline: false
      }
    ]
  } as Message;

  const attachmentFetches = (calls: ApiCall[]) =>
    calls.filter((call) => call.url.includes("/attachments/att-big"));
  // Plain snapshot rather than the element: a failed matcher on a DOM node
  // makes bun pretty-print the whole happy-dom graph, which stalls `waitFor`.
  const sendState = (root: HTMLElement) => {
    const button = [...root.querySelectorAll("button")].find((candidate) =>
      /^(Send|Loading attachments…)$/.test((candidate.textContent ?? "").trim())
    );
    return button
      ? { label: (button.textContent ?? "").trim(), disabled: button.disabled }
      : null;
  };

  it("opens at once, blocks Send and auto-save until the bytes arrive, then saves them", async () => {
    const download = deferred<Response>();
    const { view, handleRef, calls, countDraftSaves } = renderCompose({
      attachmentResponse: () => download.promise,
      holdDraftSaves: false
    });

    // Three impatient clicks while the first open is still initializing.
    await act(async () => {
      handleRef.current?.openCompose("forward", source);
      handleRef.current?.openCompose("forward", source);
      handleRef.current?.openCompose("forward", source);
    });

    const toField = view.baseElement.querySelector<HTMLInputElement>("#compose-modal-to");
    expect(toField).not.toBeNull();
    expect(attachmentFetches(calls)).toHaveLength(1);
    expect(view.getByText(/Loading…/)).toBeTruthy();
    expect(sendState(view.baseElement)).toEqual({
      label: "Loading attachments…",
      disabled: true
    });

    await act(async () => {
      fireEvent.change(toField!, { target: { value: "someone@example.test" } });
    });
    // Longer than the auto-save debounce: a save here would store a draft
    // without the file.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    });
    expect(countDraftSaves()).toBe(0);

    await act(async () => {
      download.resolve(new Response(new Blob(["%PDF"], { type: "application/pdf" })));
    });

    await waitFor(() => {
      expect(sendState(view.baseElement)).toEqual({ label: "Send", disabled: false });
    });
    await waitFor(() => expect(countDraftSaves()).toBe(1), { timeout: 5000 });
    const saved = calls.find((call) => call.url.includes("/drafts/save"))?.body as {
      attachments?: Array<{ id: string; dataUrl?: string; loadStatus?: string }>;
    };
    expect(saved.attachments).toHaveLength(1);
    expect(saved.attachments?.[0]?.dataUrl).toMatch(/^data:application\/pdf;base64,/);
    expect(saved.attachments?.[0]?.loadStatus).toBeUndefined();

    cleanup();
  }, 20000);

  it("aborts the download on Cancel and never saves a draft", async () => {
    const download = deferred<Response>();
    const { view, handleRef, calls, countDraftSaves } = renderCompose({
      attachmentResponse: () => download.promise,
      holdDraftSaves: false
    });

    await act(async () => {
      await handleRef.current?.openCompose("forward", source);
    });
    const [fetchCall] = attachmentFetches(calls);
    expect(fetchCall?.signal?.aborted).toBe(false);

    await act(async () => {
      fireEvent.click(view.getByText("Cancel"));
    });
    expect(fetchCall?.signal?.aborted).toBe(true);

    await act(async () => {
      download.resolve(new Response(new Blob(["%PDF"], { type: "application/pdf" })));
      await new Promise((resolve) => setTimeout(resolve, 2500));
    });
    expect(countDraftSaves()).toBe(0);

    cleanup();
  }, 20000);

  it("keeps Send blocked after a failed download until it is retried", async () => {
    const errors: string[] = [];
    let attempts = 0;
    const { view, handleRef } = renderCompose({
      attachmentResponse: () => {
        attempts += 1;
        return attempts === 1
          ? new Response("nope", { status: 502 })
          : new Response(new Blob(["%PDF"], { type: "application/pdf" }));
      },
      reportError: (message) => errors.push(message)
    });

    await act(async () => {
      await handleRef.current?.openCompose("forward", source);
    });
    await waitFor(() => expect(view.getByText(/Failed to load/)).toBeTruthy());
    expect(sendState(view.baseElement)).toEqual({ label: "Send", disabled: true });

    await act(async () => {
      fireEvent.click(view.getByLabelText("Retry loading attachment: big.pdf"));
    });
    await waitFor(() => {
      expect(sendState(view.baseElement)).toEqual({ label: "Send", disabled: false });
    });
    expect(view.queryByText(/Failed to load/)).toBeNull();
    expect(errors).toEqual([]);

    cleanup();
  }, 20000);
});

describe("compose initialization errors", () => {
  it("reports hydration failures without rejecting fire-and-forget callers", async () => {
    const errors: string[] = [];
    const { view, handleRef } = renderCompose({
      ensureMessageContent: async () => {
        throw new Error("hydration failed");
      },
      reportError: (message) => errors.push(message)
    });
    const source = {
      id: "source-without-content",
      accountId: "acc-test",
      folderId: "folder-inbox",
      subject: "Needs hydration",
      from: "sender@example.test",
      to: "me@example.test",
      preview: "",
      date: "2026-08-14T10:00:00.000Z",
      dateValue: 1,
      body: "",
      htmlBody: ""
    } as Message;

    await act(async () => {
      await handleRef.current?.openCompose("reply", source);
    });

    expect(errors).toEqual(["Failed to open composer: hydration failed"]);
    cleanup();
  });
});

// Exercise the real imperative API and controller, including the setter used
// by list selection. The modal must remain visible without an inline slot.
describe("mobile compose", () => {
  it("opens full-screen and coerces inline, minimized and functional setters to modal", async () => {
    const { view, handleRef } = renderCompose({ isMobile: true, showComposeModal: false });
    try {
      await act(async () => { await handleRef.current?.openCompose("new"); });
      expect(view.getByText("New message")).toBeTruthy();
      expect(view.getByRole("combobox", { name: "From:" }).textContent).toContain("me@example.test");
      for (const requested of ["inline", "minimized"] as const) {
        act(() => handleRef.current?.setComposeView(requested));
        expect(view.getByText("New message")).toBeTruthy();
      }
      act(() => handleRef.current?.setComposeView(() => "inline"));
      expect(view.getByText("New message")).toBeTruthy();
      expect(view.queryByRole("button", { name: /Dock in thread view/ })).toBeNull();
      expect(view.queryByRole("button", { name: /Minimize composer/ })).toBeNull();
      expect(view.queryByRole("button", { name: /Open composer in new window/ })).toBeNull();
      const dialog = view.getByRole("dialog", { name: "New message" });
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      expect(dialog.style.width).toBe("");
      expect(dialog.closest(".radix-themes")).toBeTruthy();
    } finally { cleanup(); }
  });
});


describe("mobile composer accessibility", () => {
  it("restores the sidebar header trigger when its compose opener unmounts", async () => {
    const header = document.createElement("button");
    header.setAttribute("aria-label", "Navigation umschalten");
    header.setAttribute("data-shell-action", "toggle-sidebar");
    const opener = document.createElement("button");
    document.body.append(header, opener);
    opener.focus();
    const { view, handleRef } = renderCompose({ isMobile: true, showComposeModal: false });
    try {
      await act(async () => { await handleRef.current?.openCompose("new"); });
      opener.remove();
      fireEvent.keyDown(view.getByRole("dialog", { name: "New message" }), { key: "Escape" });
      await waitFor(() => expect(document.activeElement === header).toBe(true));
    } finally { cleanup(); opener.remove(); header.remove(); }
  }, 20000);
  it("traps reverse tab, closes with Escape and restores the opener", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Synthetic compose opener";
    document.body.append(opener);
    opener.focus();
    const { view, handleRef } = renderCompose({ isMobile: true, showComposeModal: false });
    try {
      await act(async () => { await handleRef.current?.openCompose("new"); });
      const dialog = view.getByRole("dialog", { name: "New message" });
      const first = view.getByRole("button", { name: "Close composer" });
      act(() => first.focus());
      fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
      fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(view.queryByRole("dialog", { name: "New message" }) === null).toBe(true));
      await waitFor(() => expect(document.activeElement === opener).toBe(true));
    } finally { cleanup(); opener.remove(); }
  }, 20000);
});

describe("shell shortcut in composers", () => {
  for (const variant of ["inline", "modal"] as const) {
    it(`keeps Ctrl/Cmd+B in the ${variant} Lexical editor and fields`, async () => {
      let toggles = 0;
      const { view, handleRef, mountInlineCard } = renderCompose({
        onSidebarToggle: () => { toggles++; },
        showComposeInline: variant === "inline", showComposeModal: variant === "modal"
      });
      try {
        await act(async () => { handleRef.current?.openCompose("new"); });
        if (variant === "inline") act(mountInlineCard);
        const editor = await waitFor(() => {
          const element = view.baseElement.querySelector<HTMLElement>('[data-lexical-editor="true"]');
          expect(element).not.toBeNull();
          return element!;
        });
        const from = view.getByRole("combobox", { name: "From:" }) as HTMLButtonElement;
        expect(from.textContent).toContain("me@example.test");
        expect(from.disabled).toBe(false);
        expect(from.tagName).toBe("BUTTON");
        const recipient = view.baseElement.querySelector<HTMLInputElement>(`#compose-${variant}-to`)!;
        for (const target of [editor, recipient]) {
          act(() => target.focus());
          for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
            fireEvent.keyDown(target, { key: "b", ...modifier });
            expect(toggles).toBe(0);
          }
        }
        // The shortcut still works outside an editable target.
        fireEvent.keyDown(window, { key: "b", ctrlKey: true });
        expect(toggles).toBe(1);
      } finally {
        cleanup();
      }
    });
  }
});


describe("accepted send warnings", () => {
  it("renders both warnings inline, emits notices and prevents duplicate delivery", async () => {
    const notices: { description?: string }[] = [];
    const errors: string[] = [];
    const { view, handleRef, sendButton, countSmtpSends } = renderCompose({ holdDraftSaves: false, smtpResponse: jsonResponse({ ok: true, sentCopy: "failed", sentCopyWarning: "Sent copy unavailable.", postSendWarning: "Reply state refresh delayed." }), onNotice: n => notices.push(n), reportError: e => errors.push(e) });
    await act(async () => { await handleRef.current?.openCompose("new", undefined, false, { to: "recipient@example.test" }); });
    // Inline rendering is owned by its slot; open the modal for this receipt test.
    await act(async () => { handleRef.current?.setComposeView("modal"); });
    await act(async () => { fireEvent.click(sendButton()!); });
    expect(notices.some(n => n.description === "Sent copy unavailable.")).toBe(true);
    expect(notices.some(n => n.description === "Reply state refresh delayed.")).toBe(true);
    expect(errors).toEqual([]);
    expect(countSmtpSends()).toBe(1);
    // A warning receipt replaces the footer's Send action.
    expect(sendButton()).toBeUndefined();
    expect(view.getByText("Sent copy unavailable.")).toBeTruthy();
    expect(view.getByText("Reply state refresh delayed.")).toBeTruthy();
  });
  it("forwards warnings before a detached compose closes", async () => {
    const order: string[] = [];
    const originalClose = window.close;
    window.close = () => { order.push("close"); };
    try {
      const { handleRef, sendButton } = renderCompose({ holdDraftSaves: false, detachedWindow: true, smtpResponse: jsonResponse({ ok: true, sentCopy: "failed", sentCopyWarning: "Sent copy unavailable.", postSendWarning: "Local refresh delayed." }), onOutcome: (outcome, _id, warnings) => { expect(outcome).toBe("sent"); expect(warnings).toContain("Sent copy unavailable."); expect(warnings).toContain("Local refresh delayed."); expect(warnings?.some(w => w.includes("Check the Sent folder"))).toBe(true); order.push("outcome"); } });
      await act(async () => { await handleRef.current?.openCompose("new", undefined, false, { to: "recipient@example.test" }); });
      await act(async () => { fireEvent.click(sendButton()!); });
      expect(order).toEqual(["outcome", "close"]);
    } finally { window.close = originalClose; }
  });
});

describe("compose session delivery guard", () => {
  const source = { id: "source-next", accountId: "acc-test", folderId: "folder-inbox", threadId: "thread-next", messageId: "<next@example.test>", subject: "Next subject", from: "sender@example.test", to: "me@example.test", preview: "", date: "2026-08-14T10:00:00.000Z", dateValue: 1, body: "", htmlBody: "" } as Message;
  for (const mode of ["forward", "edit"] as const) {
    it(`keeps the delivered receipt while ${mode} hydration is pending`, async () => {
      const hydration = deferred<Message>();
      const { view, handleRef, sendButton, countSmtpSends } = renderCompose({
        holdDraftSaves: false,
        smtpResponse: () => jsonResponse({ ok: true, sentCopy: "failed" }),
        ensureMessageContent: () => hydration.promise,
      });
      await act(async () => { await handleRef.current?.openCompose("new", undefined, false, { to: "recipient@example.test" }); handleRef.current?.setComposeView("modal"); });
      await act(async () => { fireEvent.click(sendButton()!); });
      expect(countSmtpSends()).toBe(1);
      let opening: Promise<void> | undefined;
      act(() => { opening = handleRef.current?.openCompose(mode, source); });
      expect(sendButton()).toBeUndefined();
      expect(view.getByText("Delivery succeeded. Do not send it again.")).toBeTruthy();
      expect(countSmtpSends()).toBe(1);
      await act(async () => { hydration.resolve({ ...source, body: "Hydrated next body" }); await opening; });
      expect(sendButton()).toBeDefined();
      expect(view.queryByText("Delivery succeeded. Do not send it again.")).toBeNull();
      expect((view.baseElement.querySelector("#compose-modal-subject") as HTMLInputElement).value).toContain("Next subject");
    });
  }
  it("an obsolete send refresh failure leaves the newer composer and its autosave intact", async () => {
    let rejectRefresh!: (error: Error) => void;
    const refresh = new Promise<void>((_, reject) => { rejectRefresh = reject; });
    const notices: { description?: string }[] = [];
    const { view, handleRef, sendButton, countDraftSaves } = renderCompose({
      holdDraftSaves: false,
      refreshMailboxData: () => refresh,
      onNotice: notice => notices.push(notice),
    });
    await act(async () => { await handleRef.current?.openCompose("reply", { ...source, body: "Original body" }); handleRef.current?.setComposeView("modal"); });
    await act(async () => { fireEvent.click(sendButton()!); });
    await waitFor(() => expect(notices.length).toBeGreaterThan(0));
    await act(async () => { await handleRef.current?.openCompose("new", undefined, false, { to: "new@example.test", subject: "New session" }); handleRef.current?.setComposeView("modal"); });
    await act(async () => { rejectRefresh(new Error("Synthetic refresh failure")); });
    expect(notices.some(n => n.description?.includes("mailbox refresh failed"))).toBe(true);
    expect(view.queryByText("Delivery succeeded. Do not send it again.")).toBeNull();
    expect((view.baseElement.querySelector("#compose-modal-to") as HTMLInputElement).value).toBe("new@example.test");
    expect((view.baseElement.querySelector("#compose-modal-subject") as HTMLInputElement).value).toBe("New session");
    const before = countDraftSaves();
    fireEvent.change(view.baseElement.querySelector("#compose-modal-subject")!, { target: { value: "New session edited" } });
    await waitFor(() => expect(countDraftSaves()).toBeGreaterThan(before), { timeout: 5000 });
  }, 15000);
});

for (const firstSendSucceeds of [false, true]) {
  it(`completion of account A (${firstSendSucceeds ? "accepted" : "failed"}) cannot unlock account B's pending send`, async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const third = deferred<Response>();
    let sends = 0;
    const { view, props, handleRef, sendButton, countSmtpSends } = renderCompose({
      holdDraftSaves: false,
      smtpResponse: () => [first, second, third][sends++].promise,
    });
    await act(async () => { await handleRef.current!.openCompose("new", undefined, false, { to: "a@example.test" }); });
    await act(async () => { fireEvent.click(sendButton()!); });
    await waitFor(() => expect(countSmtpSends()).toBe(1));
    // MailClient resets the shared compose state on every account change.
    await act(async () => {
      handleRef.current!.resetSession();
      view.rerender(<Theme><ComposeOrchestrator ref={handleRef} {...props} activeAccountId="account-b" /></Theme>);
    });
    await act(async () => { await handleRef.current!.openCompose("new", undefined, false, { to: "b@example.test" }); });
    await act(async () => { fireEvent.click(sendButton()!); });
    await waitFor(() => expect(countSmtpSends()).toBe(2));
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { first.resolve(firstSendSucceeds ? jsonResponse({ ok: true }) : new Response('{"message":"Synthetic failure"}', { status: 500 })); });
    const stillDisabled = (sendButton() as HTMLButtonElement).disabled;
    await act(async () => { fireEvent.click(sendButton()!); });
    await act(async () => {
      second.resolve(new Response('{"message":"Synthetic B failure"}', { status: 500 }));
      third.resolve(jsonResponse({ ok: true }));
    });
    expect(stillDisabled).toBe(true);
    expect(countSmtpSends()).toBe(2);
    expect((sendButton() as HTMLButtonElement).disabled).toBe(false);
  });
}

for (const mode of ["forward", "edit"] as const) {
  it(`account switch cancels pending ${mode} source hydration`, async () => {
    const hydration = deferred<Message>();
    const h = renderCompose({ isMobile: true, holdDraftSaves: false, ensureMessageContent: () => hydration.promise });
    const source = { id: "source-a", accountId: "acc-test", folderId: "folder-inbox", threadId: "thread-a", messageId: "<a@example.test>", from: "sender@example.test", to: "me@example.test", subject: "Private synthetic A subject", date: "2026-08-14T10:00:00.000Z", dateValue: 1, preview: "", body: "", htmlBody: "" } as Message;
    let opening: Promise<void> | undefined;
    act(() => { opening = h.handleRef.current!.openCompose(mode, source); });
    await act(async () => {
      h.handleRef.current!.resetSession();
      h.view.rerender(<Theme><ComposeOrchestrator ref={h.handleRef} {...h.props} activeAccountId="account-b" /></Theme>);
    });
    await act(async () => { hydration.resolve({ ...source, body: "Private synthetic A content" }); await opening; });
    expect(h.view.queryByRole("dialog")).toBeNull();
    expect(h.sendButton()).toBeUndefined();
    expect(h.countSmtpSends()).toBe(0);
    await act(async () => { await h.handleRef.current!.openCompose("new", undefined, false, { to: "recipient@example.test", subject: "Synthetic B subject", body: "Synthetic B content" }); });
    await act(async () => { fireEvent.click(h.sendButton()!); });
    const sent = h.calls.filter(call => call.url.includes("/smtp/send"));
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("/api/accounts/account-b/smtp/send");
    expect(JSON.stringify(sent[0].body)).not.toContain("Private synthetic A");
    expect(JSON.stringify(sent[0].body)).toContain("Synthetic B content");
  });
}

describe("compose QA regressions", () => {
  for (const variant of ["inline", "modal"] as const) {
    it(`associates visible captions in ${variant} compose`, async () => {
      const h = renderCompose({ onSidebarToggle: () => {}, showComposeInline: variant === "inline", showComposeModal: variant === "modal" });
      await act(async () => { await h.handleRef.current!.openCompose("new"); });
      if (variant === "inline") act(h.mountInlineCard);
      fireEvent.click(h.view.getByRole("button", { name: "Show Cc and Bcc" }));
      for (const caption of ["To", "Cc", "Bcc", "Subject"]) {
        const field = h.view.getByLabelText(`${caption}:`) as HTMLInputElement;
        expect(field.id).toBe(`compose-${variant}-${caption.toLowerCase()}`);
      }
    });
  }

  it("preserves 30 synchronous keystrokes across autosave ticks and sends the current fields", async () => {
    const h = renderCompose({ holdDraftSaves: false });
    await act(async () => { await h.handleRef.current!.openCompose("new"); });
    // Capture only the real autosave debounce; suggestion and Radix timers keep
    // their normal timing. Drive save completions between rapid input bursts.
    const realSetTimeout = window.setTimeout.bind(window);
    const ticks = new Map<number, () => void>();
    let timerId = 100000;
    const timeoutSpy = spyOn(window, "setTimeout").mockImplementation(((callback: () => void, delay?: number, ...args: unknown[]) => {
      if (delay === 2000) { ticks.set(++timerId, callback); return timerId; }
      return realSetTimeout(callback, delay, ...args);
    }) as typeof window.setTimeout);
    const realClearTimeout = window.clearTimeout.bind(window);
    const clearSpy = spyOn(window, "clearTimeout").mockImplementation(((id?: number) => {
      if (id !== undefined && ticks.delete(id)) return;
      realClearTimeout(id);
    }) as typeof window.clearTimeout);
    try {
      fireEvent.click(h.view.getByRole("button", { name: "Show Cc and Bcc" }));
      const values = { "To:": "recipient@example.test", "Cc:": "copy@example.test", "Bcc:": "hidden@example.test", "Subject:": "0123456789abcdefghijklmnopqrst" };
      for (const [caption, value] of Object.entries(values)) {
        const input = h.view.getByLabelText(caption) as HTMLInputElement;
        for (const char of value) {
          // Each event appends to what a keyboard sees, so any stale overwrite
          // affects subsequent characters instead of being masked by .fill().
          fireEvent.change(input, { target: { value: input.value + char } });
          if (input.value.length % 5 === 0) {
            await act(async () => {
              const due = [...ticks.values()]; ticks.clear();
              due.forEach(tick => tick());
            });
          }
        }
        expect(input.value).toBe(value);
      }
      expect(h.countDraftSaves()).toBeGreaterThan(0);
      await act(async () => { fireEvent.click(h.sendButton()!); });
      const sent = h.calls.find(call => call.url.includes("/smtp/send"))!.body as Record<string, unknown>;
      expect(sent.subject).toBe(values["Subject:"]);
      expect(sent.to).toBe(values["To:"]);
      expect(sent.cc).toBe(values["Cc:"]);
      expect(sent.bcc).toBe(values["Bcc:"]);
    } finally { timeoutSpy.mockRestore(); clearSpy.mockRestore(); }
  });

  for (const isMobile of [false, true]) {
    it(`traps focus, dismisses with Escape and restores the opener (${isMobile ? "mobile" : "desktop"})`, async () => {
      const opener = document.createElement("button");
      opener.textContent = "Synthetic compose opener";
      document.body.append(opener);
      opener.focus();
      const h = renderCompose({ isMobile, followComposeOpen: true, holdDraftSaves: false });
      try {
        await act(async () => { await h.handleRef.current!.openCompose("new"); });
        const dialog = h.view.getByRole("dialog", { name: "New message" });
        expect(dialog.getAttribute("aria-modal")).toBe("true");
        const send = h.sendButton()!;
        act(() => send.focus());
        fireEvent.keyDown(send, { key: "Tab", code: "Tab" });
        expect(dialog.contains(document.activeElement)).toBe(true);
        act(() => send.focus());
        fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
        await waitFor(() => expect(h.view.queryByRole("dialog") === null).toBe(true));
        await waitFor(() => expect(document.activeElement === opener).toBe(true));
      } finally { cleanup(); opener.remove(); }
    });
  }
});


describe("sender identity compose integration", () => {
  const sender = (): SenderSettings => ({ account: { id: "acc-test", email: "me@example.test", ownAddresses: ["me@example.test", "alias@example.test"], accessRole: "manager", settings: { signatures: [{ id: "team", name: "Team", body: "Regards,\n{{user.name}} / {{identity.email}}" }], defaultSignatureId: "team" } } as SenderSettings["account"],
    identities: [{ id: "primary", accountId: "acc-test", email: "me@example.test", displayName: "Team", enabled: true, isDefault: true }, { id: "alias", accountId: "acc-test", email: "alias@example.test", displayName: "Alias", enabled: true, isDefault: false }] as SenderSettings["identities"], prefs: {}, user: { name: "Synthetic Jo", email: "jo@example.test" }, warnings: [] });
  const draft = { id: "identity-draft", accountId: "acc-test", folderId: "drafts", threadId: "thread", from: "me@example.test", to: "recipient@example.test", subject: "Synthetic identity draft", body: "Existing authored body", htmlBody: "", xComposeFormat: "text", senderIdentityId: "primary", dateValue: 1, attachments: [] } as unknown as Message;
  it("identity-only change autosaves the new sender and survives minimize/modal restore", async () => {
    const { view, handleRef, calls } = renderCompose({ sender: { ...sender(), prefs: { defaultSignatureId: "" } }, holdDraftSaves: false });
    await act(async () => { await handleRef.current?.openCompose("edit", draft); });
    fireEvent.click(view.getByRole("combobox", { name: "From:" }));
    fireEvent.click(await view.findByRole("option", { name: /Alias <alias@example.test>/ }));
    await waitFor(() => expect(calls.find(call => call.url.endsWith("/drafts/save"))?.body).toMatchObject({ identityId: "alias", text: "Existing authored body" }), { timeout: 5000 });
    act(() => { handleRef.current?.setComposeView("minimized"); });
    act(() => { handleRef.current?.setComposeView("modal"); });
    expect(view.getByRole("combobox", { name: "From:" }).textContent).toContain("alias@example.test");
  });
  it("preserves an edited signature on From change unless replacement is confirmed", async () => {
    const confirm = spyOn(window, "confirm").mockReturnValue(false);
    try {
      const { view, handleRef } = renderCompose({ sender: sender(), holdDraftSaves: false });
      // A text-only reply shares the same initialization and signature ref as HTML/Markdown.
      await act(async () => { await handleRef.current?.openCompose("reply", { ...draft, id: "source", from: "customer@example.test", to: "me@example.test", body: "Original", xComposeFormat: undefined }); });
      const editor = view.baseElement.querySelector<HTMLTextAreaElement>("textarea[name=compose_body]") ?? view.baseElement.querySelector<HTMLTextAreaElement>("textarea");
      expect(editor).not.toBeNull(); expect(editor!.value.match(/Synthetic Jo/g)).toHaveLength(1);
      fireEvent.change(editor!, { target: { value: editor!.value.replace("Synthetic Jo", "Synthetic Jo, edited") } });
      fireEvent.click(view.getByRole("combobox", { name: "From:" }));
      fireEvent.click(await view.findByRole("option", { name: /Alias <alias@example.test>/ }));
      await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
      expect(editor!.value).toContain("Synthetic Jo, edited / me@example.test"); expect(editor!.value).not.toContain("Synthetic Jo / alias@example.test");
      expect(view.getByRole("combobox", { name: "From:" }).textContent).toContain("alias@example.test");
    } finally { confirm.mockRestore(); }
  });
  it("replaces the unchanged Lexical signature without confirmation after initial serialization", async () => {
    const confirm = spyOn(window, "confirm").mockReturnValue(false);
    try {
      const { view, handleRef } = renderCompose({ sender: sender(), holdDraftSaves: false });
      await act(async () => { await handleRef.current?.openCompose("new"); });
      await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("Synthetic Jo / me@example.test"));
      // Let the first export synchronize the signature ref before choosing From.
      await act(async () => { await new Promise(resolve => requestAnimationFrame(() => resolve(undefined))); });
      fireEvent.click(view.getByRole("combobox", { name: "From:" }));
      fireEvent.click(await view.findByRole("option", { name: /Alias <alias@example.test>/ }));
      await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("Synthetic Jo / alias@example.test"));
      expect(confirm).not.toHaveBeenCalled();
      expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent?.match(/Synthetic Jo/g)).toHaveLength(1);
    } finally { confirm.mockRestore(); }
  });
  it("does not reinsert a removed signature when an empty session is detached", async () => {
    const { view, handleRef } = renderCompose({ sender: sender(), detachedWindow: true, holdDraftSaves: false });
    await act(async () => { await handleRef.current?.openDetachedCompose(null, { mode: "new", sourceMessage: null, identityId: "alias", signatureInitialized: true }); });
    expect(view.getByRole("combobox", { name: "From:" }).textContent).toContain("alias@example.test");
    await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')).not.toBeNull());
    expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).not.toContain("Synthetic Jo");
  });
  it("restores a detached empty composer's captured account and identity", async () => {
    const { view, handleRef } = renderCompose({ sender: sender(), detachedWindow: true, holdDraftSaves: false });
    await act(async () => { await handleRef.current?.openDetachedCompose(null, { mode: "new", sourceMessage: null, identityId: "alias" }); });
    expect(view.getByRole("combobox", { name: "From:" }).textContent).toContain("alias@example.test");
    const editor = await waitFor(() => { const editor = view.baseElement.querySelector<HTMLElement>('[data-lexical-editor="true"]'); expect(editor).not.toBeNull(); return editor!; });
    expect(editor.textContent).toContain("Synthetic Jo / alias@example.test");
  });
});
