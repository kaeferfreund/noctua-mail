import { describe, expect, test } from "bun:test";
import { buildInviteStatusText } from "./EventInviteStatusRow";

describe("buildInviteStatusText", () => {
  test("includes a readable reason when the event series is missing", () => {
    expect(
      buildInviteStatusText({
        actionType: "update",
        processed: false,
        unprocessedReason: "event_series_not_found"
      })
    ).toBe("Update not processed (event series not found)");
  });

  test("explains an invite that was kept because its sender is not the organizer", () => {
    const state = { actionType: "cancellation", processed: false, unprocessedReason: "organizer_mismatch" } as const;
    expect(buildInviteStatusText(state)).toBe("Cancellation not processed (sender is not the event organizer)");
    expect(buildInviteStatusText(state, undefined, { organizerMismatch: "Absender ist nicht der Organisator des Termins" })).toBe(
      "Cancellation not processed (Absender ist nicht der Organisator des Termins)"
    );
  });
});
