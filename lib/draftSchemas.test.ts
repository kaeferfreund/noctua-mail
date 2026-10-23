import { expect, test } from "bun:test";
import { saveDraftSchema } from "./draftSchemas";
import { buildDraftSavePayload } from "@/app/components/mailclient/composition/draftSaveUtils";

test("draft REST schema accepts the existing compose builder's attachment metadata", () => {
  const payload = buildDraftSavePayload({ to: "recipient@example.test", cc: "", bcc: "", subject: "Synthetic", identityId: "alias",
    composeQuotedHtmlEdited: false, composeReplyHeaders: null }, { text: "Synthetic", markdown: undefined, html: undefined, composeFormat: "text",
    attachments: [{ id: "attachment", filename: "synthetic.txt", contentType: "text/plain", size: 9, inline: false,
      dataUrl: "data:text/plain;base64,U3ludGhldGlj", url: "blob:synthetic" }] });
  expect(saveDraftSchema.safeParse(payload).success).toBe(true);
  expect(saveDraftSchema.safeParse({ ...payload, from: "forged@example.test" }).success).toBe(false);
});
