import { expect, test } from "bun:test";
import { createScheduledSendFixture } from "./testFixtures/scheduledSendDrafts";
import { saveMessageSource, getMessageSource } from "./storage";
import { assertSchedulableDraft, attemptScheduledSend } from "./scheduledSend";
import { sendDraftForAccount } from "./drafts";
import { claimDueScheduledSends, createScheduledSend, processScheduleOwner } from "./db/scheduledSends";
import { scheduledDraftFingerprint } from "./scheduledSendFingerprint";

test("fingerprint ignores address presentation, case, ordering and absent empty fields", () => {
  const draft = { messageId: "<synthetic@example.test>", from: '"Synthetic Sender" <SENDER@example.test>',
    to: '"Synthetic Two" <two@example.test>, One <ONE@example.test>', cc: undefined, bcc: undefined };
  expect(scheduledDraftFingerprint(draft, "identical MIME source")).toBe(scheduledDraftFingerprint({
    ...draft, from: "Synthetic Sender <sender@example.test>", to: "one@example.test, two@example.test", cc: "", bcc: ""
  }, "identical MIME source"));
  const withCopies = { ...draft, cc: "second@example.test, first@example.test", bcc: "hidden@example.test" };
  expect(scheduledDraftFingerprint(withCopies, "source")).toBe(scheduledDraftFingerprint({
    ...withCopies, cc: 'First <FIRST@example.test>, "Second" <SECOND@example.test>', bcc: "Hidden <HIDDEN@example.test>"
  }, "source"));
  for (const field of ["from", "to", "cc", "bcc"] as const) {
    expect(scheduledDraftFingerprint({ ...withCopies, [field]: "changed@example.test" }, "source"))
      .not.toBe(scheduledDraftFingerprint(withCopies, "source"));
  }
  expect(scheduledDraftFingerprint(draft, "changed source")).not.toBe(scheduledDraftFingerprint(draft, "source"));
  expect(scheduledDraftFingerprint({ ...draft, messageId: "<changed@example.test>" }, "source"))
    .not.toBe(scheduledDraftFingerprint(draft, "source"));
});

for (const changed of ["source", "envelope", "trash", "legacy"] as const) test(`scheduled ${changed} change aborts before SMTP with a visible reason`, async () => {
  const f = await createScheduledSendFixture({ smtp: { host: "127.0.0.1", port: 1, secure: false, user: "synthetic", password: "synthetic" } });
  const draftId = await f.seedDraft();
  const { draft, sourceFingerprint } = await assertSchedulableDraft(f.accountId, draftId);
  const row = await createScheduledSend({ accountId: f.accountId, userId: f.user.id, draftId,
    sendAt: Date.now() - 1, sourceFingerprint: changed === "legacy" ? undefined : sourceFingerprint });
  const claimed = (await claimDueScheduledSends(processScheduleOwner(), Date.now(), 1000)).find(item => item.id === row.id)!;
  if (changed === "source") await saveMessageSource(f.accountId, draftId, `${await getMessageSource(f.accountId, draftId)}Changed synthetic content`);
  if (changed === "envelope") await f.db.upsertMessages(f.accountId, null, [{ ...draft, to: "changed@example.test" }]);
  if (changed === "trash") await f.db.updateMessageFolder(f.accountId, draftId, `${f.accountId}:INBOX`, "INBOX", null);
  // Real preflight + real send path. The synthetic account has no reachable SMTP service;
  // an accidental network attempt cannot produce the expected cancellation reason.
  expect(await attemptScheduledSend(claimed)).toEqual({ status: "cancelled", reason: changed === "trash" ? "draft_deleted" : "draft_changed" });
  // Exercise the second load, bypassing preflight, too: the exact bytes to relay are checked.
  await expect(sendDraftForAccount({ account: (await f.db.getAccountById(f.accountId))!,
    accountId: f.accountId, clientId: "synthetic", draftId, actor: { userId: f.user.id, clientId: "synthetic" },
    scheduledFingerprint: changed === "legacy" ? null : sourceFingerprint })).rejects.toMatchObject({ code: changed === "trash" ? "scheduled_send_draft_deleted" : "scheduled_send_draft_changed" });
});
