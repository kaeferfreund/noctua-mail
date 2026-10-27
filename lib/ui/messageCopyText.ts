import type { Message } from "@/lib/data";
import { stripHtmlToText } from "@/lib/html";
import { hasHtmlContent } from "@/lib/messageContentState";

export type MessageCopyLabels = { from: string; to: string; cc: string; date: string; subject: string; attachments: string };

/**
 * „Inhalt kopieren“: the headers a reader sees (Cc only when set), a blank line,
 * the text body (HTML-only mail as plain text), then the attachment names.
 */
export function buildMessageCopyText(
  message: Pick<Message, "from" | "to" | "cc" | "subject" | "body" | "htmlBody" | "attachments">,
  options: { labels: MessageCopyLabels; date: string }
) {
  const { labels } = options;
  const headers = [
    `${labels.from}: ${message.from}`,
    `${labels.to}: ${message.to}`,
    ...(message.cc?.trim() ? [`${labels.cc}: ${message.cc}`] : []),
    `${labels.date}: ${options.date}`,
    `${labels.subject}: ${message.subject}`
  ];
  const body = message.body?.trim() ? message.body.replace(/\r\n?/g, "\n").trim()
    // Block tags leave a space at the start of the next line.
    : hasHtmlContent(message.htmlBody) ? stripHtmlToText(message.htmlBody!).replace(/^[ \t]+/gm, "") : "";
  const attachments = (message.attachments ?? []).filter(attachment => !attachment.inline).map(attachment => `- ${attachment.filename}`);
  return [headers.join("\n"), body, ...(attachments.length ? [`${labels.attachments}:\n${attachments.join("\n")}`] : [])]
    .filter(Boolean).join("\n\n");
}
