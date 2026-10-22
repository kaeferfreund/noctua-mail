import { ingestedSenderCases, ingestSenderPermissionMessage } from "../testFixtures/ingestedSenders";
import { remoteContentSenderKey, senderAllowsRemoteContent } from "../html/remoteContent";
import { extractPrimaryEmail, canonicalizeMailboxAddress } from "../senderIdentity";
import { resolveMessageAddresses, formatEnvelopeAddresses, formatHeaderAddresses, parseHeaderMap } from "./imap/parser";
import { describe, expect, it } from "bun:test";
import { createRequire } from "module";
import type { Account } from "@/lib/data";
import {
  extractMessageStructureMetadata,
  type ImapBodyStructure
} from "@/lib/mail/imap";

const require = createRequire(import.meta.url);
const { parser } = require("imapflow/lib/handler/imap-handler");
const tools = require("imapflow/lib/tools");

const account: Account = {
  id: "acc-test",
  name: "Test",
  email: "test@example.com",
  avatar: "",
  imap: {
    host: "imap.example.com",
    port: 993,
    secure: true,
    user: "test@example.com",
    password: "secret"
  },
  smtp: {
    host: "smtp.example.com",
    port: 465,
    secure: true,
    user: "test@example.com",
    password: "secret"
  }
};

describe("extractMessageStructureMetadata", () => {
  it("does not classify inline text body parts as attachments", () => {
    const structure: ImapBodyStructure = {
      type: "multipart/mixed",
      childNodes: [
        {
          part: "1",
          type: "multipart/alternative",
          childNodes: [
            {
              part: "1.1",
              type: "text/plain",
              disposition: "inline"
            },
            {
              part: "1.2",
              type: "text/html",
              disposition: "inline"
            }
          ]
        },
        {
          part: "2",
          type: "image/png",
          disposition: "inline",
          id: "<img-1@example.com>",
          size: 1024
        },
        {
          part: "3",
          type: "application/pdf",
          disposition: "attachment",
          dispositionParameters: { filename: "invoice.pdf" },
          size: 4096
        }
      ]
    };

    const result = extractMessageStructureMetadata(account, 123, structure);
    expect(result.plainTextPart).toBe("1.1");
    expect(result.htmlPart).toBe("1.2");
    expect(result.attachments.map((item) => item.contentType)).toEqual([
      "image/png",
      "application/pdf"
    ]);
    expect(result.attachments.map((item) => item.filename)).toEqual([
      "attachment-1",
      "invoice.pdf"
    ]);
  });

  it("still keeps real text attachments when they have filenames", () => {
    const structure: ImapBodyStructure = {
      type: "multipart/mixed",
      childNodes: [
        {
          part: "1",
          type: "text/plain",
          disposition: "inline"
        },
        {
          part: "2",
          type: "text/plain",
          disposition: "inline",
          dispositionParameters: { filename: "notes.txt" },
          size: 2048
        }
      ]
    };

    const result = extractMessageStructureMetadata(account, 124, structure);
    expect(result.plainTextPart).toBe("1");
    expect(result.attachments.map((item) => item.filename)).toEqual(["notes.txt"]);
    expect(result.attachments.map((item) => item.contentType)).toEqual(["text/plain"]);
  });

  it("preserves cid values with parentheses from imapflow bodystructure parsing", async () => {
    const cid = "E-Mail_Banner-Hoer-auf-dich(1)_bce67f06-2eb9-4fb5-b7a8-2659410eb50d.jpg";
    const filename = cid;
    const response =
      '* 1 FETCH (BODYSTRUCTURE (("TEXT" "HTML" ("CHARSET" "utf-8") NIL NIL "QUOTED-PRINTABLE" 123 4 NIL NIL NIL)("IMAGE" "JPEG" ("NAME" "' +
      filename +
      '") "<' +
      cid +
      '>" NIL "BASE64" 183229 NIL ("ATTACHMENT" ("FILENAME" "' +
      filename +
      '")) NIL NIL) "RELATED" NIL NIL NIL))';
    const parsed = await parser(Buffer.from(response));
    const formatted = await tools.formatMessageResponse(parsed, {
      uidNext: 0,
      highestModseq: null
    });

    expect(formatted.bodyStructure?.childNodes?.[1]?.id).toBe(`<${cid}>`);

    const result = extractMessageStructureMetadata(account, 125, formatted.bodyStructure as ImapBodyStructure);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]?.cid).toBe(cid);
    expect(result.attachments[0]?.filename).toBe(filename);
  });
});

describe("RFC 5322 ingestion-to-permission identity", () => {
  for (const entry of ingestedSenderCases) {
    for (const headerFallback of [false, true]) {
      it(`keeps the actual mailbox and rejects trusted permission: ${entry.name}, header fallback=${headerFallback}`, async () => {
        const message = await ingestSenderPermissionMessage(account, entry, '<img src="https://images.example.test/pixel">', headerFallback);
        expect(remoteContentSenderKey(message.from)).toBe(entry.key);
        expect(remoteContentSenderKey(message.from)).not.toBe("trusted@example.test");
        expect(senderAllowsRemoteContent({ remoteContent: { allowedSenders: { "trusted@example.test": true } } }, message.from)).toBe(false);
      });
    }
  }

  it("retains decoded envelope local-part characters and raw header quoting exactly", () => {
    for (const local of [' a  b ', 'a"b\\c', '"literal"', 'attacker <trusted@example.test>']) {
      const from = formatEnvelopeAddresses([{ name: "Synthetic", address: `${local}@example.test` }]);
      expect(from).toBe(`Synthetic <${JSON.stringify(local)}@example.test>`);
      expect(remoteContentSenderKey(from)).toBe(canonicalizeMailboxAddress(`${JSON.stringify(local)}@example.test`));
      expect(remoteContentSenderKey(from)).not.toBe("trusted@example.test");
    }
    expect(formatHeaderAddresses('" a  b "@example.test, Actual <"a\\\"b\\\\c"@example.test>')).toBe('" a  b "@example.test, Actual <"a\\\"b\\\\c"@example.test>');
    expect(formatEnvelopeAddresses([{ address: "invalid" }, { address: "trusted@example.test" }])).toBe("");
    expect(formatHeaderAddresses("attacker trusted@example.test")).toBe("");
  });

  it("never reads a body line as an address header when falling back to raw source", () => {
    for (const newline of ["\r\n", "\n"]) {
      const headers = parseHeaderMap(Buffer.from(["From: actual@example.test", "Reply-To: \"attacker trusted\"@example.test", "", "From: trusted@example.test"].join(newline)));
      expect(headers.get("from")).toEqual(["actual@example.test"]);
      expect(resolveMessageAddresses(undefined, headers, account.email).replyTo).toBe('"attacker trusted"@example.test');
    }
  });

  it("serializes every envelope address field with shared escaping and local-part quoting", () => {
    const address = { name: 'Attack " <trusted@example.test> "', address: "attacker trusted@example.test" };
    const resolved = resolveMessageAddresses({ from: [address], to: [address], cc: [address], bcc: [address] }, new Map(), account.email);
    for (const field of ["from", "to", "cc", "bcc"] as const) {
      expect(extractPrimaryEmail(resolved[field])).toBe('"attacker trusted"@example.test');
      expect(resolved[field]).toBe('"Attack \\" <trusted@example.test> \\"" <"attacker trusted"@example.test>');
    }
    expect(formatEnvelopeAddresses([{ mailbox: "attacker trusted", host: "example.test" }])).toBe('"attacker trusted"@example.test');
  });
});
