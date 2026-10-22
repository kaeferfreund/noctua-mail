import { afterEach, expect, it } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import InAppNoticeStack from "../InAppNoticeStack";
import { useDetachedSendWarnings } from "./useDetachedSendWarnings";
import {
  DETACHED_COMPOSE_EVENT_STORAGE_KEY,
  notifyDetachedComposeOutcome,
  readDetachedComposeWarnings,
} from "@/lib/ui/detachedComposeHandoff";

afterEach(() => { cleanup(); window.localStorage.clear(); });
it("retains mailbox A warnings while mailbox B is selected, across later events and remounts, until acknowledged", async () => {
  const accounts = [{ id: "a", name: "Synthetic mailbox A" }, { id: "b", name: "Synthetic mailbox B" }];
  function Harness() {
    const warnings = useDetachedSendWarnings(accounts);
    return <><p>Selected mailbox B</p><InAppNoticeStack state={{ inAppNotices: warnings.notices }} actions={{ onOpenNotice: () => {}, onDismissNotice: warnings.dismiss }} /></>;
  }
  const view = render(<Harness />);
  act(() => {
    notifyDetachedComposeOutcome("handoff-a", { version: 1, status: "ready", accountId: "a", mode: "new", draftId: null, sourceMessageId: null, createdAtMs: Date.now(), updatedAtMs: Date.now() }, "sent", null, ["Check Sent. Do not send it again."]);
    window.dispatchEvent(new StorageEvent("storage", { key: DETACHED_COMPOSE_EVENT_STORAGE_KEY, newValue: window.localStorage.getItem(DETACHED_COMPOSE_EVENT_STORAGE_KEY) }));
  });
  expect(view.getByText("Email sent · Synthetic mailbox A")).toBeTruthy();
  expect(readDetachedComposeWarnings().length).toBe(1);
  // An unrelated event replaces the broadcast slot, without deleting the receipt.
  notifyDetachedComposeOutcome("handoff-b", { version: 1, status: "ready", accountId: "b", mode: "new", draftId: null, sourceMessageId: null, createdAtMs: Date.now(), updatedAtMs: Date.now() }, "sent", null);
  view.unmount();
  const reopened = render(<Harness />);
  expect(reopened.getByText("Email sent · Synthetic mailbox A")).toBeTruthy();
  fireEvent.click(reopened.getByRole("button", { name: "Dismiss notification" }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 180)); });
  expect(readDetachedComposeWarnings()).toEqual([]);
  reopened.unmount();
  const acknowledged = render(<Harness />);
  expect(acknowledged.queryByText("Email sent · Synthetic mailbox A")).toBeNull();
});
