import { expect, test } from "bun:test";
import { createCollabFixture } from "./testThreadCollabHarness";
import { buildDraftUpdateInput } from "./draftEdit";
import { saveAttachmentData, saveMessageSource } from "./storage";
import { COMPOSE_INVITE_HEADER, encodeComposeInviteHeader } from "./composeInviteMetadata";
import { buildAccountAttachmentPath } from "./accountApiPaths";
import { FORWARDED_MESSAGE_MARKERS } from "./html";
import { resolveComposeHtml } from "./mail/composePayload";

// No transport or database mocks: use real synthetic local storage.
test("appendBody uses Markdown source like the UI editor and preserves a quoted original", async () => {
  const f = await createCollabFixture();
  const message = f.message("<markdown@example.test>", { xComposeFormat: "markdown", body: "**Authored**",
    htmlBody: '<p><strong>Authored</strong></p><div id="noctua-quoted-html"><blockquote>Original</blockquote></div>' });
  const input = await buildDraftUpdateInput(f.accountId, message, { appendBody: "*Addition* [link](https://example.test)" });
  expect(input.markdown).toBe("**Authored**\n\n*Addition* [link](https://example.test)");
  const html = await resolveComposeHtml(input);
  expect(html).toContain("<em>Addition</em>");
  expect(html).toContain('href="https://example.test"');
  expect(html).toContain("Original");
  expect(html!.indexOf("<em>Addition</em>")).toBeLessThan(html!.indexOf("Original"));
});

test("appendBody goes above the original in text replies and forwards", async () => {
  const f = await createCollabFixture();
  for (const quote of ["On Monday, Sender wrote:\n> Original", `${FORWARDED_MESSAGE_MARKERS.en}\nOriginal`]) {
    const message = f.message("<reply@example.test>", { xComposeFormat: "text", body: `Authored\n\n${quote}` });
    const input = await buildDraftUpdateInput(f.accountId, message, { appendBody: "Addition" });
    expect(input.text).toBe(`Authored\n\nAddition\n\n${quote}`);
  }
});

test("missing body and unavailable attachments fail with 409 instead of dropping content", async () => {
  const f = await createCollabFixture();
  const message = f.message("<missing@example.test>", { contentState: "missing" });
  await expect(buildDraftUpdateInput(f.accountId, message, { subject: "New" })).rejects.toMatchObject({ status: 409 });
  expect((await buildDraftUpdateInput(f.accountId, message, { text: "Replacement" })).text).toBe("Replacement");
  message.attachments = [{ id: "absent", filename: "missing.txt", contentType: "text/plain", size: 7, inline: false }];
  await expect(buildDraftUpdateInput(f.accountId, message, { text: "Replacement" })).rejects.toMatchObject({ status: 409 });
});

test("draft edits preserve invite metadata and reply/forward headers", async () => {
  const f = await createCollabFixture();
  const message = f.message("<invite@example.test>", { inReplyTo: "<original@example.test>", references: ["<root@example.test>"],
    xForwardedMessageId: "<forward@example.test>" });
  const invite = { start: "2026-11-01T10:00:00Z", end: "2026-11-01T11:00:00Z", allDay: false, location: "Synthetic room" };
  await saveMessageSource(f.accountId, message.id, `${COMPOSE_INVITE_HEADER}: ${encodeComposeInviteHeader(invite)}\r\n\r\nBody`);
  expect(await buildDraftUpdateInput(f.accountId, message, { subject: "Changed" })).toMatchObject({ invite, inReplyTo: message.inReplyTo,
    references: message.references, xForwardedMessageId: message.xForwardedMessageId });
});

test("inline attachment URLs become cid references, including images without a stored cid", async () => {
  const f = await createCollabFixture();
  for (const cid of ["image@example.test", undefined]) {
    const message = f.message("<image@example.test>", { xComposeFormat: "html" });
    const url = buildAccountAttachmentPath(f.accountId, message.id, "old-image");
    message.htmlBody = `<p>Authored</p><img src="${url}">`;
    message.attachments = [{ id: "old-image", filename: "image.png", contentType: "image/png", size: 5, inline: true, cid, url }];
    await saveAttachmentData(f.accountId, message.id, "old-image", Buffer.from("image"));
    const input = await buildDraftUpdateInput(f.accountId, message, { subject: "Updated" });
    const attachment = input.attachments![0]!;
    expect(attachment.cid).toBeTruthy();
    if (cid) expect(attachment.cid).toBe(cid);
    expect(input.html).toContain(`src="cid:${attachment.cid}"`);
    expect(input.html).not.toContain(url);
    expect(attachment.dataUrl).toEndWith(Buffer.from("image").toString("base64"));
    const markdown = await buildDraftUpdateInput(f.accountId, { ...message, xComposeFormat: "markdown", body: `![Image](${url})` }, { subject: "Updated" });
    expect(markdown.markdown).toContain(`cid:${markdown.attachments![0]!.cid}`);
    expect(markdown.text).toBe(markdown.markdown!);
    expect(markdown.markdown).not.toContain(url);
  }
});

test("expectedUpdatedAt rejects a stale patch and passes the matching version to save", async () => {
  const f = await createCollabFixture();
  const message = f.message("<version@example.test>");
  await expect(buildDraftUpdateInput(f.accountId, message, { expectedUpdatedAt: message.dateValue - 1, subject: "Stale" }))
    .rejects.toMatchObject({ status: 409, code: "draft_changed" });
  expect((await buildDraftUpdateInput(f.accountId, message, { expectedUpdatedAt: message.dateValue, subject: "New" })).expectedUpdatedAt).toBe(message.dateValue);
});
