import { describe, expect, test } from "bun:test";
import { NOTICE_TIMEOUTS, NOTICE_TIMEOUTS_NO_UNDO } from "./constants";
import { resolveInAppNoticeTimeoutMs } from "./useInAppNotices";

describe("resolveInAppNoticeTimeoutMs", () => {
  test("keeps the full timeout for undo actions regardless of translated label", () => {
    const timeoutMs = resolveInAppNoticeTimeoutMs({
      type: "success",
      title: "Event deleted.",
      actionKind: "undo",
      actionLabel: "Rückgängig",
      onAction: () => undefined
    });

    expect(timeoutMs).toBe(NOTICE_TIMEOUTS.success);
  });

  test("caps notices without undo actions to the no-undo timeout", () => {
    const timeoutMs = resolveInAppNoticeTimeoutMs({
      type: "success",
      title: "Event restored."
    });

    expect(timeoutMs).toBe(NOTICE_TIMEOUTS_NO_UNDO.success);
  });
});

test("a label alone never opts into undo behavior", () => {
  expect(resolveInAppNoticeTimeoutMs({ type: "success", title: "Synthetic", actionLabel: "Undo", onAction() {} }))
    .toBe(NOTICE_TIMEOUTS_NO_UNDO.success);
});

test("actual calendar delete producer emits semantic undo, keeps 6500 ms and restores the event", async () => {
  // Execute this small producer in isolation without importing FullCalendar or
  // mocking shared React/notice modules. A label-only producer must fail here.
  const source = await Bun.file(new URL("../calendar/CalendarEventBrowser.tsx", import.meta.url)).text();
  const producer = source.slice(source.indexOf("const handleEventDeleted ="), source.indexOf("\n  const content ="));
  expect(producer).toContain("pushNotice({");
  const javascript = new Bun.Transpiler({ loader: "tsx" }).transformSync(producer);
  const notices: Parameters<typeof resolveInAppNoticeTimeoutMs>[0][] = [];
  const restored: unknown[] = [];
  const invoke = new Function("pushNotice", "handleBack", "DELETE_TITLES", "handleRestoreDeletedEvent", "NOTICE_TIMEOUTS",
    `${javascript}\nreturn handleEventDeleted;`)(
      (notice: Parameters<typeof resolveInAppNoticeTimeoutMs>[0]) => notices.push(notice), () => {},
      { series: "Event deleted." }, (...args: unknown[]) => restored.push(args), NOTICE_TIMEOUTS
    );
  const event = { id: "synthetic-calendar-event", summary: "Synthetic calendar event" };
  invoke({ event, scope: "series" });
  expect(notices).toHaveLength(1);
  expect(notices[0].actionKind).toBe("undo");
  expect(notices[0].actionLabel).toBeUndefined();
  expect(resolveInAppNoticeTimeoutMs(notices[0])).toBe(6500);
  notices[0].onAction?.();
  expect(restored).toEqual([[event, "series"]]);
});
