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

  it("starts one draft per click and is disabled while it runs", async () => {
    const calls: string[] = [];
    function Host() {
      const [pending, setPending] = useState(false);
      const value: MessageReaderActions = { ...copyActions, canAiReply: () => true, isAiReplyPending: () => pending,
        draftAiReply: async (target) => { calls.push(target.id); setPending(true); } };
      return <MessageReaderActionsProvider value={value}>{quickActions()}</MessageReaderActionsProvider>;
    }
    const view = render(wrap(<Host />));
    const button = aiButton(view.container)!;
    expect(button.getAttribute("aria-label")).toBe("Draft AI reply");
    expect(button.disabled).toBe(false);
    await act(async () => { fireEvent.click(button); });
    expect(calls).toEqual(["msg-1"]);
    expect(aiButton(view.container)!.disabled).toBe(true);
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
