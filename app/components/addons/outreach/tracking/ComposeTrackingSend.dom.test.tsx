import { afterEach, expect, test } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import ComposeOrchestrator from "@/app/components/mailclient/composition/ComposeOrchestrator";
import { resetOutreachStatusForTests, type OutreachStatus } from "../useOutreachStatus";

afterEach(async () => {
  cleanup();
  resetOutreachStatusForTests();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
});

const ON: OutreachStatus = { loaded: true, available: true, sesConfigured: true, trackingConfigured: true,
  accounts: [{ accountId: "acc-test", enabled: true, trackMailDefault: true }] };

/** The real orchestrator with stub collaborators (same seam as composition/sendMailRace.dom.test.tsx). */
function renderCompose() {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    if (url.includes("/drafts/save")) return Response.json({ draftId: "draft-1", message: null });
    if (url.includes("/smtp/send")) return Response.json({ ok: true, sentFolderId: null, sentMessageUid: null });
    return Response.json({ ok: true });
  };
  const handleRef = React.createRef<React.ElementRef<typeof ComposeOrchestrator>>();
  const props = {
    activeAccountId: "acc-test",
    senderSettingsLoader: (_: unknown, accountId: string) => ({ account: { id: accountId, email: "me@example.test", accessRole: "manager", settings: {} },
      identities: [{ id: "primary", accountId, email: "me@example.test", displayName: "Synthetic Sender", enabled: true, isDefault: true }], prefs: {}, user: { email: "user@example.test" }, warnings: [] }),
    currentAccount: null, accountDateFormat: "locale" as const, defaultSignatureId: "", accountSignatures: [], darkMode: false, isMobile: false,
    activeThread: [], messageById: new Map(), viewMessage: null, searchScope: "folder", activeFolderId: "folder-inbox", isDraftsFolder: () => false,
    setMessages: () => {}, setViewMessage: () => {}, setActiveMessageId: () => {}, suppressDraftDeleteReconcile: () => {}, removeDraftFromUi: () => {},
    reconcileSavedDraftInUi: () => {}, refreshFolders: async () => {}, refreshMailboxData: async () => {}, pushNotice: () => {}, evictThreadCache: () => {},
    updateFlagState: () => {}, updateKeywordFlag: () => {}, accountFolders: [], findSentFolder: () => null, syncFolderWithBackgroundRef: { current: async () => {} },
    getPreferredComposeTab: () => undefined, isDraftMessage: () => false, ensureMessageContent: async () => null,
    applyRecipientSelection: (current: string) => current, loadRecipientOptions: async () => [], clearRecipientSuggestionCache: () => {},
    getComposeToken: (value: string) => value, formatRelativeTime: () => "just now", fromValue: "me@example.test", apiFetch,
    reportError: () => {}, readErrorMessage: async () => "error", stripHtml: (value: string) => value,
    showComposeInline: false, showComposeModal: true, showComposeMinimized: false, detachedWindow: false
  } as unknown as React.ComponentProps<typeof ComposeOrchestrator>;
  const view = render(<Theme><ComposeOrchestrator ref={handleRef} {...props} /></Theme>);
  const send = async () => {
    const toField = view.baseElement.querySelector<HTMLInputElement>("#compose-modal-to");
    await act(async () => { fireEvent.change(toField!, { target: { value: "someone@example.test" } }); });
    const button = [...view.baseElement.querySelectorAll("button")].find(item => (item.textContent ?? "").trim() === "Send")!;
    await act(async () => { fireEvent.click(button); });
    await waitFor(() => expect(calls.some(call => call.url.includes("/smtp/send"))).toBe(true), { timeout: 5000 });
    return calls.find(call => call.url.includes("/smtp/send"))!.body!;
  };
  return { view, handleRef, send };
}

test("activated mailbox: the switch sits in compose and the send request carries tracking", async () => {
  resetOutreachStatusForTests(ON);
  const { view, handleRef, send } = renderCompose();
  await act(async () => { handleRef.current?.openCompose("new"); });
  const toggle = await waitFor(() => {
    const element = view.baseElement.querySelector("[data-outreach-compose-tracking] [role=switch]");
    if (!element) throw new Error("switch missing");
    return element;
  });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect((await send()).tracking).toBe(true);
}, 20000);

test("switched off by the user: the request says tracking false", async () => {
  resetOutreachStatusForTests(ON);
  const { view, handleRef, send } = renderCompose();
  await act(async () => { handleRef.current?.openCompose("new"); });
  const toggle = await waitFor(() => {
    const element = view.baseElement.querySelector("[data-outreach-compose-tracking] [role=switch]");
    if (!element) throw new Error("switch missing");
    return element;
  });
  await act(async () => { fireEvent.click(toggle); });
  expect((await send()).tracking).toBe(false);
}, 20000);

test("addon off: no switch and no tracking field in the send request", async () => {
  resetOutreachStatusForTests({ ...ON, available: false, accounts: [] });
  const { view, handleRef, send } = renderCompose();
  await act(async () => { handleRef.current?.openCompose("new"); });
  expect(view.baseElement.querySelector("[data-outreach-compose-tracking]")).toBeNull();
  const body = await send();
  expect("tracking" in body).toBe(false);
}, 20000);
