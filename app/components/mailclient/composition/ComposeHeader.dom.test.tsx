import { afterEach, expect, test } from "bun:test";
import { createRef } from "react";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import { ComposeContextProvider, type ComposeContextValue } from "./ComposeContext";
import ComposeModal from "./ComposeModal";

afterEach(async () => {
  cleanup();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
});

// Geometry is asserted by the production Playwright counterpart. This DOM gate
// protects the full sender information and both ways to dismiss the composer.
for (const width of [320, 360, 390]) for (const theme of ["light", "dark"] as const) for (const enabled of [true, false]) {
  test(`P2-E header ${width}px ${theme} ${enabled ? "enabled" : "unavailable"}`, () => {
    const email = `${"a".repeat(47)}@example.test`;
    const displayName = "Synthetic Long Display Name NNNNNNNNNNNN";
    const sender = `${displayName} <${email}>`;
    let closed = 0;
    const noop = () => {};
    const value = {
      composeMode: "new", composeOpen: true, composeView: "modal", composeTo: "", composeCc: "", composeBcc: "", composeSubject: "",
      composeShowBcc: false, composeOpenedAt: "", activeAccountId: "synthetic", fromValue: sender,
      identities: [{ id: "long", accountId: "synthetic", email, displayName, enabled, isDefault: false, createdBy: "synthetic-user", createdAt: 0, updatedAt: 0 }], identityId: "long", onIdentityChange: noop,
      composeDraftId: null, composeFieldsReset: 0, composeDragActive: false, composeSize: { width, height: 844 }, inReplyToMessage: null, composeInviteDraft: null,
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
    const view = render(<Theme appearance={theme}><ComposeContextProvider value={value}><ComposeModal open isMobile /></ComposeContextProvider></Theme>);
    const subtitle = view.getByTitle(`From ${sender}`);
    expect(subtitle.textContent).toBe(`From ${sender}`);
    expect(view.getByLabelText("From:", { exact: true }).textContent).toContain(email);
    fireEvent.click(view.getByRole("button", { name: "Close composer" }));
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(closed).toBe(2);
  });
}
