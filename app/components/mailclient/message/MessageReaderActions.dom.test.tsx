import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import type { Account, Message } from "@/lib/data";
import type { NoticeInput } from "../types";
import MessageQuickActions from "./MessageQuickActions";
import { MessageReaderActionsProvider, useMessageReaderActionsValue, type MessageReaderActions } from "./MessageReaderActions";

afterEach(cleanup);
const noop = () => {};
const message: Message = {
  id: "msg-1", accountId: "acc", folderId: "acc:INBOX", threadId: "t", subject: "Synthetic", from: "Erika <erika@example.test>",
  to: "owner@example.test", preview: "", date: new Date(0).toISOString(), dateValue: 0, body: "Hallo"
};

function quickActions(options: { origin?: "list" | "thread"; isDraft?: boolean } = {}) {
  return <MessageQuickActions message={message} origin={options.origin ?? "thread"} isDraft={options.isDraft ?? false}
    pendingMessageActions={new Set()} openCompose={noop} handleDeleteMessage={noop} onShowRelated={noop} isTrashFolder={() => false} />;
}
const wrap = (children: ReactNode) => <Theme><TooltipProvider>{children}</TooltipProvider></Theme>;
const aiButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('[data-message-action="ai-reply"]');
const copyActions = { copyLink: async () => {}, copyContent: async () => {} };

describe("AI reply button", () => {
  it("is hidden without the mail client, when AI is unavailable, in list rows and for drafts", () => {
    expect(aiButton(render(wrap(quickActions())).container)).toBeNull();
    cleanup();
    const unavailable: MessageReaderActions = { canAiReply: () => false, isAiReplyPending: () => false, draftAiReply: async () => {}, ...copyActions };
    expect(aiButton(render(wrap(<MessageReaderActionsProvider value={unavailable}>{quickActions()}</MessageReaderActionsProvider>)).container)).toBeNull();
    cleanup();
    const available: MessageReaderActions = { ...unavailable, canAiReply: () => true };
    expect(aiButton(render(wrap(<MessageReaderActionsProvider value={available}>{quickActions({ origin: "list" })}</MessageReaderActionsProvider>)).container)).toBeNull();
    cleanup();
    expect(aiButton(render(wrap(<MessageReaderActionsProvider value={available}>{quickActions({ isDraft: true })}</MessageReaderActionsProvider>)).container)).toBeNull();
  });

  it("starts one draft per prompt and is disabled while it runs", async () => {
    const { view, calls, openPrompt, prompt } = promptHarness();
    const button = aiButton(view.container)!;
    expect(button.getAttribute("aria-label")).toBe("Draft AI reply");
    expect(button.disabled).toBe(false);
    await openPrompt();
    await act(async () => { fireEvent.click(view.getByRole("button", { name: "Without instruction" })); });
    expect(calls).toEqual([["msg-1", undefined]]);
    expect(aiButton(view.container)!.disabled).toBe(true);
    await settle();
    expect(prompt()).toBeNull();
  });
});

// Radix popovers mount and unmount through timers and animation frames.
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });

function promptHarness() {
  const calls: Array<[string, string | undefined]> = [];
  function Host() {
    const [pending, setPending] = useState(false);
    const value: MessageReaderActions = { ...copyActions, canAiReply: () => true, isAiReplyPending: () => pending,
      draftAiReply: async (target, instruction) => { calls.push([target.id, instruction]); setPending(true); } };
    return <MessageReaderActionsProvider value={value}>{quickActions()}</MessageReaderActionsProvider>;
  }
  const view = render(wrap(<Host />));
  const prompt = () => document.querySelector<HTMLElement>('[data-ai-reply-prompt="popover"]');
  const field = () => view.getByRole("textbox", { name: "Instruction for the AI reply" }) as HTMLInputElement;
  const openPrompt = async () => {
    await act(async () => { fireEvent.click(aiButton(view.container)!); });
    await settle();
    expect(prompt()).not.toBeNull();
  };
  const type = (value: string) => act(() => { fireEvent.change(field(), { target: { value } }); });
  return { view, calls, prompt, field, openPrompt, type };
}

