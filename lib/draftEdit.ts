import type { Message } from "@/lib/data";
import { DraftSaveError, htmlBodyText, resolveDraftBody, type DraftAttachmentInput, type SaveDraftInput } from "@/lib/drafts";
import { getFolders, getMessageById, listSenderIdentities } from "@/lib/serverDb";
import { findDraftsFolder } from "@/lib/specialFolders";
import { hasMessageFlag } from "@/lib/messageFlags";
import { hasHtmlContent } from "@/lib/messageContentState";
import { FORWARDED_MESSAGE_MARKERS, escapeHtml, extractQuotedHtmlFromDraft, isQuoteBoundaryText } from "@/lib/html";
import { extractComposeInviteDraftFromSource } from "@/lib/composeInviteMetadata";
import { getMessageSource } from "@/lib/storage";
import { readStoredAttachmentData } from "@/lib/mail/storedAttachmentData";
import { parseAddressEmails } from "@/lib/ownAddresses";
import { buildAccountAttachmentPath } from "@/lib/accountApiPaths";

export type DraftComposeFormat = "text" | "html" | "markdown";

/** A stored draft as an editing client sees it (attachment bytes are never returned). */
export type EditableDraft = {
  draftId: string;
  identityId: string | null;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  composeFormat: DraftComposeFormat;
  text: string;
  html: string | null;
  markdown: string | null;
  inReplyTo: string | null;
  references: string[];
  forwardedMessageId: string | null;
  attachments: Array<{ id: string; filename: string; contentType: string; size: number; inline: boolean }>;
  updatedAt: number;
};

/** Fields an edit may replace; omitted fields keep the stored draft's value. */
export type DraftUpdatePatch = {
  identityId?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  text?: string;
  markdown?: string;
  html?: string;
  composeFormat?: DraftComposeFormat;
  appendBody?: string;
};

type DraftBody = Pick<SaveDraftInput, "text" | "markdown" | "html" | "composeFormat" | "quotedHtmlEdited">;

/**
 * Only a real draft may be read or rewritten as one: the IMAP `\Draft` flag
 * (the same guard draft-send uses) and placement in the Drafts folder. Saving
 * replaces the stored message, so a received message must never qualify.
 */
export async function getStoredDraft(accountId: string, draftId: string): Promise<Message> {
  const message = await getMessageById(accountId, draftId);
  if (!message) throw new DraftSaveError(404, "Draft not found");
  const draftsFolder = findDraftsFolder(await getFolders(accountId), accountId);
  if (!draftsFolder || message.folderId !== draftsFolder.id || !hasMessageFlag(message.flags, "\\Draft")) {
    throw new DraftSaveError(400, `Message ${message.id} is not a draft. Only messages in the Drafts folder with the \\Draft flag can be read or edited as drafts.`);
  }
  return message;
}

/** Mirrors how compose reopens a saved draft (composeInitState). */
export function draftComposeFormat(message: Message): DraftComposeFormat {
  const format = message.xComposeFormat;
  if (format === "text" || format === "html" || format === "markdown") return format;
  return hasHtmlContent(message.htmlBody) ? "html" : "text";
}

export async function toEditableDraft(accountId: string, message: Message): Promise<EditableDraft> {
  const composeFormat = draftComposeFormat(message);
  const from = parseAddressEmails(message.from);
  const identityId = message.senderIdentityId ??
    (from.length === 1 ? (await listSenderIdentities(accountId)).find(item => item.accountId === accountId && item.email === from[0])?.id : undefined);
  return {
    draftId: message.id,
    identityId: identityId ?? null,
    from: message.from ?? "",
    to: message.to ?? "",
    cc: message.cc ?? "",
    bcc: message.bcc ?? "",
    subject: message.subject ?? "",
    composeFormat,
    text: message.body ?? "",
    html: message.htmlBody ?? null,
    markdown: composeFormat === "markdown" ? (message.body ?? "") : null,
    inReplyTo: message.inReplyTo ?? null,
    references: message.references ?? [],
    forwardedMessageId: message.xForwardedMessageId ?? null,
    attachments: (message.attachments ?? []).map(({ id, filename, contentType, size, inline }) => ({ id, filename, contentType, size, inline })),
    updatedAt: message.dateValue
  };
}

function appendParagraph(existing: string, addition: string) {
  const base = existing.replace(/\s+$/, "");
  return base ? `${base}\n\n${addition}` : addition;
}

const FORWARD_MARKER_LINES = new Set<string>(Object.values(FORWARDED_MESSAGE_MARKERS));

/**
 * Line index where the quoted original of a plain-text reply/forward starts, as
 * compose writes it (formatQuotedBody): a forward marker line, or the reply
 * header line directly above the trailing `>` block (or that block itself).
 * -1 when the text has no quote.
 */
function textQuoteStart(lines: string[]) {
  const forwardMarker = lines.findIndex(line => FORWARD_MARKER_LINES.has(line.trim()));
  if (forwardMarker !== -1) return forwardMarker;
  let end = lines.length;
  while (end > 0 && !lines[end - 1]!.trim()) end -= 1;
  let start = end;
  while (start > 0 && lines[start - 1]!.startsWith(">")) start -= 1;
  if (start === end) return -1;
  return start > 0 && isQuoteBoundaryText(lines[start - 1]!) ? start - 1 : start;
}

