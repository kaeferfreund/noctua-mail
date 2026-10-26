import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { NoticeInput } from "../types";
import type { ScheduledSendView } from "@/lib/scheduledSendView";
import { useScheduledSendControls } from "./useScheduledSends";

afterEach(cleanup);
const row: ScheduledSendView = { id: "s", draftId: "d", sendAt: Date.UTC(2026, 10, 1, 8), status: "queued",
  attempts: 0, lastError: null, scheduledByUserId: "synthetic" };

test("undo cancellation stays successful and gives a clear hint when draft reload fails", async () => {
  const notices: NoticeInput[] = [], errors: string[] = [];
  const input: Parameters<typeof useScheduledSendControls>[0] = {
    accountId: "a", enabled: true, locale: "de",
    apiFetch: async (_input, init) => Response.json(init?.method === "POST" ? { draftId: "d" } : { scheduledSends: [] }),
    pushNotice: notice => notices.push(notice), reportError: text => errors.push(text), readErrorMessage: async () => "",
    loadDraft: async () => { throw new Error("synthetic reload failure"); },
    editDraft: () => { throw new Error("no draft to edit"); }, sendDraft: async () => {}
  };
  const { result } = renderHook(() => useScheduledSendControls(input), { wrapper: ({ children }) => <I18nTestProvider locale="de">{children}</I18nTestProvider> });
  act(() => result.current.onScheduledSend({ scheduledSend: row, subject: "Synthetic" }));
  await act(async () => { await notices[0].onAction?.(); });
  expect(errors).toEqual(["Die Planung wurde aufgehoben. Der Entwurf konnte nicht geöffnet werden. Öffne ihn im Ordner „Entwürfe“."]);
});

test("opening the planning dialog refreshes and shows the existing schedule time", async () => {
  const { waitFor } = await import("@testing-library/react");
  function noop() {}
  const input: Parameters<typeof useScheduledSendControls>[0] = {
    accountId: "a", enabled: true, locale: "de",
    apiFetch: async () => Response.json({ scheduledSends: [row] }),
    pushNotice: noop, reportError: noop, readErrorMessage: async () => "", loadDraft: async () => null,
    editDraft: noop, sendDraft: async () => {}
  };
  const { result } = renderHook(() => useScheduledSendControls(input), {
    wrapper: ({ children }) => <I18nTestProvider locale="de">{children}</I18nTestProvider>
  });
  act(() => result.current.controls.schedule?.({ id: "d", accountId: "a", draft: true } as import("@/lib/data").Message));
  await waitFor(() => expect(result.current.scheduleDialog.existingSendAt).toBe(row.sendAt));
  expect(result.current.scheduleDialog.open).toBe(true);
});

test("undo of an already replaced plan does not reopen compose and release the newer plan", async () => {
  const notices: NoticeInput[] = [];
  let reloads = 0, edits = 0;
  const input: Parameters<typeof useScheduledSendControls>[0] = {
    accountId: "a", enabled: true, locale: "de",
    apiFetch: async (_input, init) => init?.method === "POST" ? Response.json({}, { status: 404 })
      : Response.json({ scheduledSends: [{ ...row, id: "newer-plan" }] }),
    pushNotice: notice => notices.push(notice), reportError: () => {}, readErrorMessage: async () => "",
    loadDraft: async () => { reloads++; return null; }, editDraft: () => { edits++; }, sendDraft: async () => {}
  };
  const { result } = renderHook(() => useScheduledSendControls(input), {
    wrapper: ({ children }) => <I18nTestProvider locale="de">{children}</I18nTestProvider>
  });
  act(() => result.current.onScheduledSend({ scheduledSend: row, subject: "Synthetic old plan" }));
  await act(async () => { await notices[0].onAction?.(); });
  expect(reloads).toBe(0);
  expect(edits).toBe(0);
  expect(result.current.controls.byDraftId.get("d")?.id).toBe("newer-plan");
});
