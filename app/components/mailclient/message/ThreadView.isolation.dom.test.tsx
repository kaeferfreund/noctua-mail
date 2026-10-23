import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import { reviewReaderProps, syntheticReviewMessage } from "@/tests/helpers/i18nSlice2b";
import { createRef, type ComponentProps } from "react";
import MessageViewOrchestrator, { type MessageViewOrchestratorHandle, type MessageViewOrchestratorProps } from "./MessageViewOrchestrator";
import ThreadMessageCard from "./ThreadMessageCard";
import ThreadView from "./ThreadView";
import type { Message } from "@/lib/data";

afterEach(cleanup);

test("200-message thread isolates card state and sibling collaboration; callbacks stay current", () => {
  const renders = new Map<string, number>();
  const { message: _message, actionPending: _pending, isCollapsed: _collapsed, contentLoading: _loading, fontScale: _scale, zoomValue: _zoom, ...shared } = reviewReaderProps();
  const messages = Array.from({length: 200}, (_, i) => ({...syntheticReviewMessage, id: `synthetic-${i}`, recent: false}));
  const calls: string[] = [];
  let props: ComponentProps<typeof ThreadView> = {
    activeMessage: messages[0], activeThread: messages, supportsThreads: true,
    showComposeInline: false, composeDraftId: null, composeReplyMessageId: null,
    renderComposeInlineCard: null, threadContentById: {}, threadContentLoading: null,
    threadContentErrorById: {},
    messageCardProps: {...shared, pendingMessageActions: new Set(), collapsedMessages: Object.fromEntries(messages.slice(6).map(m => [m.id, true])), messageTabs: {}, messageContentLoading: {}, messageFontScale: {}, messageZoom: {}, messageByMessageId: new Map(), threadViewMode: "compact", getImapFlagBadges: message => {
      renders.set(message.id, (renders.get(message.id) ?? 0) + 1); return [];
    }, renderQuickActions: message => <button onClick={() => calls.push(`mailbox-a:owner:${message.id}`)}>Synthetic action {message.id}</button>}
  };
  const view = render(<Theme><ThreadView {...props} /></Theme>);
  expect(renders.size).toBe(200);
  const counts: Record<string, number> = {};
  const update = (name: string, next: Partial<typeof props>, expected = 1) => {
    renders.clear(); props = {...props, ...next}; view.rerender(<Theme><ThreadView {...props} /></Theme>);
    counts[name] = [...renders.values()].reduce((a, b) => a + b, 0);
    console.log(`A2 ${name}: ${counts[name]} card renders`);
    if (expected === 200) expect(counts[name]).toBe(expected);
  };
  update("collapse", {messageCardProps: {...props.messageCardProps, collapsedMessages: {...props.messageCardProps.collapsedMessages, "synthetic-0": true}}});
  update("tab", {messageCardProps: {...props.messageCardProps, messageTabs: {"synthetic-1": "markdown"}}});
  update("zoom", {messageCardProps: {...props.messageCardProps, messageZoom: {"synthetic-2": 1.2}}});
  update("font", {messageCardProps: {...props.messageCardProps, messageFontScale: {"synthetic-3": 1.2}}});
  update("pending", {messageCardProps: {...props.messageCardProps, pendingMessageActions: new Set(["synthetic-4"])}});
  update("loading", {messageCardProps: {...props.messageCardProps, messageContentLoading: {"synthetic-4": true}}});
  update("translation", {messageCardProps: {...props.messageCardProps, messageTranslations: {"synthetic-3": {showing: true, targetLang: "DE", results: {"text:DE": {text: "Synthetische Übersetzung", detectedSourceLang: "EN"}}}}}});
  update("collaboration", {activeThread: messages.map((m, i) => i === 5 ? {...m, collab: {status: "closed" as const, assigneeUserId: null, commentCount: 1, updatedAt: 1}} : m)});
  update("callback and mailbox/role change", {messageCardProps: {...props.messageCardProps, activeFolderId: "mailbox-b:INBOX",
    renderQuickActions: message => <button onClick={() => calls.push(`mailbox-b:member:${message.id}`)}>Synthetic action {message.id}</button>}}, 200);
  fireEvent.click(view.getByRole("button", {name: "Synthetic action synthetic-5"}));
  expect(calls).toEqual(["mailbox-b:member:synthetic-5"]);
  for (const [name, count] of Object.entries(counts)) if (name !== "callback and mailbox/role change") expect(count).toBe(1);
});


