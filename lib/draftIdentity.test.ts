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

// Default identities use their address as display name; the saved draft then carries
// `From: "a@…" <a@…>`, which the MIME parser reads without a name.
test("a display name equal to the address, or none, still matches its identity", async () => {
  const own: SenderIdentity = { ...identity, id: "own", email: "own@example.test", replyTo: undefined, isDefault: true };
  const ownDraft = { accountId: "mailbox", from: "own@example.test", senderIdentityId: "own" } as Message;
  const source = (from: string) => `X-Noctua-Identity-Id: own\r\nFrom: ${from}\r\nMessage-ID: <own@example.test>\r\n\r\nBody`;
  for (const [displayName, from] of [
    ["own@example.test", '"own@example.test" <own@example.test>'],
    ["Own@Example.test", '"Own@Example.test" <own@example.test>'],
    ["", "own@example.test"],
    ["", '"own@example.test" <own@example.test>']
  ] as const) {
    expect((await validateDraftIdentity(source(from), ownDraft, [{ ...own, displayName }])).id).toBe("own");
  }
  for (const [displayName, from] of [
    ["own@example.test", "Someone Else <own@example.test>"],
    ["", "Someone Else <own@example.test>"],
    ["Synthetic Own", '"own@example.test" <own@example.test>'],
    ["Synthetic Own", "own@example.test"],
    ["own@example.test", '"other@example.test" <own@example.test>']
  ] as const) {
    await expect(validateDraftIdentity(source(from), ownDraft, [{ ...own, displayName }])).rejects.toMatchObject({ code: "draft_identity_changed", status: 409 });
  }
  // A foreign address or a different Sender stays refused for a default identity too.
  await expect(validateDraftIdentity(source('"own@example.test" <other@example.test>'), ownDraft, [{ ...own, displayName: own.email }]))
    .rejects.toMatchObject({ code: "draft_identity_changed", status: 409 });
  await expect(validateDraftIdentity(`Sender: other@example.test\r\n${source('"own@example.test" <own@example.test>')}`, ownDraft, [{ ...own, displayName: own.email }]))
    .rejects.toMatchObject({ code: "draft_identity_changed", status: 409 });
});

// Header parsers trim quoted names; legacy identities may carry extra spaces.
test("display name whitespace differences on either side still match, other names stay refused", async () => {
  const source = (name: string) => raw.replace("Synthetic Alias <alias@example.test>", `"${name}" <alias@example.test>`);
  for (const [displayName, header] of [
    ["Synthetic Alias ", "Synthetic Alias"],
    [" Synthetic Alias", "Synthetic Alias"],
    ["Synthetic  Alias", "Synthetic Alias"],
    ["Synthetic Alias", "Synthetic Alias "],
    ["Synthetic Alias", " Synthetic Alias"],
    ["Synthetic Alias", "Synthetic  Alias"],
    [" Synthetic   Alias ", "Synthetic  Alias  "]
  ] as const) {
    expect((await validateDraftIdentity(source(header), draft, [{ ...identity, displayName }])).id).toBe(identity.id);
  }
  for (const [displayName, header] of [
    ["Synthetic Alias ", "SyntheticAlias"],
    ["Synthetic Alias", "Synthetic Alias2"],
    ["  ", "Synthetic Alias"],
    ["Synthetic Alias ", "alias@example.test"]
  ] as const) {
    await expect(validateDraftIdentity(source(header), draft, [{ ...identity, displayName }])).rejects.toMatchObject({ code: "draft_identity_changed", status: 409 });
  }
  const own: SenderIdentity = { ...identity, id: "own", email: "own@example.test", replyTo: undefined, displayName: " own@example.test " };
  const ownRaw = "X-Noctua-Identity-Id: own\r\nFrom: own@example.test\r\nMessage-ID: <own@example.test>\r\n\r\nBody";
  expect((await validateDraftIdentity(ownRaw, { accountId: "mailbox", from: "own@example.test", senderIdentityId: "own" } as Message, [own])).id).toBe("own");
});

for (const [label, name] of [
  ["CR", "Synthetic\rAlias"], ["LF", "Synthetic\nAlias"], ["TAB", "Synthetic\tAlias"],
  ["NBSP", "Synthetic\u00a0Alias"], ["BOM", "Synthetic\ufeffAlias"],
  ["C1", "Synthetic\u0085Alias"], ["bidi", "Synthetic\u202eAlias"],
  ["oversized spaces", `Synthetic${" ".repeat(256)}Alias`]
]) test(`draft refuses RFC 2047 decoded ${label}`, async () => {
  const encoded = `=?UTF-8?B?${Buffer.from(name).toString("base64")}?=`;
  await expect(validateDraftIdentity(raw.replace("Synthetic Alias", encoded), draft, [identity]))
    .rejects.toMatchObject({ code: "draft_identity_changed", status: 409 });
});
