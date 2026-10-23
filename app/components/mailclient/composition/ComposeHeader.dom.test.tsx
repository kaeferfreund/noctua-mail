import { afterEach, expect, test } from "bun:test";
import { createRef } from "react";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render, I18nTestProvider } from "@/lib/i18n/testRender";
import { getMessages } from "@/lib/i18n/translator";
import type { Message } from "@/lib/data";
import { ComposeContextProvider, type ComposeContextValue } from "./ComposeContext";
import ComposeModal from "./ComposeModal";

afterEach(async () => {
  cleanup();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
});

// CSS geometry/clamping runs in the production browser matrix; happy-dom
// protects the complete accessible text retained by that visual truncation.
function renderHeader({ width = 320, theme = "light", enabled = true, email, displayName, locale = "en", inReplyToMessage = null }: {
  width?: number; theme?: "light" | "dark"; enabled?: boolean;
  email: string; displayName: string; locale?: "de" | "en"; inReplyToMessage?: Message | null;
}) {
  const sender = `${displayName} <${email}>`;
  let closed = 0;
  const noop = () => {};
  const value = {
    composeMode: "new", composeOpen: true, composeView: "modal", composeTo: "", composeCc: "", composeBcc: "", composeSubject: "",
    composeShowBcc: false, composeOpenedAt: "", activeAccountId: "synthetic", fromValue: sender,
    identities: [{ id: "long", accountId: "synthetic", email, displayName, enabled, isDefault: false, createdBy: "synthetic-user", createdAt: 0, updatedAt: 0 }], identityId: "long", onIdentityChange: noop,
    composeDraftId: null, composeFieldsReset: 0, composeDragActive: false, composeSize: { width, height: 844 }, inReplyToMessage, composeInviteDraft: null,
    canSaveDraft: false, attachmentLoadState: null, draftSaving: false, draftSaveError: null, draftSavedAt: null,
    sendingMail: false, discardingDraft: false, detachingCompose: false, detachedWindow: false,
    composeModalRef: createRef(), composeResizeRef: { current: null }, composeCardRef: createRef(),
    setComposeTo: noop, setComposeCc: noop, setComposeBcc: noop, setComposeSubject: noop, setComposeShowBcc: noop,
    setComposeOpen: () => { closed++; }, setComposeView: noop, setComposeResizing: noop, setComposeAttachments: noop,
    popOutCompose: noop, popInCompose: noop, minimizeCompose: noop, openComposeInNewWindow: noop, closeDetachedCompose: noop,
    handleSendMail: noop, handleSaveDraft: noop, handleDiscardDraft: noop, markComposeDirty: noop,
    applyRecipientSelection: (current: string) => current, loadRecipientOptions: async () => [], jumpToMessage: noop,
    getComposeToken: (text: string) => text, formatRelativeTime: () => "", handleComposeDragEnter: noop,
    handleComposeDragLeave: noop, handleComposeDragOver: noop, handleComposeDrop: noop, composeMessageField: <textarea aria-label="Synthetic body" />
  } satisfies ComposeContextValue;
  const view = render(<I18nTestProvider locale={locale}><Theme appearance={theme}><ComposeContextProvider value={value}><ComposeModal open isMobile /></ComposeContextProvider></Theme></I18nTestProvider>);
  return { view, sender, closed: () => closed };
}

for (const width of [320, 360, 390]) for (const theme of ["light", "dark"] as const) for (const enabled of [true, false]) {
  test(`P2-E header ${width}px ${theme} ${enabled ? "enabled" : "unavailable"}`, () => {
    const email = `${"a".repeat(47)}@example.test`;
    const { view, sender, closed } = renderHeader({ width, theme, enabled, email, displayName: "Synthetic Long Display Name NNNNNNNNNNNN" });
    expect(view.getByTitle(`From ${sender}`).textContent).toBe(`From ${sender}`);
    expect(view.getByLabelText("From:", { exact: true }).textContent).toContain(email);
    fireEvent.click(view.getByRole("button", { name: "Close composer" }));
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(closed()).toBe(2);
  });
}

