import { expect, it } from "bun:test";
import { getSendWarnings } from "./sendOutcome";
it("keeps both delivered warnings for direct, draft and calendar responses", () => {
  expect(getSendWarnings({ sentCopy: "appended" })).toEqual([]);
  expect(getSendWarnings({ sentCopy: "failed", sentCopyWarning: "Sent failed", postSendWarning: "Index delayed" })).toEqual(["Sent failed", "Index delayed", "Check the Sent folder. If the copy is missing, contact a mailbox manager. Do not send it again."]);
  expect(getSendWarnings({ sentCopy: "no-sent-folder", postSendWarning: "Index delayed" })).toEqual(["Email sent, but the Sent copy could not be saved. Do not send it again.", "Index delayed", "Ask a mailbox manager to configure the Sent folder (managers: configure it in mailbox settings). Do not send it again."]);
});
