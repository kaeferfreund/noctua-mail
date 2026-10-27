import { describe, expect, test } from "bun:test";
import { buildMessageCopyText } from "./messageCopyText";

const labels = { from: "Von", to: "An", cc: "Cc", date: "Datum", subject: "Betreff", attachments: "Anhänge" };
const message = { from: "Erika <erika@example.test>", to: "team@example.test", subject: "Unterlagen", body: "Hallo,\r\nanbei.\r\n" };

describe("buildMessageCopyText", () => {
  test("headers, blank line, body and the attachment names; inline images left out", () => {
    expect(buildMessageCopyText({ ...message, cc: "max@example.test", attachments: [
      { id: "a", filename: "Angebot.pdf", contentType: "application/pdf", size: 1, inline: false },
      { id: "b", filename: "logo.png", contentType: "image/png", size: 1, inline: true }
    ] }, { labels, date: "27.10.2026, 09:00" })).toBe(
      "Von: Erika <erika@example.test>\nAn: team@example.test\nCc: max@example.test\nDatum: 27.10.2026, 09:00\nBetreff: Unterlagen\n\n"
      + "Hallo,\nanbei.\n\nAnhänge:\n- Angebot.pdf");
  });

  test("no Cc line without Cc; HTML-only mail as plain text", () => {
    expect(buildMessageCopyText({ ...message, cc: " ", body: "", htmlBody: "<p>Das passt.</p><p>Gruß</p>" }, { labels, date: "heute" }))
      .toBe("Von: Erika <erika@example.test>\nAn: team@example.test\nDatum: heute\nBetreff: Unterlagen\n\nDas passt.\nGruß");
  });
});
