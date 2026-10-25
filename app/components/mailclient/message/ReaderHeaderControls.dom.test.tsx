import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import { reviewReaderProps, syntheticReviewMessage } from "@/tests/helpers/i18nSlice2b";
import type { ComponentProps } from "react";
import MessageViewOrchestrator, { type MessageViewOrchestratorProps } from "./MessageViewOrchestrator";
import ReaderToolbar from "./ReaderToolbar";
import type { Message } from "@/lib/data";
import type { ThreadCollabController } from "@/app/hooks/useThreadCollab";

afterEach(cleanup);

function renderReader(thread: Message[], header: Partial<MessageViewOrchestratorProps["header"]> = {}) {
  const { message: _message, actionPending: _pending, isCollapsed: _collapsed, contentLoading: _loading, fontScale: _scale, zoomValue: _zoom, ...shared } = reviewReaderProps();
  const props: MessageViewOrchestratorProps = {
    header: {activeMessage: thread[0], activeThread: thread, getAssignedThreadTopics: () => [], onToggleTopic: () => {}, ...header},
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
  return render(<Theme><ReaderToolbar layout={layout} toggleLayout={toggleLayout} back={noop}
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

test("split layout: Expand sits in the subject row and leaves no toolbar row; the tip renders below the subject", () => {
  const toolbar = <div data-testid="split-toolbar"><button type="button">Expand</button></div>;
  const view = renderReader(threadMessages(3), {toolbar, toolbarInSubjectRow: true, notice: <p>Synthetic tip</p>});
  const pane = view.container.querySelector("[data-reader-print]")!;
  const inline = view.getByTestId("split-toolbar");
  const subjectRow = inline.parentElement!;
  expect(subjectRow.contains(view.getByRole("radio", {name: "Compact"}))).toBe(true);
  expect(subjectRow.lastElementChild).toBe(inline);
  // The thread header is the pane's first child: no separate row above it.
  expect(pane.firstElementChild!.contains(inline)).toBe(true);
  expect(subjectRow.nextElementSibling?.textContent).toBe("Synthetic tip");
  cleanup();
  const focus = renderReader(threadMessages(3), {toolbar});
  const focusPane = focus.container.querySelector("[data-reader-print]")!;
  expect(focusPane.firstElementChild).toBe(focus.getByTestId("split-toolbar"));
});

test("split toolbar holds only the expand control", () => {
  const view = renderToolbar("split", () => {});
  const group = view.getByRole("group", {name: "Message reading controls"});
  expect(group.getAttribute("data-focus")).toBe("false");
  expect(Array.from(group.querySelectorAll("button")).map(b => b.getAttribute("aria-label"))).toEqual(["Expand reading view"]);
  expect(view.queryByText(/^Tip:/)).toBeNull();
});

const collab: ThreadCollabController = {state: undefined, readDenied: false, members: [], me: null, comments: [], activity: [],
  pending: false, loading: false, error: null, reload: async () => {}, update: async () => true,
  addNote: async () => true, deleteNote: async () => true};

test("split layout with a collaboration bar: toggle and Expand end the collaboration row, the subject keeps its row", () => {
  const toolbar = <div data-testid="split-toolbar"><button type="button">Expand</button></div>;
  const view = renderReader(threadMessages(3), {toolbar, toolbarInSubjectRow: true, collab: {controller: collab, role: "editor"}});
  const inline = view.getByTestId("split-toolbar");
  const compact = view.getByRole("radio", {name: "Compact"});
  const actions = inline.parentElement!;
  expect(actions.contains(compact)).toBe(true);
  expect(actions.lastElementChild).toBe(inline);
  const bar = view.getByLabelText("Thread collaboration");
  expect(bar.contains(actions)).toBe(true);
  // Same line as the assignee/status controls, not below them.
  expect(actions.parentElement!.contains(view.getByRole("button", {name: "Internal note"}))).toBe(true);
  // ThreadSubject renders the text inside its group; the group's parent is the subject row.
  const subjectRow = (v: typeof view) => v.getByText(syntheticReviewMessage.subject!).parentElement!.parentElement!;
  expect(subjectRow(view).querySelector('[role="radio"]')).toBeNull();
  expect(subjectRow(view).children).toHaveLength(1);
  cleanup();
  // Focus layout keeps the toggle in the subject row.
  const focus = renderReader(threadMessages(3), {toolbar, collab: {controller: collab, role: "editor"}});
  expect(focus.getByLabelText("Thread collaboration").querySelector('[role="radio"]')).toBeNull();
  expect(subjectRow(focus).contains(focus.getByRole("radio", {name: "Compact"}))).toBe(true);
});
