import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import { reviewReaderProps, syntheticReviewMessage } from "@/tests/helpers/i18nSlice2b";
import MessageViewOrchestrator, { type MessageViewOrchestratorProps } from "./MessageViewOrchestrator";
import type { Message } from "@/lib/data";

afterEach(cleanup);

// Message ids are only unique within a mailbox. A translation that was still
// running when the user switched mailboxes must never show up on the new
// mailbox's message with the same id.
test("a late translation of the previous mailbox's message is dropped after a mailbox switch", async () => {
  const { message: _message, actionPending: _pending, isCollapsed: _collapsed, contentLoading: _loading, fontScale: _scale, zoomValue: _zoom, ...shared } = reviewReaderProps();
  const pending = new Map<string, () => void>();
  const apiFetch = async (input: RequestInfo | URL) => {
    const accountId = String(input).split("/api/accounts/")[1]?.split("/")[0] ?? "";
    await new Promise<void>((release) => pending.set(accountId, release));
    return Response.json({ ok: true, translatedText: `Private translation from ${accountId}`, detectedSourceLang: "EN" });
  };
  const messageOf = (accountId: string): Message => ({ ...syntheticReviewMessage, id: "same-local-id", accountId, folderId: `${accountId}:INBOX`, recent: false });
  const propsFor = (accountId: string): MessageViewOrchestratorProps => {
    const message = messageOf(accountId);
    return {
      header: { activeMessage: message, activeThread: [message], getAssignedThreadTopics: () => [], onToggleTopic: () => {} },
      body: {
        composeHandleRef: { current: null }, inlineComposePlacement: { showComposeAtTop: false, composeReplyMessageId: null },
        showComposeInline: false, supportsThreads: true, threadContentById: {}, threadContentLoading: null,
        threadContentErrorById: {}, composeDraftId: null, composeMode: "new", composeThreadFocusMessageId: null,
        pendingSelectionCollapseMessageId: null, onPendingSelectionCollapseConsumed: () => {},
        autoMarkReadDelayMs: null, onAutoMarkRead: () => {}, activeAccountId: accountId, messageByMessageId: new Map(), apiFetch,
        messageCardProps: { ...shared, pendingMessageActions: new Set(), messageContentLoading: {}, translationEnabled: true,
          hasHtmlContent: () => false, getImapFlagBadges: () => [] }
      }
    };
  };
  const translate = async (container: HTMLElement) => {
    await act(async () => { fireEvent.click(within(container.querySelector("article")!).getByRole("button", { name: "Translate message" })); });
  };

  const view = render(<Theme><MessageViewOrchestrator {...propsFor("mailbox-a")} /></Theme>);
  await translate(view.container);
  expect(pending.has("mailbox-a")).toBe(true);

  view.rerender(<Theme><MessageViewOrchestrator {...propsFor("mailbox-b")} /></Theme>);
  await translate(view.container);
  expect(pending.has("mailbox-b")).toBe(true);

  await act(async () => { pending.get("mailbox-a")!(); await new Promise((resolve) => setTimeout(resolve, 10)); });
  expect(view.queryByText("Private translation from mailbox-a")).toBeNull();

  await act(async () => { pending.get("mailbox-b")!(); await new Promise((resolve) => setTimeout(resolve, 10)); });
  expect(view.getByText("Private translation from mailbox-b")).toBeTruthy();
  expect(view.queryByText("Private translation from mailbox-a")).toBeNull();
});
