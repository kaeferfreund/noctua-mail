import { afterEach, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import InAppNoticeStack, { type InAppNotice } from "../InAppNoticeStack";
import { presentDraftSendOutcome } from "./sendOutcome";
afterEach(cleanup);
it("renders accepted draft warnings and forbids an optimistic Sent row when the copy failed", () => {
  const notices: InAppNotice[] = [];
  const result = presentDraftSendOutcome({ sentCopy: "failed", sentCopyWarning: "Sent copy unavailable.", postSendWarning: "Reply flags refresh delayed." }, "Synthetic subject", notice => notices.push({ ...notice, id: String(notices.length) }));
  const view = render(<InAppNoticeStack state={{ inAppNotices: notices }} actions={{ onOpenNotice: () => {}, onDismissNotice: () => {} }} />);
  expect(view.getByText("Draft sent.")).toBeTruthy();
  expect(view.getByText("Sent copy unavailable.")).toBeTruthy();
  expect(view.getByText("Reply flags refresh delayed.")).toBeTruthy();
  expect(result.canCreateSentRow).toBe(false);
  expect(presentDraftSendOutcome({ sentCopy: "appended" }, "Synthetic subject", () => {}).canCreateSentRow).toBe(true);
  expect(presentDraftSendOutcome({ sentCopy: "no-sent-folder" }, "Synthetic subject", () => {}).canCreateSentRow).toBe(false);
});
