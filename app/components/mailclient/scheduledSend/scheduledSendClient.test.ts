import { expect, test } from "bun:test";
import { cancelDraftSchedule, releaseDraftScheduleForEdit } from "./scheduledSendClient";

test("undo of an old schedule only cancels its id, never its replacement", async () => {
  const calls: string[] = [];
  const result = await cancelDraftSchedule(async input => {
    calls.push(String(input));
    return Response.json({}, { status: 404 });
  }, "synthetic-account", { id: "old", draftId: "draft" });
  expect(result).toEqual({ ok: true });
  expect(calls).toEqual(["/api/accounts/synthetic-account/drafts/scheduled/old/cancel"]);
});

test("opening a draft reads and cancels its current schedule; busy prevents opening", async () => {
  for (const status of ["queued", "sending"] as const) {
    const calls: string[] = [];
    const result = await releaseDraftScheduleForEdit(async (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${input}`);
      return Response.json(init?.method === "POST" ? { draftId: "draft" } : {
        scheduledSends: [{ id: "new", draftId: "draft", status }]
      });
    }, "synthetic-account", "draft");
    expect(result).toEqual(status === "sending" ? { ok: false, reason: "busy" } : { ok: true });
    expect(calls).toHaveLength(status === "sending" ? 1 : 2);
    if (status === "queued") expect(calls[1]).toBe("POST /api/accounts/synthetic-account/drafts/scheduled/new/cancel");
  }
});

test("scheduling refusals map to catalogue keys, including unknown server errors", async () => {
  const { readScheduledSendRefusal } = await import("./scheduledSendClient");
  for (const [status, code, key] of [[409, "scheduled_send_draft_deleted", "notInDrafts"], [400, "send_at_too_soon", "errors.tooSoon"],
    [409, "scheduled_send_invite", "inviteUnsupported"], [404, undefined, "draftMissing"], [500, undefined, "failed"]] as const) {
    expect(await readScheduledSendRefusal(Response.json({ code, message: "English server detail" }, { status }))).toBe(key);
  }
});
