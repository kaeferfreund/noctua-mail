import { expect, test } from "bun:test";
import { validateDraftIdentity } from "./draftIdentity";
import type { Message, SenderIdentity } from "./data";
import { stripIdentityHeader, stripBccHeader } from "./mail/stripBccHeader";
const identity: SenderIdentity = { id: "alias", accountId: "mailbox", email: "alias@example.test", displayName: "Synthetic Alias",
  replyTo: "replies@example.test", enabled: true, isDefault: false, createdBy: null, createdAt: 1, updatedAt: 1 };
const draft = { accountId: "mailbox", from: "Synthetic Alias <alias@example.test>", replyTo: identity.replyTo, senderIdentityId: identity.id } as Message;
const raw = "From: Synthetic Alias <alias@example.test>\r\nReply-To: replies@example.test\r\nX-Noctua-Identity-Id: alias\r\nBcc: blind@example.test\r\n\tfold@example.test\r\nMessage-ID: <synthetic@example.test>\r\n\r\nX-Noctua-Identity-Id: body remains\r\nBcc: body remains";

test("draft identity validates raw headers and strips marker/Bcc only from outer headers", async () => {
  expect((await validateDraftIdentity(raw, draft, [identity])).id).toBe(identity.id);
  const wire = stripBccHeader(stripIdentityHeader(Buffer.from(raw)));
  expect(wire.toString()).not.toContain("blind@example.test");
  expect(wire.toString()).not.toContain("fold@example.test");
  expect(wire.toString().split("\r\n\r\n")[0]).not.toContain("X-Noctua");
  expect(wire.toString().split("\r\n\r\n")[1]).toBe(raw.split("\r\n\r\n")[1]);
});
for (const [name, source, metadata] of [
  ["duplicate From", "From: alias@example.test\r\n" + raw, draft],
  ["multiple From addresses", raw.replace("Synthetic Alias <alias@example.test>", "Synthetic Alias <alias@example.test>, other@example.test"), draft],
  ["marker/address mismatch", raw.replace("<alias@example.test>", "<other@example.test>"), draft],
  ["metadata/address mismatch", raw, { ...draft, from: "other@example.test" }],
  ["metadata/marker mismatch", raw, { ...draft, senderIdentityId: "other" }],
  ["duplicate marker", "X-Noctua-Identity-Id: alias\r\n" + raw, draft],
  ["conflicting Sender", "Sender: other@example.test\r\n" + raw, draft],
  ["Resent-From", "Resent-From: alias@example.test\r\n" + raw, draft],
  ["Resent-Sender", "Resent-Sender: other@example.test\r\n" + raw, draft],
  ["duplicate Reply-To", "Reply-To: replies@example.test\r\n" + raw, draft],
  ["Reply-To mismatch", raw.replace("Reply-To: replies@example.test", "Reply-To: other@example.test"), draft],
  ["changed display name", raw.replace("Synthetic Alias", "Old Alias"), draft],
  ["metadata Reply-To mismatch", raw, { ...draft, replyTo: "other@example.test" }]
] as const) {
  test(`draft rejects ${name}`, async () => {
    expect(validateDraftIdentity(source, metadata, [identity])).rejects.toMatchObject({ code: "draft_identity_changed", status: 409 });
  });
}
test("legacy known From resolves without marker, unknown/disabled/foreign identities never fall back", async () => {
  const legacy = raw.replace("X-Noctua-Identity-Id: alias\r\n", "");
  expect((await validateDraftIdentity(legacy, { ...draft, senderIdentityId: undefined }, [identity])).id).toBe(identity.id);
  for (const candidates of [[], [{ ...identity, enabled: false }], [{ ...identity, accountId: "foreign" }]]) {
    await expect(validateDraftIdentity(raw, draft, candidates)).rejects.toMatchObject({ code: "identity_unavailable", status: 409 });
  }
  await expect(validateDraftIdentity(legacy.replaceAll("alias@example.test", "unknown@example.test"), { ...draft, senderIdentityId: undefined, from: "unknown@example.test" }, [identity])).rejects.toMatchObject({ code: "identity_unavailable" });
});