test("orchestrator keeps sibling cards idle through real collapse, tab, font, zoom and translation actions", async () => {
  const { message: _message, actionPending: _pending, isCollapsed: _collapsed, contentLoading: _loading, fontScale: _scale, zoomValue: _zoom, ...shared } = reviewReaderProps();
  const messages = Array.from({length: 6}, (_, i) => ({...syntheticReviewMessage,
    id: `orchestrator-${i}`, recent: false, messageId: `<${i}@example.test>`,
    htmlBody: "<p>Synthetic HTML body</p>"}));
  const renders = new Map<string, number>();
  const ref = createRef<MessageViewOrchestratorHandle>();
  const props: MessageViewOrchestratorProps = {
    header: {activeMessage: messages[0], activeThread: messages, getAssignedThreadTopics: () => [], onToggleTopic: () => {}},
    body: {
      composeHandleRef: {current: null}, inlineComposePlacement: {showComposeAtTop: false, composeReplyMessageId: null},
      showComposeInline: false, supportsThreads: true, threadContentById: {}, threadContentLoading: null,
      threadContentErrorById: {}, composeDraftId: null, composeMode: "new", composeThreadFocusMessageId: null,
      pendingSelectionCollapseMessageId: null, onPendingSelectionCollapseConsumed: () => {},
      activeAccountId: syntheticReviewMessage.accountId, messageByMessageId: new Map(),
      apiFetch: async () => Response.json({ok: true, translatedText: "<p>Synthetische Übersetzung</p>", detectedSourceLang: "EN"}),
      messageCardProps: {...shared, pendingMessageActions: new Set(), messageContentLoading: {},
        translationEnabled: true, hasHtmlContent: html => Boolean(html),
        getImapFlagBadges: message => {renders.set(message.id, (renders.get(message.id) ?? 0) + 1); return [];}}
    }
  };
  const view = render(<Theme><MessageViewOrchestrator {...props} ref={ref} /></Theme>);
  expect(renders.size).toBe(6);
  const card = within(view.container.querySelector("article")!);
  renders.clear();
  fireEvent.click(card.getByRole("button", {name: "Collapse message"}));
  expect([...renders.keys()]).toEqual([messages[0].id]);
  renders.clear();
  fireEvent.click(view.getByRole("button", {name: /Synthetic Sender.*Synthetic review body/}));
  expect([...renders.keys()]).toEqual([messages[0].id]);
  const expanded = within(view.container.querySelector("article")!);
  fireEvent.keyDown(expanded.getByRole("button", {name: "Display options"}), {key: "Enter"});
  await view.findByRole("menu");
  renders.clear();
  fireEvent.click(view.getByRole("menuitem", {name: /Zoom in/}));
  expect([...renders.keys()]).toEqual([messages[0].id]);
  renders.clear();
  fireEvent.click(view.getByRole("menuitem", {name: /Increase text size/}));
  expect([...renders.keys()]).toEqual([messages[0].id]);
  renders.clear();
  fireEvent.click(view.getByRole("menuitemradio", {name: "Plain text"}));
  expect(ref.current?.getMessageTab(messages[0].id)).toBe("text");
  expect([...renders.keys()]).toEqual([messages[0].id]);
  renders.clear();
  await act(async () => {fireEvent.click(expanded.getByRole("button", {name: "Translate message"}));});
  expect([...renders.keys()]).toEqual([messages[0].id]);
  expect(view.getByText("<p>Synthetische Übersetzung</p>")).toBeTruthy();
});

