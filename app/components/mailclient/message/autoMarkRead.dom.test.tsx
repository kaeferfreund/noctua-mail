import { afterEach, describe, expect, it, jest } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import { reviewReaderProps, syntheticReviewMessage } from "@/tests/helpers/i18nSlice2b";
import type { Message } from "@/lib/data";
import MessageViewOrchestrator, { type MessageViewOrchestratorProps } from "./MessageViewOrchestrator";

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

// Newest first: the opened message is read; two older replies are unread.
const thread: Message[] = [
  { ...syntheticReviewMessage, id: "opened", seen: true, recent: false, messageId: "<opened@example.test>", dateValue: 3000 },
  { ...syntheticReviewMessage, id: "unread-newer", seen: false, recent: false, flags: [], messageId: "<unread-newer@example.test>", dateValue: 2000 },
  { ...syntheticReviewMessage, id: "unread-older", seen: false, recent: false, flags: [], messageId: "<unread-older@example.test>", dateValue: 1000 }
];

function renderThread(initialThread: Message[], options: { active?: string; pendingCollapse?: string | null } = {}) {
  const { message: _message, actionPending: _pending, isCollapsed: _collapsed, contentLoading: _loading, fontScale: _scale, zoomValue: _zoom, ...shared } = reviewReaderProps();
  const messageRefs = { current: new Map<string, HTMLElement>() };
  const marked: string[] = [];
  let current = initialThread;
  let pendingCollapse = options.pendingCollapse ?? null;
  const props = (): MessageViewOrchestratorProps => ({
    header: { activeMessage: current.find(message => message.id === (options.active ?? "opened"))!, activeThread: current, getAssignedThreadTopics: () => [], onToggleTopic: () => {} },
    body: {
      composeHandleRef: { current: null }, inlineComposePlacement: { showComposeAtTop: false, composeReplyMessageId: null },
      showComposeInline: false, supportsThreads: true, threadContentById: {}, threadContentLoading: null,
      threadContentErrorById: {}, composeDraftId: null, composeMode: "new", composeThreadFocusMessageId: null,
      pendingSelectionCollapseMessageId: pendingCollapse, onPendingSelectionCollapseConsumed: () => {},
      autoMarkReadDelayMs: 1000,
      // Stands in for the shell's updateFlagState: the read state comes back as a new thread.
      onAutoMarkRead: message => { marked.push(message.id); },
      activeAccountId: syntheticReviewMessage.accountId, messageByMessageId: new Map(),
      apiFetch: async () => Response.json({ ok: true }),
      messageCardProps: { ...shared, messageRefs, pendingMessageActions: new Set(), messageContentLoading: {},
        hasHtmlContent: html => Boolean(html), getImapFlagBadges: () => [] }
    }
  });
  const view = render(<Theme><MessageViewOrchestrator {...props()} /></Theme>);
  return {
    marked,
    advance: (ms: number) => act(() => { jest.advanceTimersByTime(ms); }),
    expanded: (id: string) => messageRefs.current.get(id)?.tagName === "ARTICLE",
    expand: (id: string) => fireEvent.click(messageRefs.current.get(id)!),
    update: (next: { thread?: Message[]; pendingCollapse?: string | null }) => {
      if (next.thread) current = next.thread;
      if (next.pendingCollapse !== undefined) pendingCollapse = next.pendingCollapse;
      view.rerender(<Theme><MessageViewOrchestrator {...props()} /></Theme>);
    }
  };
}

const markedRead = (messages: Message[], ids: string[]) =>
  messages.map(message => (ids.includes(message.id) ? { ...message, seen: true, flags: ["\\Seen"] } : message));

describe("auto-read in the thread reader", () => {
  it("marks only expanded cards and keeps collapsed older messages unread", () => {
    jest.useFakeTimers();
    const reader = renderThread(thread);
    // Default expansion: the opened message and the newest unread one.
    expect(reader.expanded("unread-newer")).toBe(true);
    expect(reader.expanded("unread-older")).toBe(false);
    reader.advance(1000);
    expect(reader.marked).toEqual(["unread-newer"]);

    // Read state arrives; the card stays open and the older unread one does not open in turn.
    reader.update({ thread: markedRead(thread, ["unread-newer"]) });
    reader.advance(5000);
    expect(reader.marked).toEqual(["unread-newer"]);
    expect(reader.expanded("unread-newer")).toBe(true);
    expect(reader.expanded("unread-older")).toBe(false);

    // Expanding the older message opens it, so it is marked after the dwell.
    reader.expand("unread-older");
    expect(reader.expanded("unread-older")).toBe(true);
    reader.advance(999);
    expect(reader.marked).toEqual(["unread-newer"]);
    reader.advance(1);
    expect(reader.marked).toEqual(["unread-newer", "unread-older"]);
  });

  it("waits for a selection's sibling collapse before any card counts as opened", () => {
    jest.useFakeTimers();
    const unreadThread = thread.map(message => ({ ...message, seen: false, flags: [] }));
    const reader = renderThread(unreadThread, { pendingCollapse: "opened" });
    reader.update({ pendingCollapse: null });
    reader.advance(1000);
    // The selection collapsed every sibling, so only the selected message is read.
    expect(reader.marked).toEqual(["opened"]);
    expect(reader.expanded("unread-newer")).toBe(false);
  });

  it("cancels when the opened card is collapsed before the dwell", () => {
    jest.useFakeTimers();
    const unreadThread = thread.map(message => ({ ...message, seen: false, flags: [] }));
    const reader = renderThread(unreadThread, { active: "unread-older", pendingCollapse: "unread-older" });
    reader.update({ pendingCollapse: null });
    reader.advance(500);
    fireEvent.click(document.querySelector("[aria-label='Collapse message']")!);
    reader.advance(5000);
    expect(reader.marked).toEqual([]);
  });
});
