import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { useMessageMoveActions } from "./useMessageMoveActions";
import { createSelectionStore } from "./messagelist/selectionStore";
import type { Message } from "@/lib/data";

afterEach(cleanup);
test("move notices follow locale changes, retain literal custom names and send raw destination IDs", async () => {
  const notices: string[] = [], requests: string[] = [];
  const message: Message = { id: "synthetic-message", accountId: "synthetic", folderId: "synthetic:INBOX",
    subject: "Synthetic subject", from: "sender@example.test", to: "user@example.test", date: "2026-10-22T12:00:00Z",
    dateValue: 1792670400000, preview: "", body: "" };
  const folderById = new Map([
    ["synthetic:Sent", { name: "Sent", specialUse: "\\Sent" }],
    ["synthetic:Custom", { name: "Sent", specialUse: undefined }]
  ]);
  const options: Parameters<typeof useMessageMoveActions>[0] = {
    activeAccountId: "synthetic", activeMessageId: message.id, activeFolderId: message.folderId,
    searchScope: "all", includeThreadAcrossFoldersForList: false, messages: [message],
    selectionStore: createSelectionStore(), folderById, lastSelectedIdRef: { current: null },
    setFolders() {}, setMessages() {}, setGroupMeta() {}, setPendingMessageActions() {}, setActiveMessageId() {}, setViewMessage() {},
    apiFetch: async (_url, init) => {
      const { destinationFolderId } = JSON.parse(String(init?.body));
      requests.push(destinationFolderId);
      return Response.json({ ok: true, queued: true, destinationFolderId,
        movedIds: [{ previousId: message.id, nextId: "synthetic-moved" }] });
    }, readErrorMessage: async () => "Synthetic error", reportError() {},
    pushNotice: notice => notices.push(notice.title), undoMoveOperation: async () => {}, noticeSuccessTimeout: 1000
  };
  let locale: "de" | "en" = "de";
  const hook = renderHook(() => useMessageMoveActions(options), {
    wrapper: ({ children }) => <I18nTestProvider locale={locale}>{children}</I18nTestProvider>
  });
  for (const [nextLocale, destination, expected] of [
    ["de", "synthetic:Sent", "Nachricht wird im Hintergrund nach „Gesendet“ verschoben."],
    ["en", "synthetic:Sent", "Moving message to Sent in background."],
    ["de", "synthetic:Custom", "Nachricht wird im Hintergrund nach „Sent“ verschoben."]
  ] as const) {
    locale = nextLocale;
    hook.rerender();
    await act(async () => { await hook.result.current.moveMessagesToFolder(destination); });
    expect(notices.at(-1)).toBe(expected);
  }
  expect(requests).toEqual(["synthetic:Sent", "synthetic:Sent", "synthetic:Custom"]);
});
