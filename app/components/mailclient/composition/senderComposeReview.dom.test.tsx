// Runs only under `bun run test:dom`, which preloads lib/testSetupDom.ts to
// register happy-dom before any component module loads.
import { afterEach, expect, it, spyOn } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import type { SenderSettings } from "@/lib/ui/senderSettings";
import type { Message } from "@/lib/data";
import { stripHtmlToText } from "@/lib/html";
import ComposeOrchestrator from "@/app/components/mailclient/composition/ComposeOrchestrator";
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from "lexical";

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
  followComposeOpen?: boolean;
  reportError?: (message: string) => void;
};

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
  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const body = typeof init?.body === "string"
      ? JSON.parse(init.body) as unknown
      : undefined;
    calls.push({ url, method: init?.method ?? "GET", body, signal: init?.signal });

    if (url.includes("/drafts/save")) return jsonResponse({ draftId: "draft-1", message: null });
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
    isMobile: false,
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
    updateKeywordFlag: () => {},
    accountFolders: [],
    findSentFolder: () => null,
    syncFolderWithBackgroundRef: { current: async () => {} },
    getPreferredComposeTab: () => undefined,
    isDraftMessage: () => false,
    ensureMessageContent: async () => null,
    applyRecipientSelection: (current: string) => current,
    loadRecipientOptions: async () => [],
    clearRecipientSuggestionCache: () => {},
    getComposeToken: (value: string) => value,
    formatRelativeTime: () => "just now",
    fromValue: "me@example.test",
    apiFetch,
    reportError: options.reportError ?? (() => {}),
    readErrorMessage: async () => "error",
    stripHtml: stripHtmlToText,
    showComposeInline: false,
    showComposeModal: true,
    showComposeMinimized: false,
    detachedWindow: false
  } as unknown as React.ComponentProps<typeof ComposeOrchestrator>;

  function LiveCompose() {
    const [open, setOpen] = React.useState(false);
    const onMirror = React.useCallback((mirror: { composeOpen: boolean }) => setOpen(mirror.composeOpen), []);
    return <ComposeOrchestrator ref={handleRef} {...props} showComposeModal={open} onComposeMirrorChange={onMirror} />;
  }
  const composer = options.followComposeOpen ? <LiveCompose /> : <ComposeOrchestrator ref={handleRef} {...props} />;

  const view = render(<Theme>{composer}</Theme>);
  return { view, props, handleRef, calls };

}


const makeSender = (): SenderSettings => ({
  account: { id: "acc-test", email: "me@example.test", ownAddresses: ["me@example.test", "alias@example.test"], accessRole: "manager", settings: { signatures: [{ id: "team", name: "Team", body: "Regards,\n{{user.name}} / {{identity.email}}" }], defaultSignatureId: "team" } } as SenderSettings["account"],
  identities: [{ id: "primary", accountId: "acc-test", email: "me@example.test", displayName: "Team", enabled: true, isDefault: true }, { id: "alias", accountId: "acc-test", email: "alias@example.test", displayName: "Alias", enabled: true, isDefault: false }] as SenderSettings["identities"],
  prefs: {}, user: { name: "Synthetic Jo", email: "jo@example.test" }, warnings: []
});
const sourceMessage = { id: "source", accountId: "acc-test", folderId: "inbox", threadId: "thread", from: "customer@example.test", to: "me@example.test", subject: "Synthetic reply", body: "Original", htmlBody: "", dateValue: 1, attachments: [] } as unknown as Message;
async function pickAlias(view: ReturnType<typeof renderCompose>["view"]) {
  fireEvent.click(view.getByRole("combobox", { name: "From:" }));
  fireEvent.click(await view.findByRole("option", { name: /Alias <alias@example.test>/ }));
}

