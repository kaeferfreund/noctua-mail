import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import { reviewReaderProps, syntheticReviewMessage } from "@/tests/helpers/i18nSlice2b";
import type { ComponentProps } from "react";
import MessageViewOrchestrator, { type MessageViewOrchestratorProps } from "./MessageViewOrchestrator";
import ReaderToolbar from "./ReaderToolbar";
import type { Message } from "@/lib/data";

afterEach(cleanup);

function renderReader(thread: Message[]) {
  const { message: _message, actionPending: _pending, isCollapsed: _collapsed, contentLoading: _loading, fontScale: _scale, zoomValue: _zoom, ...shared } = reviewReaderProps();
  const props: MessageViewOrchestratorProps = {
    header: {activeMessage: thread[0], activeThread: thread, getAssignedThreadTopics: () => [], onToggleTopic: () => {}},
    body: {
      composeHandleRef: {current: null}, inlineComposePlacement: {showComposeAtTop: false, composeReplyMessageId: null},
      showComposeInline: false, supportsThreads: true, threadContentById: {}, threadContentLoading: null,
      threadContentErrorById: {}, composeDraftId: null, composeMode: "new", composeThreadFocusMessageId: null,
      pendingSelectionCollapseMessageId: null, onPendingSelectionCollapseConsumed: () => {},
      activeAccountId: syntheticReviewMessage.accountId, messageByMessageId: new Map(),
      apiFetch: async () => Response.json({ok: true}),
      messageCardProps: {...shared, pendingMessageActions: new Set(), messageContentLoading: {},
        hasHtmlContent: html => Boolean(html), getImapFlagBadges: () => []}
    }
  };
  return render(<Theme><MessageViewOrchestrator {...props} /></Theme>);
}

const threadMessages = (count: number): Message[] => Array.from({length: count}, (_, i) => ({...syntheticReviewMessage,
  id: `header-${i}`, messageId: `<header-${i}@example.test>`, recent: false}));

test("single message → no compact/full toggle", () => {
  const view = renderReader(threadMessages(1));
  expect(view.queryByRole("radio", {name: "Compact"})).toBeNull();
  expect(view.queryByRole("radio", {name: "Full"})).toBeNull();
  expect(view.queryByText("Compact")).toBeNull();
});

test("multi-message thread → icon toggle visible with labels and radio semantics", () => {
  const view = renderReader(threadMessages(3));
  const compact = view.getByRole("radio", {name: "Compact"});
  const full = view.getByRole("radio", {name: "Full"});
  for (const item of [compact, full]) {
    expect(item.querySelector("svg")).toBeTruthy();
    expect(item.textContent?.trim()).toBe("");
  }
  expect(compact.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(full);
  expect(full.getAttribute("aria-checked")).toBe("true");
  expect(compact.getAttribute("aria-checked")).toBe("false");
});

function renderToolbar(layout: ComponentProps<typeof ReaderToolbar>["layout"], toggleLayout: () => void) {
  const noop = () => {};
  return render(<Theme><ReaderToolbar layout={layout} showHint={false} dismissHint={noop} toggleLayout={toggleLayout} back={noop}
    archive={noop} spam={noop} inSpam={false} remove={noop} move={noop} topics={noop} done={noop} isDone={false} busy={false}
    renderMenu={() => null} openWindow={noop} position={1} total={3} hasMore={false} previous={noop} next={noop}
    canPrevious={false} canNext navigating={false} /></Theme>);
}

test("expand / show-list control is icon-only and keeps its label and shortcut", () => {
  let toggles = 0;
  const view = renderToolbar("split", () => { toggles++; });
  const expand = view.getByRole("button", {name: "Expand reading view"});
  expect(expand.textContent?.trim()).toBe("");
  expect(expand.querySelector("svg")).toBeTruthy();
  expect(expand.getAttribute("aria-keyshortcuts")).toBe("Shift+Enter");
  fireEvent.click(expand);
  expect(toggles).toBe(1);
  cleanup();
  const focus = renderToolbar("focus", () => {});
  const showList = focus.getByRole("button", {name: "Show message list"});
  expect(showList.textContent?.trim()).toBe("");
  expect(showList.getAttribute("aria-keyshortcuts")).toBe("Shift+Enter");
});
