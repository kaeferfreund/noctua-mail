import { createRequire } from "node:module";
import type { ImapFlow } from "imapflow";
import type { Account } from "../data";
import { parseImapMessage } from "../mail/imap/sync";

const require = createRequire(import.meta.url);
const { parser } = require("imapflow/lib/handler/imap-handler");
const tools = require("imapflow/lib/tools");

export const ingestedSenderCases = [
  {
    name: "escaped display name from an IMAP envelope",
    from: '"Attack \\" <trusted@example.test> \\"" <actual@example.test>',
    displayName: 'Attack " <trusted@example.test> "',
    mailbox: "actual", key: "actual@example.test"
  },
  {
    name: "quoted local part from an IMAP envelope",
    from: '"attacker trusted"@example.test',
    displayName: "", mailbox: "attacker trusted", key: '"attacker trusted"@example.test'
  }
] as const;

// Real ImapFlow response parsing followed by the same MIME/envelope ingestion
// function used by syncImapMessage (Sent/drafts/copy/resync) and full sync.
// No socket is opened: these synthetic HTML-only messages need no downloads.
export async function ingestSenderPermissionMessage(
  account: Account, entry: typeof ingestedSenderCases[number], html: string, headerFallback = false
) {
  const id = `<${crypto.randomUUID()}@example.test>`;
  const response = `* 1 FETCH (UID 1 ENVELOPE (NIL "Synthetic privacy mail" ((${JSON.stringify(entry.displayName)} NIL ${JSON.stringify(entry.mailbox)} "example.test")) NIL NIL NIL NIL NIL NIL "${id}"))`;
  const parsed = await parser(Buffer.from(response));
  const item = await tools.formatMessageResponse(parsed, { uidNext: 2, highestModseq: null });
  return parseImapMessage(account, "INBOX", {
    ...item,
    envelope: headerFallback ? undefined : item.envelope,
    source: Buffer.from(`From: ${entry.from}\r\nTo: team@example.test\r\nMessage-ID: ${id}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}`)
  }, {} as ImapFlow);
}