test("memoized cards observe new callback permissions, translations and remote-content decisions", () => {
  const calls: string[] = [];
  let props: ComponentProps<typeof ThreadMessageCard> = {
    ...reviewReaderProps(), translationEnabled: true, hasHtmlContent: html => Boolean(html),
    message: {...syntheticReviewMessage, id: "policy-message", htmlBody: '<p>Original HTML</p><img src="https://images.example.test/synthetic.png">', senderKey: null},
    renderQuickActions: message => <button onClick={() => calls.push(`owner:${message.accountId}:${message.id}`)}>Synthetic action</button>
  };
  const view = render(<Theme><ThreadMessageCard {...props} /></Theme>);
  const frame = view.getByTitle("HTML message") as HTMLIFrameElement;
  expect(frame.srcdoc).toContain("data-remote-src=");
  fireEvent.click(view.getByRole("button", {name: "Load once"}));
  expect(frame.srcdoc).toContain('src="https://images.example.test/synthetic.png"');
  expect(view.queryByText("Remote content blocked")).toBeNull();
  // Only the callback changes: ordinary memo must observe its new authority.
  props = {...props, renderQuickActions: message => <button onClick={() => calls.push(`viewer:${message.accountId}:${message.id}`)}>Synthetic action</button>};
  view.rerender(<Theme><ThreadMessageCard {...props} /></Theme>);
  fireEvent.click(view.getByRole("button", {name: "Synthetic action"}));
  expect(calls).toEqual(["viewer:synthetic-review:policy-message"]);
  props = {...props, message: {...props.message, accountId: "synthetic-mailbox-b"}};
  view.rerender(<Theme><ThreadMessageCard {...props} /></Theme>);
  expect((view.getByTitle("HTML message") as HTMLIFrameElement).srcdoc).toContain("data-remote-src=");
  fireEvent.click(view.getByRole("button", {name: "Synthetic action"}));
  expect(calls.at(-1)).toBe("viewer:synthetic-mailbox-b:policy-message");
  props = {...props, translation: {showing: true, targetLang: "DE", results: {"html:DE": {text: "<p>Übersetzter Inhalt</p>", detectedSourceLang: "EN"}}}};
  view.rerender(<Theme><ThreadMessageCard {...props} /></Theme>);
  expect((view.getByTitle("HTML message") as HTMLIFrameElement).srcdoc).toContain("Übersetzter Inhalt");
  props = {...props, translation: {...props.translation!, results: {"html:DE": {text: "<p>Neue Übersetzung</p>", detectedSourceLang: "EN"}}}};
  view.rerender(<Theme><ThreadMessageCard {...props} /></Theme>);
  expect((view.getByTitle("HTML message") as HTMLIFrameElement).srcdoc).toContain("Neue Übersetzung");
  props = {...props, renderQuickActions: () => null};
  view.rerender(<Theme><ThreadMessageCard {...props} /></Theme>);
  expect(view.queryByRole("button", {name: "Synthetic action"})).toBeNull();
});


test("reply lookup changes update only the referencing card and select the current target", () => {
  const { message: _message, actionPending: _pending, isCollapsed: _collapsed, contentLoading: _loading, fontScale: _scale, zoomValue: _zoom, ...shared } = reviewReaderProps();
  const target = {...syntheticReviewMessage, id: "reply-target", messageId: "<reply-target@example.test>", subject: "Original target"};
  const message = {...syntheticReviewMessage, id: "reply-source", inReplyTo: target.messageId};
  const sibling = {...syntheticReviewMessage, id: "reply-sibling"};
  const rendered: string[] = [];
  const selected: string[] = [];
  const cardProps = {...shared, pendingMessageActions: new Set<string>(), collapsedMessages: {}, messageTabs: {},
    messageContentLoading: {}, messageFontScale: {}, messageZoom: {}, messageByMessageId: new Map([[target.messageId, target]]),
    getImapFlagBadges: (message: Message) => {rendered.push(message.id); return [];},
    handleSelectMessage: (message: Message) => selected.push(message.subject)};
  const props: ComponentProps<typeof ThreadView> = {activeMessage: message, activeThread: [message, sibling], supportsThreads: true,
    showComposeInline: false, composeDraftId: null, composeReplyMessageId: null, renderComposeInlineCard: null,
    threadContentById: {}, threadContentLoading: null, threadContentErrorById: {}, messageCardProps: cardProps};
  const view = render(<Theme><ThreadView {...props} /></Theme>);
  rendered.length = 0;
  view.rerender(<Theme><ThreadView {...props} messageCardProps={{...cardProps,
    messageByMessageId: new Map([[target.messageId, {...target, subject: "Updated target"}]])}} /></Theme>);
  expect(rendered).toEqual([message.id]);
  fireEvent.click(view.getByRole("button", {name: "Updated target"}));
  expect(selected).toEqual(["Updated target"]);
});