/** Text-format append: after the authored text, above a quoted original when there is one. */
function appendTextParagraph(text: string, addition: string) {
  const lines = text.split(/\r?\n/);
  const quoteStart = textQuoteStart(lines);
  if (quoteStart === -1) return appendParagraph(text, addition);
  const quote = lines.slice(quoteStart).join("\n");
  return `${appendParagraph(lines.slice(0, quoteStart).join("\n"), addition)}\n\n${quote}`;
}

function paragraphHtml(text: string) {
  return `<p>${escapeHtml(text).replace(/\r?\n/g, "<br>")}</p>`;
}

/** The stored body as compose would save it again, optionally with one paragraph appended. */
function storedBody(message: Message, appendBody?: string): DraftBody {
  const text = message.body ?? "";
  const quotedHtmlEdited = message.quotedHtmlEdited;
  // The quoted original is always the last part of the stored HTML (noctua-quoted-html marker).
  const { userHtml, quotedHtml } = extractQuotedHtmlFromDraft(message.htmlBody ?? "");
  const storedFormat = draftComposeFormat(message);
  // Markdown drafts saved without their source in text/plain can only be extended as HTML.
  const composeFormat = storedFormat === "markdown" && !text.trim() && hasHtmlContent(userHtml) ? "html" : storedFormat;
  if (composeFormat === "text") {
    return { composeFormat, text: appendBody === undefined ? text : appendTextParagraph(text, appendBody) };
  }
  if (composeFormat === "markdown") {
    // Markdown drafts keep their source in text/plain; the stored HTML is its rendering plus the quote.
    const markdown = appendBody === undefined ? text : appendParagraph(text, appendBody);
    return { composeFormat, text: markdown, markdown, html: quotedHtml || undefined, quotedHtmlEdited };
  }
  if (appendBody === undefined) return { composeFormat, text, html: message.htmlBody, quotedHtmlEdited };
  const html = `${userHtml}${paragraphHtml(appendBody)}${quotedHtml}`;
  return { composeFormat, text: htmlBodyText(html), html, quotedHtmlEdited };
}

/**
 * Saving rebuilds the MIME message, so every stored attachment travels along as
 * bytes. Inline images were rewritten to attachment URLs on store; point them
 * back at their Content-ID. A missing attachment fails the edit instead of
 * silently dropping it.
 */
async function storedAttachments(accountId: string, message: Message, html: string | undefined) {
  let nextHtml = html;
  const attachments: DraftAttachmentInput[] = [];
  for (const attachment of message.attachments ?? []) {
    const data = await readStoredAttachmentData(accountId, message.id, attachment);
    if (!data) {
      throw new DraftSaveError(409, `Attachment "${attachment.filename}" of this draft is not available locally. Open the draft in Noctua to edit it.`);
    }
    attachments.push({ filename: attachment.filename, contentType: attachment.contentType, inline: attachment.inline,
      cid: attachment.cid, dataUrl: `data:application/octet-stream;base64,${data.toString("base64")}` });
    if (nextHtml && attachment.inline && attachment.cid) {
      const url = attachment.url ?? buildAccountAttachmentPath(accountId, message.id, attachment.id);
      nextHtml = nextHtml.split(url).join(`cid:${attachment.cid}`);
    }
  }
  return { attachments, html: nextHtml };
}

/** SaveDraftInput that rewrites `message` in place with only the patched fields changed. */
export async function buildDraftUpdateInput(accountId: string, message: Message, patch: DraftUpdatePatch): Promise<SaveDraftInput> {
  const replacesBody = patch.text !== undefined || patch.html !== undefined || patch.markdown !== undefined;
  if (replacesBody && patch.appendBody !== undefined) {
    throw new DraftSaveError(400, 'Use either "appendBody" or "text"/"html"/"markdown", not both.');
  }
  if (patch.composeFormat !== undefined && !replacesBody) {
    throw new DraftSaveError(400, '"composeFormat" can only be changed together with "text", "html" or "markdown".');
  }
  if (!replacesBody && message.contentState === "missing") {
    throw new DraftSaveError(409, "The draft body is not available locally. Open the draft in Noctua once, or replace the whole body.");
  }
  const appendBody = patch.appendBody?.trim();
  if (patch.appendBody !== undefined && !appendBody) throw new DraftSaveError(400, '"appendBody" must not be empty.');
  const body: DraftBody = replacesBody ? resolveDraftBody(patch) : storedBody(message, appendBody);
  const { attachments, html } = await storedAttachments(accountId, message, body.html);
  const source = await getMessageSource(accountId, message.id);
  const invite = source ? extractComposeInviteDraftFromSource(source) : null;
  return {
    draftId: message.id,
    identityId: patch.identityId,
    to: patch.to?.trim() ?? message.to ?? "",
    cc: patch.cc?.trim() ?? message.cc ?? "",
    bcc: patch.bcc?.trim() ?? message.bcc ?? "",
    subject: patch.subject?.trim() ?? message.subject ?? "",
    ...body,
    html,
    inReplyTo: message.inReplyTo,
    references: message.references,
    xForwardedMessageId: message.xForwardedMessageId,
    ...(invite ? { invite } : {}),
    attachments
  };
}
