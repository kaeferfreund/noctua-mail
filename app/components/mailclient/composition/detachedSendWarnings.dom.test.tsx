import { afterEach, expect, it } from "bun:test";
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
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
    const warnings = useDetachedSendWarnings(accounts, "current-user");
    return <><p>Selected mailbox B</p><InAppNoticeStack state={{ inAppNotices: warnings.notices }} actions={{ onOpenNotice: () => {}, onDismissNotice: warnings.dismiss }} /></>;
  }
  const view = render(<Harness />);
  act(() => {
    notifyDetachedComposeOutcome("handoff-a", { version: 1, status: "ready", ownerUserId: "current-user", accountId: "a", mode: "new", draftId: null, sourceMessageId: null, createdAtMs: Date.now(), updatedAtMs: Date.now() }, "sent", null, ["Check Sent. Do not send it again."]);
    window.dispatchEvent(new StorageEvent("storage", { key: DETACHED_COMPOSE_EVENT_STORAGE_KEY, newValue: window.localStorage.getItem(DETACHED_COMPOSE_EVENT_STORAGE_KEY) }));
  });
  expect(view.getByText("Email sent · Synthetic mailbox A")).toBeTruthy();
  expect(readDetachedComposeWarnings("current-user", ["a", "b"]).length).toBe(1);
  // An unrelated event replaces the broadcast slot, without deleting the receipt.
  notifyDetachedComposeOutcome("handoff-b", { version: 1, status: "ready", ownerUserId: "current-user", accountId: "b", mode: "new", draftId: null, sourceMessageId: null, createdAtMs: Date.now(), updatedAtMs: Date.now() }, "sent", null);
  view.unmount();
  const reopened = render(<Harness />);
  expect(reopened.getByText("Email sent · Synthetic mailbox A")).toBeTruthy();
  fireEvent.click(reopened.getByRole("button", { name: "Dismiss notification" }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 180)); });
  expect(readDetachedComposeWarnings("current-user", ["a", "b"])).toEqual([]);
  reopened.unmount();
  const acknowledged = render(<Harness />);
  expect(acknowledged.queryByText("Email sent · Synthetic mailbox A")).toBeNull();
});

it("a fresh login cannot see another user's receipts, even for a shared accessible mailbox", () => {
  notifyDetachedComposeOutcome("handoff-a", { version: 1, status: "ready", ownerUserId: "previous-user", accountId: "a", mode: "new", draftId: null, sourceMessageId: null, createdAtMs: Date.now(), updatedAtMs: Date.now() }, "sent", null, ["Synthetic previous user warning."]);
  const hook = renderHook(() => useDetachedSendWarnings([{ id: "a" }, { id: "b" }], "current-user"));
  expect(hook.result.current.notices).toEqual([]);
});

it("a fresh login cannot see receipts for an inaccessible mailbox", () => {
  notifyDetachedComposeOutcome("handoff-a", { version: 1, status: "ready", ownerUserId: "current-user", accountId: "a", mode: "new", draftId: null, sourceMessageId: null, createdAtMs: Date.now(), updatedAtMs: Date.now() }, "sent", null, ["Synthetic inaccessible mailbox warning."]);
  const hook = renderHook(() => useDetachedSendWarnings([{ id: "b" }], "current-user"));
  expect(hook.result.current.notices).toEqual([]);
});

it("clears in-memory receipts on logout/login and access revocation and ignores late previous-user events", () => {
  const handoff = { version: 1 as const, status: "ready" as const, ownerUserId: "previous-user", accountId: "a", mode: "new" as const, draftId: null, sourceMessageId: null, createdAtMs: Date.now(), updatedAtMs: Date.now() };
  notifyDetachedComposeOutcome("previous-handoff", handoff, "sent", null, ["Previous user's synthetic warning."]);
  const hook = renderHook(({ userId, accounts }) => useDetachedSendWarnings(accounts, userId), {
    initialProps: { userId: "previous-user" as string | null, accounts: [{ id: "a" }] },
  });
  expect(hook.result.current.notices).toHaveLength(1);
  hook.rerender({ userId: null, accounts: [{ id: "a" }] });
  expect(hook.result.current.notices).toEqual([]);
  hook.rerender({ userId: "current-user", accounts: [{ id: "a" }] });
  expect(hook.result.current.notices).toEqual([]);
  act(() => {
    notifyDetachedComposeOutcome("late-previous-handoff", handoff, "sent", null, ["Late previous-user warning."]);
    window.dispatchEvent(new StorageEvent("storage", { key: DETACHED_COMPOSE_EVENT_STORAGE_KEY }));
  });
  expect(hook.result.current.notices).toEqual([]);
  act(() => {
    notifyDetachedComposeOutcome("current-handoff", { ...handoff, ownerUserId: "current-user" }, "sent", null, ["Current user's synthetic recovery guidance."]);
    window.dispatchEvent(new StorageEvent("storage", { key: DETACHED_COMPOSE_EVENT_STORAGE_KEY }));
  });
  expect(hook.result.current.notices).toHaveLength(1);
  hook.rerender({ userId: "current-user", accounts: [{ id: "b" }] });
  expect(hook.result.current.notices).toEqual([]);
});

it("ignores legacy receipts with no authenticated owner", () => {
  window.localStorage.setItem("noctua:detached-compose-warning:legacy", JSON.stringify({ version: 1, eventId: "legacy", handoffId: "legacy-handoff", accountId: "a", outcome: "sent", mode: "new", draftId: null, sourceMessageId: null, createdAtMs: Date.now(), warnings: ["Legacy synthetic warning."] }));
  const hook = renderHook(() => useDetachedSendWarnings([{ id: "a" }], "current-user"));
  expect(hook.result.current.notices).toEqual([]);
});

it("renders persistent recovery guidance with the wrapping description variant", () => {
  const guidance = "Check the Sent folder before sending again. " + "Synthetic recovery details. ".repeat(12);
  notifyDetachedComposeOutcome("long-warning", { version: 1, status: "ready", ownerUserId: "current-user", accountId: "a", mode: "new", draftId: null, sourceMessageId: null, createdAtMs: Date.now(), updatedAtMs: Date.now() }, "sent", null, [guidance]);
  function Harness() {
    const warnings = useDetachedSendWarnings([{ id: "a" }], "current-user");
    return <InAppNoticeStack state={{ inAppNotices: warnings.notices }} actions={{ onOpenNotice: () => {}, onDismissNotice: warnings.dismiss }} />;
  }
  const view = render(<Harness />);
  const description = view.container.querySelector(".notice-description")!;
  expect(description.textContent).toBe(guidance + " Delivery succeeded. Do not send it again.");
  expect(description.classList.contains("notice-description-wrap")).toBe(true);
});
