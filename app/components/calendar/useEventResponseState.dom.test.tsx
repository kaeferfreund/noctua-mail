import { afterEach, expect, it } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { useEventResponseState } from "./useEventResponseState";
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
it("accepted RSVP with post-send warning closes its dialog and renders a delivered notice without event data", async () => {
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) =>
    new Response(
      JSON.stringify(
        init?.method === "POST"
          ? {
              ok: true,
              sentCopy: "failed",
              sentCopyWarning: "Sent copy unavailable.",
              postSendWarning: "Calendar refresh delayed.",
            }
          : {
              ok: true,
              participation: {
                partstat: "NEEDS-ACTION",
                scope: "series",
                isRecurring: false,
              },
            },
      ),
      { status: 200 },
    )) as typeof fetch;
  function Harness() {
    const [notice, setNotice] = useState("");
    const state = useEventResponseState({
      accountId: "a",
      eventId: "event",
      eventUid: "event@example.test",
      myPartstat: "NEEDS-ACTION",
      replyRequested: true,
      canRespond: true,
      forceOccurrenceResponse: false,
      recurrenceRule: undefined,
      resolvedStartMs: 1,
      responseOccurrenceLabel: "This occurrence",
      onNotice: setNotice,
    });
    return (
      <>
        <button
          onClick={() => {
            state.openResponseDialog();
            state.setDraftPartstat("ACCEPTED");
          }}
        >
          Respond
        </button>
        {state.responseDialogOpen && (
          <div role="dialog">
            <button
              onClick={() => {
                void state.handleRespond();
              }}
            >
              Send RSVP
            </button>
          </div>
        )}
        <output>{state.currentMyPartstat}</output>
        <p role="status" aria-label="Delivery notice">
          {notice}
        </p>
      </>
    );
  }
  const view = render(<Harness />);
  await act(async () => {});
  await act(async () => {
    fireEvent.click(view.getByText("Respond"));
  });
  await act(async () => {
    fireEvent.click(view.getByText("Send RSVP"));
  });
  await waitFor(() => expect(Boolean(view.queryByRole("dialog"))).toBe(false));
  expect(
    view.getByRole("status", { name: "Delivery notice" }).textContent,
  ).toBe("Response sent. Sent copy unavailable. Calendar refresh delayed. Check the Sent folder. If the copy is missing, contact a mailbox manager. Do not send it again.");
  expect(view.getByText("ACCEPTED")).toBeTruthy();
});
