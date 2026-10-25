import { afterEach, expect, jest, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { getMessageListDateDisplay, useMessageListRelativeDayLabels } from "./messageDateDisplay";

// 2026-10-24 10:00 and 23:59:30 in Europe/Berlin (CEST, UTC+2).
const messageAt = Date.UTC(2026, 9, 24, 8, 0);
const beforeMidnight = Date.UTC(2026, 9, 24, 21, 59, 30);

function DateCell() {
  const labels = useMessageListRelativeDayLabels();
  return <span data-testid="date">{getMessageListDateDisplay(messageAt, "", undefined, "en", labels).text}</span>;
}

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

test("the list date label switches from Today to Yesterday at the next local midnight", () => {
  jest.useFakeTimers({ now: beforeMidnight });
  const view = render(<DateCell />);
  expect(view.getByTestId("date").textContent).toStartWith("Today");
  act(() => { jest.advanceTimersByTime(29_000); });
  expect(view.getByTestId("date").textContent).toStartWith("Today");
  act(() => { jest.advanceTimersByTime(1_000); });
  expect(view.getByTestId("date").textContent).toStartWith("Yesterday");
});

test("one timer serves every row and is cleared when the list unmounts", () => {
  jest.useFakeTimers({ now: beforeMidnight });
  const view = render(<><DateCell /><DateCell /><DateCell /></>);
  expect(jest.getTimerCount()).toBe(1);
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});