type ResultInput = Array<[string, boolean]>;
/** Minimal Web Speech recognizer: the test drives results, errors and the end event. */
class StubRecognition extends EventTarget {
  static instances: StubRecognition[] = [];
  lang = "";
  interimResults = false;
  continuous = true;
  started = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() { super(); StubRecognition.instances.push(this); }
  start() { this.started = true; }
  stop() { this.onend?.(); }
  abort() { this.onend?.(); }
  emit(results: ResultInput) {
    this.onresult?.({ resultIndex: 0, results: results.map(([transcript, isFinal]) => Object.assign([{ transcript, confidence: 1 }], { isFinal })) });
  }
  fail(error: string) { this.onerror?.({ error }); this.onend?.(); }
}

async function withSpeechRecognition(run: () => Promise<void>) {
  StubRecognition.instances = [];
  Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: StubRecognition });
  try { await run(); } finally { Reflect.deleteProperty(window, "webkitSpeechRecognition"); }
}

describe("AI reply prompt", () => {
  it("opens on click; Enter drafts with the normalized instruction and closes it", async () => {
    const { calls, prompt, field, openPrompt, type } = promptHarness();
    await openPrompt();
    expect(field().maxLength).toBe(200);
    expect(field().placeholder).toBe("What should the reply say? (optional)");
    await type("  Zusage   für Donnerstag, 14 Uhr ");
    // happy-dom has no implicit submission; the form submit is what Enter triggers in a browser (QA spec presses it).
    await act(async () => { fireEvent.submit(field().form!); });
    expect(calls).toEqual([["msg-1", "Zusage für Donnerstag, 14 Uhr"]]);
    await settle();
    expect(prompt()).toBeNull();
  });

  it("„Without instruction“ drafts like before, a blank field counts as none, Escape closes without drafting", async () => {
    const { calls, prompt, field, openPrompt, type, view } = promptHarness();
    await openPrompt();
    await act(async () => { fireEvent.keyDown(field(), { key: "Escape" }); });
    await settle();
    expect(prompt()).toBeNull();
    expect(calls).toEqual([]);
    await openPrompt();
    expect(field().value).toBe("");
    await type("   ");
    await act(async () => { fireEvent.click(view.getByRole("button", { name: "Draft" })); });
    expect(calls).toEqual([["msg-1", undefined]]);
  });

  it("shows the counter from 150 characters on", async () => {
    const { openPrompt, type } = promptHarness();
    await openPrompt();
    const counter = () => document.querySelector("[data-ai-reply-counter]");
    await type("x".repeat(149));
    expect(counter()).toBeNull();
    await type("x".repeat(150));
    expect(counter()?.textContent).toBe("150/200");
  });

  it("hides the microphone without SpeechRecognition", async () => {
    const { openPrompt, view } = promptHarness();
    await openPrompt();
    expect(view.queryByRole("button", { name: "Dictate" })).toBeNull();
  });

  it("dictates: interim text in grey, the final text appended and capped at 200", async () => {
    await withSpeechRecognition(async () => {
      const { openPrompt, view, field, type } = promptHarness();
      await openPrompt();
      await type("x".repeat(191));
      await act(async () => { fireEvent.click(view.getByRole("button", { name: "Dictate" })); });
      const recognition = StubRecognition.instances[0]!;
      expect(recognition).toMatchObject({ started: true, lang: "en-US", interimResults: true, continuous: false });
      expect(view.getByRole("button", { name: "Stop dictation" }).getAttribute("aria-pressed")).toBe("true");
      expect(view.getByRole("status").textContent).toBe("Listening …");
      await act(async () => { recognition.emit([["ja gerne", false]]); });
      expect(document.querySelector("[data-ai-reply-interim]")?.textContent).toContain("ja gerne");
      expect(field().value).toBe("x".repeat(191));
      await act(async () => { recognition.emit([["ja gerne bis Donnerstag", true]]); recognition.stop(); });
      expect(field().value).toBe(`${"x".repeat(191)} ja gerne`);
      expect(field().value).toHaveLength(200);
      expect(document.querySelector("[data-ai-reply-interim]")).toBeNull();
      expect(view.getByRole("button", { name: "Dictate" }).getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("shows a short inline hint when the microphone is not allowed", async () => {
    await withSpeechRecognition(async () => {
      const { openPrompt, view } = promptHarness();
      await openPrompt();
      await act(async () => { fireEvent.click(view.getByRole("button", { name: "Dictate" })); });
      await act(async () => { StubRecognition.instances[0]!.fail("not-allowed"); });
      expect(view.getByRole("status").textContent).toBe("Microphone access is not allowed.");
      expect(document.querySelector('[data-ai-reply-hint="not-allowed"]')).not.toBeNull();
    });
  });
});

describe("useMessageReaderActionsValue", () => {
  const accounts = [{ id: "acc", accessRole: "editor" }, { id: "view", accessRole: "viewer" }] as Account[];

  function harness(respond: () => Response) {
    const notices: NoticeInput[] = [];
    const opened: Message[] = [];
    const requests: Array<{ url: string; body: string }> = [];
    let actions!: MessageReaderActions;
    function Host() {
      actions = useMessageReaderActionsValue({
        aiReplyAvailable: true, accounts, pushNotice: (notice) => { notices.push(notice); }, editDraft: (draft) => { opened.push(draft); },
        apiFetch: async (input, init) => { requests.push({ url: String(input), body: String(init?.body ?? "") }); return respond(); }
      });
      return null;
    }
    render(<Host />);
    return { notices, opened, requests, actions: () => actions };
  }

  it("only editors of the message's mailbox may draft, never for drafts", () => {
    const { actions } = harness(() => new Response("{}"));
    expect(actions().canAiReply(message)).toBe(true);
    expect(actions().canAiReply({ ...message, accountId: "view" })).toBe(false);
    expect(actions().canAiReply({ ...message, draft: true })).toBe(false);
  });

  it("opens the returned draft for review in the composer", async () => {
    const draft = { ...message, id: "draft-1", draft: true };
    const { opened, requests, notices, actions } = harness(() => Response.json({ ok: true, draftId: "draft-1", message: draft }));
    await act(async () => { await actions().draftAiReply(message); });
    expect(requests[0]).toEqual({ url: "/api/accounts/acc/messages/msg-1/ai-reply", body: JSON.stringify({ locale: "en" }) });
    expect(opened.map(item => item.id)).toEqual(["draft-1"]);
    expect(notices).toEqual([]);
  });

  it("sends the instruction in the body when there is one", async () => {
    const draft = { ...message, id: "draft-2", draft: true };
    const { requests, actions } = harness(() => Response.json({ ok: true, draftId: "draft-2", message: draft }));
    await act(async () => { await actions().draftAiReply(message, "Donnerstag passt"); });
    expect(requests[0]!.body).toBe(JSON.stringify({ locale: "en", instruction: "Donnerstag passt" }));
  });

  it("shows the setup notice on 503 and keeps one request per message in flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const { notices, opened, requests, actions } = harness(() => Response.json({ ok: false, code: "ai_unavailable" }, { status: 503 }));
    let first!: Promise<void>;
    await act(async () => {
      first = actions().draftAiReply(message).then(() => gate);
      await actions().draftAiReply(message);
    });
    release();
    await act(async () => { await first; });
    await waitFor(() => expect(notices).toEqual([{ type: "error", title: "AI reply is not set up (no API key)" }]));
    expect(requests).toHaveLength(1);
    expect(opened).toEqual([]);
  });
});

describe("copy actions", () => {
  const accounts = [{ id: "acc", accessRole: "viewer" }] as Account[];
  async function withClipboard(writeText: (value: string) => Promise<void>, run: () => Promise<void>) {
    const original = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try { await run(); } finally { Object.defineProperty(navigator, "clipboard", { configurable: true, value: original }); }
  }
  function harness(full?: Message, respond?: () => Response) {
    const notices: NoticeInput[] = [];
    const fetched: string[] = [];
    let actions!: MessageReaderActions;
    function Host() {
      actions = useMessageReaderActionsValue({ aiReplyAvailable: false, accounts, pushNotice: (notice) => { notices.push(notice); }, editDraft: noop,
        apiFetch: async (input) => { fetched.push(String(input)); return respond ? respond() : Response.json({ ok: true, message: full }); } });
      return null;
    }
    render(<Host />);
    return { notices, fetched, actions: () => actions };
  }

  it("copies the message deep link and confirms with a notice", async () => {
    let copied = "";
    const { notices, actions } = harness();
    await withClipboard(async (value) => { copied = value; }, async () => { await act(async () => { await actions().copyLink(message); }); });
    const url = new URL(copied);
    expect(url.origin).toBe(window.location.origin);
    expect(url.searchParams.get("a")).toBe("~acc");
    expect(url.searchParams.get("m")).toBe("~msg-1");
    expect(notices).toEqual([{ type: "success", title: "Link copied" }]);
  });

  it("copies headers, body and attachments, reading a body-less list row first", async () => {
    let copied = "";
    const full: Message = { ...message, cc: "max@example.test", body: "Hallo,\nanbei.",
      attachments: [{ id: "a", filename: "Angebot.pdf", contentType: "application/pdf", size: 1, inline: false }] };
    const { notices, fetched, actions } = harness(full);
    const row: Message = { ...message, body: "", contentState: "omitted" };
    await withClipboard(async (value) => { copied = value; }, async () => { await act(async () => { await actions().copyContent(row); }); });
    expect(fetched).toEqual(["/api/accounts/acc/messages/msg-1"]);
    expect(copied).toStartWith("From: Erika <erika@example.test>\nTo: owner@example.test\nCc: max@example.test\nDate: ");
    expect(copied).toEndWith("\nSubject: Synthetic\n\nHallo,\nanbei.\n\nAttachments:\n- Angebot.pdf");
    expect(notices).toEqual([{ type: "success", title: "Content copied" }]);
  });

  it("does not copy an error body when the body-less row cannot be loaded", async () => {
    let copied: string | null = null;
    const { notices, actions } = harness(undefined, () => Response.json({ ok: false, message: "Message not found" }, { status: 404 }));
    const row: Message = { ...message, body: "", contentState: "omitted" };
    await withClipboard(async (value) => { copied = value; }, async () => { await act(async () => { await actions().copyContent(row); }); });
    expect(copied).toBeNull();
    expect(notices).toEqual([{ type: "error", title: "Could not copy content" }]);
  });

  it("reports a refused clipboard", async () => {
    const { notices, actions } = harness();
    await withClipboard(async () => { throw new Error("denied"); }, async () => { await act(async () => { await actions().copyContent(message); }); });
    expect(notices).toEqual([{ type: "error", title: "Could not copy content" }]);
  });

  it("reader toolbar shows link and content copy buttons that call the actions", async () => {
    const calls: string[] = [];
    const value: MessageReaderActions = { canAiReply: () => false, isAiReplyPending: () => false, draftAiReply: async () => {},
      copyLink: async (target) => { calls.push(`link:${target.id}`); }, copyContent: async (target) => { calls.push(`content:${target.id}`); } };
    const view = render(wrap(<MessageReaderActionsProvider value={value}>{quickActions()}</MessageReaderActionsProvider>));
    const link = view.container.querySelector<HTMLButtonElement>('[data-message-action="copy-link"]')!;
    const content = view.container.querySelector<HTMLButtonElement>('[data-message-action="copy-content"]')!;
    expect(link.getAttribute("aria-label")).toBe("Copy link");
    expect(content.dataset.readerExtra).toBe("widest");
    await act(async () => { fireEvent.click(link); fireEvent.click(content); });
    expect(calls).toEqual(["link:msg-1", "content:msg-1"]);
  });
});