it("P2-A From change after HTML to Text must survive switching back to HTML", async () => {
  const confirm = spyOn(window, "confirm").mockReturnValue(true);
  try {
    const {view, handleRef} = renderCompose({ sender: makeSender() });
    await act(async () => { await handleRef.current?.openCompose("new"); });
    await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("Synthetic Jo / me@example.test"));
    fireEvent.mouseDown(view.getByRole("tab", { name: /^Text(?: Text)?$/ }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(view.baseElement.querySelector<HTMLTextAreaElement>('textarea[name="compose_body"]')?.value).toContain("Synthetic Jo / me@example.test"));
    await pickAlias(view);
    await waitFor(() => expect(view.baseElement.querySelector<HTMLTextAreaElement>('textarea[name="compose_body"]')?.value).toContain("Synthetic Jo / alias@example.test"));
    fireEvent.mouseDown(view.getByRole("tab", { name: /^HTML(?: HTML)?$/ }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("Synthetic Jo / alias@example.test"));
    expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).not.toContain("Synthetic Jo / me@example.test");
  } finally { confirm.mockRestore(); }
});

it("P2-B a failed sender snapshot must allow retrying the same reply", async () => {
  const {view, handleRef, props} = renderCompose({ sender: makeSender(), followComposeOpen: false });
  let loads = 0;
  const errors: string[] = [];
  const revised = { ...props, reportError: (message: string) => errors.push(message), senderSettingsLoader: async () => {
    if (++loads === 1) throw Error("Synthetic transient sender read failure");
    return makeSender();
  }};
  view.rerender(<Theme><ComposeOrchestrator ref={handleRef} {...revised} /></Theme>);
  await act(async () => { await handleRef.current?.openCompose("reply", sourceMessage); });
  expect(errors).toHaveLength(1);
  await act(async () => { await handleRef.current?.openCompose("reply", sourceMessage); });
  expect(loads).toBe(2);
  expect(view.getByRole("combobox", { name: "From:" }).textContent).toContain("me@example.test");
});

it("a mailbox switch with compose closed loads no sender settings and drops the previous mailbox's sender error", async () => {
  const { view, props, handleRef } = renderCompose();
  const loads: string[] = [];
  const failing = { ...props, senderSettingsLoader: async (_: unknown, accountId: string) => {
    loads.push(accountId); throw new Error("Synthetic sender read failure");
  } } as typeof props;
  view.rerender(<Theme><ComposeOrchestrator ref={handleRef} {...failing} /></Theme>);
  await act(async () => { await handleRef.current?.openCompose("reply", sourceMessage).catch(() => {}); });
  expect(loads).toEqual(["acc-test"]);
  expect(view.queryByRole("button", { name: /retry/i })).not.toBeNull();
  const switched = { ...failing, activeAccountId: "acc-other", senderSettingsLoader: async (_: unknown, accountId: string) => {
    loads.push(accountId); return makeSender();
  } } as typeof props;
  view.rerender(<Theme><ComposeOrchestrator ref={handleRef} {...switched} /></Theme>);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  // No eager reload on the switch, and no dead retry for the previous mailbox.
  expect(loads).toEqual(["acc-test"]);
  expect(view.queryByRole("button", { name: /retry/i })).toBeNull();
  await act(async () => { await handleRef.current?.openCompose("new"); });
  expect(loads).toEqual(["acc-test", "acc-other"]);
});

it("keeps partially edited text and its quote when confirmed replacement appends a new signature", async () => {
  const confirm = spyOn(window, "confirm").mockReturnValue(true);
  try {
    const {view, handleRef} = renderCompose({sender: makeSender()});
    await act(async () => {await handleRef.current?.openCompose("reply", sourceMessage);});
    const textarea = view.baseElement.querySelector<HTMLTextAreaElement>('textarea[name="compose_body"]')!;
    expect(textarea).not.toBeNull();
    const edited = "User-authored introduction\n\n" + textarea.value.replace("Synthetic Jo", "Synthetic Jo, edited");
    fireEvent.change(textarea, {target:{value:edited}});
    await pickAlias(view);
    const after = view.baseElement.querySelector<HTMLTextAreaElement>('textarea[name="compose_body"]')!.value;
    expect(after).toContain(edited);
    expect(after).toContain("Synthetic Jo / alias@example.test");
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(after).toContain("> Original");
  } finally {confirm.mockRestore();}
});