for (const locale of ["de", "en"] as const) for (const enabled of [true, false]) {
  test(`P2-G clamped sender retains full accessible text: ${locale} ${enabled ? "enabled" : "unavailable"}`, () => {
    const displayName = "N".repeat(80);
    const email = `${"a".repeat(64)}@${"b".repeat(42)}.example.test`;
    const { view, sender } = renderHeader({ locale, enabled, displayName, email });
    const messages = getMessages(locale).Compose;
    const fullSubtitle = messages.fromValue.replace("{sender}", sender);
    const subtitle = view.getByTitle(fullSubtitle);
    // CSS must truncate presentation only; no shortened value or hidden
    // ancestor may replace the full name/address used by assistive technology.
    expect(subtitle.textContent).toBe(fullSubtitle);
    expect(subtitle.closest('[aria-hidden="true"], [hidden]')).toBeNull();
    const trigger = view.getByLabelText(messages.from, { exact: true });
    expect(trigger.getAttribute("title")).toBe(sender);
    expect(trigger.textContent).toContain(sender);
    expect(trigger.closest('[aria-hidden="true"], [hidden]')).toBeNull();
    expect(view.getByRole("button", { name: messages.closeComposer })).toBeTruthy();
  });
}

for (const locale of ["de", "en"] as const) test(`keyboard scroll area contains metadata, body and footer: ${locale}`, () => {
  const { view } = renderHeader({ locale, enabled: false, email: "unavailable@example.test", displayName: "Synthetic unavailable sender" });
  const messages = getMessages(locale).Compose;
  const from = view.getByLabelText(messages.from, { exact: true });
  const to = view.getByLabelText(messages.fields.to, { exact: true });
  const subject = view.getByLabelText(messages.fields.subject, { exact: true });
  const editor = view.getByLabelText("Synthetic body");
  const cancel = view.getByRole("button", { name: messages.actions.cancel });
  // Geometry and the single active scroll ancestor are checked in Chromium.
  // Keep the footer in the same structural area, so it can scroll with the
  // fields when the keyboard leaves too little room for fixed actions.
  const body = editor.parentElement!;
  const area = body.parentElement!;
  expect(body.contains(from)).toBe(true);
  expect(body.contains(to)).toBe(true);
  expect(body.contains(subject)).toBe(true);
  expect(area.contains(cancel)).toBe(true);
  expect(cancel.parentElement!.parentElement!.parentElement).toBe(area);
  expect(area.contains(view.getByRole("button", { name: messages.closeComposer }))).toBe(false);
});

test("German header, window controls and footer actions use the catalog copy", () => {
  const { view, closed } = renderHeader({ locale: "de", email: "sender@example.test", displayName: "Synthetic Sender" });
  expect(view.getByRole("dialog", { name: "Neue Nachricht" })).toBeTruthy();
  expect(view.getByText("Von Synthetic Sender <sender@example.test>")).toBeTruthy();
  expect(view.getByLabelText("An:", { exact: true })).toBeTruthy();
  expect(view.getByLabelText("Betreff:", { exact: true })).toBeTruthy();
  expect(view.getByRole("button", { name: "Cc/Bcc anzeigen" })).toBeTruthy();
  expect(view.getByText("Entwurf noch nicht gespeichert")).toBeTruthy();
  expect(view.getByRole("button", { name: "Senden" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Abbrechen" }));
  fireEvent.click(view.getByRole("button", { name: "Nachrichtenfenster schließen" }));
  expect(closed()).toBe(2);
  expect(view.queryByText(/New message|Cancel|Send$|Draft not saved/)).toBeNull();
});

for (const [locale, label] of [["de", "Antwort auf:"], ["en", "In Reply To:"]] as const) {
  test(`${locale}: the in-reply-to row label is UI copy while subject and sender stay verbatim`, () => {
    const inReplyToMessage = { id: "synthetic-original", subject: "Synthetic original subject", from: "Synthetic Sender <sender@example.test>" } as Message;
    const { view } = renderHeader({ locale, email: "sender@example.test", displayName: "Synthetic Sender", inReplyToMessage });
    expect(view.getByText(label, { exact: true })).toBeTruthy();
    expect(view.getByRole("button", { name: "Synthetic original subject — Synthetic Sender <sender@example.test>" })).toBeTruthy();
  });
}