it("P2-A From change after HTML to Markdown must survive switching back to HTML", async () => {
  const confirm = spyOn(window, "confirm").mockReturnValue(true);
  try {
    const {view, handleRef} = renderCompose({sender:makeSender()});
    await act(async () => {await handleRef.current?.openCompose("new");});
    await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("Synthetic Jo / me@example.test"));
    fireEvent.mouseDown(view.getByRole("tab", {name:/^Markdown(?: Markdown)?$/}), {button:0,ctrlKey:false});
    await waitFor(() => expect(view.baseElement.querySelector<HTMLTextAreaElement>('.w-md-editor textarea')?.value).toContain("me@example.test"));
    await pickAlias(view);
    await waitFor(() => expect(view.baseElement.querySelector<HTMLTextAreaElement>('.w-md-editor textarea')?.value.replace(/\\/g, "")).toContain("alias@example.test"));
    fireEvent.mouseDown(view.getByRole("tab", {name:/^HTML(?: HTML)?$/}), {button:0,ctrlKey:false});
    await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("Synthetic Jo / alias@example.test"));
    expect(confirm).not.toHaveBeenCalled();
  } finally {confirm.mockRestore();}
});

it("P2-C a persisted invalid shared template must not prevent opening the composer", async () => {
  const sender=makeSender();
  sender.account.settings!.signatures![0].body="Legacy signature {{user.title}} / {{user.name}}";
  const errors: string[]=[];
  const {view,handleRef,calls}=renderCompose({sender,followComposeOpen:true,reportError:message=>errors.push(message)});
  await act(async()=>{await handleRef.current?.openCompose("new");});
  expect(errors).toEqual([]);
  expect(view.getByRole("combobox",{name:"From:"})).toBeTruthy();
  await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("Legacy signature / Synthetic Jo"));
  expect(view.baseElement.textContent).not.toContain("{{user.title}}");
  expect(view.getByRole("alert").textContent).toContain("Ask a mailbox manager");
  fireEvent.change(view.getByLabelText("To:", { exact: true }), { target: { value: "recipient@example.test" } });
  fireEvent.change(view.getByLabelText("Subject:", { exact: true }), { target: { value: "Synthetic legacy template send" } });
  expect((view.getByRole("button", { name: /^Send$/ }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(view.getByRole("button", { name: /^Send$/ }));
  await waitFor(() => expect(calls.filter(call => call.url.includes("/smtp/send"))).toHaveLength(1));
});

for (const format of ["Text", "Markdown"]) it(`P2-A edited signature survives ${format} to HTML without reinsertion`, async () => {
  const confirm = spyOn(window, "confirm").mockReturnValue(false);
  try {
    const { view, handleRef } = renderCompose({ sender: makeSender() });
    await act(async () => { await handleRef.current?.openCompose("new"); });
    await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("Synthetic Jo"));
    fireEvent.mouseDown(view.getByRole("tab", { name: new RegExp(`^${format}(?: ${format})?$`) }), { button: 0, ctrlKey: false });
    const selector = format === "Text" ? 'textarea[name="compose_body"]' : '.w-md-editor textarea';
    await waitFor(() => expect(view.baseElement.querySelector<HTMLTextAreaElement>(selector)?.value).toContain("Synthetic Jo"));
    const textarea = view.baseElement.querySelector<HTMLTextAreaElement>(selector)!;
    fireEvent.change(textarea, { target: { value: textarea.value.replace("Synthetic Jo", "Synthetic Jo, edited") } });
    fireEvent.mouseDown(view.getByRole("tab", { name: /^HTML(?: HTML)?$/ }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("Synthetic Jo, edited"));
    expect(confirm).not.toHaveBeenCalled();
    await pickAlias(view);
    expect(confirm).toHaveBeenCalledTimes(1);
    const body = view.baseElement.querySelector('[data-lexical-editor="true"]')!.textContent!;
    expect(body).toContain("Synthetic Jo, edited");
    expect(body).not.toContain("alias@example.test");
    expect(body.match(/Synthetic Jo/g)).toHaveLength(1);
  } finally { confirm.mockRestore(); }
});

it("P2-B retries a failed sender snapshot in place", async () => {
  const { view, handleRef, props } = renderCompose({ followComposeOpen: false });
  let loads = 0;
  view.rerender(<Theme><ComposeOrchestrator ref={handleRef} {...props} senderSettingsLoader={async () => {
    if (++loads === 1) throw Error("Synthetic transient sender failure");
    return makeSender();
  }} /></Theme>);
  await act(async () => { await handleRef.current?.openCompose("reply", sourceMessage); });
  fireEvent.click(view.getByRole("button", { name: "Retry loading sender settings" }));
  await waitFor(() => expect(loads).toBe(2));
  await waitFor(() => expect(view.getByRole("combobox", { name: "From:" }).textContent).toContain("me@example.test"));
  expect(view.queryByRole("button", { name: "Retry loading sender settings" })).toBeNull();
});

for (const format of ["Text", "Markdown"]) it(`P2-A unchanged signature remains replaceable after authored ${format} to HTML conversion`, async () => {
  const confirm = spyOn(window, "confirm").mockReturnValue(false);
  try {
    const { view, handleRef } = renderCompose({ sender: makeSender() });
    await act(async () => { await handleRef.current?.openCompose("reply", sourceMessage); });
    if (format === "Markdown") fireEvent.mouseDown(view.getByRole("tab", { name: /^Markdown(?: Markdown)?$/ }), { button: 0, ctrlKey: false });
    const selector = format === "Text" ? 'textarea[name="compose_body"]' : '.w-md-editor textarea';
    await waitFor(() => expect(view.baseElement.querySelector<HTMLTextAreaElement>(selector)?.value).toContain("Synthetic Jo"));
    const textarea = view.baseElement.querySelector<HTMLTextAreaElement>(selector)!;
    fireEvent.change(textarea, { target: { value: "Authored introduction\n\n" + textarea.value } });
    fireEvent.mouseDown(view.getByRole("tab", { name: /^HTML(?: HTML)?$/ }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("Authored introduction"));
    await pickAlias(view);
    await waitFor(() => expect(view.baseElement.querySelector('[data-lexical-editor="true"]')?.textContent).toContain("alias@example.test"));
    expect(confirm).not.toHaveBeenCalled();
    const body = view.baseElement.querySelector('[data-lexical-editor="true"]')!.textContent!;
    expect(body).toContain("Authored introduction");
    expect(body).toContain("Original");
    expect(body.match(/Synthetic Jo/g)).toHaveLength(1);
  } finally { confirm.mockRestore(); }
});

it("P2-A repeated format round trips keep a multiline personal signature replaceable", async () => {
  const confirm = spyOn(window, "confirm").mockReturnValue(false);
  try {
    const sender = makeSender();
    sender.prefs = { defaultIdentityId: "alias", signatureOverride: "Regards,\n{{user.name}}\n{{identity.email}}" };
    const { view, handleRef } = renderCompose({ sender });
    await act(async () => { await handleRef.current?.openCompose("new"); });
    const editor = () => view.baseElement.querySelector('[data-lexical-editor="true"]')!;
    await waitFor(() => expect(editor()?.textContent).toContain("alias@example.test"));
    const primary = async () => {
      fireEvent.click(view.getByRole("combobox", { name: "From:" }));
      fireEvent.click(await view.findByRole("option", { name: /Team <me@example.test>/ }));
      await waitFor(() => expect(editor().textContent).not.toContain("alias@example.test"));
    };
    await primary();
    for (const format of ["Text", "Markdown"]) {
      fireEvent.mouseDown(view.getByRole("tab", { name: new RegExp(`^${format}(?: ${format})?$`) }), { button: 0, ctrlKey: false });
      await pickAlias(view);
      fireEvent.mouseDown(view.getByRole("tab", { name: /^HTML(?: HTML)?$/ }), { button: 0, ctrlKey: false });
      await waitFor(() => expect(editor()?.textContent).toContain("alias@example.test"));
      await primary();
      expect(confirm).not.toHaveBeenCalled();
      expect(editor().textContent!.match(/Synthetic Jo/g)).toHaveLength(1);
    }
  } finally { confirm.mockRestore(); }
});

it("sender snapshot catalog IDs are localized at the notice boundary", async () => {
  const { senderMessages } = await import("@/lib/senderMessages");
  const errors: string[] = [];
  const { view, props, handleRef } = renderCompose({ reportError: message => errors.push(message) });
  view.rerender(<Theme><ComposeOrchestrator ref={handleRef} {...props} senderSettingsLoader={async () => {
    throw new Error(senderMessages.senderLoadFailed);
  }} /></Theme>);
  await act(async () => { await handleRef.current?.openCompose("reply", sourceMessage); });
  expect(errors).toContain("Could not load sender identities and preferences.");
  expect(errors.some(message => message.includes("Errors.sender."))).toBe(false);
});

for (const format of ["HTML", "Text", "Markdown"]) it(`QA-201 switching From to an unsigned identity and back restores the signature once in untouched ${format}`, async () => {
  const confirm = spyOn(window, "confirm").mockReturnValue(false);
  try {
    const sender = makeSender();
    sender.identities.push({ id: "unsigned", accountId: "acc-test", email: "unsigned@example.test", displayName: "Unsigned", enabled: true, isDefault: false, signatureId: "" } as SenderSettings["identities"][number]);
    const { view, handleRef } = renderCompose({ sender });
    await act(async () => { await handleRef.current?.openCompose("new"); });
    const lexical = () => view.baseElement.querySelector('[data-lexical-editor="true"]');
    await waitFor(() => expect(lexical()?.textContent).toContain("Synthetic Jo / me@example.test"));
    const selector = format === "Text" ? 'textarea[name="compose_body"]' : '.w-md-editor textarea';
    if (format !== "HTML") {
      fireEvent.mouseDown(view.getByRole("tab", { name: new RegExp(`^${format}(?: ${format})?$`) }), { button: 0, ctrlKey: false });
      await waitFor(() => expect(view.baseElement.querySelector<HTMLTextAreaElement>(selector)?.value.replace(/\\/g, "")).toContain("me@example.test"));
    }
    const body = () => (format === "HTML" ? lexical()?.textContent : view.baseElement.querySelector<HTMLTextAreaElement>(selector)?.value.replace(/\\/g, "")) ?? "";
    const pick = async (name: RegExp) => {
      fireEvent.click(view.getByRole("combobox", { name: "From:" }));
      fireEvent.click(await view.findByRole("option", { name }));
    };
    for (let round = 0; round < 3; round += 1) {
      await pick(/Unsigned <unsigned@example.test>/);
      await waitFor(() => expect(body()).not.toContain("Synthetic Jo"));
      expect(body().trim()).toBe("");
      await pick(/Team <me@example.test>/);
      await waitFor(() => expect(body()).toContain("Synthetic Jo / me@example.test"));
      expect(body().match(/Synthetic Jo/g)).toHaveLength(1);
      expect(body().trimStart()).toBe(body());
      await pick(/Alias <alias@example.test>/);
      await waitFor(() => expect(body()).toContain("Synthetic Jo / alias@example.test"));
      expect(body().match(/Synthetic Jo/g)).toHaveLength(1);
    }
    expect(confirm).not.toHaveBeenCalled();
    // A body the user really authored still asks before a signature is added.
    await pick(/Unsigned <unsigned@example.test>/);
    await waitFor(() => expect(body()).not.toContain("Synthetic Jo"));
    if (format === "HTML") {
      const editor = (lexical() as HTMLElement & { __lexicalEditor: LexicalEditor }).__lexicalEditor;
      await act(async () => { editor.update(() => { $getRoot().clear().append($createParagraphNode().append($createTextNode("Authored"))); }); });
    } else {
      fireEvent.change(view.baseElement.querySelector<HTMLTextAreaElement>(selector)!, { target: { value: "Authored" } });
    }
    await waitFor(() => expect(body()).toContain("Authored"));
    await pick(/Team <me@example.test>/);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(body()).toContain("Authored");
    expect(body()).not.toContain("Synthetic Jo");
  } finally { confirm.mockRestore(); }
});
